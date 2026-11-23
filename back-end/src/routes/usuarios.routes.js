const express = require('express');
const { ah } = require('../utils/assincrono');
const { exigirLogin } = require('../middlewares/auth');
const usuarios = require('../controllers/usuarios.controller');

const router = express.Router();

// "me" = o usuário da sessão. Nenhuma rota recebe id de usuário na URL.
router.get('/api/me', exigirLogin, (req, res) => res.json({ usuario: req.usuario }));
router.patch('/api/me', exigirLogin, ah(usuarios.atualizarPerfil));
router.delete('/api/me', exigirLogin, ah(usuarios.excluirConta));

module.exports = router;
