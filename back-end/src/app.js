const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { exigirLoginPagina } = require('./middlewares/auth');
const { limiteApi } = require('./middlewares/limites');
const { naoEncontrado, tratarErros } = require('./middlewares/erros');
const authRoutes = require('./routes/auth.routes');
const animaisRoutes = require('./routes/animais.routes');
const perdidosRoutes = require('./routes/perdidos.routes');
const encontradosRoutes = require('./routes/encontrados.routes');

const PAGINAS_PUBLICAS = new Set(['index', 'home', 'cadastro-perfil', 'redefinir-senha', 'criar-nova-senha']);
const PAGINAS_PRIVADAS = new Set(['cadastro-pet', 'meus-pets', 'perfil']);

const app = express();
app.disable('x-powered-by');
if (config.producao) app.set('trust proxy', 1); // atrás do proxy da hospedagem (IP real e cookie Secure)

// CSP desligada porque as páginas usam <script> e style="" inline.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
// Express 5: sem corpo na requisição, req.body fica undefined (no 4 era {}). Garante o objeto.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// --- Arquivos estáticos: somente o que é público (nunca a pasta back-end/) ---
app.use('/css', express.static(path.join(config.raizFront, 'css')));
app.use('/img', express.static(path.join(config.raizFront, 'img'), { maxAge: '7d' }));
// Fotos têm nome aleatório e nunca mudam: podem ficar 30 dias no cache do celular
app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true, index: false }));

// --- Páginas ---
app.get('/', (req, res) => res.redirect('/index.html'));
app.get(/^\/([a-z-]+)\.html$/, (req, res, next) => {
  const pagina = req.params[0];
  const arquivo = path.join(config.raizFront, `${pagina}.html`);
  if (PAGINAS_PUBLICAS.has(pagina)) return res.sendFile(arquivo);
  if (PAGINAS_PRIVADAS.has(pagina)) {
    return exigirLoginPagina(req, res, () => res.sendFile(arquivo));
  }
  next();
});

// --- API ---
app.use('/api', limiteApi);
app.use(authRoutes);
// as rotas específicas vêm ANTES de /api/animais/:id, senão "perdidos" seria lido como um id
app.use('/api/animais/perdidos', perdidosRoutes);
app.use('/api/animais/encontrados', encontradosRoutes);
app.use('/api/animais', animaisRoutes);
app.use('/api', naoEncontrado);

app.use(tratarErros);

module.exports = app;
