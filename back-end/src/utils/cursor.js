/**
 * Cursor de paginação: guarda (criado_em, id) do último item entregue.
 * O timestamp vai como TEXTO com microssegundos (o Date do JavaScript só tem
 * milissegundos e causaria itens repetidos/perdidos); o id desempata registros
 * criados no mesmo instante.
 */
const { ErroHttp } = require('./erros');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
const ID_MAXIMO_INTEGER = 2147483647;

const codificarCursor = ({ criadoEm, id }) => Buffer.from(`${criadoEm}|${id}`).toString('base64url');

function decodificarCursor(valor) {
  if (valor === undefined || valor === '') return null;
  const invalido = () => new ErroHttp(400, 'Cursor de paginação inválido.');
  if (typeof valor !== 'string' || valor.length > 100) throw invalido();
  const [criadoEm, idTexto] = Buffer.from(valor, 'base64url').toString('utf8').split('|');
  const id = Number(idTexto);
  if (!REGEX_DATA.test(criadoEm || '') || !Number.isInteger(id) || id < 0 || id > ID_MAXIMO_INTEGER) {
    throw invalido();
  }
  return { criadoEm, id };
}

module.exports = { codificarCursor, decodificarCursor, ID_MAXIMO_INTEGER };
