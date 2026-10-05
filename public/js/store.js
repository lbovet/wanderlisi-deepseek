// Persistence layer for the MVP.
//
// Simple metadata lives in localStorage; larger payloads (raw GPX + parsed
// points, uploaded images) live in IndexedDB. The whole module is intentionally
// behind one tiny interface so it can later be swapped for a PHP/JSON backend:
// implement the same methods on a `RemoteHikeStore` and inject it instead.

const META_KEY = 'wanderlisi.hikes.v2';
const DB_NAME = 'wanderlisi';
const DB_VERSION = 1;
const GPX_STORE = 'gpx';
const IMAGE_STORE = 'images';

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyHike(fields = {}) {
  const now = Date.now();
  return {
    id: newId(),
    title: 'Neue Wanderung',
    status: 'planned', // 'planned' | 'done'
    description: '',
    stats: null,
    difficulty: 1,
    difficultySource: 'estimated',
    webImages: [],
    imageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

function openDatabase(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GPX_STORE)) {
        db.createObjectStore(GPX_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
        store.createIndex('hikeId', 'hikeId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class HikeStore {
  constructor({ storage = globalThis.localStorage, idbFactory = globalThis.indexedDB } = {}) {
    this.storage = storage;
    this.idbFactory = idbFactory;
    this.dbPromise = null;
  }

  async init() {
    if (this.dbPromise) return this.dbPromise;
    if (!this.idbFactory) {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }
    this.dbPromise = openDatabase(this.idbFactory);
    return this.dbPromise;
  }

  readMeta() {
    try {
      const raw = this.storage.getItem(META_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  writeMeta(hikes) {
    this.storage.setItem(META_KEY, JSON.stringify(hikes));
  }

  /** Serialize read-modify-write operations so concurrent saves cannot clobber each other. */
  withLock(task) {
    const run = (this.lock || Promise.resolve()).then(task, task);
    this.lock = run.catch(() => {});
    return run;
  }

  async list() {
    return this.readMeta().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async get(id) {
    return this.readMeta().find((h) => h.id === id) || null;
  }

  async save(hike) {
    return this.withLock(() => {
      const hikes = this.readMeta();
      const index = hikes.findIndex((h) => h.id === hike.id);
      const record = { ...hike, updatedAt: Date.now() };
      if (index === -1) hikes.push(record);
      else hikes[index] = record;
      this.writeMeta(hikes);
      return record;
    });
  }

  async remove(id) {
    await this.withLock(() => {
      this.writeMeta(this.readMeta().filter((h) => h.id !== id));
    });
    await this.init();
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await new Promise((resolve, reject) => {
      const tx = db.transaction([GPX_STORE, IMAGE_STORE], 'readwrite');
      tx.objectStore(GPX_STORE).delete(id);
      const images = tx.objectStore(IMAGE_STORE).index('hikeId').getAllKeys(id);
      images.onsuccess = () => {
        for (const key of images.result) tx.objectStore(IMAGE_STORE).delete(key);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- GPX payload ---------------------------------------------------------

  async saveGpx(id, payload) {
    await this.init();
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    const tx = db.transaction(GPX_STORE, 'readwrite');
    tx.objectStore(GPX_STORE).put({ id, ...payload });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async getGpx(id) {
    await this.init();
    if (!this.dbPromise) return null;
    const db = await this.dbPromise;
    const tx = db.transaction(GPX_STORE, 'readonly');
    return promisify(tx.objectStore(GPX_STORE).get(id));
  }

  async allGpxSummaries() {
    await this.init();
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    const tx = db.transaction(GPX_STORE, 'readonly');
    const records = await promisify(tx.objectStore(GPX_STORE).getAll());
    return records.map(({ id, points }) => ({ id, points }));
  }

  // --- Images --------------------------------------------------------------

  async addImages(hikeId, files) {
    await this.init();
    if (!this.dbPromise || !files || !files.length) return [];
    const db = await this.dbPromise;
    const stored = [];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE);
      for (const file of files) {
        const record = {
          id: newId(),
          hikeId,
          name: file.name || 'Bild',
          type: file.type || 'image/*',
          blob: file,
          createdAt: Date.now(),
        };
        stored.push(record);
        store.put(record);
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const hike = await this.get(hikeId);
    if (hike) {
      hike.imageCount = (hike.imageCount || 0) + stored.length;
      await this.save(hike);
    }
    return stored;
  }

  async listImages(hikeId) {
    await this.init();
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    const records = await promisify(tx.objectStore(IMAGE_STORE).index('hikeId').getAll(hikeId));
    return records.sort((a, b) => a.createdAt - b.createdAt);
  }

  async removeImage(id) {
    await this.init();
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    const image = await promisify(
      db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).get(id),
    );
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite');
      tx.objectStore(IMAGE_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    if (image?.hikeId) {
      const hike = await this.get(image.hikeId);
      if (hike) {
        hike.imageCount = Math.max(0, (hike.imageCount || 1) - 1);
        await this.save(hike);
      }
    }
  }
}