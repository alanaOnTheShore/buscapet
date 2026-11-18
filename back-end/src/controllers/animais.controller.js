const { pool } = require('../db');
const { ErroHttp } = require('../utils/erros');
const { sucesso } = require('../utils/responder');
const { texto, paraWhatsapp, exigirValido } = require('../utils/validacao');
const { normalizarSexo, descreverSexo } = require('../utils/sexo');
const { otimizarImagem } = require('../utils/imagem');
const { salvarImagem, removerImagem } = require('../utils/armazenamento');

const CATEGORIAS = ['ADOCAO', 'PERDIDO', 'ENCONTRADO'];
const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 30;
const REGEX_CURSOR_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
const ID_MAXIMO_INTEGER = 2147483647;

// ---------------------------------------------------------------------
// Cursor de paginação
// Guardamos (criado_em, id) do último item entregue. O timestamp vai como
// TEXTO com microssegundos (o Date do JavaScript só tem milissegundos e
// causaria itens repetidos/perdidos). O id desempata registros simultâneos.
// ---------------------------------------------------------------------
const codificarCursor = (criadoEm, id) => Buffer.from(`${criadoEm}|${id}`).toString('base64url');

function decodificarCursor(valor) {
  if (valor === undefined || valor === '') return null;
  const invalido = () => new ErroHttp(400, 'Cursor de paginação inválido.');
  if (typeof valor !== 'string' || valor.length > 100) throw invalido();
  const [criadoEm, idTexto] = Buffer.from(valor, 'base64url').toString('utf8').split('|');
  const id = Number(idTexto);
  if (!REGEX_CURSOR_DATA.test(criadoEm || '') || !Number.isInteger(id) || id < 0 || id > ID_MAXIMO_INTEGER) {
    throw invalido();
  }
  return { criadoEm, id };
}

const montarCard = (linha) => ({
  id: linha.id,
  categoria: linha.categoria,
  nome: linha.nome, // pode ser null (animal encontrado sem nome)
  ...descreverSexo(linha.sexo),
  foto: linha.foto,
});

// ---------------------------------------------------------------------
// POST /api/animais  (multipart/form-data, campo da foto: "foto")
// ---------------------------------------------------------------------
async function criar(req, res) {
  const categoria = texto(req.body.categoria).toUpperCase();
  const nome = texto(req.body.nome) || null;
  const sexo = normalizarSexo(req.body.sexo);
  const descricao = texto(req.body.descricao);
  const detalhesFugaInformado = texto(req.body.detalhes_fuga);

  const campos = {};
  if (!CATEGORIAS.includes(categoria)) campos.categoria = 'Selecione a situação do pet.';
  if (categoria !== 'ENCONTRADO' && !nome) campos.nome = 'Informe o nome do pet.';
  if (nome && nome.length > 80) campos.nome = 'O nome pode ter no máximo 80 caracteres.';
  if (!sexo) campos.sexo = 'Selecione o sexo do pet.';
  if (!descricao) campos.descricao = 'Informe a descrição do pet.';
  else if (descricao.length > 2000) campos.descricao = 'A descrição pode ter no máximo 2000 caracteres.';
  if (categoria === 'PERDIDO' && !detalhesFugaInformado) {
    campos.detalhes_fuga = 'Informe os detalhes da fuga.';
  } else if (detalhesFugaInformado.length > 1000) {
    campos.detalhes_fuga = 'Os detalhes da fuga podem ter no máximo 1000 caracteres.';
  }
  if (!req.file) campos.foto = 'Envie uma foto do pet.';
  exigirValido(campos);

  // A CONSTRAINT do banco exige detalhes_fuga NULL fora de PERDIDO, mas o
  // formulário envia o campo vazio (""). Aqui convertemos para NULL.
  const detalhesFuga = categoria === 'PERDIDO' ? detalhesFugaInformado : null;

  // Só gasta CPU com a imagem depois que o resto está válido
  const imagem = await otimizarImagem(req.file.buffer);
  const urlFoto = await salvarImagem(imagem);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO animais (usuario_id, categoria, nome, sexo, descricao, detalhes_fuga)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.usuario.id, categoria, nome, sexo, descricao, detalhesFuga]
    );
    await cliente.query(
      'INSERT INTO fotos_animal (animal_id, url, ordem) VALUES ($1, $2, 1)',
      [rows[0].id, urlFoto]
    );
    await cliente.query('COMMIT');

    sucesso(req, res, {
      status: 201,
      json: { animal: { id: rows[0].id, categoria, foto: urlFoto } },
      redirect: '/meus-pets.html?cadastrado=1',
    });
  } catch (erro) {
    await cliente.query('ROLLBACK').catch(() => {});
    await removerImagem(urlFoto); // não deixa foto órfã no armazenamento
    throw erro;
  } finally {
    cliente.release();
  }
}

// ---------------------------------------------------------------------
// GET /api/animais?categoria=ADOCAO&limite=12&cursor=...
// Paginação por cursor (keyset): custo constante mesmo com milhares de
// animais, ao contrário de OFFSET, que fica mais lento a cada página.
// A lista traz só o necessário para o card (sem descrição nem telefone).
// ---------------------------------------------------------------------
async function listar(req, res) {
  const categoriaInformada = texto(req.query.categoria).toUpperCase();
  let categoria = null;
  if (categoriaInformada && categoriaInformada !== 'TODOS') {
    if (!CATEGORIAS.includes(categoriaInformada)) {
      throw new ErroHttp(400, 'Categoria inválida. Use ADOCAO, PERDIDO, ENCONTRADO ou TODOS.');
    }
    categoria = categoriaInformada;
  }

  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || LIMITE_PADRAO, 1), LIMITE_MAXIMO);
  const cursor = decodificarCursor(req.query.cursor);

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
  const pagina = temMais ? rows.slice(0, limite) : rows;
  const ultimo = pagina[pagina.length - 1];

  res.json({
    itens: pagina.map(montarCard),
    proximoCursor: temMais ? codificarCursor(ultimo.cursor_data, ultimo.id) : null,
  });
}

// ---------------------------------------------------------------------
// GET /api/animais/:id  - dados completos para o modal de detalhes
// ---------------------------------------------------------------------
async function detalhar(req, res) {
  const naoEncontrado = () => new ErroHttp(404, 'Anúncio não encontrado.');
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) > ID_MAXIMO_INTEGER) throw naoEncontrado();

  const { rows } = await pool.query(
    `SELECT a.id, a.categoria, a.nome, a.sexo, a.descricao, a.detalhes_fuga,
            f.url AS foto, u.nome AS responsavel_nome, u.tipo AS responsavel_tipo, u.telefone
       FROM animais a
       JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
      WHERE a.id = $1`,
    [Number(req.params.id)]
  );
  const linha = rows[0];
  if (!linha) throw naoEncontrado();

  res.json({
    animal: {
      ...montarCard(linha),
      descricao: linha.descricao,
      detalhesFuga: linha.detalhes_fuga,
      responsavel: { nome: linha.responsavel_nome, tipo: linha.responsavel_tipo },
      // o telefone só sai aqui (detalhe), nunca na listagem
      whatsapp: paraWhatsapp(linha.telefone),
    },
  });
}

module.exports = { criar, listar, detalhar };
