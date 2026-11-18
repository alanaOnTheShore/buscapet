-- =====================================================================
-- BuscaPet - Massa de dados para testes de filtro, listagem e desempenho
-- Rode DEPOIS do database/schema.sql (v2), em banco de TESTE ou desenvolvimento.
-- ATENÇÃO: começa limpando todas as tabelas.
-- =====================================================================

TRUNCATE usuarios RESTART IDENTITY CASCADE;

-- 50 usuários (1 a cada 5 é ONG)
INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo)
SELECT 'Usuario ' || g,
       'usuario' || g || '@seed.com',
       'hash_seed',
       '47' || lpad(g::text, 9, '0'),
       CASE WHEN g % 5 = 0 THEN 'ONG'::tipo_usuario ELSE 'PESSOA'::tipo_usuario END
  FROM generate_series(1, 50) g;

-- 10.000 animais distribuídos entre as 3 categorias
INSERT INTO animais (usuario_id, categoria, nome, sexo, descricao, detalhes_fuga, criado_em)
SELECT 1 + (g % 50),
       cat,
       CASE WHEN cat = 'ENCONTRADO' THEN NULL ELSE 'Pet ' || g END,
       CASE WHEN g % 2 = 0 THEN 'M'::sexo_animal ELSE 'F'::sexo_animal END,
       'Descrição de teste ' || g,
       CASE WHEN cat = 'PERDIDO' THEN 'Fugiu de casa (registro de teste ' || g || ')' END,
       NOW() - (g || ' minutes')::interval
  FROM (SELECT g,
               (ARRAY['ADOCAO','PERDIDO','ENCONTRADO'])[1 + (g % 3)]::categoria_animal AS cat
          FROM generate_series(1, 10000) g) s;

-- Foto de capa para todos e segunda foto para os de id par
INSERT INTO fotos_animal (animal_id, url, ordem)
SELECT id, 'https://exemplo.com/fotos/' || id || '_1.jpg', 1 FROM animais;

INSERT INTO fotos_animal (animal_id, url, ordem)
SELECT id, 'https://exemplo.com/fotos/' || id || '_2.jpg', 2 FROM animais WHERE id % 2 = 0;

ANALYZE;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
-- SELECT categoria, COUNT(*) FROM animais GROUP BY categoria;

-- Desempenho da listagem (rode com o botão Run, não com "Explain"):
-- EXPLAIN ANALYZE
-- SELECT a.id, a.nome, f.url, u.telefone
--   FROM animais a
--   JOIN usuarios u ON u.id = a.usuario_id
--   LEFT JOIN fotos_animal f ON f.animal_id = a.id AND f.ordem = 1
--  WHERE a.categoria = 'ADOCAO'
--  ORDER BY a.criado_em DESC
--  LIMIT 20;
