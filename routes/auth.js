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

module.exports = router;
