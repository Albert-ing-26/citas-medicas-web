const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole } = require('../middlewares/auth');

router.use(requireRole('medico'));

// Toda ruta de medico necesita su id_medico (no solo el id_usuario de la sesion)
router.use(async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_medico FROM medicos WHERE id_usuario = ?',
      [req.session.usuario.id_usuario]
    );
    if (rows.length === 0) {
      return res.status(500).send('No se encontro el perfil de medico para este usuario');
    }
    req.idMedico = rows[0].id_medico;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el perfil de medico');
  }
});

router.get('/', async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        SUM(fecha = CURDATE() AND estado != 'cancelada') AS citasHoy,
        SUM(estado = 'pendiente') AS citasPendientes
      FROM citas
      WHERE id_medico = ?
    `, [req.idMedico]);

    const [[bloqueos]] = await pool.query(
      `SELECT
         SUM(estado = 'aprobado' AND fecha >= CURDATE()) AS aprobados,
         SUM(estado = 'pendiente') AS pendientes
       FROM dias_bloqueados WHERE id_medico = ?`,
      [req.idMedico]
    );

    res.render('medico/dashboard', {
      usuario: req.session.usuario,
      citasHoy: stats.citasHoy || 0,
      citasPendientes: stats.citasPendientes || 0,
      diasBloqueados: bloqueos.aprobados || 0,
      solicitudesPendientes: bloqueos.pendientes || 0
    });
  } catch (err) {
    console.error(err);
    res.render('medico/dashboard', { usuario: req.session.usuario, citasHoy: 0, citasPendientes: 0, diasBloqueados: 0, solicitudesPendientes: 0 });
  }
});

// Devuelve la fecha de hoy en formato YYYY-MM-DD (hora local del servidor)
function hoyISO() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const d = ahora.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Suma o resta un dia a una fecha 'YYYY-MM-DD' sin problemas de zona horaria
function sumarDias(fechaISO, dias) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  const yy = fecha.getFullYear();
  const mm = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const dd = fecha.getDate().toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ------------------- AGENDA -------------------

router.get('/agenda', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();

  try {
    const idUsuarioMedico = req.session.usuario?.id_usuario;

    const [citas] = await pool.query(`
      SELECT
        c.id_cita,
        c.fecha,
        c.hora_inicio,
        c.hora_fin,
        CONCAT(TIME_FORMAT(c.hora_inicio, '%H:%i'), ' - ', TIME_FORMAT(c.hora_fin, '%H:%i')) AS hora_rango,
        c.motivo_consulta AS motivo,
        c.estado,
        u_pac.nombre AS nombre_paciente,
        u_pac.apellidos AS apellidos_paciente,
        p.dni AS dni_paciente,
        u_pac.telefono AS telefono_paciente
      FROM citas c
      INNER JOIN medicos m ON m.id_medico = c.id_medico
      INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
      INNER JOIN usuarios u_pac ON u_pac.id_usuario = p.id_usuario
      WHERE m.id_usuario = ? AND c.fecha = ?
      ORDER BY c.hora_inicio ASC, c.id_cita ASC
    `, [idUsuarioMedico, fecha]);

    const [bloqueado] = await pool.query(
      "SELECT motivo, estado FROM dias_bloqueados WHERE id_medico = ? AND fecha = ? AND estado != 'rechazado'",
      [req.idMedico, fecha]
    );

    res.render('medico/agenda', {
      usuario: req.session.usuario,
      citas,
      fecha,
      diaAnterior: sumarDias(fecha, -1),
      diaSiguiente: sumarDias(fecha, 1),
      bloqueado: bloqueado.length > 0 ? bloqueado[0] : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar la agenda');
  }
});

// Cambia el estado de una cita, siempre validando que sea del medico logueado
// y que la transicion de estado tenga sentido.
function crearCambioEstado(estadosOrigen, estadoDestino) {
  return async (req, res) => {
    try {
      await pool.query(
        `UPDATE citas SET estado = ?
         WHERE id_cita = ? AND id_medico = ? AND estado IN (?)`,
        [estadoDestino, req.params.id, req.idMedico, estadosOrigen]
      );
    } catch (err) {
      console.error(err);
    }
    const fecha = req.body.fecha || hoyISO();
    res.redirect(`/medico/agenda?fecha=${fecha}`);
  };
}

router.post('/agenda/:id/confirmar', crearCambioEstado(['pendiente'], 'confirmada'));
router.post('/agenda/:id/atender', crearCambioEstado(['pendiente', 'confirmada'], 'atendida'));
router.post('/agenda/:id/cancelar', crearCambioEstado(['pendiente', 'confirmada'], 'cancelada'));

// ------------------- DIAS BLOQUEADOS -------------------

router.get('/dias-bloqueados', async (req, res) => {
  try {
    const [bloqueos] = await pool.query(
      `SELECT id_bloqueo, fecha, motivo, estado FROM dias_bloqueados
       WHERE id_medico = ? ORDER BY (estado = 'pendiente') DESC, fecha`,
      [req.idMedico]
    );
    res.render('medico/dias-bloqueados', {
      usuario: req.session.usuario,
      bloqueos,
      error: null,
      aviso: null,
      hoy: hoyISO()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar las solicitudes de bloqueo');
  }
});

router.post('/dias-bloqueados/nuevo', async (req, res) => {
  const { fecha, motivo } = req.body;

  const volverConMensaje = async (error, aviso) => {
    const [bloqueos] = await pool.query(
      `SELECT id_bloqueo, fecha, motivo, estado FROM dias_bloqueados
       WHERE id_medico = ? ORDER BY (estado = 'pendiente') DESC, fecha`,
      [req.idMedico]
    );
    res.render('medico/dias-bloqueados', {
      usuario: req.session.usuario,
      bloqueos,
      error,
      aviso,
      hoy: hoyISO()
    });
  };

  if (!fecha) {
    return volverConMensaje('Selecciona una fecha', null);
  }
  if (fecha < hoyISO()) {
    return volverConMensaje('No puedes solicitar el bloqueo de una fecha pasada', null);
  }

  try {
    await pool.query(
      "INSERT INTO dias_bloqueados (id_medico, fecha, motivo, estado) VALUES (?, ?, ?, 'pendiente')",
      [req.idMedico, fecha, motivo || null]
    );

    // Si ya habia citas ese dia, avisamos para que el medico las revise (no se cancelan solas
    // ni siquiera cuando el admin apruebe la solicitud)
    const [citasExistentes] = await pool.query(
      `SELECT COUNT(*) AS total FROM citas
       WHERE id_medico = ? AND fecha = ? AND estado IN ('pendiente', 'confirmada')`,
      [req.idMedico, fecha]
    );

    if (citasExistentes[0].total > 0) {
      return volverConMensaje(
        null,
        `Solicitud enviada al administrador. Ojo: ya tenias ${citasExistentes[0].total} cita(s) agendada(s) ese dia, ` +
        `revisalas en tu agenda porque no se cancelan automaticamente.`
      );
    }

    return volverConMensaje(null, 'Solicitud enviada. Quedara bloqueado el dia una vez que el administrador la apruebe.');
  } catch (err) {
    console.error(err);
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ya tienes una solicitud o un bloqueo para esa fecha'
      : 'Error al enviar la solicitud';
    volverConMensaje(mensaje, null);
  }
});

router.post('/dias-bloqueados/:id/eliminar', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM dias_bloqueados WHERE id_bloqueo = ? AND id_medico = ?',
      [req.params.id, req.idMedico]
    );
  } catch (err) {
    console.error(err);
  }
  res.redirect('/medico/dias-bloqueados');
});

module.exports = router;
