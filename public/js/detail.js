// Detail view for a single hike. Pure rendering + delegated events; all data
// loading and persistence is handled by the app controller.

import { escapeHtml } from './ui.js';
import { formatDuration } from './gpx.js';
import { difficultyInfo } from './difficulty.js';
import { renderProfile } from './profile.js';

export class DetailView {
  constructor({ panel, content, onAction }) {
    this.panel = panel;
    this.content = content;
    this.onAction = onAction;
    this.objectUrls = [];

    this.content.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const { action, id } = target.dataset;
      this.onAction(action, id);
    });

    this.content.addEventListener('change', (event) => {
      const input = event.target.closest('[data-action="add-own-images"]');
      if (input && input.files?.length) {
        this.onAction('add-own-images', this.currentId, input.files);
        input.value = '';
      }
    });
  }

  releaseUrls() {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
  }

  hide() {
    this.panel.classList.remove('open');
    this.releaseUrls();
    this.currentId = null;
  }

  show(hike, { points = [], ownImages = [], busy = false } = {}) {
    this.releaseUrls();
    this.currentId = hike.id;
    this.panel.classList.add('open');

    const difficulty = difficultyInfo(hike.difficulty || 1);
    const stats = hike.stats || {};
    const statusLabel = hike.status === 'done' ? 'Gemacht' : 'Noch nicht gemacht';
    const statusClass = hike.status === 'done' ? 'done' : 'planned';

    const webImageTiles = (hike.webImages || [])
      .map((image, index) => {
        const credit = escapeHtml(image.author || image.source || '');
        const link = image.link || image.url;
        return `<a class="image-tile" href="${escapeHtml(link)}" target="_blank" rel="noopener" title="${escapeHtml(image.title || '')}">
          <img src="${escapeHtml(image.thumbUrl || image.url)}" alt="${escapeHtml(image.title || 'Internetbild')}" loading="lazy" />
          ${credit ? `<span class="image-credit">${credit}</span>` : ''}
        </a>`;
      })
      .join('');

    const ownImageTiles = ownImages
      .map((image) => {
        const url = URL.createObjectURL(image.blob);
        this.objectUrls.push(url);
        return `<div class="image-tile">
          <img src="${url}" alt="${escapeHtml(image.name)}" loading="lazy" />
          <button class="image-remove" data-action="remove-own-image" data-id="${image.id}" title="Bild löschen" type="button">✕</button>
        </div>`;
      })
      .join('');

    this.content.innerHTML = `
      <div class="detail-head">
        <h1>${escapeHtml(hike.title)}</h1>
        <div class="pill-row">
          <span class="pill ${statusClass}">${statusLabel}</span>
          <span class="pill" style="border-color:${difficulty.color};color:${difficulty.color}">
            ${difficulty.level} · ${escapeHtml(difficulty.label)}
          </span>
          ${hike.difficultySource === 'estimated' ? '<span class="pill">geschätzt</span>' : ''}
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat"><div class="stat-label">Dauer</div><div class="stat-value">${formatDuration(stats.durationMin)}</div></div>
        <div class="stat"><div class="stat-label">Distanz</div><div class="stat-value">${stats.distanceKm ?? '–'} km</div></div>
        <div class="stat"><div class="stat-label">Aufstieg</div><div class="stat-value">+${stats.ascentM ?? 0} m</div></div>
        <div class="stat"><div class="stat-label">Abstieg</div><div class="stat-value">−${stats.descentM ?? 0} m</div></div>
        <div class="stat"><div class="stat-label">Höchster Punkt</div><div class="stat-value">${stats.maxEle ?? '–'} m</div></div>
        <div class="stat"><div class="stat-label">Tiefster Punkt</div><div class="stat-value">${stats.minEle ?? '–'} m</div></div>
      </div>

      <div class="detail-section">
        <h3>Beschreibung</h3>
        <p>${hike.description ? escapeHtml(hike.description) : 'Noch keine Beschreibung vorhanden.'}</p>
        <div class="detail-actions" style="margin-top:8px">
          <button class="ghost-btn" data-action="generate-description" data-id="${hike.id}" ${busy ? 'disabled' : ''}>
            ✨ Beschreibung mit KI erstellen
          </button>
        </div>
      </div>

      <div class="detail-section">
        <h3>Höhenprofil</h3>
        <div class="profile-container" id="detail-profile"></div>
      </div>

      <div class="detail-section">
        <h3>Internetbilder</h3>
        ${webImageTiles ? `<div class="image-grid">${webImageTiles}</div>` : '<p class="muted">Noch keine Bilder gefunden.</p>'}
        <div class="detail-actions" style="margin-top:8px">
          <button class="ghost-btn" data-action="search-images" data-id="${hike.id}">🔍 Bilder suchen</button>
        </div>
      </div>

      <div class="detail-section">
        <h3>Eigene Bilder</h3>
        ${ownImageTiles ? `<div class="image-grid">${ownImageTiles}</div>` : '<p class="muted">Noch keine eigenen Bilder hochgeladen.</p>'}
        <div class="detail-actions" style="margin-top:8px">
          <label class="ghost-btn" style="cursor:pointer">
            Bilder hochladen
            <input type="file" accept="image/*" multiple hidden data-action="add-own-images" data-id="${hike.id}" />
          </label>
        </div>
      </div>

      <div class="detail-section detail-actions">
        <button class="ghost-btn" data-action="fit" data-id="${hike.id}">Auf Karte zeigen</button>
        <button class="ghost-btn" data-action="edit" data-id="${hike.id}">Bearbeiten</button>
        <button class="ghost-btn" data-action="download" data-id="${hike.id}">GPX herunterladen</button>
        <button class="danger-btn" data-action="delete" data-id="${hike.id}">Löschen</button>
      </div>
    `;

    const profileHost = this.content.querySelector('#detail-profile');
    if (profileHost) renderProfile(profileHost, points);
  }
}