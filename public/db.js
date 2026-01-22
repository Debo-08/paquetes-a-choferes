// public/db.js

const DB_NAME = 'PacChoferesDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      // Store de Choferes (la 'key' es el nombre para que no se repitan)
      if (!db.objectStoreNames.contains('drivers')) {
        db.createObjectStore('drivers', { keyPath: 'name' });
      }

      // Store de Direcciones
      if (!db.objectStoreNames.contains('addresses')) {
        const store = db.createObjectStore('addresses', { keyPath: 'id', autoIncrement: true });
        // Creamos índice para buscar rápido si hiciera falta
        store.createIndex('driver', 'driver', { unique: false });
      }
    };
  });
}

export async function addDriver(name, color) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drivers', 'readwrite');
    const store = tx.objectStore('drivers');
    const req = store.add({ name, color }); 
    
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error); // Esto disparará el 'ConstraintError' si ya existe
  });
}

export async function getDrivers() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('drivers', 'readonly');
    const store = tx.objectStore('drivers');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function deleteDriver(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drivers', 'readwrite');
    tx.objectStore('drivers').delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearDrivers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drivers', 'readwrite');
    tx.objectStore('drivers').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addAddress(address, driver) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('addresses', 'readwrite');
    const store = tx.objectStore('addresses');
    store.add({ address, driver, createdAt: new Date() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listAddresses() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('addresses', 'readonly');
    const req = tx.objectStore('addresses').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function clearAddresses() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('addresses', 'readwrite');
    tx.objectStore('addresses').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function findByAddressFragment(query) {
  // Búsqueda simple: trae todo y filtra en JS (eficiente para apps pequeñas)
  const all = await listAddresses();
  const q = query.toLowerCase();
  return all.filter(item => item.address.toLowerCase().includes(q));
}