// Wanderlisi V2.0 — application controller.
// Wires the store, GPX pipeline, map, detail view and editor together.

import { HikeStore, emptyHike } from './store.js';
import { buildHikeFromGpx, formatDuration } from './gpx.js';
import { downsample, simplify, centroid } from './geo.js';
import { HikeMap } from './map.js';
import { DetailView } from './detail.js';
import { EditorDialog } from './editor.js';
import { ImageSearchService } from './services/images.js';
import { DescriptionService, getAiEndpoint, setAiEndpoint } from './services/description.js';
import { difficultyInfo } from './difficulty.js';
import { toast, escapeHtml, download, slugify } from './ui.js';

const store = new HikeStore();
const images = new ImageSearchService();
const descriptions = new DescriptionService();

const state = {
  hikes: [],
  points: new Map(),
  statusFilter: 'all',
  query: '',
  selectedId: null,
  pendingFit: false,
  enriching: new Set(),
};

let map;
let detail;
let editor;

// ---------------------------------------------------------------- bootstrap

function refs() {
  return {
    list: document.getElementById('hike-list'),
    count: document.getElementById('hike-count'),
    empty: document.getElementById('empty-state'),
    listPanel: document.getElementById('list-panel'),
    detailPanel: document.getElementById('detail-panel'),
  };
}

async function boot() {
  map = new HikeMap('map', { onSelect: (id) => selectHike(id, { fit: false }) });
  detail = new DetailView({
    panel: document.getElementById('detail-panel'),
    content: document.getElementById('detail-content'),
    onAction: handleDetailAction,
  });
  editor = new EditorDialog({
    dialog: document.getElementById('editor-dialog'),
    onChange: handleEditorAction,
  });

  bindChrome();
  await loadAll();
  applyRoute();
}

async function loadAll() {
  await store.init();
  state.hikes = await store.list();
  state.points = new Map();
  const summaries = await store.allGpxSummaries();
  for (const summary of summaries) {
    if (Array.isArray(summary.points)) state.points.set(summary.id, summary.points);
  }
  refreshMap();
  renderList();
}

function refreshMap() {
  map.setHikes(
    state.hikes
      .filter((hike) => state.points.has(hike.id))
      .map((hike) => ({ ...hike, points: state.points.get(hike.id) })),
  );
}

// ------------------------------------------------------------------- chrome

function bindChrome() {
  const { listPanel } = refs();
  document.getElementById('menu-toggle').addEventListener('click', () => {
    listPanel.classList.toggle('open');
  });
  document.getElementById('list-close').addEventListener('click', () => {
    listPanel.classList.remove('open');
  });
  document.getElementById('detail-close').addEventListener('click', () => {
    location.hash = '#/';
  });
  document.getElementById('fit-btn').addEventListener('click', () => map.fitAll());
  document.getElementById('new-btn').addEventListener('click', () => {
    document.getElementById('gpx-input').click();
  });
  document.getElementById('gpx-input').addEventListener('change', (event) => {
    if (event.target.files?.length) importFiles(event.target.files);
    event.target.value = '';
  });

  for (const button of document.querySelectorAll('#status-filter button')) {
    button.addEventListener('click', () => {
      state.statusFilter = button.dataset.status;
      for (const sibling of document.querySelectorAll('#status-filter button')) {
        sibling.classList.toggle('active', sibling === button);
      }
      renderList();
    });
  }

  document.getElementById('search-input').addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });

  // settings
  const settingsDialog = document.getElementById('settings-dialog');
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-ai-endpoint').value = getAiEndpoint();
    settingsDialog.showModal();
  });
  document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());
  settingsDialog.querySelector('form').addEventListener('submit', () => {
    setAiEndpoint(document.getElementById('settings-ai-endpoint').value.trim());
    toast('Einstellungen gespeichert', { type: 'success' });
  });

  // drag & drop GPX
  const overlay = document.getElementById('drop-overlay');
  let dragDepth = 0;
  window.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    overlay.classList.add('visible');
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.classList.remove('visible');
  });
  window.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    overlay.classList.remove('visible');
    if (event.dataTransfer?.files?.length) importFiles(event.dataTransfer.files);
  });

  window.addEventListener('hashchange', applyRoute);
  window.addEventListener('resize', () => map.invalidateSize());
}

// -------------------------------------------------------------------- list

function filteredHikes() {
  return state.hikes.filter((hike) => {
    if (state.statusFilter !== 'all' && hike.status !== state.statusFilter) return false;
    if (state.query && !hike.title.toLowerCase().includes(state.query)) return false;
    return true;
  });
}

function renderList() {
  const { list, count, empty } = refs();
  const hikes = filteredHikes();
  count.textContent = String(state.hikes.length);

  if (!hikes.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.querySelector('p').textContent = state.hikes.length
      ? 'Keine Wanderung passt zum Filter.'
      : 'Noch keine Wanderungen.';
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = hikes
    .map((hike) => {
      const stats = hike.stats || {};
      const difficulty = difficultyInfo(hike.difficulty || 1);
      const enriching = state.enriching.has(hike.id) ? ' · aktualisiert…' : '';
      return `<article class="hike-card ${hike.id === state.selectedId ? 'selected' : ''}" data-id="${hike.id}">
        <div class="hike-card-top">
          <span class="status-dot ${hike.status === 'done' ? 'done' : 'planned'}"></span>
          <span class="hike-card-title">${escapeHtml(hike.title)}</span>
        </div>
        <div class="hike-card-meta">
          <span>${stats.distanceKm ?? '–'} km</span>
          <span>+${stats.ascentM ?? 0} m</span>
          <span>${formatDuration(stats.durationMin)}</span>
          <span style="color:${difficulty.color}">${difficulty.level}</span>
          <span>${hike.status === 'done' ? 'gemacht' : 'geplant'}${enriching}</span>
        </div>
      </article>`;
    })
    .join('');

  for (const card of list.querySelectorAll('.hike-card')) {
    card.addEventListener('click', () => selectHike(card.dataset.id, { fit: true }));
  }
}

// ------------------------------------------------------------------ routing

function selectHike(id, { fit = true } = {}) {
  state.pendingFit = fit;
  const hash = `#/hike/${id}`;
  if (location.hash === hash) showDetail(id, { fit });
  else location.hash = hash;
}

function applyRoute() {
  const match = location.hash.match(/^#\/hike\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (state.hikes.some((hike) => hike.id === id)) {
      showDetail(id, { fit: state.pendingFit });
      return;
    }
  }
  state.pendingFit = false;
  hideDetail();
}

function hideDetail() {
  state.selectedId = null;
  detail.hide();
  map.highlight(null);
  renderList();
}

async function showDetail(id, { fit = false } = {}) {
  const hike = state.hikes.find((h) => h.id === id);
  if (!hike) return;
  state.selectedId = id;
  map.highlight(id);
  if (fit) map.fitHike(id);
  refs().listPanel.classList.remove('open');

  const ownImages = await store.listImages(id).catch(() => []);
  if (state.selectedId !== id) return;
  detail.show(hike, { points: state.points.get(id) || [], ownImages });
  renderList();
}

// ------------------------------------------------------------------ import

async function importFiles(fileList) {
  const files = Array.from(fileList).filter((file) => /\.gpx$/i.test(file.name));
  if (!files.length) {
    toast('Keine GPX-Datei gefunden.', { type: 'error' });
    return;
  }

  const created = [];
  for (const file of files) {
    try {
      const xml = await file.text();
      const built = buildHikeFromGpx(xml, file.name);
      const hike = emptyHike({
        title: built.title,
        difficulty: built.difficulty,
        difficultySource: built.difficultySource,
        stats: built.stats,
      });
      await store.save(hike);
      const points = downsample(simplify(built.points, 6), 600);
      await store.saveGpx(hike.id, { raw: xml, points, sourcePoints: built.points.length });
      created.push(hike);
    } catch (error) {
      toast(`${file.name}: ${error.message}`, { type: 'error', duration: 5000 });
    }
  }

  if (!created.length) return;
  await loadAll();
  toast(
    created.length === 1 ? `«${created[0].title}» importiert` : `${created.length} Wanderungen importiert`,
    { type: 'success' },
  );

  // Enrich asynchronously so the UI stays responsive.
  for (const hike of created) enrichHike(hike.id);
  if (created.length) selectHike(created[0].id, { fit: true });
}

async function enrichHike(id) {
  const hike = state.hikes.find((h) => h.id === id);
  if (!hike || state.enriching.has(id)) return;
  state.enriching.add(id);
  renderList();

  const pointList = state.points.get(id) || [];
  const context = { title: hike.title, centroid: centroid(pointList), count: 4 };

  if (!hike.description) {
    try {
      const result = await descriptions.generate(hike);
      hike.description = result.text;
    } catch {
      /* keep empty */
    }
  }
  try {
    const found = await images.search(context);
    if (found.length) hike.webImages = found;
  } catch {
    /* keep empty */
  }

  await store.save(hike);
  state.enriching.delete(id);
  renderList();
  if (state.selectedId === id) showDetail(id, { fit: false });
}

// ---------------------------------------------------------------- actions

async function handleDetailAction(action, id, extra) {
  const hike = state.hikes.find((h) => h.id === id);
  switch (action) {
    case 'fit':
      map.fitHike(id);
      map.highlight(id);
      break;
    case 'edit': {
      const hikeToEdit = state.hikes.find((h) => h.id === id);
      if (!hikeToEdit) return;
      const ownImages = await store.listImages(id).catch(() => []);
      editor.open(hikeToEdit, ownImages);
      break;
    }
    case 'download': {
      const record = await store.getGpx(id);
      if (record?.raw) download(`${slugify(hike?.title || 'wanderung')}.gpx`, record.raw);
      else toast('Keine GPX-Daten vorhanden.', { type: 'error' });
      break;
    }
    case 'delete':
      await deleteHike(id);
      break;
    case 'generate-description':
      await generateDescription(id);
      break;
    case 'search-images':
      await searchImages(id);
      break;
    case 'add-own-images':
      await store.addImages(id, extra);
      toast('Bilder hinzugefügt', { type: 'success' });
      if (state.selectedId === id) showDetail(id, { fit: false });
      break;
    case 'remove-own-image':
      await store.removeImage(id);
      if (state.selectedId) showDetail(state.selectedId, { fit: false });
      break;
    default:
      break;
  }
}

async function handleEditorAction(action, payload) {
  switch (action) {
    case 'save': {
      const hike = state.hikes.find((h) => h.id === payload.id);
      if (!hike) return;
      Object.assign(hike, {
        title: payload.title,
        status: payload.status,
        difficulty: payload.difficulty,
        difficultySource: hike.difficultySource === 'sac_scale' ? 'sac_scale' : 'manual',
        description: payload.description,
        webImages: payload.webImages,
      });
      await store.save(hike);
      editor.close();
      refreshMap();
      renderList();
      if (state.selectedId === hike.id) showDetail(hike.id, { fit: false });
      toast('Gespeichert', { type: 'success' });
      break;
    }
    case 'delete':
      await deleteHike(payload.id);
      editor.close();
      break;
    case 'generate-description': {
      editor.setBusy(true, 'Beschreibung…');
      try {
        const result = await generateDescription(payload.id, { silent: true });
        if (result) editor.setDescription(result);
      } finally {
        editor.setBusy(false);
      }
      break;
    }
    case 'search-images': {
      editor.setBusy(true, 'Bilder…');
      try {
        const found = await searchImages(payload.id, { silent: true });
        if (found) editor.setWebImages(found);
      } finally {
        editor.setBusy(false);
      }
      break;
    }
    case 'add-own-images': {
      await store.addImages(payload.id, payload.files);
      editor.setOwnImages(await store.listImages(payload.id).catch(() => []));
      break;
    }
    case 'remove-own-image':
      await store.removeImage(payload.id);
      if (editor.hike) editor.setOwnImages(await store.listImages(editor.hike.id).catch(() => []));
      break;
    default:
      break;
  }
}

async function generateDescription(id, { silent = false } = {}) {
  const hike = state.hikes.find((h) => h.id === id);
  if (!hike) return null;
  if (!silent) toast('Beschreibung wird erstellt…');
  const result = await descriptions.generate(hike);
  hike.description = result.text;
  await store.save(hike);
  renderList();
  if (state.selectedId === id) showDetail(id, { fit: false });
  if (!silent) toast(`Beschreibung erstellt (${result.provider})`, { type: 'success' });
  return result.text;
}

async function searchImages(id, { silent = false } = {}) {
  const hike = state.hikes.find((h) => h.id === id);
  if (!hike) return null;
  if (!silent) toast('Bilder werden gesucht…');
  const found = await images.search({
    title: hike.title,
    centroid: centroid(state.points.get(id) || []),
    count: 4,
  });
  if (found.length) {
    hike.webImages = found;
    await store.save(hike);
    renderList();
    if (state.selectedId === id) showDetail(id, { fit: false });
    if (!silent) toast(`${found.length} Bilder gefunden`, { type: 'success' });
  } else if (!silent) {
    toast('Keine Bilder gefunden.', { type: 'error' });
  }
  return found;
}

async function deleteHike(id) {
  const hike = state.hikes.find((h) => h.id === id);
  const label = hike ? `«${hike.title}»` : 'diese Wanderung';
  if (!window.confirm(`${label} wirklich löschen?`)) return;
  await store.remove(id);
  state.points.delete(id);
  await loadAll();
  if (state.selectedId === id) location.hash = '#/';
  toast('Wanderung gelöscht');
}

// Untracked helper kept for parity with older links.
window.addEventListener('DOMContentLoaded', () => {
  boot().catch((error) => {
    console.error(error);
    toast(`Start fehlgeschlagen: ${error.message}`, { type: 'error', duration: 6000 });
  });
});