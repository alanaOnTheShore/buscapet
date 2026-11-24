/**
 * Armazenamento de imagens.
 * Em produção (quando SUPABASE_URL está definida), envia para o Supabase Storage.
 * Localmente ou nos testes, continua gravando em disco (pasta uploads/).
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'pets';

/**
 * Cabeçalhos de autenticação do Supabase Storage.
 * As chaves novas (sb_secret_...) NÃO são JWT: vão só em `apikey`. Mandá-las em
 * `Authorization: Bearer` faz o Supabase recusar com "Invalid JWT".
 * As chaves antigas (service_role, começam com "eyJ") são JWT e precisam do Bearer.
 */
function cabecalhosSupabase(extra = {}) {
  const cabecalhos = { apikey: SUPABASE_SERVICE_KEY, ...extra };
  if (!SUPABASE_SERVICE_KEY.startsWith('sb_')) cabecalhos.Authorization = `Bearer ${SUPABASE_SERVICE_KEY}`;
  return cabecalhos;
}

async function salvarImagem(buffer) {
  const nome = `${crypto.randomUUID()}.webp`;

  // Modo Produção: Supabase Storage
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${nome}`, {
      method: 'POST',
      headers: cabecalhosSupabase({ 'Content-Type': 'image/webp' }),
      body: buffer,
    });

    if (!res.ok) {
      const erro = await res.text();
      throw new Error(`Falha ao enviar imagem para o Supabase (${res.status}): ${erro}`);
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nome}`;
  }

  // Modo Local / Testes: Disco
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, nome), buffer);
  return `/uploads/${nome}`;
}

async function removerImagem(url) {
  if (typeof url !== 'string') return;

  // Remove do Supabase Storage se for uma URL pública do bucket
  const prefixoSupabase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY && url.startsWith(prefixoSupabase)) {
    const nome = url.slice(prefixoSupabase.length);
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${nome}`, {
      method: 'DELETE',
      headers: cabecalhosSupabase(),
    }).catch(() => {});
    return;
  }

  // Remove do disco local
  if (url.startsWith('/uploads/')) {
    await fs.unlink(path.join(config.uploadDir, path.basename(url))).catch(() => {});
  }
}

module.exports = { salvarImagem, removerImagem };
