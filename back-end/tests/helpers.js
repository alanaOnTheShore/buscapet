const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// No Windows o cache do sharp mantém arquivos "presos" e impede apagar a pasta de uploads.
sharp.cache(false);
const { pool } = require('../src/db');

const SCHEMA = path.join(__dirname, '..', 'database', 'schema.sql');

/** Recria tabelas/tipos/índices (o schema.sql começa com DROP). */
async function recriarEsquema() {
  await pool.query(fs.readFileSync(SCHEMA, 'utf8'));
}

async function limparTabelas() {
  await pool.query('TRUNCATE usuarios RESTART IDENTITY CASCADE');
}

function limparUploads() {
  try {
    fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Antivírus/indexador do Windows pode segurar a pasta por instantes: não derruba o teste.
    // Os testes não dependem da pasta estar vazia, e sim de contar arquivos novos (veja contarUploads).
  }
}

function contarUploads() {
  return fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR).length : 0;
}

/** Foto "de celular": grande (3000x2000) para provar que será reduzida. */
function criarFotoGrande() {
  return sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 120, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

const DADOS_USUARIO = {
  nome: 'ONG Patas',
  email: 'ong@teste.com',
  telefone: '(47) 99999-8888',
  tipo: 'ONG',
  senha: 'senha123',
  'conf-senha': 'senha123',
};

/** Cadastra e faz login; devolve o agent (com cookie de sessão). */
async function entrar(request, app, sobrescrever = {}) {
  const agent = request.agent(app);
  const dados = { ...DADOS_USUARIO, ...sobrescrever };
  await agent.post('/cadastrar').send(dados).expect(201);
  await agent.post('/login').send({ email: dados.email, senha: dados.senha }).expect(200);
  return agent;
}

/** Insere um animal direto no banco (com foto de capa). */
async function inserirAnimal(usuarioId, sobrescrever = {}) {
  const d = {
    categoria: 'ADOCAO',
    nome: 'Rex',
    sexo: 'M',
    descricao: 'Descrição',
    detalhes_fuga: null,
    criado_em: new Date(),
    foto: '/uploads/exemplo.webp',
    ...sobrescrever,
  };
  const { rows } = await pool.query(
    `INSERT INTO animais (usuario_id, categoria, nome, sexo, descricao, detalhes_fuga, criado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [usuarioId, d.categoria, d.nome, d.sexo, d.descricao, d.detalhes_fuga, d.criado_em]
  );
  if (d.foto) {
    await pool.query('INSERT INTO fotos_animal (animal_id, url, ordem) VALUES ($1,$2,1)', [rows[0].id, d.foto]);
  }
  return rows[0].id;
}

module.exports = {
  pool,
  recriarEsquema,
  limparTabelas,
  limparUploads,
  contarUploads,
  criarFotoGrande,
  DADOS_USUARIO,
  entrar,
  inserirAnimal,
};
