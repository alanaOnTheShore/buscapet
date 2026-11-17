const petPerdidoModel = require('../models/PetPerdidoModel');

const cadastrarPetPerdido = async (req, res) => {
  const { usuario_id, categoria, nome, descricao, detalhes_fuga } = req.body;

  // Validação contínua: o campo de fuga é obrigatório
  if (categoria === 'PERDIDO' && !detalhes_fuga) {
    return res.status(400).json({ error: 'O detalhamento da fuga é obrigatório.' });
  }

  try {
    // Em vez de fingir, chamamos a função do Model que criaste
    const novoPet = await petPerdidoModel.criarPetPerdido({
      usuario_id,
      nome,
      descricao,
      detalhes_fuga
    });

    // Devolve o animal real que o PostgreSQL acabou de gravar (com o ID verdadeiro)
    res.status(201).json(novoPet);
  } catch (erro) {
    console.error('Erro ao gravar na base de dados:', erro);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

module.exports = {
  cadastrarPetPerdido
};

const listarPetsPerdidos = async (req, res) => {
  try {
    const listaPets = await petPerdidoModel.listarPetsPerdidos();
    res.status(200).json(listaPets);
  } catch (erro) {
    console.error('Erro ao buscar no banco de dados:', erro);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

// Adicione na exportação:
module.exports = {
  cadastrarPetPerdido,
  listarPetsPerdidos
};