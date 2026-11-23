/**
 * Model das tabelas `usuarios` e `tokens_recuperacao`: único lugar com SQL de contas.
 * Todos os valores vão por parâmetros ($1, $2...) - nunca concatenados (evita SQL Injection).
 */
const { pool } = require('../db');

// Colunas que podem sair da API (nunca senha_hash)
const COLUNAS_PUBLICAS = 'id, nome, email, telefone, tipo';

async function criar({ nome, email, senhaHash, telefone, tipo }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUNAS_PUBLICAS}`,
    [nome, email, senhaHash, telefone, tipo]
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Único caso em que o hash sai do banco: conferir a senha no login. */
async function buscarParaLogin(email) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS_PUBLICAS}, senha_hash FROM usuarios WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await pool.query(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE email = $1`, [email]);
  return rows[0] || null;
}

/** E-mail e tipo de conta não mudam por aqui: só nome e telefone. */
async function atualizarPerfil(id, { nome, telefone }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET nome = $2, telefone = $3
      WHERE id = $1
      RETURNING ${COLUNAS_PUBLICAS}`,
    [id, nome, telefone]
  );
  return rows[0] || null;
}

/**
 * Apaga a conta. O banco apaga em cascata os animais, as fotos e os tokens;
 * por isso as URLs das fotos são lidas ANTES e devolvidas, para quem chamou
 * limpar também o armazenamento (senão os arquivos ficariam órfãos).
 */
async function excluir(id) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `SELECT f.url
         FROM fotos_animal f
         JOIN animais a ON a.id = f.animal_id
        WHERE a.usuario_id = $1`,
      [id]
    );
    await cliente.query('DELETE FROM usuarios WHERE id = $1', [id]);
    await cliente.query('COMMIT');
    return rows.map((linha) => linha.url);
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    cliente.release();
  }
}

// ---------------------------------------------------------------------
// Recuperação de senha (guarda só o HASH do token, nunca o token em si)
// ---------------------------------------------------------------------

/** Um pedido novo invalida os anteriores. */
async function criarTokenRecuperacao(usuarioId, tokenHash) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM tokens_recuperacao WHERE usuario_id = $1', [usuarioId]);
    await cliente.query(
      `INSERT INTO tokens_recuperacao (usuario_id, token_hash, expira_em)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [usuarioId, tokenHash]
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    cliente.release();
  }
}

/**
 * Consome o token de forma atômica (só funciona uma vez e antes de expirar)
 * e grava a nova senha. Devolve false se o token for inválido, usado ou expirado.
 */
async function trocarSenhaComToken(tokenHash, novoHash) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const consumido = await cliente.query(
      `UPDATE tokens_recuperacao SET usado_em = NOW()
        WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW()
        RETURNING usuario_id`,
      [tokenHash]
    );
    if (consumido.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return false;
    }

    const usuarioId = consumido.rows[0].usuario_id;
    await cliente.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [novoHash, usuarioId]);
    await cliente.query('DELETE FROM tokens_recuperacao WHERE usuario_id = $1', [usuarioId]);
    await cliente.query('COMMIT');
    return true;
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  criar,
  buscarPorId,
  buscarParaLogin,
  buscarPorEmail,
  atualizarPerfil,
  excluir,
  criarTokenRecuperacao,
  trocarSenhaComToken,
};
