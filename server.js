const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos
const db = new Database(path.join(__dirname, 'db', 'database.sqlite'));

// Asegurar carpeta de uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

  CREATE TABLE IF NOT EXISTS subitems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
`);

// Insertar usuarios predefinidos
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
app.use('/uploads', express.static(uploadsDir));

app.use(session({
  secret: 'clave-super-secreta-para-la-app-de-la-pareja',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Middleware de autenticación
function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
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
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
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

// ===== ITEMS =====
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
  items.forEach(item => {
    try { item.data = JSON.parse(item.data || '{}'); } catch { item.data = {}; }
  });
  res.json(items);
});

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

app.put('/api/items/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { title, description, data } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
  const dataStr = JSON.stringify(data || {});
  const stmt = db.prepare(`
    UPDATE items SET title = ?, description = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);
  const result = stmt.run(title, description || '', dataStr, id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item no encontrado' });
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  try { updated.data = JSON.parse(updated.data || '{}'); } catch { updated.data = {}; }
  res.json(updated);
});

app.delete('/api/items/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  // Primero eliminar subitems (la DB lo hace en cascada, pero también eliminamos archivos de imagen)
  const subitems = db.prepare('SELECT * FROM subitems WHERE item_id = ?').all(id);
  subitems.forEach(sub => {
    if (sub.type === 'image' && sub.content) {
      const filePath = path.join(__dirname, sub.content);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  const result = stmt.run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item no encontrado' });
  res.json({ success: true });
});

// ===== SUBITEMS =====
app.get('/api/items/:id/subitems', isAuthenticated, (req, res) => {
  const itemId = req.params.id;
  const stmt = db.prepare('SELECT * FROM subitems WHERE item_id = ? ORDER BY created_at ASC');
  const subitems = stmt.all(itemId);
  subitems.forEach(s => {
    try { s.metadata = JSON.parse(s.metadata || '{}'); } catch { s.metadata = {}; }
  });
  res.json(subitems);
});

app.post('/api/items/:id/subitems', isAuthenticated, (req, res) => {
  const itemId = req.params.id;
  const { type, content, metadata } = req.body;
  if (!type || !content) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  const metaStr = JSON.stringify(metadata || {});
  const stmt = db.prepare('INSERT INTO subitems (item_id, type, content, metadata) VALUES (?, ?, ?, ?)');
  const info = stmt.run(itemId, type, content, metaStr);
  const newSub = db.prepare('SELECT * FROM subitems WHERE id = ?').get(info.lastInsertRowid);
  try { newSub.metadata = JSON.parse(newSub.metadata || '{}'); } catch { newSub.metadata = {}; }
  res.status(201).json(newSub);
});

app.put('/api/subitems/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { content, metadata } = req.body;
  if (!content) return res.status(400).json({ error: 'El contenido es obligatorio' });
  const metaStr = JSON.stringify(metadata || {});
  const stmt = db.prepare('UPDATE subitems SET content = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(content, metaStr, id);
  if (result.changes === 0) return res.status(404).json({ error: 'Subitem no encontrado' });
  const updated = db.prepare('SELECT * FROM subitems WHERE id = ?').get(id);
  try { updated.metadata = JSON.parse(updated.metadata || '{}'); } catch { updated.metadata = {}; }
  res.json(updated);
});

app.delete('/api/subitems/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const sub = db.prepare('SELECT * FROM subitems WHERE id = ?').get(id);
  if (!sub) return res.status(404).json({ error: 'Subitem no encontrado' });
  if (sub.type === 'image' && sub.content) {
    const filePath = path.join(__dirname, sub.content);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  const stmt = db.prepare('DELETE FROM subitems WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

// ===== UPLOAD DE IMÁGENES =====
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

app.post('/api/upload', isAuthenticated, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
    const timestamp = Date.now();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.webp`;
    const outputPath = path.join(uploadsDir, filename);
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);
    const publicUrl = `/uploads/${filename}`;
    res.json({ url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
