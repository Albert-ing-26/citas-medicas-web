const express = require('express');
const router = express.Router();
const { requireRole } = require('../middlewares/auth');

router.use(requireRole('medico'));

router.get('/', (req, res) => {
  res.render('medico/dashboard', { usuario: req.session.usuario });
});

// Aqui iran las rutas para ver su agenda y bloquear dias
// GET /medico/agenda, POST /medico/bloquear-dia

module.exports = router;
