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
const imageFileInput = document.getElementById('imageFileInput');
const deleteItemBtn = document.getElementById('deleteItemBtn');

// Estrellas
const ratingArea = document.getElementById('ratingArea');
const starsContainer = document.getElementById('starsContainer');
const ratingInfo = document.getElementById('ratingInfo');

// Ubicación modal
const locationModal = document.getElementById('locationModal');
const locationSearchInput = document.getElementById('locationSearchInput');
const locationSuggestions = document.getElementById('locationSuggestions');
const cancelLocationBtn = document.getElementById('cancelLocationBtn');

// Filtros
const filterRating = document.getElementById('filterRating');
const filterDistance = document.getElementById('filterDistance');
let currentSort = 'rating'; // 'rating' o 'distance'

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

function updateStarsDisplay(itemData) {
  const ratings = itemData.ratings || {};
  const myRating = ratings[currentUser] || 0;
  starsContainer.textContent = renderStars(myRating);
  ratingInfo.textContent = myRating > 0 ? `Tu puntuación: ${myRating}/5` : 'Puntúa este restaurante';
  // Guardar referencia en el elemento para manejar clicks
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
    // Actualizar la lista de items para reflejar el cambio
    loadItems(currentType);
    // Actualizar visualización local
    updateStarsDisplay(data);
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
  // Mostrar u ocultar filtros
  filtersBar.style.display = (type === 'restaurante') ? 'flex' : 'none';
  try {
    const res = await fetch(`/api/items?type=${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error('Error al cargar');
    items = await res.json();
    // Para restaurantes, calcular distancia y añadir a cada item
    if (type === 'restaurante' && userPosition) {
      // Obtener subitems de ubicación para cada item (necesitamos las coordenadas)
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
  // Clonar para no modificar original
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
      // Estrellas
      const ratings = item.data?.ratings || {};
      const values = Object.values(ratings);
      const avg = values.length ? (values.reduce((s, v) => s + v, 0) / values.length) : 0;
      const stars = avg > 0 ? `⭐ ${avg.toFixed(1)}` : 'Sin puntuar';
      // Distancia
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

  // Mostrar/ocultar área de estrellas
  if (item.type === 'restaurante') {
    ratingArea.style.display = 'block';
    updateStarsDisplay(item.data || {});
    // Event listener para estrellas
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

  // Ocultar modal de ubicación si estaba abierto
  locationModal.style.display = 'none';

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
    let icon = '';
    if (sub.type === 'note') {
      icon = '📝';
      contentHtml = escapeHtml(sub.content);
    } else if (sub.type === 'link') {
      icon = '🔗';
      const meta = sub.metadata || {};
      if (meta.title) {
        contentHtml = `
          <div class="link-preview">
            ${meta.image ? `<img src="${escapeHtml(meta.image)}" alt="" class="preview-img">` : ''}
            <div class="preview-content">
              <div class="preview-title">${escapeHtml(meta.title)}</div>
              ${meta.description ? `<div class="preview-desc">${escapeHtml(meta.description)}</div>` : ''}
              <div class="preview-url"><a href="${escapeHtml(sub.content)}" target="_blank">🔗</a></div>
            </div>
          </div>
        `;
      } else {
        contentHtml = `<a href="${escapeHtml(sub.content)}" target="_blank">${escapeHtml(sub.content)}</a>`;
      }
    } else if (sub.type === 'image') {
      icon = '🖼️';
      contentHtml = `<img src="${escapeHtml(sub.content)}" alt="Imagen" loading="lazy">`;
    } else if (sub.type === 'location') {
      icon = '📍';
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
        <div class="sub-icon">${icon}</div>
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
        // Recargar items para actualizar distancias si era ubicación
        loadItems(currentType);
      } catch (error) {
        alert('Error al eliminar');
      }
    });
  });
}

// Cerrar modal
closeModalBtn.addEventListener('click', () => {
  itemModal.classList.remove('active');
  currentItemId = null;
  locationModal.style.display = 'none';
});
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) {
    itemModal.classList.remove('active');
    currentItemId = null;
    locationModal.style.display = 'none';
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

// Enlace
addLinkBtn.addEventListener('click', async () => {
  const url = prompt('URL del enlace:');
  if (url === null) return;
  if (!url.trim()) return alert('La URL no puede estar vacía');
  try {
    const previewRes = await fetch(`/api/preview?url=${encodeURIComponent(url.trim())}`);
    const preview = await previewRes.json();
    const metadata = {
      title: preview.title || url.trim(),
      description: preview.description || '',
      image: preview.image || ''
    };
    const res = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'link', content: url.trim(), metadata })
    });
    if (!res.ok) throw new Error('Error al añadir enlace');
    await loadSubitems(currentItemId);
  } catch (error) {
    alert('Error al añadir enlace: ' + error.message);
  }
});

// Imagen
addImageBtn.addEventListener('click', () => {
  imageFileInput.click();
});

imageFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
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
    await loadSubitems(currentItemId);
    imageFileInput.value = '';
  } catch (error) {
    alert('Error: ' + error.message);
    imageFileInput.value = '';
  }
});

// ===== Ubicación con autocompletado =====
let locationSearchTimeout = null;

addLocationBtn.addEventListener('click', () => {
  locationModal.style.display = 'block';
  locationSearchInput.value = '';
  locationSuggestions.innerHTML = '';
  locationSearchInput.focus();
});

cancelLocationBtn.addEventListener('click', () => {
  locationModal.style.display = 'none';
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
    locationModal.style.display = 'none';
    await loadSubitems(currentItemId);
    loadItems(currentType); // Actualizar distancias en la lista
  } catch (error) {
    alert('Error al añadir ubicación: ' + error.message);
  }
}

// ========== Inicialización ==========
checkSession();
