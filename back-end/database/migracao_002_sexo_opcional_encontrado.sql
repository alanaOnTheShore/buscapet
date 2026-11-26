-- =====================================================================
-- Migração 002: o sexo passa a ser OPCIONAL para pets ENCONTRADOS.
-- (quem encontra um animal nem sempre sabe dizer se é macho ou fêmea)
-- Para Adoção e Perdido o sexo continua obrigatório.
-- Rode UMA vez no SQL Editor do Supabase, com o botão Run. Não apaga nem altera nenhum dado.
-- =====================================================================
BEGIN;

ALTER TABLE animais ALTER COLUMN sexo DROP NOT NULL;

ALTER TABLE animais ADD CONSTRAINT ck_animais_sexo CHECK (
    categoria = 'ENCONTRADO' OR sexo IS NOT NULL
);

COMMIT;
