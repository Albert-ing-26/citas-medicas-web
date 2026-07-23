const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');

// Trae los datos actualizados del usuario logueado, con sus datos extra segun el rol
async function obtenerPerfil(id, rol) {
  let datos = null;

  if (rol === 'admin') {
    const [administradores] = await pool.query(
      'SELECT id_admin AS id, nombre, apellidos, correo, telefono, ? AS rol FROM administradores WHERE id_admin = ?',
      [rol, id]
    );
    datos = administradores[0] || null;
  }

  if (rol === 'medico') {
    const [medicos] = await pool.query(
      'SELECT id_medico AS id, nombre, apellidos, correo, telefono, ? AS rol, colegiatura FROM medicos WHERE id_medico = ?',
      [rol, id]
    );
    datos = medicos[0] || null;
    if (datos) {
      const [especialidadRows] = await pool.query(
        `SELECT e.nombre AS especialidad
         FROM medicos m
         JOIN especialidades e ON e.id_especialidad = m.id_especialidad
         WHERE m.id_medico = ?`,
        [id]
      );
      datos.extra = especialidadRows[0] || null;
    }
  }

  if (rol === 'paciente') {
    const [pacientes] = await pool.query(
      'SELECT id_paciente AS id, nombre, apellidos, correo, telefono, ? AS rol, dni, fecha_nacimiento, direccion FROM pacientes WHERE id_paciente = ?',
      [rol, id]
    );
    datos = pacientes[0] || null;
    if (datos) {
      datos.extra = {
        dni: datos.dni,
        fecha_nacimiento: datos.fecha_nacimiento,
        direccion: datos.direccion
      };
    }
  }

  return datos;
}

router.get('/', async (req, res) => {
  try {
    const perfil = await obtenerPerfil(req.session.usuario.id, req.session.usuario.rol);
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
  const id = req.session.usuario.id;

  const nameRegex = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/;
  if (!nameRegex.test(nombre) || !nameRegex.test(apellidos)) {
    try {
      const perfil = await obtenerPerfil(id, req.session.usuario.rol);
      return res.render('perfil', {
        usuario: req.session.usuario,
        perfil,
        mensaje: null,
        error: 'El nombre y los apellidos solo deben contener letras y espacios'
      });
    } catch (err) {
      console.error(err);
      return res.status(500).send('Error al cargar el perfil');
    }
  }

  try {
    if (req.session.usuario.rol === 'admin') {
      await pool.query(
        'UPDATE administradores SET nombre=?, apellidos=?, correo=?, telefono=? WHERE id_admin=?',
        [nombre, apellidos, correo, telefono || null, id]
      );
    }

    if (req.session.usuario.rol === 'medico') {
      await pool.query(
        'UPDATE medicos SET nombre=?, apellidos=?, correo=?, telefono=? WHERE id_medico=?',
        [nombre, apellidos, correo, telefono || null, id]
      );
    }

    if (req.session.usuario.rol === 'paciente') {
      await pool.query(
        'UPDATE pacientes SET nombre=?, apellidos=?, correo=?, telefono=?, direccion=? WHERE id_paciente=?',
        [nombre, apellidos, correo, telefono || null, direccion || null, id]
      );
    }

    req.session.usuario.nombre = nombre;

    const perfil = await obtenerPerfil(id, req.session.usuario.rol);
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

    const perfil = await obtenerPerfil(id, req.session.usuario.rol);
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
  const id = req.session.usuario.id;

  try {
    const perfil = await obtenerPerfil(id, req.session.usuario.rol);

    if (password_nueva !== password_confirmar) {
      return res.render('perfil', {
        usuario: req.session.usuario,
        perfil,
        mensaje: null,
        error: 'La nueva contrasena y su confirmacion no coinciden'
      });
    }

    let rows;
    if (req.session.usuario.rol === 'admin') {
      [rows] = await pool.query(
        'SELECT contrasena_hash FROM administradores WHERE id_admin = ?',
        [id]
      );
    } else if (req.session.usuario.rol === 'medico') {
      [rows] = await pool.query(
        'SELECT contrasena_hash FROM medicos WHERE id_medico = ?',
        [id]
      );
    } else {
      [rows] = await pool.query(
        'SELECT contrasena_hash FROM pacientes WHERE id_paciente = ?',
        [id]
      );
    }

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
    if (req.session.usuario.rol === 'admin') {
      await pool.query(
        'UPDATE administradores SET contrasena_hash = ? WHERE id_admin = ?',
        [nuevoHash, id]
      );
    } else if (req.session.usuario.rol === 'medico') {
      await pool.query(
        'UPDATE medicos SET contrasena_hash = ? WHERE id_medico = ?',
        [nuevoHash, id]
      );
    } else {
      await pool.query(
        'UPDATE pacientes SET contrasena_hash = ? WHERE id_paciente = ?',
        [nuevoHash, id]
      );
    }

    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: 'Contrasena actualizada correctamente',
      error: null
    });
  } catch (err) {
    console.error(err);
    const perfil = await obtenerPerfil(id, req.session.usuario.rol);
    res.render('perfil', {
      usuario: req.session.usuario,
      perfil,
      mensaje: null,
      error: 'Error al cambiar la contrasena'
    });
  }
});

module.exports = router;
