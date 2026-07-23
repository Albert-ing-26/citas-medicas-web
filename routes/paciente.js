const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole } = require('../middlewares/auth');
const { generarSlots, horaAMinutos, minutosAHora } = require('../utils/horarios');

router.use(requireRole('paciente'));

// Toda ruta de paciente necesita su id_paciente (no solo el id_usuario de la sesion)
router.use((req, res, next) => {
  try {
    if (!req.session.usuario || req.session.usuario.rol !== 'paciente') {
      return res.status(500).send('No se encontro el perfil de paciente para este usuario');
    }
    req.idPaciente = req.session.usuario.id;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el perfil de paciente');
  }
});

router.get('/', async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        SUM(estado IN ('pendiente','confirmada') AND fecha >= CURDATE()) AS proximasCitas,
        SUM(estado = 'atendida') AS citasAtendidas
      FROM citas
      WHERE id_paciente = ?
    `, [req.idPaciente]);

    res.render('paciente/dashboard', {
      usuario: req.session.usuario,
      proximasCitas: stats.proximasCitas || 0,
      citasAtendidas: stats.citasAtendidas || 0
    });
  } catch (err) {
    console.error(err);
    res.render('paciente/dashboard', { usuario: req.session.usuario, proximasCitas: 0, citasAtendidas: 0 });
  }
});

// ------------------- RESERVAR CITA -------------------

// Devuelve la fecha de hoy en formato YYYY-MM-DD (hora local del servidor)
function hoyISO() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const d = ahora.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getReservaMinFecha() {
  const ahora = new Date();
  ahora.setDate(ahora.getDate() + 1); // mañana
  const y = ahora.getFullYear();
  const m = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const d = ahora.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getReservaMaxFecha() {
  const ahora = new Date();
  ahora.setDate(ahora.getDate() + 14); // 2 semanas
  const y = ahora.getFullYear();
  const m = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const d = ahora.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

router.get('/reservar', async (req, res) => {
  const { id_especialidad, id_medico, fecha } = req.query;

  try {
    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');

    let medicos = [];
    if (id_especialidad) {
      const [rows] = await pool.query(`
        SELECT id_medico, nombre, apellidos
        FROM medicos
        WHERE id_especialidad = ? AND estado = 'activo'
        ORDER BY apellidos, nombre
      `, [id_especialidad]);
      medicos = rows;
    }

    let slots = [];
    let mensajeSlots = null;
    let medicoSeleccionado = null;

    if (id_especialidad && id_medico && fecha) {
      const minFecha = getReservaMinFecha();
      const maxFecha = getReservaMaxFecha();
      // Validar que la fecha no esté fuera de los límites
      if (fecha < minFecha) {
        mensajeSlots = 'Debes reservar con al menos 1 día de anticipación';
      } else if (fecha > maxFecha) {
        mensajeSlots = 'Solo puedes reservar hasta con 2 semanas de anticipación';
      } else {
        const [medicoRows] = await pool.query(`
          SELECT m.id_medico, e.duracion_cita_minutos, m.nombre, m.apellidos
          FROM medicos m
          JOIN especialidades e ON e.id_especialidad = m.id_especialidad
          WHERE m.id_medico = ? AND m.id_especialidad = ?
        `, [id_medico, id_especialidad]);

        if (medicoRows.length === 0) {
          mensajeSlots = 'Selecciona un medico valido para esa especialidad';
        } else {
          medicoSeleccionado = medicoRows[0];

          // ¿El medico bloqueo este dia completo?
          const [bloqueado] = await pool.query(
            "SELECT 1 FROM dias_bloqueados WHERE id_medico = ? AND fecha = ? AND estado = 'aprobado'",
            [id_medico, fecha]
          );

          if (bloqueado.length > 0) {
            mensajeSlots = 'El medico no atiende ese dia. Elige otra fecha.';
          } else {
            const [bloques] = await pool.query('SELECT hora_inicio, hora_fin FROM bloques_horario ORDER BY hora_inicio');
            const todosLosSlots = generarSlots(bloques, medicoSeleccionado.duracion_cita_minutos);

            const [citasExistentes] = await pool.query(
              `SELECT hora_inicio FROM citas
               WHERE id_medico = ? AND fecha = ? AND estado != 'cancelada'`,
              [id_medico, fecha]
            );
            const ocupados = new Set(citasExistentes.map(c => c.hora_inicio));

            let disponibles = todosLosSlots.filter(s => !ocupados.has(s));

            // Si la fecha elegida es hoy, ocultar horarios que ya pasaron
            if (fecha === hoyISO()) {
              const ahora = new Date();
              const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
              disponibles = disponibles.filter(s => horaAMinutos(s) > minutosAhora);
            }

            slots = disponibles;
            if (slots.length === 0) {
              mensajeSlots = 'No hay horarios disponibles para esa fecha. Prueba con otro dia.';
            }
          }
        }
      }
    }

    res.render('paciente/reservar', {
      usuario: req.session.usuario,
      especialidades,
      medicos,
      slots,
      mensajeSlots,
      medicoSeleccionado,
      seleccion: { id_especialidad, id_medico, fecha },
      error: null,
      hoy: hoyISO(),
      minFecha: getReservaMinFecha(),
      maxFecha: getReservaMaxFecha()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el formulario de reserva');
  }
});

router.post('/reservar', async (req, res) => {
  const { id_especialidad, id_medico, fecha, hora_inicio, motivo_consulta } = req.body;

  const volverAlFormulario = async (mensajeError) => {
    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');
    let medicos = [];
    if (id_especialidad) {
      const [rows] = await pool.query(`
        SELECT id_medico, nombre, apellidos
        FROM medicos
        WHERE id_especialidad = ? AND estado = 'activo'
        ORDER BY apellidos, nombre
      `, [id_especialidad]);
      medicos = rows;
    }
    res.render('paciente/reservar', {
      usuario: req.session.usuario,
      especialidades,
      medicos,
      slots: [],
      mensajeSlots: null,
      medicoSeleccionado: null,
      seleccion: { id_especialidad, id_medico, fecha },
      error: mensajeError,
      hoy: hoyISO(),
      minFecha: getReservaMinFecha(),
      maxFecha: getReservaMaxFecha()
    });
  };

  if (!id_especialidad || !id_medico || !fecha || !hora_inicio || !motivo_consulta) {
    return volverAlFormulario('Completa todos los campos, incluyendo el motivo de la consulta');
  }

  const minFecha = getReservaMinFecha();
  const maxFecha = getReservaMaxFecha();
  if (fecha < minFecha || fecha > maxFecha) {
    return volverAlFormulario('La fecha seleccionada debe ser desde mañana y hasta dentro de dos semanas');
  }

  try {
    const [medicoRows] = await pool.query(`
      SELECT e.duracion_cita_minutos
      FROM medicos m
      JOIN especialidades e ON e.id_especialidad = m.id_especialidad
      WHERE m.id_medico = ? AND m.id_especialidad = ?
    `, [id_medico, id_especialidad]);

    if (medicoRows.length === 0) {
      return volverAlFormulario('El medico seleccionado no es valido');
    }

    const duracion = medicoRows[0].duracion_cita_minutos;
    const horaFin = minutosAHora(horaAMinutos(hora_inicio) + duracion);

    // ¿Dia bloqueado por el medico? (revalidacion por si cambio entre que se mostro el formulario y se envio)
    const [bloqueado] = await pool.query(
      "SELECT 1 FROM dias_bloqueados WHERE id_medico = ? AND fecha = ? AND estado = 'aprobado'",
      [id_medico, fecha]
    );
    if (bloqueado.length > 0) {
      return volverAlFormulario('El medico ya no atiende ese dia. Elige otra fecha.');
    }

    await pool.query(
      `INSERT INTO citas (id_medico, id_paciente, fecha, hora_inicio, hora_fin, motivo_consulta, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [id_medico, req.idPaciente, fecha, hora_inicio, horaFin, motivo_consulta]
    );

    res.redirect('/paciente/mis-citas');

  } catch (err) {
    console.error(err);
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ese horario ya fue reservado por otro paciente. Elige otro horario.'
      : 'Ocurrio un error al reservar la cita';
    volverAlFormulario(mensaje);
  }
});

// ------------------- MIS CITAS -------------------

router.get('/mis-citas', async (req, res) => {
  try {
    const [citas] = await pool.query(`
      SELECT c.id_cita, c.fecha, c.hora_inicio, c.hora_fin, c.motivo_consulta, c.estado,
             m.nombre AS medico_nombre, m.apellidos AS medico_apellidos, e.nombre AS especialidad
      FROM citas c
      JOIN medicos m ON m.id_medico = c.id_medico
      JOIN especialidades e ON e.id_especialidad = m.id_especialidad
      WHERE c.id_paciente = ?
      ORDER BY c.fecha DESC, c.hora_inicio DESC
    `, [req.idPaciente]);

    const hoy = hoyISO();
    const ahora = new Date();
    const horaActual = ahora.toTimeString().split(' ')[0]; // Formato HH:MM:SS

    const processedCitas = citas.map(c => {
      const fechaCitaStr = c.fecha.toISOString 
        ? c.fecha.toISOString().substring(0, 10) 
        : c.fecha;
      
      const esPasada = (fechaCitaStr < hoy) || (fechaCitaStr === hoy && c.hora_inicio < horaActual);
      
      let estadoMostrar = c.estado;
      if (esPasada) {
        if (c.estado !== 'atendida') {
          estadoMostrar = 'cancelada';
        }
      }

      return {
        ...c,
        esPasada,
        estado: estadoMostrar
      };
    });

    res.render('paciente/mis-citas', {
      usuario: req.session.usuario,
      citas: processedCitas,
      mensaje: req.query.ok ? 'Cita cancelada correctamente' : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar tus citas');
  }
});

router.post('/mis-citas/:id/cancelar', async (req, res) => {
  try {
    // 1. Validar que la cita pertenece al paciente autenticado y obtener datos de fecha/hora
    const [citas] = await pool.query(
      'SELECT fecha, hora_inicio FROM citas WHERE id_cita = ? AND id_paciente = ?',
      [req.params.id, req.idPaciente]
    );
    if (citas.length === 0) {
      return res.status(403).send('No tienes permiso para cancelar esta cita');
    }

    const hoy = hoyISO();
    const ahora = new Date();
    const horaActual = ahora.toTimeString().split(' ')[0];
    const c = citas[0];
    const fechaCitaStr = c.fecha.toISOString ? c.fecha.toISOString().substring(0, 10) : c.fecha;
    const esPasada = (fechaCitaStr < hoy) || (fechaCitaStr === hoy && c.hora_inicio < horaActual);

    if (esPasada) {
      return res.status(400).send('No se puede cancelar una cita que ya pasó');
    }

    // 2. Llamar al procedimiento almacenado spcancelarcita
    await pool.query('CALL spcancelarcita(?)', [req.params.id]);
    res.redirect('/paciente/mis-citas?ok=1');
  } catch (err) {
    console.error(err);
    const mensaje = err.sqlMessage || 'Error al cancelar la cita';
    res.status(400).send(mensaje);
  }
});

module.exports = router;
