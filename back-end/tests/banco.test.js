/**
 * BuscaPet - Testes do banco de dados (Jest + pg)
 *
 * ATENÇÃO: estes testes RECRIAM as tabelas (rodam o buscapet_schema.sql,
 * que começa com DROP TABLE). Use SEMPRE um banco separado, definido em
 * TEST_DATABASE_URL. Nunca aponte para o banco real.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const URL = process.env.TEST_DATABASE_URL;
if (!URL) {
  throw new Error('Defina TEST_DATABASE_URL (banco SEPARADO para testes) no arquivo .env');
}

// Neon/Supabase já trazem sslmode=require na string de conexão
const pool = new Pool({ connectionString: URL });

// Conexão remota + carga de 10 mil registros podem passar do limite padrão (5 s)
jest.setTimeout(60000);

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const q = (sql, params) => pool.query(sql, params);

/** Executa a promise e devolve o código SQLSTATE do erro (ou null se não falhou). */
async function codigoErro(promise) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.code || e.message;
  }
}

async function criarUsuario(o = {}) {
  const d = {
    nome: 'Usuario Teste',
    email: `u${Math.random().toString(36).slice(2)}@teste.com`,
    senha_hash: 'hash_de_teste',
    telefone: '47999999999',
    tipo: 'PESSOA',
    ...o,
  };
  const r = await q(
    `INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [d.nome, d.email, d.senha_hash, d.telefone, d.tipo]
  );
  return r.rows[0].id;
}

async function criarAnimal(usuarioId, o = {}) {
  const d = {
    categoria: 'ADOCAO',
    nome: 'Rex',
    sexo: 'M',
    descricao: 'Descrição de teste',
    detalhes_fuga: null,
    criado_em: new Date(),
    ...o,
  };
  const r = await q(
    `INSERT INTO animais (usuario_id, categoria, nome, sexo, descricao, detalhes_fuga, criado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [usuarioId, d.categoria, d.nome, d.sexo, d.descricao, d.detalhes_fuga, d.criado_em]
  );
  return r.rows[0].id;
}

async function criarFoto(animalId, ordem = 1, url = 'https://exemplo.com/foto.jpg') {
  await q(`INSERT INTO fotos_animal (animal_id, url, ordem) VALUES ($1,$2,$3)`, [animalId, url, ordem]);
}

// ---------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------
beforeAll(async () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await q(schema); // recria tipos, tabelas e índices
});

beforeEach(async () => {
  await q('TRUNCATE usuarios RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// SQLSTATE usados: 23505 unique | 23514 check | 23502 not null
//                  23503 foreign key | 22P02 valor inválido de enum

// =====================================================================
// 1. TESTES UNITÁRIOS (estrutura e regras do banco)
// =====================================================================
describe('1. Unitários - estrutura e regras', () => {
  test('01 - tabelas usuarios, animais e fotos_animal existem', async () => {
    const r = await q(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`
    );
    const nomes = r.rows.map((x) => x.table_name);
    expect(nomes).toEqual(expect.arrayContaining(['usuarios', 'animais', 'fotos_animal']));
  });

  test('02 - insere usuário válido', async () => {
    const id = await criarUsuario();
    expect(id).toBe(1);
  });

  test('03 - e-mail duplicado é recusado (23505)', async () => {
    await criarUsuario({ email: 'dup@teste.com' });
    const erro = await codigoErro(criarUsuario({ email: 'dup@teste.com' }));
    expect(erro).toBe('23505');
  });

  test('04 - e-mail em formato inválido é recusado (23514)', async () => {
    const erro = await codigoErro(criarUsuario({ email: 'abc' }));
    expect(erro).toBe('23514');
  });

  test.each(['nome', 'email', 'senha_hash', 'telefone'])(
    '05 - usuário sem %s é recusado (23502)',
    async (campo) => {
      const erro = await codigoErro(criarUsuario({ [campo]: null }));
      expect(erro).toBe('23502');
    }
  );

  test('06 - tipo de usuário fora de PESSOA/ONG é recusado (22P02)', async () => {
    const erro = await codigoErro(criarUsuario({ tipo: 'ADMIN' }));
    expect(erro).toBe('22P02');
  });

  test('07 - animal de adoção com nome e descrição é aceito', async () => {
    const u = await criarUsuario();
    const id = await criarAnimal(u, { categoria: 'ADOCAO' });
    expect(id).toBe(1);
  });

  test('08 - perdido sem detalhes_fuga é recusado (ck_animais_detalhes_fuga)', async () => {
    const u = await criarUsuario();
    await expect(
      criarAnimal(u, { categoria: 'PERDIDO', nome: 'Bob', detalhes_fuga: null })
    ).rejects.toThrow(/ck_animais_detalhes_fuga/);
  });

  test('08b - perdido com detalhes_fuga em branco é recusado', async () => {
    const u = await criarUsuario();
    const erro = await codigoErro(criarAnimal(u, { categoria: 'PERDIDO', detalhes_fuga: '   ' }));
    expect(erro).toBe('23514');
  });

  test('08c - perdido com detalhes_fuga é aceito', async () => {
    const u = await criarUsuario();
    const id = await criarAnimal(u, {
      categoria: 'PERDIDO',
      nome: 'Mel',
      detalhes_fuga: 'Fugiu pelo portão às 18h',
    });
    expect(id).toBe(1);
  });

  test('09 - adoção com detalhes_fuga preenchido é recusado (23514)', async () => {
    const u = await criarUsuario();
    const erro = await codigoErro(
      criarAnimal(u, { categoria: 'ADOCAO', detalhes_fuga: 'não deveria existir' })
    );
    expect(erro).toBe('23514');
  });

  test('10 - encontrado sem nome é aceito', async () => {
    const u = await criarUsuario();
    const id = await criarAnimal(u, { categoria: 'ENCONTRADO', nome: null });
    expect(id).toBe(1);
  });

  test.each(['ADOCAO', 'PERDIDO'])('11 - %s sem nome é recusado (23514)', async (categoria) => {
    const u = await criarUsuario();
    const erro = await codigoErro(
      criarAnimal(u, {
        categoria,
        nome: null,
        detalhes_fuga: categoria === 'PERDIDO' ? 'fuga' : null,
      })
    );
    expect(erro).toBe('23514');
  });

  test('12 - categoria inválida é recusada (22P02)', async () => {
    const u = await criarUsuario();
    const erro = await codigoErro(criarAnimal(u, { categoria: 'ADOTADO' }));
    expect(erro).toBe('22P02');
  });

  test('13 - animal com usuario_id inexistente é recusado (23503)', async () => {
    const erro = await codigoErro(criarAnimal(9999));
    expect(erro).toBe('23503');
  });

  test('14 - duas fotos com a mesma ordem no mesmo animal são recusadas (23505)', async () => {
    const u = await criarUsuario();
    const a = await criarAnimal(u);
    await criarFoto(a, 1);
    const erro = await codigoErro(criarFoto(a, 1, 'https://exemplo.com/outra.jpg'));
    expect(erro).toBe('23505');
  });

  test('15 - foto com ordem 0 é recusada (23514)', async () => {
    const u = await criarUsuario();
    const a = await criarAnimal(u);
    const erro = await codigoErro(criarFoto(a, 0));
    expect(erro).toBe('23514');
  });

  test('16 - mesma ordem em animais diferentes é permitida', async () => {
    const u = await criarUsuario();
    const a1 = await criarAnimal(u);
    const a2 = await criarAnimal(u, { nome: 'Thor' });
    await criarFoto(a1, 1);
    await expect(criarFoto(a2, 1)).resolves.not.toThrow();
  });

  test('17 - animal sem sexo é recusado em ADOCAO e PERDIDO (23514), mas aceito em ENCONTRADO', async () => {
    const u = await criarUsuario();
    expect(await codigoErro(criarAnimal(u, { sexo: null }))).toBe('23514');
    expect(await codigoErro(criarAnimal(u, { categoria: 'PERDIDO', sexo: null, detalhes_fuga: 'Fugiu ontem' }))).toBe('23514');
    await expect(criarAnimal(u, { categoria: 'ENCONTRADO', nome: null, sexo: null })).resolves.toBeDefined();
  });

  test('18 - sexo fora de M/F é recusado (22P02)', async () => {
    const u = await criarUsuario();
    const erro = await codigoErro(criarAnimal(u, { sexo: 'X' }));
    expect(erro).toBe('22P02');
  });

  test('19 - token de recuperação: hash único e cascade ao excluir o usuário', async () => {
    const u = await criarUsuario();
    const hash = 'a'.repeat(64);
    await q(`INSERT INTO tokens_recuperacao (usuario_id, token_hash, expira_em)
             VALUES ($1, $2, NOW() + INTERVAL '1 hour')`, [u, hash]);

    const duplicado = await codigoErro(
      q(`INSERT INTO tokens_recuperacao (usuario_id, token_hash, expira_em)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`, [u, hash])
    );
    expect(duplicado).toBe('23505');

    await q('DELETE FROM usuarios WHERE id = $1', [u]);
    expect((await q('SELECT 1 FROM tokens_recuperacao')).rowCount).toBe(0);
  });
});

// =====================================================================
// 2. TESTES DE INTEGRAÇÃO (relacionamentos e consultas)
// =====================================================================
describe('2. Integração - relacionamentos e consultas', () => {
  test('20 - excluir usuário apaga seus animais e fotos (CASCADE)', async () => {
    const u = await criarUsuario();
    const a = await criarAnimal(u);
    await criarFoto(a, 1);

    await q('DELETE FROM usuarios WHERE id = $1', [u]);

    const animais = await q('SELECT 1 FROM animais');
    const fotos = await q('SELECT 1 FROM fotos_animal');
    expect(animais.rowCount).toBe(0);
    expect(fotos.rowCount).toBe(0);
  });

  test('21 - excluir animal apaga suas fotos, sem afetar o usuário', async () => {
    const u = await criarUsuario();
    const a = await criarAnimal(u);
    await criarFoto(a, 1);

    await q('DELETE FROM animais WHERE id = $1', [a]);

    expect((await q('SELECT 1 FROM fotos_animal')).rowCount).toBe(0);
    expect((await q('SELECT 1 FROM usuarios')).rowCount).toBe(1);
  });

  test('22 - listagem por categoria traz só a categoria pedida, do mais recente ao mais antigo', async () => {
    const u = await criarUsuario({ nome: 'ONG Patas', telefone: '47988887777' });
    await criarAnimal(u, { categoria: 'ADOCAO', nome: 'Antigo', criado_em: new Date('2026-01-01') });
    await criarAnimal(u, { categoria: 'ADOCAO', nome: 'Novo', criado_em: new Date('2026-06-01') });
    await criarAnimal(u, { categoria: 'PERDIDO', nome: 'Mel', detalhes_fuga: 'fuga' });
    await criarAnimal(u, { categoria: 'ENCONTRADO', nome: null });

    const r = await q(
      `SELECT a.nome, a.categoria, u.telefone, u.nome AS responsavel
         FROM animais a
         JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.categoria = $1
        ORDER BY a.criado_em DESC`,
      ['ADOCAO']
    );

    expect(r.rows.map((x) => x.nome)).toEqual(['Novo', 'Antigo']);
    expect(r.rows.every((x) => x.categoria === 'ADOCAO')).toBe(true);
    expect(r.rows[0].telefone).toBe('47988887777');
    expect(r.rows[0].responsavel).toBe('ONG Patas');
  });

  test('23 - listagem traz a foto de capa (ordem 1) e não duplica animais com várias fotos', async () => {
    const u = await criarUsuario();
    const a = await criarAnimal(u);
    await criarFoto(a, 1, 'https://exemplo.com/capa.jpg');
    await criarFoto(a, 2, 'https://exemplo.com/segunda.jpg');

    const r = await q(
      `SELECT a.id, f.url AS foto_principal
         FROM animais a
         LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
        WHERE a.categoria = 'ADOCAO'`
    );

    expect(r.rowCount).toBe(1);
    expect(r.rows[0].foto_principal).toBe('https://exemplo.com/capa.jpg');
  });

  test('24 - animal sem foto aparece na listagem com foto vazia (LEFT JOIN)', async () => {
    const u = await criarUsuario();
    await criarAnimal(u);

    const r = await q(
      `SELECT a.id, f.url AS foto_principal
         FROM animais a
         LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1`
    );

    expect(r.rowCount).toBe(1);
    expect(r.rows[0].foto_principal).toBeNull();
  });

  test('25 - "Animais Cadastrados" devolve só os animais do usuário informado', async () => {
    const u1 = await criarUsuario();
    const u2 = await criarUsuario();
    await criarAnimal(u1, { nome: 'Do U1 - A' });
    await criarAnimal(u1, { nome: 'Do U1 - B', categoria: 'ENCONTRADO' });
    await criarAnimal(u2, { nome: 'Do U2' });

    const r = await q('SELECT nome FROM animais WHERE usuario_id = $1 ORDER BY id', [u1]);

    expect(r.rows.map((x) => x.nome)).toEqual(['Do U1 - A', 'Do U1 - B']);
  });

  test('26 - login: busca o usuário pelo e-mail e retorna o hash', async () => {
    await criarUsuario({ email: 'login@teste.com', senha_hash: '$2b$10$hashfalso' });

    const r = await q('SELECT id, nome, senha_hash FROM usuarios WHERE email = $1', ['login@teste.com']);

    expect(r.rowCount).toBe(1);
    expect(r.rows[0].senha_hash).toBe('$2b$10$hashfalso');
  });

  test('27 - login com e-mail inexistente não retorna linhas', async () => {
    const r = await q('SELECT id FROM usuarios WHERE email = $1', ['nao@existe.com']);
    expect(r.rowCount).toBe(0);
  });

  test('28 - ONG e pessoa convivem e o tipo padrão é PESSOA', async () => {
    const ong = await criarUsuario({ tipo: 'ONG' });
    const r1 = await q('SELECT tipo FROM usuarios WHERE id = $1', [ong]);
    expect(r1.rows[0].tipo).toBe('ONG');

    await q(
      `INSERT INTO usuarios (nome, email, senha_hash, telefone)
       VALUES ('Sem tipo', 'semtipo@teste.com', 'x', '47911112222')`
    );
    const r2 = await q(`SELECT tipo FROM usuarios WHERE email = 'semtipo@teste.com'`);
    expect(r2.rows[0].tipo).toBe('PESSOA');
  });
});

// =====================================================================
// 3. REGRESSÃO - garante que o esquema continua com os índices esperados
// =====================================================================
describe('3. Regressão - índices e estrutura', () => {
  test('29 - índices de desempenho existem', async () => {
    const r = await q(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`);
    const nomes = r.rows.map((x) => x.indexname);
    expect(nomes).toEqual(
      expect.arrayContaining([
        'idx_animais_categoria_data',
        'idx_animais_data',
        'idx_animais_usuario',
        'idx_fotos_animal',
        'idx_tokens_usuario',
      ])
    );
  });
});

// =====================================================================
// 4. DESEMPENHO (meta: carregamento < 2 s)
// =====================================================================
describe('4. Desempenho', () => {
  const TOTAL = 10000;

  beforeEach(async () => {
    const u = await criarUsuario();
    await q(
      `INSERT INTO animais (usuario_id, categoria, nome, sexo, descricao, detalhes_fuga, criado_em)
       SELECT $1, cat,
              CASE WHEN cat = 'ENCONTRADO' THEN NULL ELSE 'Pet ' || g END,
              CASE WHEN g % 2 = 0 THEN 'M'::sexo_animal ELSE 'F'::sexo_animal END,
              'Descrição ' || g,
              CASE WHEN cat = 'PERDIDO' THEN 'Fuga ' || g END,
              NOW() - (g || ' minutes')::interval
         FROM (SELECT g, (ARRAY['ADOCAO','PERDIDO','ENCONTRADO'])[1 + (g % 3)]::categoria_animal AS cat
                 FROM generate_series(1, ${TOTAL}) g) s`,
      [u]
    );
    await q(
      `INSERT INTO fotos_animal (animal_id, url, ordem)
       SELECT id, 'https://exemplo.com/' || id || '.jpg', 1 FROM animais`
    );
    await q('ANALYZE');
  });

  test('30 - listagem por categoria (20 mais recentes) responde em menos de 2 s', async () => {
    const inicio = Date.now();
    const r = await q(
      `SELECT a.id, a.nome, a.descricao, f.url AS foto_principal, u.telefone
         FROM animais a
         JOIN usuarios u ON u.id = a.usuario_id
         LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
        WHERE a.categoria = 'ADOCAO'
        ORDER BY a.criado_em DESC
        LIMIT 20`
    );
    const ms = Date.now() - inicio;

    expect(r.rowCount).toBe(20);
    expect(ms).toBeLessThan(2000);
  });

  test('31 - listagem completa de uma categoria responde em menos de 2 s', async () => {
    const inicio = Date.now();
    const r = await q(
      `SELECT a.id, a.nome, f.url
         FROM animais a
         LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
        WHERE a.categoria = 'PERDIDO'
        ORDER BY a.criado_em DESC`
    );
    const ms = Date.now() - inicio;

    expect(r.rowCount).toBeGreaterThan(3000);
    expect(ms).toBeLessThan(2000);
  });
});
