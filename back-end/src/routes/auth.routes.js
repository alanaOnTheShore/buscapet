const express = require('express');
const { ah } = require('../utils/assincrono');
const { comParametros } = require('../utils/responder');
const { definirRetorno } = require('../middlewares/retorno');
const { limiteLogin, limiteRecuperacao, limiteCadastro } = require('../middlewares/limites');
const auth = require('../controllers/auth.controller');

const router = express.Router();

// Nomes de rota = os "action" dos formulários do front
router.post('/cadastrar', definirRetorno('/cadastro-perfil.html'), limiteCadastro, ah(auth.cadastrar));
router.post('/login', definirRetorno('/index.html'), limiteLogin, ah(auth.login));
router.post('/api/logout', ah(auth.logout));

router.post(
  '/api/recuperar-senha',
  definirRetorno('/redefinir-senha.html'),
  limiteRecuperacao,
  ah(auth.recuperarSenha)
);

// Se der erro, volta para a página com o token (quando ele tem o formato certo)
const voltarParaNovaSenha = (req) => {
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
  return comParametros('/criar-nova-senha.html', { token: /^[a-f0-9]{64}$/.test(token) ? token : '' });
};
router.post('/atualizar-senha', definirRetorno(voltarParaNovaSenha), limiteLogin, ah(auth.atualizarSenha));

module.exports = router;
