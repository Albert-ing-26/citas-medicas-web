require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

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

app.use((req, res, next) => {
  const originalRender = res.render.bind(res);

  res.render = function(view, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const locals = { ...(res.locals || {}), ...(options || {}) };

    const done = (err, html) => {
      if (err) {
        if (typeof callback === 'function') return callback(err);
        return res.status(500).send(err.message || err);
      }

      if (typeof html !== 'string') {
        if (typeof callback === 'function') return callback(null, html);
        return res.send(html);
      }

      if (typeof html === 'string' && html.includes('</body>')) {
        const chatbotPath = path.join(__dirname, 'views', 'partials', 'chatbot.ejs');
        const templateContent = fs.readFileSync(chatbotPath, 'utf8');
        const chatbotHtml = ejs.render(templateContent, { ...locals, currentPath: req.path, currentUrl: req.originalUrl || req.url }, { views: path.join(__dirname, 'views') });
        const htmlWithChatbot = html.replace('</body>', `${chatbotHtml}</body>`);

        if (typeof callback === 'function') return callback(null, htmlWithChatbot);
        return res.send(htmlWithChatbot);
      }

      if (typeof callback === 'function') return callback(null, html);
      return res.send(html);
    };

    return originalRender(view, locals, done);
  };

  next();
});

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
