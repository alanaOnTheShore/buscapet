/**
 * Único lugar que traduz a categoria salva no banco (ENUM categoria_animal)
 * para o texto e a classe de cor exibidos. As cores ficam em css/geral.css.
 */
export const CATEGORIAS = {
  PERDIDO: { rotulo: 'Perdido', classe: 'status-perdido' },
  ENCONTRADO: { rotulo: 'Encontrado', classe: 'status-encontrado' },
  ADOCAO: { rotulo: 'Adoção', classe: 'status-adocao' },
};

export const infoCategoria = (categoria) => CATEGORIAS[categoria] ?? { rotulo: categoria, classe: '' };
