// Modal editor for a hike: title, status, difficulty, description, internet
// images and own images.

import { escapeHtml } from './ui.js';

export class EditorDialog {
  constructor({ dialog, onChange }) {
    this.dialog = dialog;
    this.onChange = onChange; // (action, payload) => Promise|void
    this.hike = null;
    this.webImages = [];
    this.ownImages = [];
    this.objectUrls = [];

    this.titleInput = dialog.querySelector('#edit-title');
    this.statusSelect = dialog.querySelector('#edit-status');
    this.difficultySelect = dialog.querySelector('#edit-difficulty');
    this.descriptionInput = dialog.querySelector('#edit-description');
    this.webContainer = dialog.querySelector('#edit-web-images');
    this.ownContainer = dialog.querySelector('#edit-own-images');
    this.aiButton = dialog.querySelector('#edit-ai-btn');
    this.searchButton = dialog.querySelector('#edit-images-search');
    this.uploadButton = dialog.querySelector('#edit-images-upload-btn');
    this.uploadInput = dialog.querySelector('#edit-images-input');

    dialog.querySelector('#editor-close').addEventListener('click', () => this.close());
    dialog.querySelector('#editor-cancel').addEventListener('click', () => this.close());
    dialog.querySelector('#editor-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.onChange('save', this.values());
    });
    dialog.querySelector('#editor-delete').addEventListener('click', () => {
      if (this.hike) this.onChange('delete', { id: this.hike.id });
    });
    this.aiButton.addEventListener('click', () => this.onChange('generate-description', { id: this.hike?.id }));
    this.searchButton.addEventListener('click', () => this.onChange('search-images', { id: this.hike?.id }));
    this.uploadButton.addEventListener('click', () => this.uploadInput.click());
    this.uploadInput.addEventListener('change', () => {
      if (this.uploadInput.files?.length) {
        this.onChange('add-own-images', { id: this.hike?.id, files: this.uploadInput.files });
      }
      this.uploadInput.value = '';
    });

    this.webContainer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-web]');
      if (!button) return;
      this.webImages.splice(Number(button.dataset.removeWeb), 1);
      this.renderWebImages();
    });
    this.ownContainer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-own]');
      if (!button) return;
      this.onChange('remove-own-image', { id: button.dataset.removeOwn });
    });
  }

  values() {
    return {
      id: this.hike?.id,
      title: this.titleInput.value.trim() || 'Wanderung',
      status: this.statusSelect.value,
      difficulty: Number(this.difficultySelect.value),
      description: this.descriptionInput.value.trim(),
      webImages: this.webImages,
    };
  }

  releaseUrls() {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
  }

  open(hike, ownImages = []) {
    this.hike = hike;
    this.webImages = [...(hike.webImages || [])];
    this.titleInput.value = hike.title || '';
    this.statusSelect.value = hike.status || 'planned';
    this.difficultySelect.value = String(hike.difficulty || 1);
    this.descriptionInput.value = hike.description || '';
    this.renderWebImages();
    this.setOwnImages(ownImages);
    this.setBusy(false);
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
  }

  close() {
    this.releaseUrls();
    if (typeof this.dialog.close === 'function') this.dialog.close();
    else this.dialog.removeAttribute('open');
    this.hike = null;
  }

  setBusy(busy, label = '') {
    this.aiButton.disabled = busy;
    this.searchButton.disabled = busy;
    this.aiButton.textContent = busy ? `… ${label}` : '✨ Beschreibung mit KI erstellen';
  }

  setDescription(text) {
    this.descriptionInput.value = text;
  }

  setWebImages(images) {
    this.webImages = [...(images || [])];
    this.renderWebImages();
  }

  renderWebImages() {
    if (!this.webImages.length) {
      this.webContainer.innerHTML = '<p class="muted">Noch keine Internetbilder.</p>';
      return;
    }
    this.webContainer.innerHTML = this.webImages
      .map(
        (image, index) => `<div class="image-tile">
          <img src="${escapeHtml(image.thumbUrl || image.url)}" alt="${escapeHtml(image.title || 'Bild')}" loading="lazy" />
          <button class="image-remove" type="button" data-remove-web="${index}" title="Bild entfernen">✕</button>
        </div>`,
      )
      .join('');
  }

  setOwnImages(images) {
    this.releaseUrls();
    this.ownImages = images || [];
    if (!this.ownImages.length) {
      this.ownContainer.innerHTML = '<p class="muted">Noch keine eigenen Bilder.</p>';
      return;
    }
    this.ownContainer.innerHTML = this.ownImages
      .map((image) => {
        const url = URL.createObjectURL(image.blob);
        this.objectUrls.push(url);
        return `<div class="image-tile">
          <img src="${url}" alt="${escapeHtml(image.name)}" loading="lazy" />
          <button class="image-remove" type="button" data-remove-own="${image.id}" title="Bild löschen">✕</button>
        </div>`;
      })
      .join('');
  }
}