/**
 * Model da tabela `animais` (+ `fotos_animal`): único lugar com SQL de animais.
 * Serve às três categorias; o que muda entre elas são as regras (utils/regrasAnimal.js).
 * Todos os valores vão por parâmetros ($1, $2...) - nunca concatenados (evita SQL Injection).
 */
const { pool } = require('../db');

/** Grava o animal e a foto de capa na mesma transação (ou os dois, ou nenhum). */
async function inserirComFoto({ usuarioId, categoria, nome, sexo, descricao, detalhesFuga, urlFoto }) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO animais (usuario_id, categoria, nome, sexo, descricao, detalhes_fuga)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, categoria, nome, sexo`,
      [usuarioId, categoria, nome, sexo, descricao, detalhesFuga]
    );
    await cliente.query('INSERT INTO fotos_animal (animal_id, url, ordem) VALUES ($1, $2, 1)', [
      rows[0].id,
      urlFoto,
    ]);
    await cliente.query('COMMIT');
    return { ...rows[0], foto: urlFoto };
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    cliente.release();
  }
}

/**
 * Uma página de animais (mais recentes primeiro), por cursor (keyset):
 * custo constante em qualquer página, ao contrário de OFFSET.
 * Traz só o necessário para o card (sem descrição nem telefone).
 */
async function listarPagina({ categoria = null, limite, cursor = null }) {
  const parametros = [];
  const condicoes = [];
  if (categoria) {
    parametros.push(categoria);
    condicoes.push(`a.categoria = $${parametros.length}`);
  }
  if (cursor) {
    parametros.push(cursor.criadoEm, cursor.id);
    condicoes.push(
      `(a.criado_em, a.id) < ($${parametros.length - 1}::timestamp, $${parametros.length}::int)`
    );
  }
  parametros.push(limite + 1); // um a mais só para saber se existe próxima página

  const { rows } = await pool.query(
    `SELECT a.id, a.categoria, a.nome, a.sexo, f.url AS foto,
            to_char(a.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS cursor_data
       FROM animais a
       LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
      ${condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''}
      ORDER BY a.criado_em DESC, a.id DESC
      LIMIT $${parametros.length}`,
    parametros
  );

  const temMais = rows.length > limite;
  const itens = temMais ? rows.slice(0, limite) : rows;
  const ultimo = itens[itens.length - 1];
  return { itens, proximo: temMais ? { criadoEm: ultimo.cursor_data, id: ultimo.id } : null };
}

/** Dados completos de um anúncio + contato do responsável (para o modal de detalhes). */
async function buscarDetalhe(id) {
  const { rows } = await pool.query(
    `SELECT a.id, a.categoria, a.nome, a.sexo, a.descricao, a.detalhes_fuga,
            f.url AS foto, u.nome AS responsavel_nome, u.tipo AS responsavel_tipo, u.telefone
       FROM animais a
       JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
      WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { inserirComFoto, listarPagina, buscarDetalhe };
