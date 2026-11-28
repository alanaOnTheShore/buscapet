const fs = require('fs');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
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

let agent;
let foto;

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

/** Envia o formulário de cadastro de pet como o front faz (multipart). */
function enviarPet(cliente, campos = {}, arquivo = { buffer: foto, nome: 'foto.jpg', tipo: 'image/jpeg' }) {
  const dados = {
    categoria: 'ADOCAO',
    nome: 'Rex',
    sexo: 'M',
    descricao: 'Cachorro dócil, castrado e muito carinhoso.',
    detalhes_fuga: '', // o formulário envia o campo vazio fora de "Perdido"
    ...campos,
  };
  let req = cliente.post('/api/animais').set('Accept', 'application/json');
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor !== undefined) req = req.field(chave, valor);
  }
  if (arquivo) req = req.attach('foto', arquivo.buffer, { filename: arquivo.nome, contentType: arquivo.tipo });
  return req;
}

// =====================================================================
describe('Cadastro de pet para adoção (POST /api/animais)', () => {
  test('exige login (401) e não grava nada', async () => {
    const res = await enviarPet(request(app));
    expect(res.status).toBe(401);
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
    expect(contarUploads()).toBe(0);
  });

  test('cria o anúncio: sexo salvo, detalhes_fuga NULL e foto registrada', async () => {
    const res = await enviarPet(agent);

    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT a.categoria, a.nome, a.sexo, a.detalhes_fuga, a.usuario_id, f.url, f.ordem
         FROM animais a JOIN fotos_animal f ON f.animal_id = a.id`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ categoria: 'ADOCAO', nome: 'Rex', sexo: 'M', detalhes_fuga: null, usuario_id: 1, ordem: 1 });
    expect(rows[0].url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
  });

  test('a foto é redimensionada (<=800px), convertida para WebP e fica leve', async () => {
    await enviarPet(agent).expect(201);

    const { rows } = await pool.query('SELECT url FROM fotos_animal');
    const arquivo = path.join(process.env.UPLOAD_DIR, path.basename(rows[0].url));
    const meta = await sharp(fs.readFileSync(arquivo)).metadata();

    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(800);
    expect(meta.width / meta.height).toBeCloseTo(3000 / 2000, 1); // mantém a proporção
    expect(fs.statSync(arquivo).size).toBeLessThan(100 * 1024);
    expect(contarUploads()).toBe(1);
  });

  test('foto pequena não é ampliada', async () => {
    const pequena = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#fff' } }).png().toBuffer();
    await enviarPet(agent, {}, { buffer: pequena, nome: 'p.png', tipo: 'image/png' }).expect(201);

    const { rows } = await pool.query('SELECT url FROM fotos_animal');
    const meta = await sharp(fs.readFileSync(path.join(process.env.UPLOAD_DIR, path.basename(rows[0].url)))).metadata();
    expect(meta.width).toBe(300);
  });

  test('sexo continua obrigatório em ADOCAO e PERDIDO (só ENCONTRADO pode ficar sem)', async () => {
    const adocao = await enviarPet(agent, { sexo: '' });
    expect(adocao.status).toBe(400);
    expect(adocao.body.campos.sexo).toBeDefined();

    const perdido = await enviarPet(agent, { categoria: 'PERDIDO', detalhes_fuga: 'Fugiu ontem à noite pelo portão da frente', sexo: '' });
    expect(perdido.status).toBe(400);
    expect(perdido.body.campos.sexo).toBeDefined();
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
  });

  test('aceita sexo em minúsculas e normaliza para M/F', async () => {
    await enviarPet(agent, { sexo: 'f' }).expect(201);
    expect((await pool.query('SELECT sexo FROM animais')).rows[0].sexo).toBe('F');
  });

  test.each([
    ['sem categoria', { categoria: undefined }, 'categoria'],
    ['categoria inválida', { categoria: 'ADOTADO' }, 'categoria'],
    ['sem nome', { nome: '' }, 'nome'],
    ['nome muito longo (31 caracteres)', { nome: 'a'.repeat(31) }, 'nome'],
    ['sem sexo', { sexo: undefined }, 'sexo'],
    ['sexo inválido', { sexo: 'X' }, 'sexo'],
    ['sem descrição', { descricao: '   ' }, 'descricao'],
    ['descrição gigante', { descricao: 'a'.repeat(2001) }, 'descricao'],
    ['descrição com menos de 30 caracteres', { descricao: 'a'.repeat(29) }, 'descricao'],
    ['descrição com caractere especial (@)', { descricao: 'Cachorro dócil, castrado. Fale comigo @fulano' }, 'descricao'],
    ['nome com caractere especial (@)', { nome: 'Rex@' }, 'nome'],
    ['nome com caractere especial (#)', { nome: '#Rex' }, 'nome'],
  ])('rejeita %s (400) sem gravar nem deixar foto órfã', async (_d, alteracao, campo) => {
    const res = await enviarPet(agent, alteracao);
    expect(res.status).toBe(400);
    expect(res.body.campos[campo]).toBeDefined();
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
    expect(contarUploads()).toBe(0);
  });

  test('aceita acentos e pontuação comum no nome e na descrição, e a descrição com exatamente 30 caracteres', async () => {
    const acentuado = await enviarPet(agent, {
      nome: 'Conceição',
      descricao: 'Ele é muito carinhoso (nunca mordeu!). Não late à noite: só “pede” colo.',
    });
    expect(acentuado.status).toBe(201);
    expect(acentuado.body.animal.nome).toBe('Conceição');

    const limite = await enviarPet(agent, { descricao: 'a'.repeat(30) });
    expect(limite.status).toBe(201);
  });

  test('detalhes de fuga só se aplicam a pets perdidos (ADOCAO com fuga -> 400)', async () => {
    const res = await enviarPet(agent, { detalhes_fuga: 'Fugiu ontem' });
    expect(res.status).toBe(400);
    expect(res.body.campos.detalhes_fuga).toBeDefined();
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
    expect(contarUploads()).toBe(0);
  });

  test('exige a foto', async () => {
    const res = await enviarPet(agent, {}, null);
    expect(res.status).toBe(400);
    expect(res.body.campos.foto).toBeDefined();
  });

  test('arquivo que não é imagem (mesmo com tipo image/png) é recusado', async () => {
    const res = await enviarPet(agent, {}, { buffer: Buffer.from('isto não é uma imagem'), nome: 'x.png', tipo: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/imagem/i);
    expect(contarUploads()).toBe(0);
  });

  test('SVG é recusado (só JPG, PNG, WEBP e GIF)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    const res = await enviarPet(agent, {}, { buffer: svg, nome: 'x.svg', tipo: 'image/svg+xml' });
    expect(res.status).toBe(400);
  });

  test('tipo de arquivo que não é imagem é recusado já no upload', async () => {
    const res = await enviarPet(agent, {}, { buffer: Buffer.from('%PDF-1.4'), nome: 'x.pdf', tipo: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  test('arquivo maior que 10 MB é recusado (413)', async () => {
    const res = await enviarPet(agent, {}, { buffer: Buffer.alloc(11 * 1024 * 1024), nome: 'g.jpg', tipo: 'image/jpeg' });
    expect(res.status).toBe(413);
    expect(res.body.erro).toMatch(/10 MB/);
  });

  test('formulário HTML (multipart): sucesso redireciona para Meus Pets', async () => {
    const res = await agent
      .post('/api/animais')
      .set('Accept', 'text/html')
      .field('categoria', 'ADOCAO')
      .field('nome', 'Rex')
      .field('sexo', 'M')
      .field('descricao', 'Cachorro dócil, castrado e muito carinhoso.')
      .attach('foto', foto, { filename: 'f.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/meus-pets.html?cadastrado=1');
  });

  // Regras compartilhadas com as outras categorias (o front usa um só formulário)
  test('PERDIDO exige detalhes da fuga; ENCONTRADO aceita nome vazio', async () => {
    const semFuga = await enviarPet(agent, { categoria: 'PERDIDO', detalhes_fuga: '' });
    expect(semFuga.status).toBe(400);
    expect(semFuga.body.campos.detalhes_fuga).toBeDefined();

    const fugaCurta = await enviarPet(agent, { categoria: 'PERDIDO', detalhes_fuga: 'a'.repeat(29) });
    expect(fugaCurta.status).toBe(400);
    expect(fugaCurta.body.campos.detalhes_fuga).toMatch(/mínimo de 30/);

    await enviarPet(agent, { categoria: 'PERDIDO', detalhes_fuga: 'Fugiu às 18h pelo portão da frente.' }).expect(201);
    await enviarPet(agent, { categoria: 'ENCONTRADO', nome: '' }).expect(201);

    const { rows } = await pool.query('SELECT categoria, nome, detalhes_fuga FROM animais ORDER BY id');
    expect(rows).toEqual([
      { categoria: 'PERDIDO', nome: 'Rex', detalhes_fuga: 'Fugiu às 18h pelo portão da frente.' },
      { categoria: 'ENCONTRADO', nome: null, detalhes_fuga: null },
    ]);
  });
});

// =====================================================================
describe('Listagem (GET /api/animais)', () => {
  let usuarioId;
  beforeEach(async () => {
    usuarioId = (await pool.query('SELECT id FROM usuarios')).rows[0].id;
  });

  test('é pública, filtra por categoria e ordena do mais recente ao mais antigo', async () => {
    await inserirAnimal(usuarioId, { nome: 'Antigo', criado_em: new Date('2026-01-01') });
    await inserirAnimal(usuarioId, { nome: 'Novo', criado_em: new Date('2026-06-01') });
    await inserirAnimal(usuarioId, { categoria: 'PERDIDO', nome: 'Mel', detalhes_fuga: 'fuga' });
    await inserirAnimal(usuarioId, { categoria: 'ENCONTRADO', nome: null });

    const res = await request(app).get('/api/animais?categoria=ADOCAO');

    expect(res.status).toBe(200);
    expect(res.body.itens.map((i) => i.nome)).toEqual(['Novo', 'Antigo']);
    expect(res.body.itens.every((i) => i.categoria === 'ADOCAO')).toBe(true);
    expect(res.body.proximoCursor).toBeNull();
  });

  test('sem categoria ou TODOS traz todas as categorias', async () => {
    await inserirAnimal(usuarioId);
    await inserirAnimal(usuarioId, { categoria: 'PERDIDO', detalhes_fuga: 'f' });
    await inserirAnimal(usuarioId, { categoria: 'ENCONTRADO', nome: null });

    expect((await request(app).get('/api/animais')).body.itens).toHaveLength(3);
    expect((await request(app).get('/api/animais?categoria=todos')).body.itens).toHaveLength(3);
  });

  test('ícone de gênero vem do que está salvo no banco (M -> masc, F -> fem)', async () => {
    await inserirAnimal(usuarioId, { nome: 'Macho', sexo: 'M', criado_em: new Date('2026-02-01') });
    await inserirAnimal(usuarioId, { nome: 'Femea', sexo: 'F', criado_em: new Date('2026-01-01') });

    const { itens } = (await request(app).get('/api/animais?categoria=ADOCAO')).body;

    expect(itens[0]).toMatchObject({ nome: 'Macho', sexo: 'M', sexoRotulo: 'Macho', sexoIcone: '/img/icon-sexo/masc.png' });
    expect(itens[1]).toMatchObject({ nome: 'Femea', sexo: 'F', sexoRotulo: 'Fêmea', sexoIcone: '/img/icon-sexo/fem.png' });
  });

  test('o card traz a foto e NÃO expõe telefone nem descrição', async () => {
    await inserirAnimal(usuarioId, { foto: '/uploads/abc.webp' });
    const { itens } = (await request(app).get('/api/animais')).body;

    expect(itens[0].foto).toBe('/uploads/abc.webp');
    expect(itens[0]).not.toHaveProperty('telefone');
    expect(itens[0]).not.toHaveProperty('whatsapp');
    expect(itens[0]).not.toHaveProperty('descricao');
  });

  test('animal sem foto aparece com foto null', async () => {
    await inserirAnimal(usuarioId, { foto: null });
    const { itens } = (await request(app).get('/api/animais')).body;
    expect(itens).toHaveLength(1);
    expect(itens[0].foto).toBeNull();
  });

  test('paginação por cursor: páginas completas, sem repetir e sem pular', async () => {
    for (let i = 1; i <= 5; i++) {
      await inserirAnimal(usuarioId, { nome: `Pet ${i}`, criado_em: new Date(2026, 0, i) });
    }

    const nomes = [];
    let cursor = null;
    const tamanhos = [];
    do {
      const url = `/api/animais?categoria=ADOCAO&limite=2${cursor ? `&cursor=${cursor}` : ''}`;
      const { body } = await request(app).get(url).expect(200);
      tamanhos.push(body.itens.length);
      nomes.push(...body.itens.map((i) => i.nome));
      cursor = body.proximoCursor;
    } while (cursor);

    expect(tamanhos).toEqual([2, 2, 1]);
    expect(nomes).toEqual(['Pet 5', 'Pet 4', 'Pet 3', 'Pet 2', 'Pet 1']);
  });

  test('registros com o MESMO horário não se perdem entre páginas (desempate por id)', async () => {
    const mesmoInstante = new Date('2026-03-01T12:00:00Z');
    for (let i = 1; i <= 4; i++) await inserirAnimal(usuarioId, { nome: `Gemeo ${i}`, criado_em: mesmoInstante });

    const vistos = [];
    let cursor = null;
    do {
      const { body } = await request(app).get(`/api/animais?limite=1${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      vistos.push(...body.itens.map((i) => i.nome));
      cursor = body.proximoCursor;
    } while (cursor);

    expect(vistos).toHaveLength(4);
    expect(new Set(vistos).size).toBe(4);
  });

  test('item novo cadastrado durante a rolagem não duplica itens já vistos', async () => {
    for (let i = 1; i <= 3; i++) await inserirAnimal(usuarioId, { nome: `Pet ${i}`, criado_em: new Date(2026, 0, i) });

    const pagina1 = (await request(app).get('/api/animais?limite=2')).body;
    await inserirAnimal(usuarioId, { nome: 'Recem-chegado', criado_em: new Date(2026, 5, 1) });
    const pagina2 = (await request(app).get(`/api/animais?limite=2&cursor=${pagina1.proximoCursor}`)).body;

    expect(pagina1.itens.map((i) => i.nome)).toEqual(['Pet 3', 'Pet 2']);
    expect(pagina2.itens.map((i) => i.nome)).toEqual(['Pet 1']);
  });

  test('limite padrão é 12 e o máximo é 30', async () => {
    for (let i = 0; i < 35; i++) await inserirAnimal(usuarioId, { nome: `P${i}`, criado_em: new Date(2026, 0, 1, 0, i) });

    const padrao = (await request(app).get('/api/animais')).body;
    expect(padrao.itens).toHaveLength(12);
    expect(padrao.proximoCursor).not.toBeNull();

    const enorme = (await request(app).get('/api/animais?limite=9999')).body;
    expect(enorme.itens).toHaveLength(30);
  });

  test.each([
    ['categoria inválida', '?categoria=GATO'],
    ['cursor inválido', '?cursor=lixo'],
    ['cursor com SQL', `?cursor=${Buffer.from("2026-01-01T00:00:00.000000|1; DROP TABLE animais").toString('base64url')}`],
  ])('%s -> 400', async (_d, consulta) => {
    const res = await request(app).get(`/api/animais${consulta}`);
    expect(res.status).toBe(400);
    expect((await pool.query('SELECT to_regclass(\'animais\') AS t')).rows[0].t).not.toBeNull();
  });
});

// =====================================================================
describe('Detalhe (GET /api/animais/:id)', () => {
  test('traz descrição, responsável e WhatsApp com DDI 55', async () => {
    const usuarioId = (await pool.query('SELECT id FROM usuarios')).rows[0].id; // telefone (47) 99999-8888
    const id = await inserirAnimal(usuarioId, { nome: 'Fabi', sexo: 'F', descricao: 'Resgatada, vacinada.' });

    const res = await request(app).get(`/api/animais/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.animal).toMatchObject({
      id,
      nome: 'Fabi',
      categoria: 'ADOCAO',
      sexo: 'F',
      sexoRotulo: 'Fêmea',
      sexoIcone: '/img/icon-sexo/fem.png',
      descricao: 'Resgatada, vacinada.',
      detalhesFuga: null,
      whatsapp: '5547999998888',
      responsavel: { nome: 'ONG Patas', tipo: 'ONG' },
    });
  });

  test('pet perdido devolve os detalhes da fuga', async () => {
    const usuarioId = (await pool.query('SELECT id FROM usuarios')).rows[0].id;
    const id = await inserirAnimal(usuarioId, { categoria: 'PERDIDO', detalhes_fuga: 'Fugiu pelo portão' });
    const { body } = await request(app).get(`/api/animais/${id}`);
    expect(body.animal.detalhesFuga).toBe('Fugiu pelo portão');
  });

  test.each(['9999', 'abc', '1; DROP TABLE animais', '99999999999999999999'])(
    'id "%s" inexistente/inválido -> 404',
    async (id) => {
      const res = await request(app).get(`/api/animais/${encodeURIComponent(id)}`);
      expect(res.status).toBe(404);
    }
  );
});
