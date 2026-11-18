const rateLimit = require('express-rate-limit');
const { falha } = require('../utils/responder');

/** Limita requisições por IP. Desligado nos testes automatizados. */
function criarLimite({ janelaMinutos, maximo, mensagem }) {
  return rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res) => falha(req, res, 429, mensagem, { redirect: req.retornoErro }),
  });
}

const limiteApi = criarLimite({
  janelaMinutos: 15,
  maximo: 600,
  mensagem: 'Muitas requisições. Aguarde alguns minutos.',
});
// login e troca de senha: protege contra tentativa de adivinhar senhas
const limiteLogin = criarLimite({
  janelaMinutos: 15,
  maximo: 10,
  mensagem: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
});
// recuperação: evita usar o sistema para disparar e-mails em massa
const limiteRecuperacao = criarLimite({
  janelaMinutos: 15,
  maximo: 5,
  mensagem: 'Muitos pedidos de recuperação. Aguarde 15 minutos.',
});
const limiteCadastro = criarLimite({
  janelaMinutos: 60,
  maximo: 20,
  mensagem: 'Muitos cadastros a partir desta rede. Tente mais tarde.',
});

module.exports = { limiteApi, limiteLogin, limiteRecuperacao, limiteCadastro };
