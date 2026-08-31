// Estado global
let currentUser = null;
let currentType = 'mudanza';
let items = [];
let currentItemId = null; // para el tablero
let subitems = [];

// Elementos del DOM
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const itemsList = document.getElementById('itemsList');
const bottomNav = document.getElementById('bottomNav');
const fab = document.getElementById('fab');

const itemModal = document.getElementById('itemModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');

// Elementos del tablero
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
const imageFileInput = document.getElementById('imageFileInput');
const deleteItemBtn = document.getElementById('deleteItemBtn');

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

// ========== Autenticación ==========
async function checkSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.username;
      showScreen(mainScreen);
      loadItems(currentType);
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
  try {
    const res = await fetch(`/api/items?type=${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error('Error al cargar');
    items = await res.json();
    renderItems(items);
  } catch (error) {
    itemsList.innerHTML = `<p class="error-msg">Error al cargar los items</p>`;
  }
}

function renderItems(itemsData) {
  if (itemsData.length === 0) {
    itemsList.innerHTML = `<p class="empty-msg">No hay items. ¡Agrega uno!</p>`;
    return;
  }
  let html = '';
  itemsData.forEach(item => {
    const data = item.data || {};
    const summary = item.description || data.cuisine || data.location || '';
    html += `
      <div class="item-card" data-id="${item.id}">
        <h4>${escapeHtml(item.title)}</h4>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
        <div class="meta">${formatDate(item.created_at)}</div>
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

// ========== Navegación por tabs ==========
bottomNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const type = btn.dataset.type;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadItems(type);
});

// ========== Botón flotante (agregar item) ==========
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
  modalTitle.textContent = 'Tablero';
  // Mostrar título y descripción
  viewTitle.textContent = item.title;
  viewDesc.textContent = item.description || 'Sin descripción';
  // Ocultar editores
  document.querySelector('.item-title-area').style.display = 'flex';
  document.querySelector('.item-title-edit').style.display = 'none';
  document.querySelector('.item-desc-area').style.display = 'flex';
  document.querySelector('.item-desc-edit').style.display = 'none';
  // Cargar subitems
  await loadSubitems(item.id);
  // Mostrar modal
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
      contentHtml = `<a href="${escapeHtml(sub.content)}" target="_blank">${escapeHtml(sub.content)}</a>`;
    } else if (sub.type === 'image') {
      contentHtml = `<img src="${escapeHtml(sub.content)}" alt="Imagen" loading="lazy">`;
    }
    const icon = sub.type === 'note' ? '📝' : sub.type === 'link' ? '🔗' : '🖼️';
    html += `
      <div class="subitem-card" data-id="${sub.id}">
        <div class="sub-icon">${icon}</div>
        <div class="sub-content">
          ${contentHtml}
          <div class="sub-meta">${formatDate(sub.created_at)}</div>
        </div>
        <button class="sub-delete" data-id="${sub.id}">✕</button>
      </div>
    `;
  });
  subitemsList.innerHTML = html;
  // Eventos para eliminar subitems
  document.querySelectorAll('.sub-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (!confirm('¿Eliminar este subitem?')) return;
      try {
        const res = await fetch(`/api/subitems/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await loadSubitems(currentItemId);
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
});
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) {
    itemModal.classList.remove('active');
    currentItemId = null;
  }
});

// ========== Editar título y descripción del item ==========
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
        data: {}
      })
    });
    if (!res.ok) throw new Error('Error al actualizar');
    viewTitle.textContent = newTitle;
    document.querySelector('.item-title-area').style.display = 'flex';
    document.querySelector('.item-title-edit').style.display = 'none';
    // Actualizar lista de items
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
        data: {}
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
  const content = prompt('URL del enlace:');
  if (content === null) return;
  if (!content.trim()) return alert('La URL no puede estar vacía');
  // Validación simple
  try {
    new URL(content.trim());
  } catch {
    alert('URL inválida');
    return;
  }
  try {
    const res = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'link', content: content.trim(), metadata: {} })
    });
    if (!res.ok) throw new Error('Error al añadir enlace');
    await loadSubitems(currentItemId);
  } catch (error) {
    alert('Error al añadir enlace');
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
    // Crear subitem de tipo imagen con la URL
    const subRes = await fetch(`/api/items/${currentItemId}/subitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'image', content: data.url, metadata: {} })
    });
    if (!subRes.ok) throw new Error('Error al guardar imagen');
    await loadSubitems(currentItemId);
    imageFileInput.value = ''; // limpiar
  } catch (error) {
    alert('Error: ' + error.message);
    imageFileInput.value = '';
  }
});

// ========== Inicialización ==========
checkSession();
