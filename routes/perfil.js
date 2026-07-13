const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');

// Trae los datos actualizados del usuario logueado, con sus datos extra segun el rol
async function obtenerPerfil(idUsuario) {
  const [usuarios] = await pool.query(
    'SELECT id_usuario, nombre, apellidos, correo, telefono, rol FROM usuarios WHERE id_usuario = ?',
    [idUsuario]
  );
  if (usuarios.length === 0) return null;
  const datos = usuarios[0];

  if (datos.rol === 'medico') {
    const [medicos] = await pool.query(`
      SELECT m.colegiatura, e.nombre AS especialidad
      FROM medicos m JOIN especialidades e ON e.id_especialidad = m.id_especialidad
      WHERE m.id_usuario = ?
    `, [idUsuario]);
    datos.extra = medicos[0] || null;
  }

  if (datos.rol === 'paciente') {
    const [pacientes] = await pool.query(
      'SELECT dni, fecha_nacimiento, direccion FROM pacientes WHERE id_usuario = ?',
      [idUsuario]
    );
    datos.extra = pacientes[0] || null;
  }

  return datos;
}

router.get('/', async (req, res) => {
  try {
    const perfil = await obtenerPerfil(req.session.usuario.id_usuario);
    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: null,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el perfil');
  }
});

// Actualizar datos basicos (nombre, apellidos, correo, telefono, y direccion si es paciente)
router.post('/', async (req, res) => {
  const { nombre, apellidos, correo, telefono, direccion } = req.body;
  const idUsuario = req.session.usuario.id_usuario;

  try {
    await pool.query(
      'UPDATE usuarios SET nombre=?, apellidos=?, correo=?, telefono=? WHERE id_usuario=?',
      [nombre, apellidos, correo, telefono, idUsuario]
    );

    if (req.session.usuario.rol === 'paciente') {
      await pool.query(
        'UPDATE pacientes SET direccion=? WHERE id_usuario=?',
        [direccion, idUsuario]
      );
    }

    // Refrescar el nombre en la sesion para que se vea actualizado sin volver a iniciar sesion
    req.session.usuario.nombre = nombre;

    const perfil = await obtenerPerfil(idUsuario);
    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: 'Datos actualizados correctamente',
      error: null
    });
  } catch (err) {
    console.error(err);
    const mensaje = err.code === 'ER_DUP_ENTRY'
      ? 'Ese correo ya esta en uso por otra cuenta'
      : 'Error al actualizar el perfil';

    const perfil = await obtenerPerfil(idUsuario);
    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: null,
      error: mensaje
    });
  }
});

// Cambiar contrasena (pide la actual para verificar identidad)
router.post('/password', async (req, res) => {
  const { password_actual, password_nueva, password_confirmar } = req.body;
  const idUsuario = req.session.usuario.id_usuario;

  try {
    const perfil = await obtenerPerfil(idUsuario);

    if (password_nueva !== password_confirmar) {
      return res.render('perfil', {
        usuario: req.session.usuario,
        perfil,
        mensaje: null,
        error: 'La nueva contrasena y su confirmacion no coinciden'
      });
    }

    const [rows] = await pool.query(
      'SELECT contrasena_hash FROM usuarios WHERE id_usuario = ?',
      [idUsuario]
    );
    const passwordValida = await bcrypt.compare(password_actual, rows[0].contrasena_hash);

    if (!passwordValida) {
      return res.render('perfil', {
        usuario: req.session.usuario,
        perfil,
        mensaje: null,
        error: 'La contrasena actual no es correcta'
      });
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);
    await pool.query(
      'UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?',
      [nuevoHash, idUsuario]
    );

    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: 'Contrasena actualizada correctamente',
      error: null
    });
  } catch (err) {
    console.error(err);
    const perfil = await obtenerPerfil(idUsuario);
    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: null,
      error: 'Error al cambiar la contrasena'
    });
  }
});

module.exports = router;
