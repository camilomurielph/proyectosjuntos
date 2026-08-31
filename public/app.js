// Estado global
let currentUser = null;
let currentType = 'mudanza';
let items = [];
let editingItem = null; // para el modal

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
const itemForm = document.getElementById('itemForm');
const modalTitle = document.getElementById('modalTitle');
const itemId = document.getElementById('itemId');
const itemType = document.getElementById('itemType');
const editTitle = document.getElementById('editTitle');
const editDescription = document.getElementById('editDescription');
const dynamicFields = document.getElementById('dynamicFields');
const linksContainer = document.getElementById('linksContainer');
const imagesContainer = document.getElementById('imagesContainer');
const textsContainer = document.getElementById('textsContainer');
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
  // Asignar eventos de clic para abrir detalle
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const item = items.find(i => i.id === id);
      if (item) openModal(item);
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// ========== Botón flotante (agregar) ==========
fab.addEventListener('click', () => {
  // Crear un item vacío del tipo actual
  const newItem = {
    id: null,
    type: currentType,
    title: '',
    description: '',
    data: getDefaultData(currentType)
  };
  openModal(newItem);
});

function getDefaultData(type) {
  const base = { links: [], images: [], texts: [] };
  if (type === 'mudanza') return { ...base, budget: '' };
  if (type === 'restaurante') return { ...base, cuisine: '', location: '', visited: false, rating: 0, favoriteDish: '' };
  if (type === 'cita') return { ...base, date: '', location: '' };
  if (type === 'proyecto') return { ...base, customFields: {} };
  return base;
}

// ========== Modal ==========
function openModal(item) {
  editingItem = item;
  itemId.value = item.id || '';
  itemType.value = item.type;
  editTitle.value = item.title || '';
  editDescription.value = item.description || '';
  modalTitle.textContent = item.id ? 'Editar' : 'Nuevo';

  // Renderizar campos dinámicos específicos
  renderDynamicFields(item.type, item.data || {});

  // Renderizar arrays comunes
  renderArrayContainer(linksContainer, item.data?.links || [], 'links');
  renderArrayContainer(imagesContainer, item.data?.images || [], 'images');
  renderArrayContainer(textsContainer, item.data?.texts || [], 'texts');

  // Mostrar/ocultar botón eliminar
  deleteItemBtn.style.display = item.id ? 'block' : 'none';

  itemModal.classList.add('active');
}

function closeModal() {
  itemModal.classList.remove('active');
  editingItem = null;
}

closeModalBtn.addEventListener('click', closeModal);
// Cerrar al hacer clic fuera del contenido (en el fondo)
itemModal.addEventListener('click', (e) => {
  if (e.target === itemModal) closeModal();
});

// ========== Campos dinámicos específicos ==========
function renderDynamicFields(type, data) {
  dynamicFields.innerHTML = '';
  const fields = getFieldsForType(type, data);
  fields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    const label = document.createElement('label');
    label.textContent = field.label;
    div.appendChild(label);

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === field.value) option.selected = true;
        input.appendChild(option);
      });
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = field.value || false;
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '0.5rem';
      wrapper.appendChild(input);
      const label2 = document.createElement('span');
      label2.textContent = field.label;
      wrapper.appendChild(label2);
      div.innerHTML = '';
      div.appendChild(wrapper);
      // guardar referencia
      input.dataset.field = field.key;
      input.dataset.type = 'checkbox';
      div._input = input;
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      input.value = field.value || '';
      input.placeholder = field.placeholder || '';
    }

    if (!field.type || field.type !== 'checkbox') {
      input.dataset.field = field.key;
      div.appendChild(input);
    }
    dynamicFields.appendChild(div);
  });
}

function getFieldsForType(type, data) {
  const fields = [];
  if (type === 'mudanza') {
    fields.push({ key: 'budget', label: 'Presupuesto (€)', type: 'number', value: data.budget || '' });
  }
  if (type === 'restaurante') {
    fields.push({ key: 'cuisine', label: 'Tipo de cocina', type: 'text', value: data.cuisine || '' });
    fields.push({ key: 'location', label: 'Ubicación', type: 'text', value: data.location || '' });
    fields.push({ key: 'visited', label: '¿Visitado?', type: 'checkbox', value: data.visited || false });
    fields.push({ key: 'rating', label: 'Puntuación (0-5)', type: 'number', value: data.rating || 0, placeholder: '0-5' });
    fields.push({ key: 'favoriteDish', label: 'Plato favorito', type: 'text', value: data.favoriteDish || '' });
  }
  if (type === 'cita') {
    fields.push({ key: 'date', label: 'Fecha', type: 'date', value: data.date || '' });
    fields.push({ key: 'location', label: 'Ubicación', type: 'text', value: data.location || '' });
  }
  if (type === 'proyecto') {
    // Podríamos permitir campos personalizados, pero por ahora solo título y descripción
    // Añadimos un campo extra para customFields? Mejor no complicar.
    // Dejamos solo título y descripción, y los arrays comunes.
  }
  return fields;
}

// ========== Renderizar arrays (enlaces, imágenes, textos) ==========
function renderArrayContainer(container, itemsArray, key) {
  container.innerHTML = '';
  itemsArray.forEach((val, index) => {
    const div = document.createElement('div');
    div.className = 'array-item';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = val;
    input.placeholder = key === 'images' ? 'URL de imagen' : key === 'links' ? 'URL' : 'Nota';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      container.removeChild(div);
    });
    div.appendChild(input);
    div.appendChild(removeBtn);
    container.appendChild(div);
  });
  // Guardar referencia del contenedor para añadir
  container._key = key;
}

// Eventos para añadir elementos a arrays (usando delegación)
document.querySelectorAll('.add-array-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target; // 'links', 'images', 'texts'
    const container = document.getElementById(`${target}Container`);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'array-item';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = target === 'images' ? 'URL de imagen' : target === 'links' ? 'URL' : 'Nota';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      container.removeChild(div);
    });
    div.appendChild(input);
    div.appendChild(removeBtn);
    container.appendChild(div);
  });
});

// ========== Guardar item ==========
itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Recoger datos comunes
  const id = itemId.value ? parseInt(itemId.value) : null;
  const type = itemType.value;
  const title = editTitle.value.trim();
  const description = editDescription.value.trim();

  // Recoger campos dinámicos
  const data = {};
  // Primero, los valores de los inputs dinámicos
  const dynamicInputs = dynamicFields.querySelectorAll('input, select');
  dynamicInputs.forEach(input => {
    const key = input.dataset.field;
    if (!key) return;
    if (input.type === 'checkbox') {
      data[key] = input.checked;
    } else {
      data[key] = input.value;
    }
  });

  // Recoger arrays comunes
  data.links = getArrayValues(linksContainer);
  data.images = getArrayValues(imagesContainer);
  data.texts = getArrayValues(textsContainer);

  // Eliminar campos vacíos para limpieza
  Object.keys(data).forEach(k => {
    if (data[k] === '' || data[k] === null || data[k] === undefined) delete data[k];
  });

  const payload = { type, title, description, data };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    if (!res.ok) {
      const err = await res.json();
      alert('Error: ' + (err.error || 'desconocido'));
      return;
    }
    closeModal();
    loadItems(currentType);
  } catch (error) {
    alert('Error de conexión al guardar');
  }
});

function getArrayValues(container) {
  const inputs = container.querySelectorAll('.array-item input');
  const values = [];
  inputs.forEach(input => {
    const val = input.value.trim();
    if (val) values.push(val);
  });
  return values;
}

// ========== Eliminar item ==========
deleteItemBtn.addEventListener('click', async () => {
  const id = itemId.value;
  if (!id) return;
  if (!confirm('¿Estás seguro de eliminar este item?')) return;
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert('Error: ' + (err.error || 'desconocido'));
      return;
    }
    closeModal();
    loadItems(currentType);
  } catch {
    alert('Error de conexión al eliminar');
  }
});

// ========== Inicialización ==========
checkSession();
