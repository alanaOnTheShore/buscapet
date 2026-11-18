/**
 * Armazenamento de imagens. Hoje grava em disco (pasta uploads/).
 * Se o deploy usar disco efêmero (ex.: Render gratuito), troque APENAS este
 * arquivo por um serviço de objetos (Supabase Storage, Cloudinary...):
 * o resto do sistema só enxerga a URL devolvida por salvarImagem().
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

async function salvarImagem(buffer) {
  await fs.mkdir(config.uploadDir, { recursive: true });
  const nome = `${crypto.randomUUID()}.webp`;
  await fs.writeFile(path.join(config.uploadDir, nome), buffer);
  return `/uploads/${nome}`;
}

async function removerImagem(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  await fs.unlink(path.join(config.uploadDir, path.basename(url))).catch(() => {});
}

module.exports = { salvarImagem, removerImagem };
