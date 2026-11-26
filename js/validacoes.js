/**
 * Regras de validação dos campos de texto, iguais às do servidor (back-end/src/utils/validacao.js
 * e regrasAnimal.js). O servidor sempre confere de novo: estas funções só avisam antes do envio.
 *
 * Letras com acento (ç, á, ã, â, ê, õ...) valem em todos os campos (\p{L} e \p{M}).
 * Cada função devolve a mensagem de erro, ou '' quando o valor é válido.
 */
export const MSG_NOME_INVALIDO = 'Digite um nome válido.';
export const MSG_TELEFONE_INVALIDO = 'Telefone inválido.';
export const DESCRICAO_MIN = 30;

const NOME_PESSOA = /^[\p{L}][\p{L}\p{M}' ’-]*$/u;
const NOME_ONG_PROIBIDO = /[@#!*?]/;
const NOME_PET = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}' ’-]*$/u;
const TEXTO_LIVRE = /^[\p{L}\p{M}\p{N}\s.,;:!?()'’"“”\-/%]*$/u;

const limpar = (valor) => valor.trim().normalize('NFC');

/** Nome de quem se cadastra: pessoa física só com letras; ONG sem @ # ! * ? */
export function erroDeNomeUsuario(valor, tipo) {
  const nome = limpar(valor);
  if (!nome || nome.length > 120) return MSG_NOME_INVALIDO;
  const valido = tipo === 'ONG' ? !NOME_ONG_PROIBIDO.test(nome) : NOME_PESSOA.test(nome);
  return valido ? '' : MSG_NOME_INVALIDO;
}

/** Nome do pet (pode ficar vazio quando a situação é "Encontrado"; o `required` do campo cuida disso). */
export function erroDeNomePet(valor) {
  const nome = limpar(valor);
  return !nome || NOME_PET.test(nome) ? '' : MSG_NOME_INVALIDO;
}

/** Telefone: o DDD (2 primeiros dígitos, depois do 55 opcional) não pode começar nem terminar em 0. */
export function erroDeTelefone(valor) {
  let digitos = valor.replace(/\D/g, '');
  if (valor.trim().length > 20) return MSG_TELEFONE_INVALIDO;
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length < 10 || digitos.length > 11) return MSG_TELEFONE_INVALIDO;
  if (digitos[0] === '0' || digitos[1] === '0') return MSG_TELEFONE_INVALIDO;
  return '';
}

/** Descrição do pet: mínimo de 30 caracteres e sem caracteres especiais. */
export function erroDeDescricao(valor) {
  const texto = limpar(valor);
  if (!texto) return '';
  if (texto.length < DESCRICAO_MIN) return `A descrição deve ter no mínimo ${DESCRICAO_MIN} caracteres.`;
  return TEXTO_LIVRE.test(texto) ? '' : 'Use apenas letras, números e pontuação comum (sem caracteres especiais).';
}

/** Detalhes da fuga: só confere os caracteres (não há mínimo). */
export function erroDeTextoLivre(valor) {
  return TEXTO_LIVRE.test(limpar(valor)) ? '' : 'Use apenas letras, números e pontuação comum (sem caracteres especiais).';
}

/**
 * Liga um campo a uma regra: a cada digitação a mensagem é atualizada e, se houver erro, o navegador
 * bloqueia o envio e mostra a mensagem ao lado do campo. Devolve a função que reavalia o campo.
 * @param {HTMLInputElement|HTMLTextAreaElement} campo
 * @param {() => string} obterErro
 */
export function validarCampo(campo, obterErro) {
  const conferir = () => campo.setCustomValidity(obterErro());
  campo.addEventListener('input', conferir);
  conferir();
  return conferir;
}
