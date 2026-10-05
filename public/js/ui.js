// Small DOM / UX helpers shared across the app.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

let toastContainer = null;
let toastTimer = null;

export function toast(message, { type = 'info', duration = 3200 } = {}) {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
  }
  if (!toastContainer) return;
  toastContainer.innerHTML = `<div class="toast toast-${type}">${escapeHtml(message)}</div>`;
  toastContainer.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastContainer.classList.remove('visible'), duration);
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function download(filename, content, mime = 'application/gpx+xml') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value) {
  return String(value || 'wanderung')
    .toLowerCase()
    .replace(/[äàáâ]/g, 'a')
    .replace(/[öòóô]/g, 'o')
    .replace(/[üùúû]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}