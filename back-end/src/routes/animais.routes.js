const express = require('express');
const { ah } = require('../utils/assincrono');
const { definirRetorno } = require('../middlewares/retorno');
const { exigirLogin } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const animais = require('../controllers/animais.controller');

const router = express.Router();

// Visualização é pública
router.get('/', ah(animais.listar));

// "meus" vem ANTES de "/:id", senão seria lido como se fosse um id
router.get('/meus', exigirLogin, ah(animais.listarMeus));
router.get('/:id', ah(animais.detalhar));

// Cadastro exige login (a verificação vem ANTES de receber a foto)
router.post(
  '/',
  definirRetorno('/cadastro-pet.html'),
  exigirLogin,
  upload.single('foto'),
  ah(animais.criar)
);

// Só o dono exclui o próprio anúncio
router.delete('/:id', exigirLogin, ah(animais.excluir));

module.exports = router;
