const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

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
