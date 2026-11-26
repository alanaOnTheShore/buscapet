const { ErroHttp } = require('./erros');

// Mesmo padrão usado nos formulários (HTML) e compatível com a CONSTRAINT do banco
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Letras de qualquer idioma (\p{L}: ç, á, ã, â, ê, õ...) e acentos soltos/decompostos (\p{M}) valem em todos os campos.
const MSG_NOME_INVALIDO = 'Digite um nome válido.';
const MSG_TELEFONE_INVALIDO = 'Telefone inválido.';
// Pessoa física: só letras, espaço, hífen e apóstrofo (Ana-Maria, D'Ávila). Sem números nem símbolos.
const NOME_PESSOA = /^[\p{L}][\p{L}\p{M}' \u2019-]*$/u;
// ONG: aceita números e pontuação comum (ex.: "Abrigo 4 Patas"), mas não estes cinco símbolos.
const NOME_ONG_PROIBIDO = /[@#!*?]/;

/** Remove espaços das pontas e junta acentos soltos às letras ("a" + "~" vira "ã"). */
const texto = (valor) => (typeof valor === 'string' ? valor.trim().normalize('NFC') : '');

/** Retorna o e-mail em minúsculas ou null se inválido. */
function validarEmail(valor) {
  const email = texto(valor).toLowerCase();
  if (!email || email.length > 160 || !EMAIL_REGEX.test(email)) return null;
  return email;
}

/**
 * Retorna a mensagem de erro, ou null se o nome (já com trim) é válido.
 * As regras mudam com o tipo da conta: PESSOA (padrão) ou ONG.
 */
function erroDeNome(nome, tipo = 'PESSOA') {
  if (!nome || nome.length > 120) return MSG_NOME_INVALIDO;
  const valido = tipo === 'ONG' ? !NOME_ONG_PROIBIDO.test(nome) : NOME_PESSOA.test(nome);
  return valido ? null : MSG_NOME_INVALIDO;
}

/** Retorna a mensagem de erro, ou null se a senha é válida. */
function erroDeSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 6) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  // bcrypt só considera os 72 primeiros bytes
  if (Buffer.byteLength(senha, 'utf8') > 72) {
    return 'A senha é muito longa (máximo de 72 caracteres).';
  }
  return null;
}

/**
 * Aceita "(47) 99999-8888", "47999998888", "+55 47 99999-8888"... Retorna o texto ou null.
 * O DDD (2 primeiros dígitos, depois do 55 opcional) não pode começar nem terminar em 0.
 */
function validarTelefone(valor) {
  const telefone = texto(valor);
  let digitos = telefone.replace(/\D/g, '');
  if (telefone.length > 20) return null;
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2); // DDI do Brasil
  if (digitos.length < 10 || digitos.length > 11) return null;
  if (digitos[0] === '0' || digitos[1] === '0') return null;
  return telefone;
}

/** Número no formato do link wa.me (com DDI 55 quando não informado). */
function paraWhatsapp(telefone) {
  const digitos = String(telefone).replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

/** Lança ErroHttp 400 se algum campo tiver mensagem de erro. */
function exigirValido(campos) {
  const chaves = Object.keys(campos);
  if (chaves.length) throw new ErroHttp(400, campos[chaves[0]], campos);
}

module.exports = {
  MSG_NOME_INVALIDO,
  MSG_TELEFONE_INVALIDO,
  texto,
  validarEmail,
  erroDeNome,
  erroDeSenha,
  validarTelefone,
  paraWhatsapp,
  exigirValido,
};
