// app.js
// Lógica principal de la PWA: choferes, import .txt, asignación y búsqueda por voz/texto.

import { addDriver, getDrivers, deleteDriver,
         addAddress, listAddresses, findByAddressFragment, clearAddresses, clearDrivers } from './db.js';

const els = {
  btnInstall: document.getElementById('btnInstall'),
  driverName: document.getElementById('driverName'),
  driverColor: document.getElementById('driverColor'),
  addDriver: document.getElementById('addDriver'),
  driversList: document.getElementById('driversList'),
  txtFile: document.getElementById('txtFile'),
  importTxt: document.getElementById('importTxt'),
  addressInput: document.getElementById('addressInput'),
  assignDriver: document.getElementById('assignDriver'),
  assignAddress: document.getElementById('assignAddress'),
  addressesBoard: document.getElementById('addressesBoard'),
  micBtn: document.getElementById('micBtn'),
  offlineMode: document.getElementById('offlineMode'),
  searchText: document.getElementById('searchText'),
  runSearch: document.getElementById('runSearch'),
  searchResults: document.getElementById('searchResults')
};

// --- Instalación PWA (evento beforeinstallprompt)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.btnInstall.hidden = false;
});
els.btnInstall.addEventListener('click', async () => {
  els.btnInstall.hidden = true;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

// --- Choferes
els.addDriver.addEventListener('click', async () => {
  const name = (els.driverName.value || '').trim();
  const color = els.driverColor.value || '#0b5fff';
  if (!name) return alert('Ingresá un nombre de chofer');
  try {
    await addDriver(name, color);
    els.driverName.value = '';
    await renderDrivers();
    await refreshDriverSelect();
  } catch (e) {
    if ((e && e.name) === 'ConstraintError') {
      alert('Ya existe un chofer con ese nombre.');
    } else {
      console.error(e);
      alert('Error al guardar el chofer.');
    }
  }
});

async function renderDrivers() {
  const drivers = await getDrivers();
  els.driversList.innerHTML = '';
  for (const d of drivers) {
    const li = document.createElement('li');
    li.className = 'chip';
    li.innerHTML = `
      <span class="color" style="background:${d.color}"></span>
      <strong>${d.name}</strong>
      <button class="secondary" data-del="${d.name}">✕</button>
    `;
    els.driversList.appendChild(li);
  }
  // borrar driver
  els.driversList.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-del');
      if (confirm(`¿Eliminar chofer "${name}"? (no borra direcciones)`)) {
        await deleteDriver(name);
        await renderDrivers();
        await refreshDriverSelect();
        await renderAddresses();
      }
    });
  });
}

// boton de vaciar todos los drivers cargados
const btnClearDrivers = document.getElementById('clearDrivers');

btnClearDrivers.addEventListener('click', async () => {
  if (!confirm('¿Vaciar TODOS los choferes guardados?')) return;
  await clearDrivers();
  await renderDrivers();
  await refreshDriverSelect();
  await renderAddresses(); // re-render para que los badges sin chofer se vean coherentes
  alert('Choferes Eliminados.');
});



// boton de vaciar direcciones asignadas
const btnClearAddresses = document.getElementById('btnClearAddresses');
btnClearAddresses.addEventListener('click', async () => {
  if (!confirm('¿Vaciar TODAS las direcciones?')) return;
  await clearAddresses();
  await renderAddresses();
  alert('Direcciones vaciadas.');
});

async function refreshDriverSelect() {
  const drivers = await getDrivers();
  els.assignDriver.innerHTML = '<option value="">Seleccioná chofer…</option>';
  drivers.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name; opt.textContent = d.name;
    els.assignDriver.appendChild(opt);
  });
}

// --- Asignar dirección manual
els.assignAddress.addEventListener('click', async () => {
  const addr = (els.addressInput.value || '').trim();
  const driver = els.assignDriver.value;
  if (!addr) return alert('Ingresá una dirección');
  if (!driver) return alert('Seleccioná un chofer');
  await addAddress(addr, driver);
  els.addressInput.value = '';
  await renderAddresses();
});

// --- Render direcciones asignadas (tablero)
async function renderAddresses() {
  const [drivers, addresses] = await Promise.all([getDrivers(), listAddresses()]);
  const colorMap = Object.fromEntries(drivers.map(d => [d.name, d.color]));
  els.addressesBoard.innerHTML = '';
  addresses.forEach(a => {
    const color = colorMap[a.driver] || 'var(--muted)'; // color neutro si ya no existe el chofer
    const label = colorMap[a.driver] ? a.driver : `${a.driver || 'Sin Chofer Asignado'}`;
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = `
      <span class="addr">${a.address}</span>
      <span class="meta">
        <span class="badge" style="border-color:${color}; color:${color}">${label}</span>
      </span>
    `;
    els.addressesBoard.appendChild(wrap);
  });
}

// --- Import .txt
els.importTxt.addEventListener('click', async () => {
  const file = els.txtFile.files?.[0];
  if (!file) return alert('Seleccioná un archivo .txt');
  try {
    const text = await file.text();
    const blocks = parseBlocks(text);
    let createdDrivers = 0, createdAddrs = 0;

    for (const block of blocks) {
      const name = (block.shift() || '').trim();
      if (!name) continue;
      // si el chofer no existe, lo creo con color auto (random pastel)
      const drivers = await getDrivers();
      const exists = drivers.some(d => d.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        await addDriver(name, randomPastel());
        createdDrivers++;
      }
      for (const addr of block) {
        const clean = addr.trim();
        if (!clean) continue;
        await addAddress(clean, name);
        createdAddrs++;
      }
    }
    await renderDrivers();
    await refreshDriverSelect();
    await renderAddresses();
    alert(`Importación lista.\nChoferes nuevos: ${createdDrivers}\nDirecciones agregadas: ${createdAddrs}`);
  } catch (e) {
    console.error(e);
    alert('Error importando el .txt');
  }
});

function parseBlocks(text) {
  // Separa por bloques usando líneas en blanco (una o más).
  // Devuelve array de arrays: [ [chofer, dir1, dir2,...], [chofer2, ...], ... ]
  const raw = text.replace(/\r/g,'').split(/\n{2,}/);
  return raw.map(block => block.split('\n').map(l => l.trim()).filter(Boolean))
            .filter(arr => arr.length > 0);
}

function randomPastel() {
  const hue = Math.floor(Math.random()*360);
  return `hsl(${hue} 70% 60%)`;
}

// --- Búsqueda por voz / texto
let recognizing = false;
let recognition = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new R();
  recognition.lang = 'es-AR'; // ajustable
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => { recognizing = true; els.micBtn.textContent = '🎤 Escuchando…'; };
  recognition.onend = () => { recognizing = false; els.micBtn.textContent = '🎤 Buscar por voz'; };
  recognition.onerror = (e) => { console.warn('Speech error', e); recognizing = false; els.micBtn.textContent = '🎤 Buscar por voz'; };
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript || '';
    els.searchText.value = transcript;
    runSearchFlow();
  };
}

els.micBtn.addEventListener('click', () => {
  if (els.offlineMode.checked) {
    alert('Modo offline activo: usá el campo de texto para pegar/tipear direcciones.');
    return;
  }
  if (!recognition) {
    alert('Reconocimiento de voz no soportado en este navegador.');
    return;
  }
  if (recognizing) { recognition.stop(); return; }
  recognition.start();
});

els.runSearch.addEventListener('click', runSearchFlow);

async function runSearchFlow() {
  // Entradas: si hay texto en textarea, procesa múltiples direcciones separadas por coma, salto de línea o “ y ”
  const raw = els.searchText.value.trim();
  if (!raw) return alert('Ingresá o dicta al menos una dirección');

  const queries = splitAddresses(raw);
  const found = [];
  for (const q of queries) {
    const matches = await findByAddressFragment(q);
    if (matches.length > 0) {
      // si hay varias coincidencias, mostramos todas
      matches.forEach(m => found.push({ query:q, address:m.address, driver:m.driver }));
    } else {
      found.push({ query:q, address:null, driver:null });
    }
  }
  renderResults(found);
}

function splitAddresses(text) {
  // Divide por saltos de línea, comas y la conjunción ' y '
  return text
    .split(/\n|,| y /i)
    .map(s => s.trim())
    .filter(Boolean);
}

async function renderResults(rows) {
  const drivers = await getDrivers();
  const colorMap = Object.fromEntries(drivers.map(d => [d.name, d.color]));
  els.searchResults.innerHTML = '';
  rows.forEach(r => {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    const right = r.driver
      ? `<span class="badge" style="border-color:${colorMap[r.driver]}; color:${colorMap[r.driver]}">${r.driver}</span>`
      : `<span class="badge" style="border-color:var(--warn); color:var(--warn)">No asignada</span>`;
    wrap.innerHTML = `
      <div>
        <div class="addr">${r.address ?? r.query}</div>
        <div class="meta">${r.address ? 'Coincidencia' : 'Sin coincidencias, probá asignar o revisar la dirección'}</div>
      </div>
      ${right}
    `;
    els.searchResults.appendChild(wrap);
  });
}

// Primera carga
(async function init(){// borra direcciones cada vez que abre la app(los choferes permanecen)
  await renderDrivers();
  await refreshDriverSelect();
  await renderAddresses();
})();