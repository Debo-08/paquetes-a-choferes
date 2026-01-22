// server.js
// Servidor Express simple para servir la PWA en producción o desarrollo.
// Comentado para facilitar debugging.

const path = require('path');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Comprimir respuestas
app.use(compression());

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '7d',
  extensions: ['html']
}));

// Fallback SPA (sin patrón, compatible Express 5)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0',() => {
  console.log(`✅ Paquetes a Choferes con auth en http://localhost:${PORT}`);
});