-- =====================================================================
-- BuscaPet - Esquema do banco de dados (PostgreSQL) - versão 2
-- Novidades em relação à v1:
--   * animais.sexo (ENUM 'M'/'F')  -> ícones de gênero exibidos a partir dele
--   * tabela tokens_recuperacao    -> "esqueci minha senha"
--   * índices pensados para paginação por cursor (home com rolagem infinita)
--   * Row Level Security ativado (sem políticas): bloqueia acesso direto pela
--     API pública do Supabase; o back-end (dono das tabelas) continua acessando.
-- ATENÇÃO: começa com DROP TABLE. Use apenas em banco novo ou de testes.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS tokens_recuperacao CASCADE;
DROP TABLE IF EXISTS fotos_animal CASCADE;
DROP TABLE IF EXISTS animais CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TYPE  IF EXISTS sexo_animal;
DROP TYPE  IF EXISTS categoria_animal;
DROP TYPE  IF EXISTS tipo_usuario;

CREATE TYPE categoria_animal AS ENUM ('ADOCAO', 'PERDIDO', 'ENCONTRADO');
CREATE TYPE tipo_usuario     AS ENUM ('PESSOA', 'ONG');
CREATE TYPE sexo_animal      AS ENUM ('M', 'F');

CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(120)  NOT NULL,
    email         VARCHAR(160)  NOT NULL UNIQUE,
    senha_hash    VARCHAR(255)  NOT NULL,
    telefone      VARCHAR(20)   NOT NULL,
    tipo          tipo_usuario  NOT NULL DEFAULT 'PESSOA',
    criado_em     TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuarios_email CHECK (email LIKE '%_@_%._%')
);

CREATE TABLE animais (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria     categoria_animal NOT NULL,
    nome          VARCHAR(80),
    sexo          sexo_animal      NOT NULL,
    descricao     TEXT             NOT NULL,
    detalhes_fuga TEXT,
    criado_em     TIMESTAMP        NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_animais_detalhes_fuga CHECK (
        (categoria = 'PERDIDO'  AND detalhes_fuga IS NOT NULL AND length(trim(detalhes_fuga)) > 0)
     OR (categoria <> 'PERDIDO' AND detalhes_fuga IS NULL)
    ),
    CONSTRAINT ck_animais_nome CHECK (
        categoria = 'ENCONTRADO' OR (nome IS NOT NULL AND length(trim(nome)) > 0)
    )
);

CREATE TABLE fotos_animal (
    id         SERIAL PRIMARY KEY,
    animal_id  INTEGER      NOT NULL REFERENCES animais(id) ON DELETE CASCADE,
    url        VARCHAR(500) NOT NULL,
    ordem      SMALLINT     NOT NULL DEFAULT 1,
    CONSTRAINT uq_foto_ordem UNIQUE (animal_id, ordem),
    CONSTRAINT ck_foto_ordem CHECK (ordem >= 1)
);

-- Guarda só o HASH (SHA-256) do token enviado por e-mail, nunca o token em si.
CREATE TABLE tokens_recuperacao (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  CHAR(64)  NOT NULL UNIQUE,
    expira_em   TIMESTAMP NOT NULL,
    usado_em    TIMESTAMP,
    criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices (paginação por cursor: ordenar por criado_em DESC, id DESC)
CREATE INDEX idx_animais_categoria_data ON animais (categoria, criado_em DESC, id DESC); -- abas Adoção/Perdidos/Encontrados
CREATE INDEX idx_animais_data           ON animais (criado_em DESC, id DESC);            -- aba "Todos"
CREATE INDEX idx_animais_usuario        ON animais (usuario_id);
CREATE INDEX idx_fotos_animal           ON fotos_animal (animal_id);
CREATE INDEX idx_tokens_usuario         ON tokens_recuperacao (usuario_id);

ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE animais            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_animal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_recuperacao ENABLE ROW LEVEL SECURITY;

COMMIT;
