/**
 * Regras de negócio do cadastro de animais, por categoria.
 * Espelham as CONSTRAINTS do banco (ck_animais_nome e ck_animais_detalhes_fuga),
 * mas devolvem mensagens amigáveis antes de chegar ao banco.
 */
const { texto, exigirValido, MSG_NOME_INVALIDO } = require('./validacao');
const { normalizarSexo } = require('./sexo');

// Limite do nome no cadastro (a coluna do banco aceita até 80; o front usa o mesmo número em cadastro-pet.html)
const NOME_MAX = 30;

// Mínimo de caracteres da descrição e dos detalhes da fuga (o front usa o mesmo número em js/validacoes.js)
const DESCRICAO_MIN = 30;
// Nome do pet: letras (com acentos), números, espaço, hífen e apóstrofo
const NOME_PET = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}' \u2019-]*$/u;
// Descrição/fuga: letras, números, espaços/quebras de linha e pontuação comum. Sem @ # $ & * + = < > [ ] { } | ^ ~ _ etc.
const TEXTO_LIVRE = /^[\p{L}\p{M}\p{N}\s.,;:!?()'\u2019"\u201C\u201D\-/%]*$/u;
const MSG_TEXTO_ESPECIAL = 'Use apenas letras, números e pontuação comum (sem caracteres especiais).';

const REGRAS = {
  ADOCAO: { nomeObrigatorio: true, sexoObrigatorio: true, fuga: 'proibida' },
  PERDIDO: { nomeObrigatorio: true, sexoObrigatorio: true, fuga: 'obrigatoria' },
  ENCONTRADO: { nomeObrigatorio: false, sexoObrigatorio: false, fuga: 'proibida' }, // pode não ter nome nem sexo
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
  else if (nome && !NOME_PET.test(nome)) campos.nome = MSG_NOME_INVALIDO;
  // Sexo: obrigatório, exceto em ENCONTRADO (onde pode ficar em branco). Valor preenchido e inválido sempre é recusado.
  if (!sexo && (texto(body.sexo) || (regra && regra.sexoObrigatorio))) campos.sexo = 'Selecione o sexo do pet.';
  if (!descricao) campos.descricao = 'Informe a descrição do pet.';
  else if (descricao.length < DESCRICAO_MIN) campos.descricao = `A descrição deve ter no mínimo ${DESCRICAO_MIN} caracteres.`;
  else if (!TEXTO_LIVRE.test(descricao)) campos.descricao = MSG_TEXTO_ESPECIAL;
  else if (descricao.length > 2000) campos.descricao = 'A descrição pode ter no máximo 2000 caracteres.';

  if (regra && regra.fuga === 'obrigatoria' && !detalhesFuga) {
    campos.detalhes_fuga = 'O detalhamento da fuga é obrigatório.';
  } else if (regra && regra.fuga === 'obrigatoria' && detalhesFuga.length < DESCRICAO_MIN) {
    campos.detalhes_fuga = `Os detalhes da fuga devem ter no mínimo ${DESCRICAO_MIN} caracteres.`;
  } else if (regra && regra.fuga === 'proibida' && detalhesFuga) {
    campos.detalhes_fuga = 'Detalhes de fuga só se aplicam a pets perdidos.';
  } else if (detalhesFuga.length > 1000) {
    campos.detalhes_fuga = 'Os detalhes da fuga podem ter no máximo 1000 caracteres.';
  } else if (!TEXTO_LIVRE.test(detalhesFuga)) {
    campos.detalhes_fuga = MSG_TEXTO_ESPECIAL;
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
