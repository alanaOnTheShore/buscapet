const request = require('supertest');
const app = require('../src/app');

describe('Módulo de Pets Perdidos', () => {
  it('deve cadastrar um pet PERDIDO com sucesso e retornar status 201', async () => {
    const petPerdidoMock = {
      usuario_id: 1,
      categoria: 'PERDIDO',
      nome: 'Bidu',
      descricao: 'Cachorro de porte médio, pelo caramelo e coleira azul.',
      detalhes_fuga: 'Fugiu pelo portão de casa na tarde de terça-feira.'
    };

    const response = await request(app)
      .post('/api/animais/perdidos')
      .send(petPerdidoMock);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.categoria).toBe('PERDIDO');
    expect(response.body.nome).toBe(petPerdidoMock.nome);
  });

  it('deve retornar erro 400 se tentar cadastrar pet PERDIDO sem detalhes_fuga', async () => {
    const petSemFuga = {
      usuario_id: 1,
      categoria: 'PERDIDO',
      nome: 'Rex',
      descricao: 'Cachorro grande.'
    };


    const response = await request(app)
      .post('/api/animais/perdidos')
      .send(petSemFuga);

    expect(response.status).toBe(400); 
  });

it('deve listar todos os pets perdidos com status 200', async () => {
    // Fazemos um GET na rota (não enviamos 'send' porque é apenas busca)
    const response = await request(app).get('/api/animais/perdidos');

    expect(response.status).toBe(200);
    // Verificamos se a resposta é uma lista (array) de animais
    expect(Array.isArray(response.body)).toBe(true);
  });
});