/**
 * Módulo "Meus Pets": o usuário logado vê e exclui os PRÓPRIOS anúncios
 * (GET /api/animais/meus e DELETE /api/animais/:id).
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

beforeAll(async () => {
  await recriarEsquema();
  foto = await criarFotoGrande();
});
beforeEach(async () => {
  await limparTabelas();
  limparUploads();
});
afterAll(async () => {
  limparUploads();
  await pool.end();
});

const OUTRO_USUARIO = { nome: 'Maria Silva', email: 'maria@teste.com', telefone: '(11) 98888-2222', tipo: 'PESSOA' };

/** Cadastra um pet de verdade (com upload da foto), como o formulário do front faz. */
function enviarPet(cliente, campos = {}) {
  let req = cliente.post('/api/animais').set('Accept', 'application/json');
  const dados = { categoria: 'ADOCAO', nome: 'Rex', sexo: 'M', descricao: 'Cachorro dócil.', detalhes_fuga: '', ...campos };
  for (const [chave, valor] of Object.entries(dados)) req = req.field(chave, valor);
  return req.attach('foto', foto, { filename: 'foto.jpg', contentType: 'image/jpeg' });
}

// =====================================================================
describe('Listar meus pets (GET /api/animais/meus)', () => {
  test('exige login (401)', async () => {
    const res = await request(app).get('/api/animais/meus');

    expect(res.status).toBe(401);
    expect(res.body.erro).toBeDefined();
  });

  test('lista vazia para quem ainda não cadastrou nada', async () => {
    const agent = await entrar(request, app);

    const res = await agent.get('/api/animais/meus');

    expect(res.status).toBe(200); // "meus" não é lido como se fosse um :id
    expect(res.body).toEqual({ itens: [] });
  });

  test('traz só os anúncios de quem está logado, de todas as categorias, do mais recente ao mais antigo', async () => {
    const agenteA = await entrar(request, app); // usuário 1
    const agenteB = await entrar(request, app, OUTRO_USUARIO); // usuário 2
    await inserirAnimal(1, { nome: 'Antigo', criado_em: new Date('2026-01-01') });
    await inserirAnimal(1, {
      categoria: 'PERDIDO',
      nome: 'Mel',
      sexo: 'F',
      detalhes_fuga: 'Fugiu no portão',
      criado_em: new Date('2026-02-01'),
    });
    await inserirAnimal(1, { categoria: 'ENCONTRADO', nome: null, criado_em: new Date('2026-03-01') });
    await inserirAnimal(2, { nome: 'DaMaria' });

    const { body } = await agenteA.get('/api/animais/meus').expect(200);

    expect(body.itens.map((animal) => animal.categoria)).toEqual(['ENCONTRADO', 'PERDIDO', 'ADOCAO']);
    expect(body.itens.map((animal) => animal.nome)).toEqual([null, 'Mel', 'Antigo']);
    expect(body.itens[1]).toMatchObject({
      sexo: 'F',
      sexoRotulo: 'Fêmea',
      sexoIcone: '/img/icon-sexo/fem.png',
      foto: '/uploads/exemplo.webp',
    });

    const deMaria = (await agenteB.get('/api/animais/meus')).body.itens;
    expect(deMaria.map((animal) => animal.nome)).toEqual(['DaMaria']);
  });

  test('não expõe telefone nem descrição', async () => {
    const agent = await entrar(request, app);
    await inserirAnimal(1);

    const { itens } = (await agent.get('/api/animais/meus')).body;

    expect(itens[0]).not.toHaveProperty('telefone');
    expect(itens[0]).not.toHaveProperty('whatsapp');
    expect(itens[0]).not.toHaveProperty('descricao');
  });

  test('o pet recém-cadastrado pelo formulário aparece em "meus pets" (e só para o dono)', async () => {
    const agenteA = await entrar(request, app);
    const agenteB = await entrar(request, app, OUTRO_USUARIO);

    const criado = await enviarPet(agenteA, { nome: 'Fabi', sexo: 'F' }).expect(201);

    const meus = (await agenteA.get('/api/animais/meus')).body.itens;
    expect(meus).toHaveLength(1);
    expect(meus[0]).toMatchObject({ id: criado.body.animal.id, nome: 'Fabi', categoria: 'ADOCAO' });
    expect(meus[0].foto).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect((await agenteB.get('/api/animais/meus')).body.itens).toEqual([]);
  });
});

// =====================================================================
describe('Excluir pet (DELETE /api/animais/:id)', () => {
  test('exige login (401) e não apaga nada', async () => {
    const agent = await entrar(request, app);
    const id = (await enviarPet(agent).expect(201)).body.animal.id;

    const res = await request(app).delete(`/api/animais/${id}`);

    expect(res.status).toBe(401);
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(1);
    expect(contarUploads()).toBe(1);
  });

  test('o dono exclui o anúncio, a foto no banco e o arquivo da foto', async () => {
    const agent = await entrar(request, app);
    const id = (await enviarPet(agent).expect(201)).body.animal.id;
    expect(contarUploads()).toBe(1);

    const res = await agent.delete(`/api/animais/${id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM fotos_animal')).rowCount).toBe(0);
    expect(contarUploads()).toBe(0);
    expect((await request(app).get(`/api/animais/${id}`)).status).toBe(404);
    expect((await agent.get('/api/animais/meus')).body.itens).toEqual([]);
  });

  test('anúncio de OUTRA pessoa não é apagado (404, igual a um id que não existe)', async () => {
    const agenteA = await entrar(request, app);
    const agenteB = await entrar(request, app, OUTRO_USUARIO);
    const idDaA = (await enviarPet(agenteA, { nome: 'PetDaA' }).expect(201)).body.animal.id;

    const res = await agenteB.delete(`/api/animais/${idDaA}`);

    expect(res.status).toBe(404);
    expect((await pool.query('SELECT nome FROM animais')).rows).toEqual([{ nome: 'PetDaA' }]);
    expect(contarUploads()).toBe(1);
  });

  test('apagar um não afeta os outros anúncios do mesmo dono', async () => {
    const agent = await entrar(request, app);
    const primeiro = (await enviarPet(agent, { nome: 'Primeiro' }).expect(201)).body.animal.id;
    await enviarPet(agent, { nome: 'Segundo' }).expect(201);

    await agent.delete(`/api/animais/${primeiro}`).expect(200);

    expect((await pool.query('SELECT nome FROM animais')).rows).toEqual([{ nome: 'Segundo' }]);
    expect(contarUploads()).toBe(1);
  });

  test.each([['9999'], ['abc'], ['1.5'], ['-1'], ['99999999999999999999']])(
    'id %s não existe ou é inválido: 404 sem erro de servidor',
    async (id) => {
      const agent = await entrar(request, app);

      const res = await agent.delete(`/api/animais/${encodeURIComponent(id)}`);

      expect(res.status).toBe(404);
      expect(res.body.erro).toBe('Anúncio não encontrado.');
    }
  );
});
