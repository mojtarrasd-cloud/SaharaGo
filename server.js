const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SESSION_KEY = process.env.SESSION_SECRET || SUPABASE_SECRET_KEY || crypto.randomBytes(32).toString('hex');
const SESSION_SECONDS = 7 * 24 * 60 * 60;
function publicProfile(perfil) {
  return { id:perfil.id, nombre:perfil.nombre, tipo:perfil.tipo, vehiculo:perfil.vehiculo, matricula:perfil.matricula };
}
function sessionSignature(value) {
  return crypto.createHmac('sha256', SESSION_KEY).update('saharago-session:' + value).digest('base64url');
}
function startSession(res, perfil) {
  const value = Buffer.from(JSON.stringify({ perfil:publicProfile(perfil), exp:Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  res.cookie('saharago_auth', value + '.' + sessionSignature(value), { httpOnly:true, secure:process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER), sameSite:'lax', maxAge:SESSION_SECONDS * 1000, path:'/' });
}
function readSession(req) {
  try {
    const cookie = (req.headers.cookie || '').split(';').map(part=>part.trim()).find(part=>part.startsWith('saharago_auth='));
    if (!cookie) return null;
    const [value, signature, extra] = decodeURIComponent(cookie.slice('saharago_auth='.length)).split('.');
    if (!value || !signature || extra) return null;
    const expected = Buffer.from(sessionSignature(value));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (!Number.isFinite(session.exp) || session.exp <= Date.now() || !session.perfil?.id) return null;
    return session.perfil;
  } catch { return null; }
}

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
// Only browser assets are public; never expose server code or trip storage.
for (const asset of ['index.html', 'app.js', 'styles.css', 'manifest.json', 'service-worker.js']) {
  app.get('/' + asset, (req, res) => res.sendFile(path.join(__dirname, asset)));
}
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/cuentas/registro', async (req, res) => {
  const { nombre, telefono, password, tipo, vehiculo, matricula } = req.body || {};
  if (typeof nombre !== 'string' || !nombre.trim() || typeof telefono !== 'string' || !telefono.trim() || typeof password !== 'string' || password.length < 6 || password.length > 256 || !['pasajero', 'conductor'].includes(tipo)) return res.status(400).json({ ok:false, message:'Completa los datos y usa una contraseña de al menos 6 caracteres' });
  try { const [perfil] = await supabase('profiles', { method:'POST', body:JSON.stringify({ nombre:nombre.trim(), telefono:telefono.trim(), password_hash:hashPassword(password), tipo, vehiculo:vehiculo||null, matricula:matricula||null }) }); startSession(res, perfil); res.json({ ok:true, perfil:publicProfile(perfil) }); }
  catch (error) { res.status(400).json({ ok:false, message:'No se pudo crear la cuenta' }); }
});
app.post('/api/cuentas/login', async (req, res) => {
  const { telefono, password } = req.body || {};
  if (typeof telefono !== 'string' || !telefono.trim() || typeof password !== 'string' || !password || password.length > 256) return res.status(400).json({ ok:false, message:'Escribe tu teléfono y contraseña' });
  try { const perfiles = await supabase(`profiles?telefono=eq.${encodeURIComponent(telefono.trim())}&select=*`); const perfil = perfiles[0]; if (!perfil || !checkPassword(password, perfil.password_hash)) return res.status(401).json({ ok:false, message:'Teléfono o contraseña incorrectos' }); startSession(res, perfil); res.json({ ok:true, perfil:publicProfile(perfil) }); }
  catch (error) { res.status(500).json({ ok:false, message:'No se pudo iniciar sesión' }); }
});
app.get('/api/cuentas/sesion', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const perfil = readSession(req);
  if (!perfil) return res.status(401).json({ ok:false, message:'Inicia sesión para confirmar tu solicitud' });
  res.json({ ok:true, perfil });
});
app.post('/api/cuentas/salir', (req, res) => {
  res.clearCookie('saharago_auth', { httpOnly:true, secure:process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER), sameSite:'lax', path:'/' });
  res.json({ ok:true });
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

// En desarrollo local se conserva el archivo como respaldo. En Render, cuando
// existen las variables de Supabase, todos los viajes se guardan en la base de datos.
const tieneBaseDeDatos = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
function filaViaje(viaje) {
  return {
    id: viaje.id,
    pasajero_id: viaje.pasajeroId || null,
    conductor_id: viaje.conductorId || null,
    origen: viaje.origen,
    destino: viaje.destino,
    pasajeros: viaje.pasajeros || 1,
    precio: viaje.precio,
    metodo_pago: viaje.metodoPago || 'Efectivo',
    pago_estado: viaje.pagoEstado || 'pendiente',
    estado: viaje.estado,
    tipo_reserva: viaje.tipoReserva === 'programada' ? 'programada' : 'ahora',
    fecha_hora: viaje.fechaHora || null,
    datos: viaje
  };
}
async function obtenerViajes() {
  if (!tieneBaseDeDatos) return viajes;
  const filas = await supabase('viajes?select=datos&order=creado_en.asc');
  return filas.map(fila => fila.datos).filter(Boolean);
}
async function guardarViaje(viaje, existe = false) {
  if (!tieneBaseDeDatos) {
    if (!existe) viajes.push(viaje);
    guardarViajes();
    return viaje;
  }
  const tabla = existe ? `viajes?id=eq.${encodeURIComponent(viaje.id)}` : 'viajes';
  const resultado = await supabase(tabla, { method: existe ? 'PATCH' : 'POST', body: JSON.stringify(filaViaje(viaje)) });
  return resultado[0]?.datos || viaje;
}

const campamentos = ['Smara / السمارة', 'El Aaiún / العيون', 'Auserd / أوسرد', 'Dajla / الداخلة', 'Rabuni / الرابوني'];
function calcularPrecio(origen, destino) {
  const distancia = Math.abs(campamentos.indexOf(origen) - campamentos.indexOf(destino));
  return 300 + (distancia * 200);
}

app.post('/api/viajes', async (req, res) => {
  const perfil = readSession(req);
  if (!perfil) return res.status(401).json({ ok:false, message:'Entra en tu cuenta o crea una para confirmar la solicitud' });
  if (perfil.tipo !== 'pasajero') return res.status(403).json({ ok:false, message:'Necesitas una cuenta de pasajero para solicitar un viaje' });
  const body = req.body || {};
  if (!campamentos.includes(body.origen) || !campamentos.includes(body.destino) || body.origen === body.destino) {
    return res.status(400).json({ ok:false, message:'Elige un origen y un destino válidos y diferentes' });
  }
  if (body.pasajeros !== undefined && (!Number.isSafeInteger(body.pasajeros) || body.pasajeros < 1)) {
    return res.status(400).json({ ok:false, message:'El número de pasajeros debe ser un entero positivo' });
  }
  if (body.tipoReserva === 'programada' && (!body.fechaHora || !Number.isFinite(Date.parse(body.fechaHora)) || Date.parse(body.fechaHora) <= Date.now())) {
    return res.status(400).json({ ok:false, message:'Elige una fecha y hora futuras para la reserva' });
  }
  const viaje = {
    id: crypto.randomUUID(),
    origen: req.body.origen,
    destino: req.body.destino,
    pasajeros: req.body.pasajeros || 1,
    precio: calcularPrecio(req.body.origen, req.body.destino),
    tipoReserva: req.body.tipoReserva === 'programada' ? 'programada' : 'ahora',
    fechaHora: req.body.fechaHora || null,
    pasajero: perfil,
    pasajeroId: perfil.id,
    ubicacionPasajero: req.body.ubicacion || null,
    ubicacionConductor: null,
    estado: 'solicitado',
    metodoPago: 'Efectivo',
    pagoEstado: 'pendiente',
    creadoEn: new Date().toISOString()
  };

  try { res.json({ ok: true, viaje: await guardarViaje(viaje) }); }
  catch (error) { console.error(error); res.status(500).json({ ok:false, message:'No se pudo guardar el viaje' }); }
});

app.get('/api/viajes', async (req, res) => {
  try { res.json(await obtenerViajes()); }
  catch (error) { console.error(error); res.status(500).json([]); }
});
app.get('/api/perfiles/:id/resumen', async (req, res) => {
  const id = req.params.id;
  try {
  const todos = await obtenerViajes();
  const realizados = todos.filter(v => v.pasajeroId === id || v.conductorId === id);
  const comoConductor = todos.filter(v => v.conductorId === id && v.estado === 'finalizado' && v.pagoEstado === 'pagado');
  const recibidas = todos.flatMap(v => {
    if (v.conductorId === id && v.valoracionConductor) return [v.valoracionConductor.estrellas];
    if (v.pasajeroId === id && v.valoracionPasajero) return [v.valoracionPasajero.estrellas];
    return [];
  });
  res.json({ ok:true, viajes:realizados.length, ingresos:comoConductor.reduce((total, v) => total + Number(v.precio || 0), 0), valoraciones:recibidas.length, media:recibidas.length ? recibidas.reduce((a,b) => a+b, 0) / recibidas.length : null });
  } catch (error) { res.status(500).json({ok:false,message:'No se pudo cargar el perfil'}); }
});
app.get('/api/reputacion', async (req, res) => {
  const tipo = req.query.tipo;
  const nombre = req.query.nombre;
  const campoPersona = tipo === 'conductor' ? 'conductor' : 'pasajero';
  const campoValoracion = tipo === 'conductor' ? 'valoracionConductor' : 'valoracionPasajero';
  try { const todos = await obtenerViajes(); const valoraciones = todos
    .filter(v => v[campoPersona] && v[campoPersona].nombre === nombre && v[campoValoracion])
    .map(v => v[campoValoracion].estrellas);
  const media = valoraciones.length ? valoraciones.reduce((a, b) => a + b, 0) / valoraciones.length : null;
  res.json({ ok: true, media, total: valoraciones.length });
  } catch (error) { res.status(500).json({ok:false,media:null,total:0}); }
});
app.put('/api/viajes/:id', async (req, res) => {
  const id = req.params.id;
  try {
  const todos = await obtenerViajes();
  const viaje = todos.find(v => v.id === id);

  if (!viaje) {
    return res.status(404).json({
      ok: false,
      message: 'Viaje no encontrado'
    });
  }

  const estadosValidos = ['aceptado', 'conductor_llegado', 'en_curso', 'finalizado', 'cancelado'];
  const body = req.body || {};
  const nuevoEstado = body.estado;

  if (!estadosValidos.includes(nuevoEstado)) {
    return res.status(400).json({
      ok: false,
      message: 'Estado de viaje no válido'
    });
  }

  const transiciones = {
    solicitado: ['aceptado', 'cancelado'],
    aceptado: ['conductor_llegado', 'cancelado'],
    conductor_llegado: ['en_curso', 'cancelado'],
    en_curso: ['finalizado', 'cancelado'],
    finalizado: [],
    cancelado: []
  };
  const confirmarPago = viaje.estado === 'finalizado' && nuevoEstado === 'finalizado' && body.pagoEstado === 'pagado';
  if (!confirmarPago && !(transiciones[viaje.estado] || []).includes(nuevoEstado)) {
    return res.status(409).json({ ok:false, message:'El viaje ya cambió de estado. Actualiza la pantalla antes de continuar.' });
  }
  if (body.pagoEstado != null && (!['pendiente', 'pagado'].includes(body.pagoEstado) || (body.pagoEstado === 'pagado' && nuevoEstado !== 'finalizado') || (viaje.pagoEstado === 'pagado' && body.pagoEstado !== 'pagado'))) {
    return res.status(400).json({ ok:false, message:'El pago solo puede confirmarse al finalizar el viaje' });
  }
  if (viaje.conductorId && body.conductorId && viaje.conductorId !== body.conductorId) {
    return res.status(409).json({ ok:false, message:'Este viaje ya tiene otro conductor asignado' });
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
  res.json({ ok: true, viaje: await guardarViaje(viaje, true) });
  } catch (error) { console.error(error); res.status(500).json({ok:false,message:'No se pudo actualizar el viaje'}); }
});
app.put('/api/viajes/:id/ubicacion-conductor', async (req, res) => {
  try { const viaje = (await obtenerViajes()).find(v => v.id === req.params.id);
  const ubicacion = req.body.ubicacion;

  if (!viaje) {
    return res.status(404).json({ ok: false, message: 'Viaje no encontrado' });
  }
  if (!['aceptado', 'conductor_llegado', 'en_curso'].includes(viaje.estado)) {
    return res.status(409).json({ ok:false, message:'El viaje no está activo' });
  }
  if (!ubicacion || !Number.isFinite(ubicacion.lat) || !Number.isFinite(ubicacion.lng) || Math.abs(ubicacion.lat) > 90 || Math.abs(ubicacion.lng) > 180) {
    return res.status(400).json({ ok: false, message: 'Ubicación no válida' });
  }

  viaje.ubicacionConductor = ubicacion;
  res.json({ ok: true, viaje: await guardarViaje(viaje, true) });
  } catch (error) { res.status(500).json({ok:false,message:'No se pudo actualizar la ubicación'}); }
});
app.put('/api/viajes/:id/valoracion', async (req, res) => {
  try { const viaje = (await obtenerViajes()).find(v => v.id === req.params.id);
  const { actor, estrellas, comentario } = req.body;
  if (!viaje) return res.status(404).json({ ok: false, message: 'Viaje no encontrado' });
  if (viaje.estado !== 'finalizado') return res.status(400).json({ ok: false, message: 'El viaje no ha finalizado' });
  if (!['pasajero', 'conductor'].includes(actor) || !Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ ok: false, message: 'Valoración no válida' });
  }
  viaje[actor === 'pasajero' ? 'valoracionConductor' : 'valoracionPasajero'] = { estrellas, comentario: comentario || '', creadaEn: new Date().toISOString() };
  res.json({ ok: true, viaje: await guardarViaje(viaje, true) });
  } catch (error) { res.status(500).json({ok:false,message:'No se pudo guardar la valoración'}); }
});
app.listen(PORT, () => {
  console.log('SaharaGo funcionando en http://localhost:3000');
});

