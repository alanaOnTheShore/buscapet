const { ErroHttp } = require('./erros');

// Mesmo padrão usado nos formulários (HTML) e compatível com a CONSTRAINT do banco
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/** Retorna o e-mail em minúsculas ou null se inválido. */
function validarEmail(valor) {
  const email = texto(valor).toLowerCase();
  if (!email || email.length > 160 || !EMAIL_REGEX.test(email)) return null;
  return email;
}

/** Retorna a mensagem de erro, ou null se o nome (já com trim) é válido. */
function erroDeNome(nome) {
  return !nome || nome.length > 120 ? 'Informe o nome (até 120 caracteres).' : null;
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

/** Aceita "(47) 99999-8888", "47999998888"... Retorna o texto ou null. */
function validarTelefone(valor) {
  const telefone = texto(valor);
  const digitos = telefone.replace(/\D/g, '');
  if (telefone.length > 20 || digitos.length < 10 || digitos.length > 13) return null;
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
  texto,
  validarEmail,
  erroDeNome,
  erroDeSenha,
  validarTelefone,
  paraWhatsapp,
  exigirValido,
};
