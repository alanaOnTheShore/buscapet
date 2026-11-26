const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { ErroHttp } = require('../utils/erros');
const { sucesso } = require('../utils/responder');
const { enviarEmailRecuperacao } = require('../utils/email');
const { iniciarSessao, encerrarSessao } = require('../middlewares/auth');
const usuarioModel = require('../models/usuario.model');
const {
  texto,
  validarEmail,
  erroDeNome,
  erroDeSenha,
  validarTelefone,
  exigirValido,
  MSG_TELEFONE_INVALIDO,
} = require('../utils/validacao');

const CUSTO_BCRYPT = 10;
// Hash "de mentira" para gastar o mesmo tempo quando o e-mail não existe
// (evita descobrir quais e-mails estão cadastrados pelo tempo de resposta).
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-igualar-o-tempo', CUSTO_BCRYPT);

const MSG_RECUPERACAO = 'Se este e-mail estiver cadastrado, as instruções foram enviadas.';
const MSG_TOKEN_INVALIDO = 'Link inválido ou expirado. Solicite uma nova redefinição de senha.';

const sha256 = (valor) => crypto.createHash('sha256').update(valor).digest('hex');
const usuarioPublico = ({ id, nome, email, telefone, tipo }) => ({ id, nome, email, telefone, tipo });

/** Valida a senha e a confirmação (quando enviada). Devolve { senha?, confSenha? } com as mensagens. */
function errosDeSenha(senha, confirmacao) {
  const erro = erroDeSenha(senha);
  if (erro) return { senha: erro };
  if (confirmacao !== undefined && confirmacao !== senha) return { confSenha: 'As senhas não coincidem.' };
  return {};
}

/** POST /cadastrar */
async function cadastrar(req, res) {
  const { senha } = req.body;
  const confirmacao = req.body['conf-senha'] ?? req.body.confSenha;
  const nome = texto(req.body.nome);
  const email = validarEmail(req.body.email);
  const telefone = validarTelefone(req.body.telefone);
  const tipo = (texto(req.body.tipo) || 'PESSOA').toUpperCase();

  const campos = {};
  const erroNome = erroDeNome(nome, tipo);
  if (erroNome) campos.nome = erroNome;
  if (!email) campos.email = 'Informe um e-mail válido (ex: nome@dominio.com).';
  if (!telefone) campos.telefone = MSG_TELEFONE_INVALIDO;
  if (!['PESSOA', 'ONG'].includes(tipo)) campos.tipo = 'Tipo de conta inválido.';
  Object.assign(campos, errosDeSenha(senha, confirmacao));
  exigirValido(campos);

  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  let usuario;
  try {
    usuario = await usuarioModel.criar({ nome, email, senhaHash, telefone, tipo });
  } catch (erro) {
    // 23505 = violação de UNIQUE (e-mail já cadastrado). Seguro contra corrida.
    if (erro.code === '23505') {
      throw new ErroHttp(409, 'Este e-mail já está cadastrado.', { email: 'E-mail já cadastrado.' });
    }
    throw erro;
  }

  sucesso(req, res, {
    status: 201,
    json: { usuario: usuarioPublico(usuario) },
    redirect: '/index.html?cadastro=ok',
  });
}

/** POST /login */
async function login(req, res) {
  const email = validarEmail(req.body.email);
  const { senha } = req.body;
  const invalidas = () => new ErroHttp(401, 'E-mail ou senha incorretos.');

  if (!email || typeof senha !== 'string' || senha.length === 0) throw invalidas();

  const usuario = await usuarioModel.buscarParaLogin(email);
  const confere = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);
  if (!usuario || !confere) throw invalidas();

  iniciarSessao(res, usuario.id);
  sucesso(req, res, { json: { usuario: usuarioPublico(usuario) }, redirect: '/home.html' });
}

/** POST /api/logout */
async function logout(req, res) {
  encerrarSessao(res);
  sucesso(req, res, { json: { ok: true }, redirect: '/index.html' });
}

/** POST /api/recuperar-senha  - responde SEMPRE igual (não revela se o e-mail existe) */
async function recuperarSenha(req, res) {
  const email = validarEmail(req.body.email);

  if (email) {
    const usuario = await usuarioModel.buscarPorEmail(email);
    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      await usuarioModel.criarTokenRecuperacao(usuario.id, sha256(token));
      const link = `${config.appUrl}/criar-nova-senha.html?token=${token}`;
      // Sem await de propósito: o tempo do SMTP não pode denunciar se o e-mail existe.
      enviarEmailRecuperacao({ para: usuario.email, nome: usuario.nome, link }).catch((erro) =>
        console.error('Falha ao enviar e-mail de recuperação:', erro.message)
      );
    }
  }

  sucesso(req, res, {
    json: { mensagem: MSG_RECUPERACAO },
    redirect: '/redefinir-senha.html',
  });
}

/** POST /atualizar-senha */
async function atualizarSenha(req, res) {
  const token = texto(req.body.token);
  const { senha } = req.body;
  const confirmacao = req.body['conf-senha'] ?? req.body.confSenha;

  exigirValido(errosDeSenha(senha, confirmacao)); // valida ANTES de consumir o token

  if (!/^[a-f0-9]{64}$/.test(token)) throw new ErroHttp(400, MSG_TOKEN_INVALIDO);

  const novoHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  const trocou = await usuarioModel.trocarSenhaComToken(sha256(token), novoHash);
  if (!trocou) throw new ErroHttp(400, MSG_TOKEN_INVALIDO);

  sucesso(req, res, {
    json: { mensagem: 'Senha alterada com sucesso.' },
    redirect: '/index.html?senha=alterada',
  });
}

module.exports = { cadastrar, login, logout, recuperarSenha, atualizarSenha };
