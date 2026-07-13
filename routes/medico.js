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

router.get('/', (req, res) => {
  res.render('medico/dashboard', { usuario: req.session.usuario });
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
    const [citas] = await pool.query(`
      SELECT c.id_cita, c.hora_inicio, c.hora_fin, c.motivo_consulta, c.estado,
             u.nombre AS paciente_nombre, u.apellidos AS paciente_apellidos,
             p.dni, u.telefono
      FROM citas c
      JOIN pacientes p ON p.id_paciente = c.id_paciente
      JOIN usuarios u ON u.id_usuario = p.id_usuario
      WHERE c.id_medico = ? AND c.fecha = ?
      ORDER BY c.hora_inicio
    `, [req.idMedico, fecha]);

    const [bloqueado] = await pool.query(
      'SELECT motivo FROM dias_bloqueados WHERE id_medico = ? AND fecha = ?',
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
      `SELECT id_bloqueo, fecha, motivo FROM dias_bloqueados
       WHERE id_medico = ? ORDER BY fecha`,
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
    res.status(500).send('Error al cargar los dias bloqueados');
  }
});

router.post('/dias-bloqueados/nuevo', async (req, res) => {
  const { fecha, motivo } = req.body;

  const volverConMensaje = async (error, aviso) => {
    const [bloqueos] = await pool.query(
      `SELECT id_bloqueo, fecha, motivo FROM dias_bloqueados
       WHERE id_medico = ? ORDER BY fecha`,
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
    return volverConMensaje('No puedes bloquear una fecha pasada', null);
  }

  try {
    await pool.query(
      'INSERT INTO dias_bloqueados (id_medico, fecha, motivo) VALUES (?, ?, ?)',
      [req.idMedico, fecha, motivo || null]
    );

    // Si ya habia citas ese dia, avisamos para que el medico las revise (no se cancelan solas)
    const [citasExistentes] = await pool.query(
      `SELECT COUNT(*) AS total FROM citas
       WHERE id_medico = ? AND fecha = ? AND estado IN ('pendiente', 'confirmada')`,
      [req.idMedico, fecha]
    );

    if (citasExistentes[0].total > 0) {
      return volverConMensaje(
        null,
        `Dia bloqueado. Ojo: ya tenias ${citasExistentes[0].total} cita(s) agendada(s) ese dia, ` +
        `revisalas en tu agenda porque no se cancelan automaticamente.`
      );
    }

    res.redirect('/medico/dias-bloqueados');
  } catch (err) {
    console.error(err);
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ya tienes bloqueada esa fecha'
      : 'Error al bloquear la fecha';
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
