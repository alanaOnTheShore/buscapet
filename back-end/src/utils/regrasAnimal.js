/**
 * Regras de negócio do cadastro de animais, por categoria.
 * Espelham as CONSTRAINTS do banco (ck_animais_nome e ck_animais_detalhes_fuga),
 * mas devolvem mensagens amigáveis antes de chegar ao banco.
 */
const { texto, exigirValido } = require('./validacao');
const { normalizarSexo } = require('./sexo');

// Limite do nome no cadastro (a coluna do banco aceita até 80; o front usa o mesmo número em cadastro-pet.html)
const NOME_MAX = 30;

const REGRAS = {
  ADOCAO: { nomeObrigatorio: true, fuga: 'proibida' },
  PERDIDO: { nomeObrigatorio: true, fuga: 'obrigatoria' },
  ENCONTRADO: { nomeObrigatorio: false, fuga: 'proibida' }, // pode não ter nome
};
const CATEGORIAS = Object.keys(REGRAS);

/**
 * Valida o corpo do formulário. `categoriaFixa` é usada pelas rotas
 * /api/animais/perdidos e /encontrados (ignoram o campo "categoria" do corpo).
 * Lança ErroHttp 400 com `campos` ou devolve os dados já limpos.
 */
function validarAnimal(body, arquivo, categoriaFixa = null) {
  const categoria = categoriaFixa || texto(body.categoria).toUpperCase();
  const regra = REGRAS[categoria];
  const nome = texto(body.nome) || null;
  const sexo = normalizarSexo(body.sexo);
  const descricao = texto(body.descricao);
  const detalhesFuga = texto(body.detalhes_fuga);

  const campos = {};
  if (!regra) campos.categoria = 'Selecione a situação do pet.';
  if (regra && regra.nomeObrigatorio && !nome) campos.nome = 'Informe o nome do pet.';
  if (nome && nome.length > NOME_MAX) campos.nome = `O nome pode ter no máximo ${NOME_MAX} caracteres.`;
  if (!sexo) campos.sexo = 'Selecione o sexo do pet.';
  if (!descricao) campos.descricao = 'Informe a descrição do pet.';
  else if (descricao.length > 2000) campos.descricao = 'A descrição pode ter no máximo 2000 caracteres.';

  if (regra && regra.fuga === 'obrigatoria' && !detalhesFuga) {
    campos.detalhes_fuga = 'O detalhamento da fuga é obrigatório.';
  } else if (regra && regra.fuga === 'proibida' && detalhesFuga) {
    campos.detalhes_fuga = 'Detalhes de fuga só se aplicam a pets perdidos.';
  } else if (detalhesFuga.length > 1000) {
    campos.detalhes_fuga = 'Os detalhes da fuga podem ter no máximo 1000 caracteres.';
  }
  if (!arquivo) campos.foto = 'Envie uma foto do pet.';
  exigirValido(campos);

  return {
    categoria,
    nome,
    sexo,
    descricao,
    detalhesFuga: regra.fuga === 'obrigatoria' ? detalhesFuga : null, // o banco exige NULL fora de PERDIDO
  };
}

module.exports = { CATEGORIAS, REGRAS, validarAnimal };
