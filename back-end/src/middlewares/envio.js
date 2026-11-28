const { ErroHttp } = require('../utils/erros');

// Usuários que estão com um cadastro sendo processado agora (guardado na memória do servidor).
const emAndamento = new Set();

/**
 * Impede que o MESMO usuário tenha dois cadastros sendo processados ao mesmo tempo.
 * Quem clica várias vezes em "Cadastrar" (ou reenvia por internet lenta) mandaria o mesmo pet
 * duas, três vezes: a primeira requisição é processada e as seguintes recebem 409.
 * Deve vir DEPOIS de exigirLogin (usa req.usuario) e ANTES de receber a foto.
 */
function bloquearEnvioSimultaneo(req, res, next) {
  const chave = req.usuario.id;
  if (emAndamento.has(chave)) {
    return next(new ErroHttp(409, 'Já estamos salvando o seu pet. Aguarde um instante.'));
  }
  emAndamento.add(chave);
  // 'close' cobre o caso de a conexão cair no meio: o bloqueio nunca fica preso
  const liberar = () => emAndamento.delete(chave);
  res.once('finish', liberar);
  res.once('close', liberar);
  next();
}

module.exports = { bloquearEnvioSimultaneo };
