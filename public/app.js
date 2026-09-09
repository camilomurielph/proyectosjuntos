// Estado global
let currentUser = null;
let currentType = 'mudanza';
let items = [];
let currentItemId = null;
let currentItemType = null;
let subitems = [];
let userPosition = null;

// Elementos del DOM
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const itemsList = document.getElementById('itemsList');
const bottomNav = document.getElementById('bottomNav');
const fab = document.getElementById('fab');
const filtersBar = document.getElementById('filtersBar');

const itemModal = document.getElementById('itemModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');

const viewTitle = document.getElementById('viewTitle');
const editTitleBtn = document.getElementById('editTitleBtn');
const saveTitleBtn = document.getElementById('saveTitleBtn');
const cancelTitleBtn = document.getElementById('cancelTitleBtn');
const editItemTitle = document.getElementById('editItemTitle');
const viewDesc = document.getElementById('viewDesc');
const editDescBtn = document.getElementById('editDescBtn');
const saveDescBtn = document.getElementById('saveDescBtn');
const cancelDescBtn = document.getElementById('cancelDescBtn');
const editItemDesc = document.getElementById('editItemDesc');
const subitemsList = document.getElementById('subitemsList');
const addNoteBtn = document.getElementById('addNoteBtn');
const addLinkBtn = document.getElementById('addLinkBtn');
const addImageBtn = document.getElementById('addImageBtn');
const addLocationBtn = document.getElementById('addLocationBtn');
const deleteItemBtn = document.getElementById('deleteItemBtn');

// Estrellas
const ratingArea = document.getElementById('ratingArea');
const ratingsDisplay = document.getElementById('ratingsDisplay');
const starsContainer = document.getElementById('starsContainer');
const ratingInfo = document.getElementById('ratingInfo');

// Link modal (independiente)
const linkModal = document.getElementById('linkModal');
const closeLinkModalBtn = document.getElementById('closeLinkModalBtn');
const linkUrlInput = document.getElementById('linkUrlInput');
const linkNameInput = document.getElementById('linkNameInput');
const linkConfirmBtn = document.getElementById('linkConfirmBtn');
const linkCancelBtn = document.getElementById('linkCancelBtn');

// Ubicación modal (independiente)
const locationModal = document.getElementById('locationModal');
const closeLocationModalBtn = document.getElementById('closeLocationModalBtn');
const locationSearchInput = document.getElementById('locationSearchInput');
const locationSuggestions = document.getElementById('locationSuggestions');
const locationCancelBtn = document.getElementById('locationCancelBtn');

// Crop modal
const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const closeCropBtn = document.getElementById('closeCropBtn');
const cropConfirmBtn = document.getElementById('cropConfirmBtn');
const cropCancelBtn = document.getElementById('cropCancelBtn');

// Filtros
const filterRating = document.getElementById('filterRating');
const filterDistance = document.getElementById('filterDistance');
let currentSort = 'rating';

// ========== Utilidades ==========
function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function deg2rad(deg) { return deg * (Math.PI / 180); }

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getUserPosition() {
  return new Promise((resolve) => {
    if (userPosition) { resolve(userPosition); return; }
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(userPosition);
      },
      () => { resolve(null); },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  });
}

// ========== Estrellas ==========
function renderStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function updateRatingsDisplay(itemData) {
  const ratings = itemData?.ratings || {};
  const entries = Object.entries(ratings);
  if (entries.length === 0) {
    ratingsDisplay.innerHTML = '<span style="color:#888;">Sin puntuaciones aún</span>';
  } else {
    ratingsDisplay.innerHTML = entries.map(([user, rating]) => `
      <div class="rating-item">
        <span class="username">${escapeHtml(user)}</span>
        <span class="stars">${renderStars(rating)}</span>
      </div>
    `).join('');
  }
  // Actualizar mi puntuación
  const myRating = ratings[currentUser] || 0;
  starsContainer.textContent = renderStars(myRating);
  ratingInfo.textContent = myRating > 0 ? `Tu puntuación: ${myRating}/5` : 'Puntúa este restaurante';
  starsContainer.dataset.currentRating = myRating;
}

async function saveRating(rating) {
  if (!currentItemId || currentItemType !== 'restaurante') return;
  const item = items.find(i => i.id === currentItemId);
  if (!item) return;
  const data = item.data || {};
  if (!data.ratings) data.ratings = {};
  data.ratings[currentUser] = rating;
  try {
    const res = await fetch(`/api/items/${currentItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: viewTitle.textContent,
        description: viewDesc.textContent === 'Sin descripción' ? '' : viewDesc.textContent,
        data: data
      })
    });
    if (!res.ok) throw new Error('Error al guardar puntuación');
    loadItems(currentType);
    updateRatingsDisplay(data);
  } catch (error) {
    alert('Error al guardar puntuación');
  }
}

// ========== Autenticación ==========
async function checkSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.username;
      showScreen(mainScreen);
      loadItems(currentType);
      getUserPosition();
      return true;
    } else {
      showScreen(loginScreen);
      return false;
    }
  } catch {
    showScreen(loginScreen);
    return false;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  loginError.textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data.username;
      showScreen(mainScreen);
      loadItems(currentType);
      getUserPosition();
    } else {
      loginError.textContent = data.error || 'Credenciales incorrectas';
    }
  } catch {
    loginError.textContent = 'Error de conexión';
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  showScreen(loginScreen);
});

// ========== Carga de items ==========
async function loadItems(type) {
  currentType = type;
  filtersBar.style.display = (type === 'restaurante') ? 'flex' : 'none';
  try {
    const res = await fetch(`/api/items?type=${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error('Error al cargar');
    items = await res.json();
    if (type === 'restaurante' && userPosition) {
      for (let item of items) {
        const subRes = await fetch(`/api/items/${item.id}/subitems`);
        if (subRes.ok) {
          const subs = await subRes.json();
          const locationSub = subs.find(s => s.type === 'location');
          if (locationSub && locationSub.metadata && locationSub.metadata.lat) {
            const dist = getDistanceFromLatLonInKm(
              userPosition.lat, userPosition.lng,
              locationSub.metadata.lat, locationSub.metadata.lng
            );
            item.distance = dist;
          }
        }
      }
    }
    renderItemsWithSort(items, currentSort);
  } catch (error) {
    itemsList.innerHTML = `<p class="error-msg">Error al cargar los items</p>`;
  }
}

function renderItemsWithSort(itemsData, sortBy) {
  let sorted = [...itemsData];
  if (currentType === 'restaurante') {
    if (sortBy === 'rating') {
      sorted.sort((a, b) => {
        const aRatings = a.data?.ratings || {};
        const bRatings = b.data?.ratings || {};
        const aAvg = Object.values(aRatings).reduce((s, v) => s + v, 0) / (Object.keys(aRatings).length || 1);
        const bAvg = Object.values(bRatings).reduce((s, v) => s + v, 0) / (Object.keys(bRatings).length || 1);
        return bAvg - aAvg;
      });
    } else if (sortBy === 'distance') {
      sorted.sort((a, b) => {
        const aDist = a.distance !== undefined ? a.distance : Infinity;
        const bDist = b.distance !== undefined ? b.distance : Infinity;
        return aDist - bDist;
      });
    }
  }
  renderItems(sorted);
}

function renderItems(itemsData) {
  if (itemsData.length === 0) {
    itemsList.innerHTML = `<p class="empty-msg">No hay items. ¡Agrega uno!</p>`;
    return;
  }
  let html = '';
  itemsData.forEach(item => {
    const isRestaurant = (item.type === 'restaurante');
    let metaHtml = '';
    if (isRestaurant) {
      const ratings = item.data?.ratings || {};
      const values = Object.values(ratings);
      const avg = values.length ? (values.reduce((s, v) => s + v, 0) / values.length) : 0;
      const stars = avg > 0 ? `⭐ ${avg.toFixed(1)}` : 'Sin puntuar';
      let distHtml = '';
      if (item.distance !== undefined && item.distance !== Infinity) {
        distHtml = `📍 ${item.distance.toFixed(1)} km`;
      } else {
        distHtml = '📍 Sin ubicación';
      }
      metaHtml = `<div class="item-meta">
        <span class="stars">${stars}</span>
        <span class="distance">${distHtml}</span>
        <span class="date">${formatDate(item.created_at)}</span>
      </div>`;
    } else {
      metaHtml = `<div class="item-meta">
        <span class="date">${formatDate(item.created_at)}</span>
      </div>`;
    }
    const summary = item.description || '';
    html += `
      <div class="item-card" data-id="${item.id}">
        <h4>${escapeHtml(item.title)}</h4>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
        ${metaHtml}
      </div>
    `;
  });
  itemsList.innerHTML = html;
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const item = items.find(i => i.id === id);
      if (item) openBoard(item);
    });
  });
}

// ========== Navegación y filtros ==========
bottomNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const type = btn.dataset.type;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadItems(type);
});

filterRating.addEventListener('click', () => {
  filterRating.classList.add('active');
  filterDistance.classList.remove('active');
  currentSort = 'rating';
  renderItemsWithSort(items, currentSort);
});
filterDistance.addEventListener('click', () => {
  filterDistance.classList.add('active');
  filterRating.classList.remove('active');
  currentSort = 'distance';
  renderItemsWithSort(items, currentSort);
});

fab.addEventListener('click', async () => {
  const title = prompt('Título del nuevo item:');
  if (!title) return;
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentType,
        title: title,
        description: '',
        data: {}
      })
    });
    if (!res.ok) throw new Error('Error al crear');
    loadItems(currentType);
  } catch (error) {
    alert('Error al crear el item');
  }
});

// ========== Tablero ==========
async function openBoard(item) {
  currentItemId = item.id;
  currentItemType = item.type;
  modalTitle.textContent = 'Tablero';
  viewTitle.textContent = item.title;
  viewDesc.textContent = item.description || 'Sin descripción';
  document.querySelector('.item-title-area').style.display = 'flex';
  document.querySelector('.item-title-edit').style.display = 'none';
  document.querySelector('.item-desc-area').style.display = 'flex';
  document.querySelector('.item-desc-edit').style.display = 'none';

  if (item.type === 'restaurante') {
    ratingArea.style.display = 'block';
    updateRatingsDisplay(item.data || {});
    starsContainer.onclick = function(e) {
      const rect = this.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const starWidth = rect.width / 5;
      const rating = Math.min(5, Math.max(1, Math.ceil(clickX / starWidth)));
      saveRating(rating);
    };
  } else {
    ratingArea.style.display = 'none';
  }

  // Mostrar/ocultar botón de ubicación
  if (item.type === 'restaurante' || item.type === 'cita') {
    addLocationBtn.style.display = 'inline-block';
  } else {
    addLocationBtn.style.display = 'none';
  }

  // Cerrar modales secundarios
  locationModal.classList.remove('active');
  linkModal.classList.remove('active');
  cropModal.classList.remove('active');

  await loadSubitems(item.id);
  itemModal.classList.add('active');
}

async function loadSubitems(itemId) {
  try {
    const res = await fetch(`/api/items/${itemId}/subitems`);
    if (!res.ok) throw new Error('Error al cargar subitems');
    subitems = await res.json();
    renderSubitems(subitems);
  } catch (error) {
    subitemsList.innerHTML = `<p class="error-msg">Error al cargar</p>`;
  }
}

function renderSubitems(subitemsData) {
  if (subitemsData.length === 0) {
    subitemsList.innerHTML = `<p class="empty-msg">No hay anotaciones aún. Añade una.</p>`;
    return;
  }
  let html = '';
  subitemsData.forEach(sub => {
    let contentHtml = '';
    if (sub.type === 'note') {
      contentHtml = escapeHtml(sub.content);
    } else if (sub.type === 'link') {
      const meta = sub.metadata || {};
      const name = meta.name || sub.content;
      const url = meta.url || sub.content;
      contentHtml = `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(name)}</a>`;
    } else if (sub.type === 'image') {
      contentHtml = `<img src="${escapeHtml(sub.content)}" alt="Imagen" loading="lazy">`;
    } else if (sub.type === 'location') {
      const meta = sub.metadata || {};
      const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${meta.lng-0.01},${meta.lat-0.01},${meta.lng+0.01},${meta.lat+0.01}&layer=mapnik&marker=${meta.lat},${meta.lng}`;
      let distanceHtml = '';
      if (userPosition && meta.lat && meta.lng) {
        const dist = getDistanceFromLatLonInKm(userPosition.lat, userPosition.lng, meta.lat, meta.lng);
        distanceHtml = `<div class="distance">📍 ${dist.toFixed(1)} km</div>`;
      } else {
        if (!userPosition) {
          getUserPosition().then(() => {
            if (currentItemId) loadSubitems(currentItemId);
          });
        }
      }
      contentHtml = `
        <div class="location-card">
          <div class="map-container">
            <iframe src="${mapUrl}" width="100%" height="100%" style="border:0;" allowfullscreen loading="lazy"></iframe>
          </div>
          <div class="location-address">${escapeHtml(sub.content)}</div>
          ${meta.display_name ? `<div class="location-name">${escapeHtml(meta.display_name)}</div>` : ''}
          ${distanceHtml}
        </div>
      `;
    }
    html += `
      <div class="subitem-card" data-id="${sub.id}">
        <div class="sub-content">${contentHtml}</div>
        <button class="sub-delete" data-id="${sub.id}">✕</button>
      </div>
    `;
  });
  subitemsList.innerHTML = html;
  document.querySelectorAll('.sub-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (!confirm('¿Eliminar este subitem?')) return;
      try {
        const res = await fetch(`/api/subitems/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await loadSubitems(currentItemId);
        loadItems(currentType);
      } catch (error) {
        alert('Error al eliminar');
      }
    });
  });
}

// Cerrar modal principal
closeModalBtn.addEventListener('click', () => {
  itemModal.classList.remove('active');
  currentItemId = null;
  locationModal.classList.remove('active');
  linkModal.classList.remove('active');
  cropModal.classList.remove('active');
});
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) {
    itemModal.classList.remove('active');
    currentItemId = null;
    locationModal.classList.remove('active');
    linkModal.classList.remove('active');
    cropModal.classList.remove('active');
  }
});

// ========== Editar título y descripción ==========
editTitleBtn.addEventListener('click', () => {
  document.querySelector('.item-title-area').style.display = 'none';
  document.querySelector('.item-title-edit').style.display = 'flex';
  editItemTitle.value = viewTitle.textContent;
});
cancelTitleBtn.addEventListener('click', () => {
  document.querySelector('.item-title-area').style.display = 'flex';
  document.querySelector('.item-title-edit').style.display = 'none';
});
saveTitleBtn.addEventListener('click', async () => {
  const newTitle = editItemTitle.value.trim();
  if (!newTitle) return;
  try {
    const res = await fetch(`/api/items/${currentItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: viewDesc.textContent === 'Sin descripción' ? '' : viewDesc.textContent,
        data: items.find(i => i.id === currentItemId)?.data || {}
      })
    });
    if (!res.ok) throw new Error('Error al actualizar');
    viewTitle.textContent = newTitle;
    document.querySelector('.item-title-area').style.display = 'flex';
    document.querySelector('.item-title-edit').style.display = 'none';
    loadItems(currentType);
  } catch (error) {
    alert('Error al guardar título');
  }
});

editDescBtn.addEventListener('click', () => {
  document.querySelector('.item-desc-area').style.display = 'none';
  document.querySelector('.item-desc-edit').style.display = 'flex';
  editItemDesc.value = viewDesc.textContent === 'Sin descripción' ? '' : viewDesc.textContent;
});
cancelDescBtn.addEventListener('click', () => {
  document.querySelector('.item-desc-area').style.display = 'flex';
  document.querySelector('.item-desc-edit').style.display = 'none';
});
saveDescBtn.addEventListener('click', async () => {
  const newDesc = editItemDesc.value.trim();
  try {
    const res = await fetch(`/api/items/${currentItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: viewTitle.textContent,
        description: newDesc,
        data: items.find(i => i.id === currentItemId)?.data || {}
      })
    });
    if (!res.ok) throw new Error('Error al actualizar');
    viewDesc.textContent = newDesc || 'Sin descripción';
    document.querySelector('.item-desc-area').style.display = 'flex';
    document.querySelector('.item-desc-edit').style.display = 'none';
    loadItems(currentType);
  } catch (error) {
    alert('Error al guardar descripción');
  }
});

// ========== Eliminar item ==========
deleteItemBtn.addEventListener('click', async () => {
  if (!confirm('¿Eliminar este item y todos sus subitems?')) return;
  try {
    const res = await fetch(`/api/items/${currentItemId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');
    itemModal.classList.remove('active');
    currentItemId = null;
    loadItems(currentType);
  } catch (error) {
    alert('Error al eliminar');
  }
});

// ========== Añadir subitems ==========
// Nota
addNoteBtn.addEventListener('click', async () => {
  const content = prompt('Escribe tu nota:');
  if (content === null) return;
  if (!content.trim()) return alert('La nota no puede estar vacía');
  try {
    const res = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', content: content.trim(), metadata: {} })
    });
    if (!res.ok) throw new Error('Error al añadir nota');
    await loadSubitems(currentItemId);
  } catch (error) {
    alert('Error al añadir nota');
  }
});

// Enlace (modal independiente)
addLinkBtn.addEventListener('click', () => {
  linkModal.classList.add('active');
  linkUrlInput.value = '';
  linkNameInput.value = '';
  linkUrlInput.focus();
});

function closeLinkModal() {
  linkModal.classList.remove('active');
}

closeLinkModalBtn.addEventListener('click', closeLinkModal);
linkCancelBtn.addEventListener('click', closeLinkModal);
linkModal.addEventListener('click', (e) => {
  if (e.target === linkModal) closeLinkModal();
});

linkConfirmBtn.addEventListener('click', async () => {
  const url = linkUrlInput.value.trim();
  const name = linkNameInput.value.trim();
  if (!url) return alert('La URL es obligatoria');
  if (!name) return alert('El nombre es obligatorio');
  try {
    const metadata = { name: name, url: url };
    const res = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'link', content: url, metadata })
    });
    if (!res.ok) throw new Error('Error al añadir enlace');
    closeLinkModal();
    await loadSubitems(currentItemId);
  } catch (error) {
    alert('Error al añadir enlace: ' + error.message);
  }
});

// ===== Recorte de imagen con redimensionamiento =====
let cropImageFile = null;
let cropImageDataUrl = null;
let cropRect = { x: 0, y: 0, size: 200 };
let isDragging = false;
let isResizing = false;
let dragStartX, dragStartY, dragStartSize;
let cropCanvasWidth = 0, cropCanvasHeight = 0;

addImageBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      cropImageDataUrl = ev.target.result;
      cropImageFile = file;
      openCropModal();
    };
    reader.readAsDataURL(file);
  };
  input.click();
});

function openCropModal() {
  cropModal.classList.add('active');
  const img = new Image();
  img.onload = () => {
    const canvas = cropCanvas;
    const ctx = canvas.getContext('2d');
    const modalContent = cropModal.querySelector('.modal-content');
    const maxWidth = modalContent.clientWidth - 40;
    const maxHeight = window.innerHeight * 0.6;
    let width = img.width;
    let height = img.height;
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = height * ratio;
    }
    if (height > maxHeight) {
      const ratio = maxHeight / height;
      height = maxHeight;
      width = width * ratio;
    }
    canvas.width = width;
    canvas.height = height;
    cropCanvasWidth = width;
    cropCanvasHeight = height;
    ctx.drawImage(img, 0, 0, width, height);
    const size = Math.min(width, height) * 0.6;
    cropRect = {
      x: (width - size) / 2,
      y: (height - size) / 2,
      size: size
    };
    const slider = document.getElementById('cropSizeSlider');
    if (slider) {
      const percent = (size / Math.min(width, height)) * 100;
      slider.value = Math.min(100, Math.max(20, percent));
    }
    drawCrop();
  };
  img.src = cropImageDataUrl;
}

function drawCrop() {
  const canvas = cropCanvas;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, cropRect.y);
    ctx.fillRect(0, cropRect.y + cropRect.size, canvas.width, canvas.height - cropRect.y - cropRect.size);
    ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.size);
    ctx.fillRect(cropRect.x + cropRect.size, cropRect.y, canvas.width - cropRect.x - cropRect.size, cropRect.size);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.size, cropRect.size);
    const handleSize = 8;
    const corners = [
      [cropRect.x, cropRect.y],
      [cropRect.x + cropRect.size - handleSize, cropRect.y],
      [cropRect.x, cropRect.y + cropRect.size - handleSize],
      [cropRect.x + cropRect.size - handleSize, cropRect.y + cropRect.size - handleSize]
    ];
    ctx.fillStyle = '#fff';
    corners.forEach(([cx, cy]) => {
      ctx.fillRect(cx, cy, handleSize, handleSize);
    });
  };
  img.src = cropImageDataUrl;
}

function getMousePos(e) {
  const rect = cropCanvas.getBoundingClientRect();
  const scaleX = cropCanvas.width / rect.width;
  const scaleY = cropCanvas.height / rect.height;
  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function isOnCorner(pos) {
  const handleSize = 12;
  const corners = [
    [cropRect.x, cropRect.y],
    [cropRect.x + cropRect.size, cropRect.y],
    [cropRect.x, cropRect.y + cropRect.size],
    [cropRect.x + cropRect.size, cropRect.y + cropRect.size]
  ];
  for (let i = 0; i < corners.length; i++) {
    const [cx, cy] = corners[i];
    if (pos.x >= cx - handleSize/2 && pos.x <= cx + handleSize/2 &&
        pos.y >= cy - handleSize/2 && pos.y <= cy + handleSize/2) {
      return i;
    }
  }
  return -1;
}

function isInsideRect(pos) {
  return pos.x >= cropRect.x && pos.x <= cropRect.x + cropRect.size &&
         pos.y >= cropRect.y && pos.y <= cropRect.y + cropRect.size;
}

function handleStart(e) {
  e.preventDefault();
  const pos = getMousePos(e);
  const corner = isOnCorner(pos);
  if (corner !== -1) {
    isResizing = true;
    dragStartX = pos.x;
    dragStartY = pos.y;
    dragStartSize = cropRect.size;
    cropRect._corner = corner;
    return;
  }
  if (isInsideRect(pos)) {
    isDragging = true;
    dragStartX = pos.x - cropRect.x;
    dragStartY = pos.y - cropRect.y;
  }
}

function handleMove(e) {
  e.preventDefault();
  const pos = getMousePos(e);
  if (isResizing) {
    const corner = cropRect._corner;
    let newSize = cropRect.size;
    let newX = cropRect.x;
    let newY = cropRect.y;
    if (corner === 0) {
      const dx = cropRect.x + cropRect.size - pos.x;
      const dy = cropRect.y + cropRect.size - pos.y;
      newSize = Math.min(dx, dy);
      newSize = Math.max(20, newSize);
      newX = cropRect.x + cropRect.size - newSize;
      newY = cropRect.y + cropRect.size - newSize;
    } else if (corner === 1) {
      const dx = pos.x - cropRect.x;
      const dy = cropRect.y + cropRect.size - pos.y;
      newSize = Math.min(dx, dy);
      newSize = Math.max(20, newSize);
      newX = cropRect.x;
      newY = cropRect.y + cropRect.size - newSize;
    } else if (corner === 2) {
      const dx = cropRect.x + cropRect.size - pos.x;
      const dy = pos.y - cropRect.y;
      newSize = Math.min(dx, dy);
      newSize = Math.max(20, newSize);
      newX = cropRect.x + cropRect.size - newSize;
      newY = cropRect.y;
    } else if (corner === 3) {
      const dx = pos.x - cropRect.x;
      const dy = pos.y - cropRect.y;
      newSize = Math.min(dx, dy);
      newSize = Math.max(20, newSize);
      newX = cropRect.x;
      newY = cropRect.y;
    }
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + newSize > cropCanvasWidth) newSize = cropCanvasWidth - newX;
    if (newY + newSize > cropCanvasHeight) newSize = cropCanvasHeight - newY;
    cropRect.x = newX;
    cropRect.y = newY;
    cropRect.size = newSize;
    const slider = document.getElementById('cropSizeSlider');
    if (slider) {
      const percent = (newSize / Math.min(cropCanvasWidth, cropCanvasHeight)) * 100;
      slider.value = Math.min(100, Math.max(20, percent));
    }
    drawCrop();
    return;
  }
  if (isDragging) {
    let newX = pos.x - dragStartX;
    let newY = pos.y - dragStartY;
    newX = Math.max(0, Math.min(cropCanvasWidth - cropRect.size, newX));
    newY = Math.max(0, Math.min(cropCanvasHeight - cropRect.size, newY));
    cropRect.x = newX;
    cropRect.y = newY;
    drawCrop();
  }
}

function handleEnd(e) {
  isDragging = false;
  isResizing = false;
  cropCanvas.style.cursor = 'default';
}

cropCanvas.addEventListener('mousedown', handleStart);
cropCanvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('mousemove', handleMove);
window.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('mouseup', handleEnd);
window.addEventListener('touchend', handleEnd);
window.addEventListener('touchcancel', handleEnd);

// Control deslizante para el tamaño del cuadrado
let sliderExists = document.getElementById('cropSizeSlider');
if (!sliderExists) {
  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range';
  sizeSlider.id = 'cropSizeSlider';
  sizeSlider.min = 20;
  sizeSlider.max = 100;
  sizeSlider.value = 60;
  sizeSlider.style.width = '100%';
  sizeSlider.style.marginTop = '0.5rem';
  sizeSlider.style.background = '#333';
  sizeSlider.style.accentColor = '#bb86fc';
  const cropControls = document.querySelector('#cropModal .modal-content');
  const confirmBtn = document.getElementById('cropConfirmBtn');
  cropControls.insertBefore(sizeSlider, confirmBtn);

  sizeSlider.addEventListener('input', () => {
    const percent = parseInt(sizeSlider.value) / 100;
    const maxSize = Math.min(cropCanvasWidth, cropCanvasHeight);
    const newSize = maxSize * percent;
    cropRect.x = (cropCanvasWidth - newSize) / 2;
    cropRect.y = (cropCanvasHeight - newSize) / 2;
    cropRect.size = newSize;
    drawCrop();
  });
}

cropConfirmBtn.addEventListener('click', async () => {
  const canvas = cropCanvas;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.size, cropRect.size);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropRect.size;
  tempCanvas.height = cropRect.size;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(imageData, 0, 0);
  const croppedDataUrl = tempCanvas.toDataURL('image/webp', 0.9);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: croppedDataUrl })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al subir imagen');
    }
    const data = await res.json();
    const subRes = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'image', content: data.url, metadata: {} })
    });
    if (!subRes.ok) throw new Error('Error al guardar imagen');
    cropModal.classList.remove('active');
    await loadSubitems(currentItemId);
  } catch (error) {
    alert('Error: ' + error.message);
  }
});

cropCancelBtn.addEventListener('click', () => {
  cropModal.classList.remove('active');
});
closeCropBtn.addEventListener('click', () => {
  cropModal.classList.remove('active');
});

// ===== Ubicación con autocompletado (modal independiente) =====
let locationSearchTimeout = null;

// Asegurar que el botón existe y tiene un listener
if (addLocationBtn) {
  addLocationBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    locationModal.classList.add('active');
    locationSearchInput.value = '';
    locationSuggestions.innerHTML = '';
    setTimeout(() => locationSearchInput.focus(), 100);
  });
} else {
  console.warn('Botón de ubicación no encontrado en el DOM');
}

function closeLocationModal() {
  locationModal.classList.remove('active');
}

closeLocationModalBtn.addEventListener('click', closeLocationModal);
locationCancelBtn.addEventListener('click', closeLocationModal);
locationModal.addEventListener('click', (e) => {
  if (e.target === locationModal) closeLocationModal();
});

locationSearchInput.addEventListener('input', async () => {
  const query = locationSearchInput.value.trim();
  if (query.length < 2) {
    locationSuggestions.innerHTML = '';
    return;
  }
  clearTimeout(locationSearchTimeout);
  locationSearchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search-places?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Error en búsqueda');
      const data = await res.json();
      locationSuggestions.innerHTML = data.map(item => `
        <div class="suggestion-item" style="padding:0.5rem; background:#333; margin-bottom:0.2rem; cursor:pointer; border-radius:0px;">
          ${escapeHtml(item.label)}
        </div>
      `).join('');
      document.querySelectorAll('.suggestion-item').forEach((el, index) => {
        el.addEventListener('click', () => {
          const selected = data[index];
          addLocation(selected.label, selected.lat, selected.lng, selected.display_name);
        });
      });
    } catch (error) {
      console.error(error);
    }
  }, 300);
});

async function addLocation(address, lat, lng, displayName) {
  try {
    const metadata = { lat, lng, display_name: displayName || address };
    const res = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'location', content: address, metadata })
    });
    if (!res.ok) throw new Error('Error al guardar ubicación');
    closeLocationModal();
    await loadSubitems(currentItemId);
    loadItems(currentType);
  } catch (error) {
    alert('Error al añadir ubicación: ' + error.message);
  }
}

// ========== Inicialización ==========
checkSession();
