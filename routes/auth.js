const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM usuarios WHERE correo = ? AND activo = TRUE',
      [correo]
    );

    if (rows.length === 0) {
      return res.render('login', { error: 'Correo o contrasena incorrectos' });
    }

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.contrasena_hash);

    if (!passwordValida) {
      return res.render('login', { error: 'Correo o contrasena incorrectos' });
    }

    req.session.usuario = {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      rol: usuario.rol
    };

    if (usuario.rol === 'admin') return res.redirect('/admin');
    if (usuario.rol === 'medico') return res.redirect('/medico');
    return res.redirect('/paciente');

  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Ocurrio un error, intenta de nuevo' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ------------------- REGISTRO DE PACIENTE (auto-registro) -------------------

router.get('/registro', (req, res) => {
  res.render('registro', { error: null, datos: {} });
});

router.post('/registro', async (req, res) => {
  const { nombre, apellidos, correo, password, telefono, dni, fecha_nacimiento, direccion } = req.body;

  if (!nombre || !apellidos || !correo || !password || !dni) {
    return res.render('registro', {
      error: 'Nombre, apellidos, correo, DNI y contrasena son obligatorios',
      datos: req.body
    });
  }

  const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
  const dniRegex = /^[0-9]{8}$/;

  if (!nameRegex.test(nombre) || !nameRegex.test(apellidos)) {
    return res.render('registro', {
      error: 'El nombre y los apellidos solo deben contener letras y espacios',
      datos: req.body
    });
  }

  if (!dniRegex.test(dni)) {
    return res.render('registro', {
      error: 'El DNI debe contener exactamente 8 números',
      datos: req.body
    });
  }

  // --- Validación de fecha de nacimiento ---
  if (!fecha_nacimiento) {
    return res.render('registro', {
      error: 'La fecha de nacimiento es obligatoria',
      datos: req.body
    });
  }

  const fechaNac = new Date(fecha_nacimiento + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (isNaN(fechaNac.getTime())) {
    return res.render('registro', {
      error: 'La fecha de nacimiento no es válida',
      datos: req.body
    });
  }

  if (fechaNac > hoy) {
    return res.render('registro', {
      error: 'La fecha de nacimiento no puede ser una fecha futura',
      datos: req.body
    });
  }

  const fechaMin18 = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
  if (fechaNac > fechaMin18) {
    return res.render('registro', {
      error: 'Debe tener 18 años o más para registrarse',
      datos: req.body
    });
  }
  // -----------------------------------------

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);

    const [resultUsuario] = await conn.query(
      `INSERT INTO usuarios (nombre, apellidos, correo, contrasena_hash, telefono, rol)
       VALUES (?, ?, ?, ?, ?, 'paciente')`,
      [nombre, apellidos, correo, hash, telefono || null]
    );

    await conn.query(
      `INSERT INTO pacientes (id_usuario, dni, fecha_nacimiento, direccion)
       VALUES (?, ?, ?, ?)`,
      [resultUsuario.insertId, dni, fecha_nacimiento || null, direccion || null]
    );

    await conn.commit();

    // Autologin tras registrarse
    req.session.usuario = {
      id_usuario: resultUsuario.insertId,
      nombre,
      rol: 'paciente'
    };
    res.redirect('/paciente');

  } catch (err) {
    await conn.rollback();
    console.error(err);
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ese correo o ese DNI ya estan registrados'
      : 'Ocurrio un error al registrarte, intenta de nuevo';
    res.render('registro', { error: mensaje, datos: req.body });
  } finally {
    conn.release();
  }
});

module.exports = router;
