const express = require('express');
const router = express.Router();
const animaisEncontradosController = require('../controllers/AnimaisEncontradosController');

router.post('/', animaisEncontradosController.cadastrarAnimalEncontrado);
router.get('/', animaisEncontradosController.listarAnimaisEncontrados);

module.exports = router;