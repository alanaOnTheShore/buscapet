const animalEncontradoModel = require('../models/AnimalEncontradoModel');

const cadastrarAnimalEncontrado = async (req, res) => {
  const { usuario_id, categoria, nome, descricao, detalhes_fuga } = req.body;

  if (categoria === 'ENCONTRADO' && detalhes_fuga) {
    return res.status(400).json({ error: 'Animais encontrados não devem conter detalhes de fuga.' });
  }

  try {
    const novoAnimal = await animalEncontradoModel.criarAnimalEncontrado({
      usuario_id,
      nome,
      descricao
    });

    res.status(201).json(novoAnimal);
  } catch (erro) {
    console.error('Erro ao gravar na base de dados:', erro);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

module.exports = {
  cadastrarAnimalEncontrado
};

const listarAnimaisEncontrados = async (req, res) => {
  try {
    const listaAnimais = await animalEncontradoModel.listarAnimaisEncontrados();
    res.status(200).json(listaAnimais);
  } catch (erro) {
    console.error('Erro ao buscar no banco de dados:', erro);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

module.exports = {
  cadastrarAnimalEncontrado,
  listarAnimaisEncontrados
};