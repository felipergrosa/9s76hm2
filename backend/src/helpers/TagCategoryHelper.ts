/**
 * Helper para categorizar tags baseado na quantidade de # no início
 * 
 * Hierarquia:
 * - # (1x) = Tag pessoal (obrigatória para acesso)
 * - ## (2x) = Grupo (complementar)
 * - ### (3x) = Região (complementar)
 * - Sem # = Transacional (não afeta permissões)
 */

export interface CategorizedTags {
  personal: number[];      // Tags com 1x #
  complementary: number[]; // Tags com 2x # ou 3x #
  transactional: number[]; // Tags sem #
}

/**
 * Categoriza tags baseado no prefixo
 */
export const categorizeTagsByName = (tags: Array<{ id: number; name: string }>): CategorizedTags => {
  const result: CategorizedTags = {
    personal: [],
    complementary: [],
    transactional: []
  };

  tags.forEach(tag => {
    const name = tag.name || '';
    
    if (name.startsWith('###')) {
      // Região (3x #)
      result.complementary.push(tag.id);
    } else if (name.startsWith('##')) {
      // Grupo (2x #)
      result.complementary.push(tag.id);
    } else if (name.startsWith('#')) {
      // Pessoal (1x #)
      result.personal.push(tag.id);
    } else {
      // Transacional (sem #)
      result.transactional.push(tag.id);
    }
  });

  return result;
};

/**
 * Verifica se uma tag é de permissão (começa com #)
 */
export const isPermissionTag = (tagName: string): boolean => {
  return tagName && tagName.startsWith('#');
};

/**
 * Conta quantos # tem no início da tag
 */
export const countHashPrefix = (tagName: string): number => {
  if (!tagName) return 0;
  let count = 0;
  for (const char of tagName) {
    if (char === '#') count++;
    else break;
  }
  return count;
};
