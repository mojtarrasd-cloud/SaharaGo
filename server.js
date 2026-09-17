const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

async function supabase(table, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Supabase no está configurado');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    ...options,
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function checkPassword(password, saved) { try { const [salt, hash] = saved.split(':'); const candidate = crypto.scryptSync(password, salt, 64); const actual = Buffer.from(hash, 'hex'); return actual.length === candidate.length && crypto.timingSafeEqual(actual, candidate); } catch (error) { return false; } }

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/cuentas/registro', async (req, res) => {
  const { nombre, telefono, password, tipo, vehiculo, matricula } = req.body;
  if (!nombre || !telefono || !password || password.length < 6 || !['pasajero', 'conductor'].includes(tipo)) return res.status(400).json({ ok:false, message:'Completa los datos y usa una contraseña de al menos 6 caracteres' });
  try { const [perfil] = await supabase('profiles', { method:'POST', body:JSON.stringify({ nombre, telefono, password_hash:hashPassword(password), tipo, vehiculo:vehiculo||null, matricula:matricula||null }) }); res.json({ ok:true, perfil:{ id:perfil.id, nombre:perfil.nombre, tipo:perfil.tipo, vehiculo:perfil.vehiculo, matricula:perfil.matricula } }); }
  catch (error) { res.status(400).json({ ok:false, message:'No se pudo crear la cuenta' }); }
});
app.post('/api/cuentas/login', async (req, res) => {
  try { const perfiles = await supabase(`profiles?telefono=eq.${encodeURIComponent(req.body.telefono)}&select=*`); const perfil = perfiles[0]; if (!perfil || !checkPassword(req.body.password||'', perfil.password_hash)) return res.status(401).json({ ok:false, message:'Teléfono o contraseña incorrectos' }); res.json({ ok:true, perfil:{ id:perfil.id, nombre:perfil.nombre, tipo:perfil.tipo, vehiculo:perfil.vehiculo, matricula:perfil.matricula } }); }
  catch (error) { res.status(500).json({ ok:false, message:'No se pudo iniciar sesión' }); }
});

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    message: 'Servidor SaharaGo funcionando'
  });
});
const DATA_FILE = path.join(__dirname, 'viajes.json');

function cargarViajes() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const datos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    console.error('No se pudieron cargar los viajes:', error.message);
    return [];
  }
}
function guardarViajes() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(viajes, null, 2), 'utf8');
}
let viajes = cargarViajes();

const campamentos = ['Smara / السمارة', 'El Aaiún / العيون', 'Auserd / أوسرد', 'Dajla / الداخلة', 'Rabuni / الرابوني'];
function calcularPrecio(origen, destino) {
  const distancia = Math.abs(campamentos.indexOf(origen) - campamentos.indexOf(destino));
  return 300 + (distancia * 200);
}

app.post('/api/viajes', (req, res) => {
  const viaje = {
    id: Date.now(),
    origen: req.body.origen,
    destino: req.body.destino,
    pasajeros: req.body.pasajeros || 1,
    precio: calcularPrecio(req.body.origen, req.body.destino),
    tipoReserva: req.body.tipoReserva === 'programada' ? 'programada' : 'ahora',
    fechaHora: req.body.fechaHora || null,
    pasajero: req.body.pasajero || null,
    ubicacionPasajero: req.body.ubicacion || null,
    ubicacionConductor: null,
    estado: 'solicitado',
    metodoPago: 'Efectivo',
    pagoEstado: 'pendiente',
    creadoEn: new Date().toISOString()
  };

  viajes.push(viaje);
  guardarViajes();

  res.json({
    ok: true,
    viaje
  });
});

app.get('/api/viajes', (req, res) => {
  res.json(viajes);
});
app.get('/api/perfiles/:id/resumen', (req, res) => {
  const id = req.params.id;
  const realizados = viajes.filter(v => v.pasajeroId === id || v.conductorId === id);
  const comoConductor = viajes.filter(v => v.conductorId === id && v.estado === 'finalizado' && v.pagoEstado === 'pagado');
  const recibidas = viajes.flatMap(v => {
    if (v.conductorId === id && v.valoracionConductor) return [v.valoracionConductor.estrellas];
    if (v.pasajeroId === id && v.valoracionPasajero) return [v.valoracionPasajero.estrellas];
    return [];
  });
  res.json({ ok:true, viajes:realizados.length, ingresos:comoConductor.reduce((total, v) => total + Number(v.precio || 0), 0), valoraciones:recibidas.length, media:recibidas.length ? recibidas.reduce((a,b) => a+b, 0) / recibidas.length : null });
});
app.get('/api/reputacion', (req, res) => {
  const tipo = req.query.tipo;
  const nombre = req.query.nombre;
  const campoPersona = tipo === 'conductor' ? 'conductor' : 'pasajero';
  const campoValoracion = tipo === 'conductor' ? 'valoracionConductor' : 'valoracionPasajero';
  const valoraciones = viajes
    .filter(v => v[campoPersona] && v[campoPersona].nombre === nombre && v[campoValoracion])
    .map(v => v[campoValoracion].estrellas);
  const media = valoraciones.length ? valoraciones.reduce((a, b) => a + b, 0) / valoraciones.length : null;
  res.json({ ok: true, media, total: valoraciones.length });
});
app.put('/api/viajes/:id', (req, res) => {
  const id = Number(req.params.id);

  const viaje = viajes.find(v => v.id === id);

  if (!viaje) {
    return res.status(404).json({
      ok: false,
      message: 'Viaje no encontrado'
    });
  }

  const estadosValidos = ['aceptado', 'conductor_llegado', 'en_curso', 'finalizado', 'cancelado'];
  const nuevoEstado = req.body.estado || 'aceptado';

  if (!estadosValidos.includes(nuevoEstado)) {
    return res.status(400).json({
      ok: false,
      message: 'Estado de viaje no válido'
    });
  }

  viaje.estado = nuevoEstado;
  if (req.body.conductorUbicacion) {
    viaje.ubicacionConductor = req.body.conductorUbicacion;
  }
  if (req.body.conductor) {
    viaje.conductor = req.body.conductor;
  }
  if (req.body.conductorId) viaje.conductorId = req.body.conductorId;
  if (nuevoEstado === 'cancelado') {
    viaje.motivoCancelacion = req.body.motivoCancelacion || 'Sin motivo indicado';
    viaje.canceladoEn = new Date().toISOString();
  }
  if (req.body.pagoEstado && ['pendiente', 'pagado'].includes(req.body.pagoEstado)) {
    viaje.pagoEstado = req.body.pagoEstado;
  }
  guardarViajes();

  res.json({
    ok: true,
    viaje
  });
});
app.put('/api/viajes/:id/ubicacion-conductor', (req, res) => {
  const viaje = viajes.find(v => v.id === Number(req.params.id));
  const ubicacion = req.body.ubicacion;

  if (!viaje) {
    return res.status(404).json({ ok: false, message: 'Viaje no encontrado' });
  }
  if (!ubicacion || typeof ubicacion.lat !== 'number' || typeof ubicacion.lng !== 'number') {
    return res.status(400).json({ ok: false, message: 'Ubicación no válida' });
  }

  viaje.ubicacionConductor = ubicacion;
  guardarViajes();
  res.json({ ok: true, viaje });
});
app.put('/api/viajes/:id/valoracion', (req, res) => {
  const viaje = viajes.find(v => v.id === Number(req.params.id));
  const { actor, estrellas, comentario } = req.body;
  if (!viaje) return res.status(404).json({ ok: false, message: 'Viaje no encontrado' });
  if (viaje.estado !== 'finalizado') return res.status(400).json({ ok: false, message: 'El viaje no ha finalizado' });
  if (!['pasajero', 'conductor'].includes(actor) || !Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ ok: false, message: 'Valoración no válida' });
  }
  viaje[actor === 'pasajero' ? 'valoracionConductor' : 'valoracionPasajero'] = { estrellas, comentario: comentario || '', creadaEn: new Date().toISOString() };
  guardarViajes();
  res.json({ ok: true, viaje });
});
app.listen(PORT, () => {
  console.log('SaharaGo funcionando en http://localhost:3000');
});
