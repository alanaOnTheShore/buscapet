const jwt = require('jsonwebtoken');
const config = require('../config');
const usuarioModel = require('../models/usuario.model');
const { falha, comParametros } = require('../utils/responder');

const NOME_COOKIE = 'buscapet_sessao';
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const opcoesCookie = () => ({ httpOnly: true, sameSite: 'lax', secure: config.producao, path: '/' });

function iniciarSessao(res, usuarioId) {
  const token = jwt.sign({ sub: String(usuarioId) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessaoDias}d`,
  });
  res.cookie(NOME_COOKIE, token, { ...opcoesCookie(), maxAge: config.sessaoDias * UM_DIA_MS });
}

function encerrarSessao(res) {
  res.clearCookie(NOME_COOKIE, opcoesCookie());
}

/** Lê o cookie, valida o JWT e busca o usuário (null se não houver sessão válida). */
async function carregarUsuario(req) {
  const token = req.cookies && req.cookies[NOME_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const id = Number.parseInt(payload.sub, 10);
    if (!Number.isInteger(id)) return null;
    return await usuarioModel.buscarPorId(id);
  } catch {
    return null;
  }
}

/** Para rotas da API: 401 (ou redireciona ao login se for formulário). */
async function exigirLogin(req, res, next) {
  try {
    const usuario = await carregarUsuario(req);
    if (!usuario) {
      return falha(req, res, 401, 'Faça login para continuar.', { redirect: '/index.html' });
    }
    req.usuario = usuario;
    next();
  } catch (erro) {
    next(erro);
  }
}

/** Para páginas HTML protegidas: redireciona ao início. */
async function exigirLoginPagina(req, res, next) {
  try {
    const usuario = await carregarUsuario(req);
    if (!usuario) {
      return res.redirect(302, comParametros('/index.html', { erro: 'Faça login para continuar.' }));
    }
    req.usuario = usuario;
    next();
  } catch (erro) {
    next(erro);
  }
}

module.exports = { NOME_COOKIE, iniciarSessao, encerrarSessao, exigirLogin, exigirLoginPagina };
