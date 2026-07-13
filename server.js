require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const medicoRoutes = require('./routes/medico');
const pacienteRoutes = require('./routes/paciente');
const perfilRoutes = require('./routes/perfil');
const { requireLogin } = require('./middlewares/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'clave_temporal_cambiar',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 horas
}));

app.get('/', (req, res) => res.redirect('/login'));

app.use('/', authRoutes);
app.use('/perfil', requireLogin, perfilRoutes);
app.use('/admin', requireLogin, adminRoutes);
app.use('/medico', requireLogin, medicoRoutes);
app.use('/paciente', requireLogin, pacienteRoutes);

app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sistema de citas medicas corriendo en http://localhost:${PORT}`);
});
