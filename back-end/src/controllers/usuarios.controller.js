const { sucesso } = require('../utils/responder');
const { texto, validarTelefone, erroDeNome, exigirValido } = require('../utils/validacao');
const { removerImagem } = require('../utils/armazenamento');
const { encerrarSessao } = require('../middlewares/auth');
const usuarioModel = require('../models/usuario.model');

/** PATCH /api/me - altera nome e telefone. E-mail, tipo e senha NÃO mudam por aqui. */
async function atualizarPerfil(req, res) {
  const nome = texto(req.body.nome);
  const telefone = validarTelefone(req.body.telefone);

  const campos = {};
  const erroNome = erroDeNome(nome);
  if (erroNome) campos.nome = erroNome;
  if (!telefone) campos.telefone = 'Informe um telefone válido com DDD.';
  exigirValido(campos);

  // o id vem SEMPRE da sessão, nunca do corpo da requisição
  const usuario = await usuarioModel.atualizarPerfil(req.usuario.id, { nome, telefone });
  sucesso(req, res, { json: { usuario } });
}

/** DELETE /api/me - exclui a conta, os anúncios (em cascata) e as fotos do armazenamento. */
async function excluirConta(req, res) {
  const fotos = await usuarioModel.excluir(req.usuario.id);

  // a conta já foi apagada: falha ao remover um arquivo não pode virar erro para o usuário
  await Promise.allSettled(fotos.map(removerImagem));

  encerrarSessao(res);
  sucesso(req, res, { json: { ok: true } });
}

module.exports = { atualizarPerfil, excluirConta };
