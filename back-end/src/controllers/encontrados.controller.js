/** Módulo de Animais Encontrados: nome opcional e fuga proibida (veja utils/regrasAnimal.js). */
const { criarCategoria, listarCategoria } = require('./animais.controller');

module.exports = {
  cadastrarAnimalEncontrado: criarCategoria('ENCONTRADO'),
  listarAnimaisEncontrados: listarCategoria('ENCONTRADO'),
};
