const express = require('express');
const router = express.Router();
const { requireRole } = require('../middlewares/auth');

router.use(requireRole('paciente'));

router.get('/', (req, res) => {
  res.render('paciente/dashboard', { usuario: req.session.usuario });
});

// Aqui iran las rutas para reservar cita, ver mis citas, cancelar
// GET /paciente/reservar, GET /paciente/mis-citas

module.exports = router;
