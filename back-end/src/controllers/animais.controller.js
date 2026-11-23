const { ErroHttp } = require('../utils/erros');
const { sucesso } = require('../utils/responder');
const { texto, paraWhatsapp } = require('../utils/validacao');
const { descreverSexo } = require('../utils/sexo');
const { otimizarImagem } = require('../utils/imagem');
const { salvarImagem, removerImagem } = require('../utils/armazenamento');
const { codificarCursor, decodificarCursor, ID_MAXIMO_INTEGER } = require('../utils/cursor');
const { CATEGORIAS, validarAnimal } = require('../utils/regrasAnimal');
const animalModel = require('../models/animal.model');

const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 30;

/** Formato do card entregue ao front. O ícone de gênero vem do que está salvo no banco. */
const montarCard = (linha) => ({
  id: linha.id,
  categoria: linha.categoria,
  nome: linha.nome, // pode ser null (animal encontrado sem nome)
  ...descreverSexo(linha.sexo),
  foto: linha.foto,
});

// ---------------------------------------------------------------------
// POST (multipart/form-data, campo da foto: "foto") - exige login
// Sem categoria fixa: a categoria vem do corpo (formulário único do front).
// Com categoria fixa: usada pelas rotas /perdidos e /encontrados.
// ---------------------------------------------------------------------
function criarCategoria(categoriaFixa = null) {
  return async function criar(req, res) {
    const dados = validarAnimal(req.body, req.file, categoriaFixa);

    // Só gasta CPU com a imagem depois que o resto está válido
    const imagem = await otimizarImagem(req.file.buffer);
    const urlFoto = await salvarImagem(imagem);

    let animal;
    try {
      // o dono do anúncio vem SEMPRE da sessão, nunca do corpo da requisição
      animal = await animalModel.inserirComFoto({ usuarioId: req.usuario.id, ...dados, urlFoto });
    } catch (erro) {
      await removerImagem(urlFoto); // não deixa foto órfã no armazenamento
      throw erro;
    }

    sucesso(req, res, {
      status: 201,
      json: { animal: montarCard(animal) },
      redirect: '/meus-pets.html?cadastrado=1',
    });
  };
}

// ---------------------------------------------------------------------
// GET ?categoria=ADOCAO&limite=12&cursor=...  - público
// ---------------------------------------------------------------------
function listarCategoria(categoriaFixa = null) {
  return async function listar(req, res) {
    let categoria = categoriaFixa;
    if (!categoria) {
      const informada = texto(req.query.categoria).toUpperCase();
      if (informada && informada !== 'TODOS') {
        if (!CATEGORIAS.includes(informada)) {
          throw new ErroHttp(400, 'Categoria inválida. Use ADOCAO, PERDIDO, ENCONTRADO ou TODOS.');
        }
        categoria = informada;
      }
    }

    const limite = Math.min(
      Math.max(Number.parseInt(req.query.limite, 10) || LIMITE_PADRAO, 1),
      LIMITE_MAXIMO
    );
    const cursor = decodificarCursor(req.query.cursor);

    const { itens, proximo } = await animalModel.listarPagina({ categoria, limite, cursor });
    res.json({ itens: itens.map(montarCard), proximoCursor: proximo ? codificarCursor(proximo) : null });
  };
}

const naoEncontrado = () => new ErroHttp(404, 'Anúncio não encontrado.');

/** Valida o :id da URL. Qualquer coisa que não seja um id possível vira 404 (nunca chega ao banco). */
function lerId(valor) {
  if (!/^\d+$/.test(valor) || Number(valor) > ID_MAXIMO_INTEGER) throw naoEncontrado();
  return Number(valor);
}

// ---------------------------------------------------------------------
// GET /meus - anúncios do usuário logado (tela "Meus Pets")
// ---------------------------------------------------------------------
async function listarMeus(req, res) {
  // o dono vem SEMPRE da sessão, nunca de parâmetro da URL
  const itens = await animalModel.listarDoUsuario(req.usuario.id);
  res.json({ itens: itens.map(montarCard) });
}

// ---------------------------------------------------------------------
// DELETE /:id - exclui o anúncio (e as fotos) se for do usuário logado
// Anúncio de outra pessoa responde 404, igual a um id que não existe.
// ---------------------------------------------------------------------
async function excluir(req, res) {
  const fotos = await animalModel.excluirDoUsuario(lerId(req.params.id), req.usuario.id);
  if (!fotos) throw naoEncontrado();

  // o anúncio já foi apagado: falha ao remover um arquivo não pode virar erro para o usuário
  await Promise.allSettled(fotos.map(removerImagem));
  res.json({ ok: true });
}

// ---------------------------------------------------------------------
// GET /:id - dados completos para o modal de detalhes (público)
// ---------------------------------------------------------------------
async function detalhar(req, res) {
  const linha = await animalModel.buscarDetalhe(lerId(req.params.id));
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

module.exports = {
  criarCategoria,
  listarCategoria,
  criar: criarCategoria(),
  listar: listarCategoria(),
  listarMeus,
  excluir,
  detalhar,
};
