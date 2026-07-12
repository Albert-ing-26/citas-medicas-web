const express = require('express');
const router = express.Router();
const { requireRole } = require('../middlewares/auth');

router.use(requireRole('admin'));

router.get('/', (req, res) => {
  res.render('admin/dashboard', { usuario: req.session.usuario });
});

// Aqui iran las rutas de gestion de medicos, pacientes y especialidades
// GET/POST/PUT/DELETE /admin/medicos, /admin/especialidades, etc.

module.exports = router;
