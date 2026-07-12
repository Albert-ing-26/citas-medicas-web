function requireLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.redirect('/login');
    }
    if (!rolesPermitidos.includes(req.session.usuario.rol)) {
      return res.status(403).send('No tienes permiso para acceder a esta seccion');
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
