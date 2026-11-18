-- =====================================================================
-- Migração 001: para quem JÁ criou o banco com o script da v1.
-- Preserva os dados existentes. Rode UMA vez, com o botão Run.
-- =====================================================================
BEGIN;

CREATE TYPE sexo_animal AS ENUM ('M', 'F');

ALTER TABLE animais ADD COLUMN sexo sexo_animal;
UPDATE animais SET sexo = 'M' WHERE sexo IS NULL;   -- só havia dados de teste
ALTER TABLE animais ALTER COLUMN sexo SET NOT NULL;

CREATE TABLE tokens_recuperacao (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  CHAR(64)  NOT NULL UNIQUE,
    expira_em   TIMESTAMP NOT NULL,
    usado_em    TIMESTAMP,
    criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_animais_categoria_data;
CREATE INDEX idx_animais_categoria_data ON animais (categoria, criado_em DESC, id DESC);
CREATE INDEX idx_animais_data           ON animais (criado_em DESC, id DESC);
CREATE INDEX idx_tokens_usuario         ON tokens_recuperacao (usuario_id);

ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE animais            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_animal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_recuperacao ENABLE ROW LEVEL SECURITY;

COMMIT;
