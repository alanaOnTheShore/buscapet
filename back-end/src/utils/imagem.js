const sharp = require('sharp');
const { ErroHttp } = require('./erros');

const FORMATOS_ACEITOS = ['jpeg', 'png', 'webp', 'gif'];
const MAX_LADO = 800;
const QUALIDADE = 80;

/**
 * Nunca guardamos a imagem bruta: redimensiona (máx. 800x800), comprime (80%)
 * e converte para WebP. Também aplica a rotação do EXIF (fotos de celular) e
 * descarta metadados (inclusive a localização GPS da foto).
 */
async function otimizarImagem(buffer) {
  const mensagem = 'Não foi possível ler a imagem. Envie um arquivo JPG, PNG ou WEBP.';
  try {
    const { format } = await sharp(buffer, { limitInputPixels: 100_000_000 }).metadata();
    if (!FORMATOS_ACEITOS.includes(format)) throw new Error('formato não aceito');

    return await sharp(buffer, { failOn: 'error', limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: MAX_LADO, height: MAX_LADO, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE })
      .toBuffer();
  } catch {
    throw new ErroHttp(400, mensagem, { foto: mensagem });
  }
}

module.exports = { otimizarImagem };
