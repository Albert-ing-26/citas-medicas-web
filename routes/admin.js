const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { requireRole } = require('../middlewares/auth');

router.use(requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    const [[especialidades]] = await pool.query('SELECT COUNT(*) AS total FROM especialidades');
    const [[medicos]] = await pool.query(`
      SELECT COUNT(*) AS total FROM medicos m
      JOIN usuarios u ON u.id_usuario = m.id_usuario
      WHERE u.activo = TRUE
    `);
    const [[pacientes]] = await pool.query(`
      SELECT COUNT(*) AS total FROM pacientes p
      JOIN usuarios u ON u.id_usuario = p.id_usuario
      WHERE u.activo = TRUE
    `);
    const [[citasHoy]] = await pool.query(
      `SELECT COUNT(*) AS total FROM citas WHERE fecha = CURDATE() AND estado != 'cancelada'`
    );
    const [[solicitudes]] = await pool.query(
      `SELECT COUNT(*) AS total FROM dias_bloqueados WHERE estado = 'pendiente'`
    );

    res.render('admin/dashboard', {
      usuario: req.session.usuario,
      totalEspecialidades: especialidades.total,
      totalMedicos: medicos.total,
      totalPacientes: pacientes.total,
      citasHoy: citasHoy.total,
      solicitudesPendientes: solicitudes.total
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', {
      usuario: req.session.usuario,
      totalEspecialidades: 0, totalMedicos: 0, totalPacientes: 0, citasHoy: 0, solicitudesPendientes: 0
    });
  }
});

// ------------------- ESPECIALIDADES -------------------

// Listar todas las especialidades
router.get('/especialidades', async (req, res) => {
  try {
    const [especialidades] = await pool.query(
      'SELECT * FROM especialidades ORDER BY nombre'
    );
    res.render('admin/especialidades/index', {
      usuario: req.session.usuario,
      especialidades,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar especialidades');
  }
});

// Mostrar formulario para crear una especialidad nueva
router.get('/especialidades/nueva', (req, res) => {
  res.render('admin/especialidades/form', {
    usuario: req.session.usuario,
    especialidad: null,
    error: null
  });
});

// Guardar la especialidad nueva
router.post('/especialidades/nueva', async (req, res) => {
  const { nombre, duracion_cita_minutos } = req.body;
  try {
    await pool.query(
      'INSERT INTO especialidades (nombre, duracion_cita_minutos) VALUES (?, ?)',
      [nombre, duracion_cita_minutos]
    );
    res.redirect('/admin/especialidades');
  } catch (err) {
    console.error(err);
    // ER_DUP_ENTRY si el nombre ya existe (nombre es UNIQUE)
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ya existe una especialidad con ese nombre'
      : 'Error al guardar la especialidad';
    res.render('admin/especialidades/form', {
      usuario: req.session.usuario,
      especialidad: { nombre, duracion_cita_minutos },
      error: mensaje
    });
  }
});

// Mostrar formulario para editar una especialidad existente
router.get('/especialidades/:id/editar', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM especialidades WHERE id_especialidad = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.redirect('/admin/especialidades');

    res.render('admin/especialidades/form', {
      usuario: req.session.usuario,
      especialidad: rows[0],
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar la especialidad');
  }
});

// Guardar los cambios de una especialidad editada
router.post('/especialidades/:id/editar', async (req, res) => {
  const { nombre, duracion_cita_minutos } = req.body;
  try {
    await pool.query(
      'UPDATE especialidades SET nombre = ?, duracion_cita_minutos = ? WHERE id_especialidad = ?',
      [nombre, duracion_cita_minutos, req.params.id]
    );
    res.redirect('/admin/especialidades');
  } catch (err) {
    console.error(err);
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ya existe una especialidad con ese nombre'
      : 'Error al actualizar la especialidad';
    res.render('admin/especialidades/form', {
      usuario: req.session.usuario,
      especialidad: { id_especialidad: req.params.id, nombre, duracion_cita_minutos },
      error: mensaje
    });
  }
});

// Eliminar una especialidad
router.post('/especialidades/:id/eliminar', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM especialidades WHERE id_especialidad = ?',
      [req.params.id]
    );
    res.redirect('/admin/especialidades');
  } catch (err) {
    console.error(err);
    // ER_ROW_IS_REFERENCED si ya hay medicos usando esa especialidad
    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');
    res.render('admin/especialidades/index', {
      usuario: req.session.usuario,
      especialidades,
      error: 'No se puede eliminar: hay medicos registrados con esa especialidad'
    });
  }
});

// ------------------- MEDICOS -------------------

// Listar todos los medicos con su especialidad
router.get('/medicos', async (req, res) => {
  try {
    const [medicos] = await pool.query(`
      SELECT m.id_medico, m.colegiatura, u.nombre, u.apellidos, u.correo,
             u.telefono, u.activo, e.nombre AS especialidad
      FROM medicos m
      JOIN usuarios u ON u.id_usuario = m.id_usuario
      JOIN especialidades e ON e.id_especialidad = m.id_especialidad
      ORDER BY u.apellidos, u.nombre
    `);
    res.render('admin/medicos/index', {
      usuario: req.session.usuario,
      medicos,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar medicos');
  }
});

// Mostrar formulario para crear un medico nuevo
router.get('/medicos/nuevo', async (req, res) => {
  try {
    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');
    res.render('admin/medicos/form', {
      usuario: req.session.usuario,
      medico: null,
      especialidades,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el formulario');
  }
});

// Guardar el medico nuevo (crea usuario + perfil medico en una transaccion)
router.post('/medicos/nuevo', async (req, res) => {
  const { nombre, apellidos, correo, telefono, id_especialidad, colegiatura, password } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);

    const [resultUsuario] = await conn.query(
      `INSERT INTO usuarios (nombre, apellidos, correo, contrasena_hash, telefono, rol)
       VALUES (?, ?, ?, ?, ?, 'medico')`,
      [nombre, apellidos, correo, hash, telefono]
    );

    await conn.query(
      'INSERT INTO medicos (id_usuario, id_especialidad, colegiatura) VALUES (?, ?, ?)',
      [resultUsuario.insertId, id_especialidad, colegiatura]
    );

    await conn.commit();
    res.redirect('/admin/medicos');

  } catch (err) {
    await conn.rollback();
    console.error(err);

    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ese correo o esa colegiatura ya estan registrados'
      : 'Error al guardar el medico';

    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');
    res.render('admin/medicos/form', {
      usuario: req.session.usuario,
      medico: { nombre, apellidos, correo, telefono, id_especialidad, colegiatura },
      especialidades,
      error: mensaje
    });
  } finally {
    conn.release();
  }
});

// Mostrar formulario para editar un medico existente
router.get('/medicos/:id/editar', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.id_medico, m.id_especialidad, m.colegiatura,
             u.id_usuario, u.nombre, u.apellidos, u.correo, u.telefono
      FROM medicos m
      JOIN usuarios u ON u.id_usuario = m.id_usuario
      WHERE m.id_medico = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.redirect('/admin/medicos');

    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');

    res.render('admin/medicos/form', {
      usuario: req.session.usuario,
      medico: rows[0],
      especialidades,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el medico');
  }
});

// Guardar los cambios de un medico editado (la contrasena solo cambia si se escribe una nueva)
router.post('/medicos/:id/editar', async (req, res) => {
  const { nombre, apellidos, correo, telefono, id_especialidad, colegiatura, password } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id_usuario FROM medicos WHERE id_medico = ?',
      [req.params.id]
    );
    const idUsuario = rows[0].id_usuario;

    if (password && password.trim() !== '') {
      const hash = await bcrypt.hash(password, 10);
      await conn.query(
        'UPDATE usuarios SET nombre=?, apellidos=?, correo=?, telefono=?, contrasena_hash=? WHERE id_usuario=?',
        [nombre, apellidos, correo, telefono, hash, idUsuario]
      );
    } else {
      await conn.query(
        'UPDATE usuarios SET nombre=?, apellidos=?, correo=?, telefono=? WHERE id_usuario=?',
        [nombre, apellidos, correo, telefono, idUsuario]
      );
    }

    await conn.query(
      'UPDATE medicos SET id_especialidad=?, colegiatura=? WHERE id_medico=?',
      [id_especialidad, colegiatura, req.params.id]
    );

    await conn.commit();
    res.redirect('/admin/medicos');

  } catch (err) {
    await conn.rollback();
    console.error(err);

    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ese correo o esa colegiatura ya estan registrados'
      : 'Error al actualizar el medico';

    const [especialidades] = await pool.query('SELECT * FROM especialidades ORDER BY nombre');
    res.render('admin/medicos/form', {
      usuario: req.session.usuario,
      medico: { id_medico: req.params.id, nombre, apellidos, correo, telefono, id_especialidad, colegiatura },
      especialidades,
      error: mensaje
    });
  } finally {
    conn.release();
  }
});

// Bloquear o reactivar la cuenta de un medico (activo = FALSE le impide iniciar sesion)
router.post('/medicos/:id/bloquear', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_usuario FROM medicos WHERE id_medico = ?',
      [req.params.id]
    );
    if (rows.length > 0) {
      await pool.query(
        'UPDATE usuarios SET activo = NOT activo WHERE id_usuario = ?',
        [rows[0].id_usuario]
      );
    }
    res.redirect('/admin/medicos');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al actualizar el estado del medico');
  }
});

// ------------------- PACIENTES -------------------

// Listar todos los pacientes
router.get('/pacientes', async (req, res) => {
  try {
    const [pacientes] = await pool.query(`
      SELECT p.id_paciente, p.dni, p.fecha_nacimiento, p.direccion,
             u.id_usuario, u.nombre, u.apellidos, u.correo, u.telefono, u.activo
      FROM pacientes p
      JOIN usuarios u ON u.id_usuario = p.id_usuario
      ORDER BY u.apellidos, u.nombre
    `);
    res.render('admin/pacientes/index', {
      usuario: req.session.usuario,
      pacientes,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar pacientes');
  }
});

// Bloquear o reactivar la cuenta de un paciente (activo = FALSE le impide iniciar sesion)
router.post('/pacientes/:id/bloquear', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_usuario FROM pacientes WHERE id_paciente = ?',
      [req.params.id]
    );
    if (rows.length > 0) {
      await pool.query(
        'UPDATE usuarios SET activo = NOT activo WHERE id_usuario = ?',
        [rows[0].id_usuario]
      );
    }
    res.redirect('/admin/pacientes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al actualizar el estado del paciente');
  }
});

// Ver citas de un paciente por DNI usando el procedimiento almacenado splistarcitaspaciente
router.get('/pacientes/:id/citas', async (req, res) => {
  try {
    const [pacienteRows] = await pool.query(
      `SELECT p.dni, u.nombre, u.apellidos
       FROM pacientes p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_paciente = ?`,
      [req.params.id]
    );

    if (pacienteRows.length === 0) {
      return res.status(404).send('Paciente no encontrado');
    }

    const paciente = pacienteRows[0];

    const [result] = await pool.query('CALL splistarcitaspaciente(?)', [paciente.dni]);
    const citas = result[0];

    res.render('admin/pacientes/citas', {
      usuario: req.session.usuario,
      paciente,
      citas
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener las citas del paciente');
  }
});


// ------------------- REPORTES -------------------

router.get('/reportes', async (req, res) => {
  // Rango de fechas opcional; si no se especifica, se muestran todas las citas registradas
  const fechaDesde = req.query.fecha_desde || '1970-01-01';
  const fechaHasta = req.query.fecha_hasta || '2100-12-31';
  try {
    const [result] = await pool.query('CALL spreportecitasxestado(?, ?)', [fechaDesde, fechaHasta]);
    const porEstado = result[0];

    const [porEspecialidad] = await pool.query(
      `SELECT e.nombre AS especialidad,
              COUNT(c.id_cita) AS total,
              SUM(c.estado = 'atendida') AS atendidas,
              SUM(c.estado = 'cancelada') AS canceladas
       FROM citas c
       JOIN medicos m ON m.id_medico = c.id_medico
       JOIN especialidades e ON e.id_especialidad = m.id_especialidad
       WHERE c.fecha BETWEEN ? AND ?
       GROUP BY e.id_especialidad, e.nombre
       ORDER BY total DESC`,
      [fechaDesde, fechaHasta]
    );

    const [porMedico] = await pool.query(
      `SELECT u.nombre, u.apellidos, esp.nombre AS especialidad,
              COUNT(c.id_cita) AS total,
              SUM(c.estado = 'atendida') AS atendidas,
              SUM(c.estado = 'cancelada') AS canceladas
       FROM citas c
       JOIN medicos m ON m.id_medico = c.id_medico
       JOIN usuarios u ON u.id_usuario = m.id_usuario
       JOIN especialidades esp ON esp.id_especialidad = m.id_especialidad
       WHERE c.fecha BETWEEN ? AND ?
       GROUP BY m.id_medico, u.nombre, u.apellidos, esp.nombre
       ORDER BY total DESC`,
      [fechaDesde, fechaHasta]
    );

    // Normalizamos los 4 estados posibles para que siempre aparezcan, aunque tengan 0 citas
    const estadosPosibles = ['pendiente', 'confirmada', 'atendida', 'cancelada'];
    const conteoEstados = {};
    estadosPosibles.forEach(e => { conteoEstados[e] = 0; });
    porEstado.forEach(fila => { conteoEstados[fila.estado] = fila.total; });

    const totalCitas = estadosPosibles.reduce((acc, e) => acc + conteoEstados[e], 0);

    res.render('admin/reportes', {
      usuario: req.session.usuario,
      conteoEstados,
      totalCitas,
      porEspecialidad,
      porMedico,
      fechaDesde: req.query.fecha_desde || '',
      fechaHasta: req.query.fecha_hasta || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al generar los reportes');
  }
});

// ------------------- SOLICITUDES DE BLOQUEO -------------------

router.get('/solicitudes-bloqueo', async (req, res) => {
  try {
    const [solicitudes] = await pool.query(`
      SELECT b.id_bloqueo, b.fecha, b.motivo, b.estado,
             u.nombre, u.apellidos, e.nombre AS especialidad,
             (SELECT COUNT(*) FROM citas c
              WHERE c.id_medico = b.id_medico AND c.fecha = b.fecha
                AND c.estado IN ('pendiente','confirmada')) AS citas_afectadas
      FROM dias_bloqueados b
      JOIN medicos m ON m.id_medico = b.id_medico
      JOIN usuarios u ON u.id_usuario = m.id_usuario
      JOIN especialidades e ON e.id_especialidad = m.id_especialidad
      ORDER BY (b.estado = 'pendiente') DESC, b.fecha
    `);
    res.render('admin/solicitudes-bloqueo', {
      usuario: req.session.usuario,
      solicitudes,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar las solicitudes de bloqueo');
  }
});

router.post('/solicitudes-bloqueo/:id/aprobar', async (req, res) => {
  try {
    await pool.query(
      "UPDATE dias_bloqueados SET estado = 'aprobado' WHERE id_bloqueo = ? AND estado = 'pendiente'",
      [req.params.id]
    );
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin/solicitudes-bloqueo');
});

router.post('/solicitudes-bloqueo/:id/rechazar', async (req, res) => {
  try {
    await pool.query(
      "UPDATE dias_bloqueados SET estado = 'rechazado' WHERE id_bloqueo = ? AND estado = 'pendiente'",
      [req.params.id]
    );
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin/solicitudes-bloqueo');
});

module.exports = router;
