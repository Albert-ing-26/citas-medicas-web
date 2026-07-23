const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole } = require('../middlewares/auth');

router.use(requireRole('medico'));

// Toda ruta de medico necesita su id_medico (no solo el id_usuario de la sesion)
router.use((req, res, next) => {
  try {
    if (!req.session.usuario || req.session.usuario.rol !== 'medico') {
      return res.status(500).send('No se encontro el perfil de medico para este usuario');
    }
    req.idMedico = req.session.usuario.id;
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

    // PASO 2: DETECTAR "CITA EN CURSO" PARA EL BANNER
    let citaEnCurso = null;
    try {
      const [citasDeHoy] = await pool.query(`
        SELECT
          c.id_cita,
          c.fecha,
          c.hora_inicio,
          c.hora_fin,
          c.estado,
          p.nombre AS nombre_paciente,
          p.apellidos AS apellidos_paciente
        FROM citas c
        INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
        WHERE c.id_medico = ? AND c.fecha = CURDATE() AND c.estado IN ('confirmada', 'pendiente')
        ORDER BY c.hora_inicio ASC
      `, [req.idMedico]);

      console.log('[DEBUG] Citas de hoy encontradas:', citasDeHoy.length);
      citasDeHoy.forEach((cita, idx) => {
        const fechaStr = cita.fecha.toISOString().split('T')[0];
        const inProgress = isAppointmentInProgress(fechaStr, cita.hora_inicio, cita.hora_fin);
        console.log(`[DEBUG] Cita ${idx + 1}: ${cita.nombre_paciente} - ${cita.hora_inicio} - Estado: ${cita.estado} - En Curso: ${inProgress}`);
      });

      // Busca la primera cita que esté en curso (dentro del rango + 30 min de tolerancia)
      for (const cita of citasDeHoy) {
        const fechaStr = cita.fecha.toISOString().split('T')[0];
        if (isAppointmentInProgress(fechaStr, cita.hora_inicio, cita.hora_fin) && cita.estado === 'confirmada') {
          citaEnCurso = {
            id_cita: cita.id_cita,
            nombre_paciente: cita.nombre_paciente,
            apellidos_paciente: cita.apellidos_paciente,
            hora_inicio: cita.hora_inicio.substring(0, 5), // Formato HH:mm
            hora_fin: cita.hora_fin.substring(0, 5)
          };
          console.log('[DEBUG] ✅ CITA EN CURSO DETECTADA:', citaEnCurso);
          break;
        }
      }
      if (!citaEnCurso) {
        console.log('[DEBUG] ❌ No se detectó cita en curso (podría estar en "pendiente" o no estar en rango horario)');
      }
    } catch (err) {
      console.error('Error al detectar cita en curso:', err);
    }

    res.render('medico/dashboard', {
      usuario: req.session.usuario,
      citasHoy: stats.citasHoy || 0,
      citasPendientes: stats.citasPendientes || 0,
      diasBloqueados: bloqueos.aprobados || 0,
      solicitudesPendientes: bloqueos.pendientes || 0,
      citaEnCurso: citaEnCurso
    });
  } catch (err) {
    console.error(err);
    res.render('medico/dashboard', { usuario: req.session.usuario, citasHoy: 0, citasPendientes: 0, diasBloqueados: 0, solicitudesPendientes: 0, citaEnCurso: null });
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

// ================ FUNCIONES HELPER DE TOLERANCIA DE 30 MINUTOS ================

/**
 * Devuelve true si la cita ha expirado (pasaron más de 30 minutos de la hora final)
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {string} horaFin - Hora en formato HH:mm:ss
 * @returns {boolean}
 */
function isAppointmentExpired(fecha, horaFin) {
  const hoy = hoyISO();
  
  // Si la cita es de un día anterior, está expirada
  if (fecha < hoy) {
    return true;
  }
  
  // Si la cita es de hoy, verifica si ya pasaron 30 minutos de la hora final
  if (fecha === hoy) {
    const ahora = new Date();
    const horaFinDate = new Date();
    const [horas, minutos, segundos] = horaFin.split(':').map(Number);
    horaFinDate.setHours(horas, minutos, segundos);
    
    // Suma 30 minutos a la hora final para aplicar tolerancia
    const toleranciaMs = 30 * 60 * 1000;
    const horaFinConTolerancia = new Date(horaFinDate.getTime() + toleranciaMs);
    
    return ahora > horaFinConTolerancia;
  }
  
  return false;
}

/**
 * Devuelve true si la cita está ocurriendo AHORA (dentro de su rango + tolerancia de 30 min)
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {string} horaInicio - Hora en formato HH:mm:ss
 * @param {string} horaFin - Hora en formato HH:mm:ss
 * @returns {boolean}
 */
function isAppointmentInProgress(fecha, horaInicio, horaFin) {
  const hoy = hoyISO();
  
  // La cita debe ser de hoy para estar en progreso
  if (fecha !== hoy) {
    return false;
  }
  
  const ahora = new Date();
  const horaInicioDate = new Date();
  const horaFinDate = new Date();
  
  const [hI, mI, sI] = horaInicio.split(':').map(Number);
  const [hF, mF, sF] = horaFin.split(':').map(Number);
  
  horaInicioDate.setHours(hI, mI, sI);
  horaFinDate.setHours(hF, mF, sF);
  
  // Suma 30 minutos de tolerancia a la hora final
  const toleranciaMs = 30 * 60 * 1000;
  const horaFinConTolerancia = new Date(horaFinDate.getTime() + toleranciaMs);
  
  return ahora >= horaInicioDate && ahora <= horaFinConTolerancia;
}

/**
 * Devuelve true si un botón de acción debe estar habilitado
 * Depende del estado actual de la cita y el tiempo transcurrido
 * @param {string} estado - Estado actual de la cita
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {string} horaInicio - Hora inicio en formato HH:mm:ss
 * @param {string} horaFin - Hora fin en formato HH:mm:ss
 * @returns {boolean}
 */
function isActionButtonEnabled(estado, fecha, horaInicio, horaFin) {
  // Solo citas confirmadas o pendientes pueden tener acciones
  if (!['pendiente', 'confirmada'].includes(estado)) {
    return false;
  }
  
  // Si está expirada, no se puede hacer nada
  if (isAppointmentExpired(fecha, horaFin)) {
    return false;
  }
  
  // Si está confirmada y está en progreso (o casi), se puede atender
  if (estado === 'confirmada') {
    return isAppointmentInProgress(fecha, horaInicio, horaFin) || 
           !isAppointmentExpired(fecha, horaInicio);
  }
  
  return true;
}

// ------------------- AGENDA -------------------

router.get('/agenda', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();

  try {
    const [citas] = await pool.query(`
      SELECT
        c.id_cita,
        c.fecha,
        c.hora_inicio,
        c.hora_fin,
        CONCAT(TIME_FORMAT(c.hora_inicio, '%H:%i'), ' - ', TIME_FORMAT(c.hora_fin, '%H:%i')) AS hora_rango,
        c.motivo_consulta AS motivo,
        c.estado,
        p.nombre AS nombre_paciente,
        p.apellidos AS apellidos_paciente,
        p.dni AS dni_paciente,
        p.telefono AS telefono_paciente
      FROM citas c
      INNER JOIN medicos m ON m.id_medico = c.id_medico
      INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
      WHERE m.id_medico = ? AND c.fecha = ?
      ORDER BY c.hora_inicio ASC, c.id_cita ASC
    `, [req.idMedico, fecha]);

    // PASO 1: Agregar información de estado y habilitación de botones
    const citasConEstado = citas.map(cita => {
      const fechaStr = cita.fecha.toISOString().split('T')[0];
      const isExpired = isAppointmentExpired(fechaStr, cita.hora_fin);
      const inProgress = isAppointmentInProgress(fechaStr, cita.hora_inicio, cita.hora_fin);
      const actionEnabled = isActionButtonEnabled(cita.estado, fechaStr, cita.hora_inicio, cita.hora_fin);
      
      return {
        ...cita,
        isExpired,
        inProgress,
        actionEnabled,
        estadoVisual: isExpired ? 'ausente' : cita.estado,
        horaMostrada: inProgress ? '⏱️ EN CURSO' : cita.hora_rango
      };
    });

    const [bloqueado] = await pool.query(
      "SELECT motivo, estado FROM dias_bloqueados WHERE id_medico = ? AND fecha = ? AND estado != 'rechazado'",
      [req.idMedico, fecha]
    );

    res.render('medico/agenda', {
      usuario: req.session.usuario,
      citas: citasConEstado,
      fecha,
      diaAnterior: sumarDias(fecha, -1),
      diaSiguiente: sumarDias(fecha, 1),
      bloqueado: bloqueado.length > 0 ? bloqueado[0] : null,
      hoy: hoyISO()
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
