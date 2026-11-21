/**
 * Módulo de Pets Perdidos (rotas /api/animais/perdidos).
 * Adaptado dos testes originais: agora o cadastro exige login, sexo e foto,
 * e cada teste cria os próprios dados no banco de TESTES.
 */
const request = require('supertest');
const app = require('../src/app');
const {
  pool,
  recriarEsquema,
  limparTabelas,
  limparUploads,
  contarUploads,
  criarFotoGrande,
  entrar,
  inserirAnimal,
} = require('./helpers');

let foto;
let agent;

beforeAll(async () => {
  await recriarEsquema();
  foto = await criarFotoGrande();
});
beforeEach(async () => {
  await limparTabelas();
  limparUploads();
  agent = await entrar(request, app);
});
afterAll(async () => {
  limparUploads();
  await pool.end();
});

const petPerdidoMock = {
  nome: 'Bidu',
  sexo: 'M',
  descricao: 'Cachorro de porte médio, pelo caramelo e coleira azul.',
  detalhes_fuga: 'Fugiu pelo portão de casa na tarde de terça-feira.',
};

function enviar(cliente, campos = petPerdidoMock) {
  let req = cliente.post('/api/animais/perdidos').set('Accept', 'application/json');
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor !== undefined) req = req.field(chave, valor);
  }
  return req.attach('foto', foto, { filename: 'bidu.jpg', contentType: 'image/jpeg' });
}

describe('Módulo de Pets Perdidos', () => {
  it('deve cadastrar um pet PERDIDO com sucesso e retornar status 201', async () => {
    const response = await enviar(agent);

    expect(response.status).toBe(201);
    expect(response.body.animal).toHaveProperty('id');
    expect(response.body.animal.categoria).toBe('PERDIDO');
    expect(response.body.animal.nome).toBe(petPerdidoMock.nome);

    const { rows } = await pool.query('SELECT detalhes_fuga, sexo FROM animais');
    expect(rows).toEqual([{ detalhes_fuga: petPerdidoMock.detalhes_fuga, sexo: 'M' }]);
  });

  it('deve retornar erro 400 se tentar cadastrar pet PERDIDO sem detalhes_fuga', async () => {
    const response = await enviar(agent, { ...petPerdidoMock, detalhes_fuga: undefined });

    expect(response.status).toBe(400);
    expect(response.body.campos.detalhes_fuga).toMatch(/obrigatório/i);
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
    expect(contarUploads()).toBe(0);
  });

  it('deve listar todos os pets perdidos com status 200', async () => {
    const usuarioId = (await pool.query('SELECT id FROM usuarios')).rows[0].id;
    await inserirAnimal(usuarioId, { categoria: 'PERDIDO', nome: 'Mel', detalhes_fuga: 'fuga' });
    await inserirAnimal(usuarioId, { categoria: 'ADOCAO', nome: 'Rex' });
    await inserirAnimal(usuarioId, { categoria: 'ENCONTRADO', nome: null });

    const response = await request(app).get('/api/animais/perdidos');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.itens)).toBe(true);
    expect(response.body.itens.map((i) => i.nome)).toEqual(['Mel']); // só a categoria PERDIDO
    expect(response.body.proximoCursor).toBeNull();
  });

  // ---- novidades da integração com Autenticação e banco oficial ----
  it('exige login (401) e não grava nada', async () => {
    const response = await enviar(request(app));
    expect(response.status).toBe(401);
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
  });

  it('o dono do pet é o usuário da sessão, mesmo que o corpo mande outro usuario_id', async () => {
    await entrar(request, app, { email: 'outra@teste.com', nome: 'Outra Pessoa' }); // usuário 2
    const response = await enviar(agent, { ...petPerdidoMock, usuario_id: '2' }); // sessão do usuário 1
    expect(response.status).toBe(201);
    expect((await pool.query('SELECT usuario_id FROM animais')).rows).toEqual([{ usuario_id: 1 }]);
  });

  it('a categoria é sempre PERDIDO nesta rota, mesmo que o corpo diga outra', async () => {
    const response = await enviar(agent, { ...petPerdidoMock, categoria: 'ADOCAO' });
    expect(response.status).toBe(201);
    expect(response.body.animal.categoria).toBe('PERDIDO');
  });

  it('exige sexo (M/F) e foto', async () => {
    const semSexo = await enviar(agent, { ...petPerdidoMock, sexo: undefined });
    expect(semSexo.status).toBe(400);
    expect(semSexo.body.campos.sexo).toBeDefined();

    let req = agent.post('/api/animais/perdidos').set('Accept', 'application/json');
    for (const [c, v] of Object.entries(petPerdidoMock)) req = req.field(c, v);
    const semFoto = await req;
    expect(semFoto.status).toBe(400);
    expect(semFoto.body.campos.foto).toBeDefined();
  });

  it('pet perdido sem nome é recusado', async () => {
    const response = await enviar(agent, { ...petPerdidoMock, nome: '' });
    expect(response.status).toBe(400);
    expect(response.body.campos.nome).toBeDefined();
  });

  it('o pet cadastrado aparece na listagem geral e no detalhe, com os detalhes da fuga', async () => {
    const criado = (await enviar(agent)).body.animal;

    const lista = await request(app).get('/api/animais?categoria=PERDIDO');
    expect(lista.body.itens.map((i) => i.id)).toEqual([criado.id]);

    const detalhe = await request(app).get(`/api/animais/${criado.id}`);
    expect(detalhe.body.animal.detalhesFuga).toBe(petPerdidoMock.detalhes_fuga);
  });

  it('a rota /perdidos não é confundida com /api/animais/:id', async () => {
    const response = await request(app).get('/api/animais/perdidos');
    expect(response.status).toBe(200); // e não 404 de "id inválido"
  });

  it('a listagem de perdidos também pagina por cursor', async () => {
    const usuarioId = (await pool.query('SELECT id FROM usuarios')).rows[0].id;
    for (let i = 1; i <= 3; i++) {
      await inserirAnimal(usuarioId, { categoria: 'PERDIDO', nome: `P${i}`, detalhes_fuga: 'f', criado_em: new Date(2026, 0, i) });
    }
    const pagina1 = (await request(app).get('/api/animais/perdidos?limite=2')).body;
    const pagina2 = (await request(app).get(`/api/animais/perdidos?limite=2&cursor=${pagina1.proximoCursor}`)).body;
    expect(pagina1.itens.map((i) => i.nome)).toEqual(['P3', 'P2']);
    expect(pagina2.itens.map((i) => i.nome)).toEqual(['P1']);
    expect(pagina2.proximoCursor).toBeNull();
  });
});
