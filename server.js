const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos
const db = new Database(path.join(__dirname, 'db', 'database.sqlite'));

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insertar usuarios predefinidos (solo si no existen)
const users = [
  { username: 'camilomuriel', password: 'b55f86bd4c353' },
  { username: 'kathgaleri', password: 'akira123' }
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)');

users.forEach(({ username, password }) => {
  const hash = bcrypt.hashSync(password, 10);
  insertUser.run(username, hash);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'clave-super-secreta-para-la-app-de-la-pareja',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 día
}));

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'No autenticado' });
}

// ================== RUTAS API ==================

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ success: true, username: user.username });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Verificar sesión
app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({ username: req.session.username });
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
});

// Obtener items (con filtro por tipo opcional)
app.get('/api/items', isAuthenticated, (req, res) => {
  const { type } = req.query;
  let query = 'SELECT * FROM items';
  const params = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC';
  const stmt = db.prepare(query);
  const items = stmt.all(...params);
  // Parsear data JSON
  items.forEach(item => {
    try {
      item.data = JSON.parse(item.data || '{}');
    } catch {
      item.data = {};
    }
  });
  res.json(items);
});

// Crear item
app.post('/api/items', isAuthenticated, (req, res) => {
  const { type, title, description, data } = req.body;
  if (!type || !title) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (type, title)' });
  }

  const dataStr = JSON.stringify(data || {});
  const stmt = db.prepare(`
    INSERT INTO items (type, title, description, data)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(type, title, description || '', dataStr);
  const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
  try { newItem.data = JSON.parse(newItem.data || '{}'); } catch { newItem.data = {}; }
  res.status(201).json(newItem);
});

// Actualizar item
app.put('/api/items/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { title, description, data } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }

  const dataStr = JSON.stringify(data || {});
  const stmt = db.prepare(`
    UPDATE items
    SET title = ?, description = ?, data = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(title, description || '', dataStr, id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Item no encontrado' });
  }

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  try { updated.data = JSON.parse(updated.data || '{}'); } catch { updated.data = {}; }
  res.json(updated);
});

// Eliminar item
app.delete('/api/items/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  const result = stmt.run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Item no encontrado' });
  }
  res.json({ success: true });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
