const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { pool } = require('../db');
const { ErroHttp } = require('../utils/erros');
const { sucesso } = require('../utils/responder');
const { enviarEmailRecuperacao } = require('../utils/email');
const { iniciarSessao, encerrarSessao } = require('../middlewares/auth');
const {
  texto,
  validarEmail,
  erroDeSenha,
  validarTelefone,
  exigirValido,
} = require('../utils/validacao');

const CUSTO_BCRYPT = 10;
// Hash "de mentira" para gastar o mesmo tempo quando o e-mail não existe
// (evita descobrir quais e-mails estão cadastrados pelo tempo de resposta).
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-igualar-o-tempo', CUSTO_BCRYPT);

const MSG_RECUPERACAO = 'Se este e-mail estiver cadastrado, as instruções foram enviadas.';
const MSG_TOKEN_INVALIDO = 'Link inválido ou expirado. Solicite uma nova redefinição de senha.';

const sha256 = (valor) => crypto.createHash('sha256').update(valor).digest('hex');
const usuarioPublico = ({ id, nome, email, telefone, tipo }) => ({ id, nome, email, telefone, tipo });

/** POST /cadastrar */
async function cadastrar(req, res) {
  const { senha } = req.body;
  const confirmacao = req.body['conf-senha'] ?? req.body.confSenha;
  const nome = texto(req.body.nome);
  const email = validarEmail(req.body.email);
  const telefone = validarTelefone(req.body.telefone);
  const tipo = (texto(req.body.tipo) || 'PESSOA').toUpperCase();

  const campos = {};
  if (!nome || nome.length > 120) campos.nome = 'Informe o nome (até 120 caracteres).';
  if (!email) campos.email = 'Informe um e-mail válido (ex: nome@dominio.com).';
  if (!telefone) campos.telefone = 'Informe um telefone válido com DDD.';
  if (!['PESSOA', 'ONG'].includes(tipo)) campos.tipo = 'Tipo de conta inválido.';
  const erroSenha = erroDeSenha(senha);
  if (erroSenha) campos.senha = erroSenha;
  else if (confirmacao !== undefined && confirmacao !== senha) {
    campos.confSenha = 'As senhas não coincidem.';
  }
  exigirValido(campos);

  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  let usuario;
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, email, telefone, tipo`,
      [nome, email, senhaHash, telefone, tipo]
    );
    usuario = rows[0];
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

  const { rows } = await pool.query(
    'SELECT id, nome, email, telefone, tipo, senha_hash FROM usuarios WHERE email = $1',
    [email]
  );
  const usuario = rows[0];
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
    const { rows } = await pool.query('SELECT id, nome, email FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      // um pedido novo invalida os anteriores
      await pool.query('DELETE FROM tokens_recuperacao WHERE usuario_id = $1', [usuario.id]);
      await pool.query(
        `INSERT INTO tokens_recuperacao (usuario_id, token_hash, expira_em)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [usuario.id, sha256(token)]
      );
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

  const campos = {};
  const erroSenha = erroDeSenha(senha);
  if (erroSenha) campos.senha = erroSenha;
  else if (confirmacao !== undefined && confirmacao !== senha) {
    campos.confSenha = 'As senhas não coincidem.';
  }
  exigirValido(campos); // valida ANTES de consumir o token

  if (!/^[a-f0-9]{64}$/.test(token)) throw new ErroHttp(400, MSG_TOKEN_INVALIDO);

  const novoHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Consome o token de forma atômica: só funciona uma vez e antes de expirar
    const consumido = await cliente.query(
      `UPDATE tokens_recuperacao SET usado_em = NOW()
        WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW()
        RETURNING usuario_id`,
      [sha256(token)]
    );
    if (consumido.rowCount === 0) throw new ErroHttp(400, MSG_TOKEN_INVALIDO);

    const usuarioId = consumido.rows[0].usuario_id;
    await cliente.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [novoHash, usuarioId]);
    await cliente.query('DELETE FROM tokens_recuperacao WHERE usuario_id = $1', [usuarioId]);
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    cliente.release();
  }

  sucesso(req, res, {
    json: { mensagem: 'Senha alterada com sucesso.' },
    redirect: '/index.html?senha=alterada',
  });
}

module.exports = { cadastrar, login, logout, recuperarSenha, atualizarSenha };
