/**
 * Chunking Semântico Inteligente
 * Divide texto em chunks respeitando estrutura (títulos, parágrafos, código, tabelas)
 * Melhora coerência dos chunks para RAG
 */

export interface SemanticChunkOptions {
  maxChunkSize?: number; // Tamanho máximo em caracteres (default: 1200)
  minChunkSize?: number; // Tamanho mínimo (default: 100)
  overlap?: number; // Overlap entre chunks (default: 150)
  preserveStructure?: boolean; // Preservar estrutura (default: true)
  respectCodeBlocks?: boolean; // Não quebrar blocos de código (default: true)
  respectTables?: boolean; // Não quebrar tabelas (default: true)
}

export interface Chunk {
  content: string;
  index: number;
  metadata?: {
    type: 'paragraph' | 'heading' | 'code' | 'table' | 'list' | 'mixed';
    heading?: string; // Título da seção pai
    hasCode?: boolean;
    hasTable?: boolean;
  };
}

/**
 * Divide texto em chunks semânticos
 */
export const semanticChunk = (
  text: string,
  options: SemanticChunkOptions = {}
): Chunk[] => {
  const {
    maxChunkSize = 1200,
    minChunkSize = 100,
    overlap = 150,
    preserveStructure = true,
    respectCodeBlocks = true,
    respectTables = true
  } = options;

  if (!text || typeof text !== "string") return [];

  // Normaliza texto
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Detecta estrutura do documento
  const sections = detectSections(cleanText);

  // Processa cada seção
  const chunks: Chunk[] = [];
  let currentHeading = "";

  for (const section of sections) {
    // Atualiza heading atual
    if (section.type === "heading") {
      currentHeading = section.content.trim();
      continue;
    }

    // Processa seção baseado no tipo
    const sectionChunks = processSection(section, {
      maxChunkSize,
      minChunkSize,
      overlap,
      preserveStructure,
      respectCodeBlocks,
      respectTables,
      currentHeading
    });

    for (const chunk of sectionChunks) {
      chunks.push({
        content: chunk.content,
        index: chunks.length,
        metadata: chunk.metadata
      });
    }
  }

  // Aplica overlap entre chunks adjacentes
  if (overlap > 0) {
    return applyOverlap(chunks, overlap, maxChunkSize);
  }

  return chunks;
};

/**
 * Detecta seções do documento (headings, parágrafos, código, tabelas)
 */
interface Section {
  type: 'heading' | 'paragraph' | 'code' | 'table' | 'list' | 'mixed';
  content: string;
  level?: number; // Para headings (1-6)
}

const detectSections = (text: string): Section[] => {
  const sections: Section[] = [];
  const lines = text.split("\n");

  let currentBlock: string[] = [];
  let currentType: Section['type'] = 'paragraph';
  let inCodeBlock = false;
  let inTable = false;

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      const content = currentBlock.join("\n").trim();
      if (content) {
        sections.push({ type: currentType, content });
      }
      currentBlock = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    // Detecta código (``` ou indentado 4+ espaços)
    if (line.startsWith("```")) {
      flushBlock();
      inCodeBlock = !inCodeBlock;
      currentType = inCodeBlock ? 'code' : 'paragraph';
      currentBlock.push(line);
      continue;
    }

    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }

    // Detecta tabela (linha com | e próxima com |---)
    if (line.includes("|") && nextLine.match(/^\|[\s\-:|]+\|/)) {
      flushBlock();
      inTable = true;
      currentType = 'table';
      currentBlock.push(line);
      continue;
    }

    if (inTable && !line.includes("|")) {
      flushBlock();
      inTable = false;
      currentType = 'paragraph';
    }

    if (inTable) {
      currentBlock.push(line);
      continue;
    }

    // Detecta heading markdown (# )
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushBlock();
      sections.push({
        type: 'heading',
        content: headingMatch[2],
        level: headingMatch[1].length
      });
      continue;
    }

    // Detecta heading HTML (<h1>-<h6>)
    const htmlHeadingMatch = line.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
    if (htmlHeadingMatch) {
      flushBlock();
      sections.push({
        type: 'heading',
        content: htmlHeadingMatch[2].replace(/<[^>]+>/g, '').trim(),
        level: parseInt(htmlHeadingMatch[1])
      });
      continue;
    }

    // Detecta lista (- , * , 1. )
    if (line.match(/^(\s*)([-*]|\d+\.)\s+/)) {
      if (currentType !== 'list') {
        flushBlock();
        currentType = 'list';
      }
      currentBlock.push(line);
      continue;
    }

    // Linha em branco = separador de parágrafo
    if (line.trim() === "") {
      if (currentBlock.length > 0) {
        flushBlock();
        currentType = 'paragraph';
      }
      continue;
    }

    // Parágrafo normal
    if (!['paragraph', 'mixed'].includes(currentType)) {
      flushBlock();
      currentType = 'paragraph';
    }
    currentBlock.push(line);
  }

  // Flush final
  flushBlock();

  return sections;
};

/**
 * Processa uma seção e retorna chunks
 */
const processSection = (
  section: Section,
  options: {
    maxChunkSize: number;
    minChunkSize: number;
    overlap: number;
    preserveStructure: boolean;
    respectCodeBlocks: boolean;
    respectTables: boolean;
    currentHeading: string;
  }
): Chunk[] => {
  const {
    maxChunkSize,
    minChunkSize,
    respectCodeBlocks,
    respectTables,
    currentHeading
  } = options;

  const chunks: Chunk[] = [];

  // Código: não quebra
  if (section.type === 'code' && respectCodeBlocks) {
    chunks.push({
      content: section.content,
      index: 0,
      metadata: {
        type: 'code',
        heading: currentHeading || undefined,
        hasCode: true
      }
    });
    return chunks;
  }

  // Tabela: não quebra
  if (section.type === 'table' && respectTables) {
    chunks.push({
      content: section.content,
      index: 0,
      metadata: {
        type: 'table',
        heading: currentHeading || undefined,
        hasTable: true
      }
    });
    return chunks;
  }

  // Lista: tenta manter junta
  if (section.type === 'list') {
    if (section.content.length <= maxChunkSize) {
      chunks.push({
        content: section.content,
        index: 0,
        metadata: {
          type: 'list',
          heading: currentHeading || undefined
        }
      });
      return chunks;
    }
    // Se muito grande, divide em itens
    return splitList(section.content, maxChunkSize, currentHeading);
  }

  // Parágrafo/mixed: divide por sentenças
  return splitBySentences(section.content, maxChunkSize, minChunkSize, currentHeading);
};

/**
 * Divide lista em chunks mantendo itens juntos
 */
const splitList = (
  content: string,
  maxSize: number,
  heading: string
): Chunk[] => {
  const items = content.split(/\n(?=\s*[-*]|\s*\d+\.)/);
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentSize = 0;

  for (const item of items) {
    if (currentSize + item.length > maxSize && current.length > 0) {
      chunks.push({
        content: current.join("\n"),
        index: chunks.length,
        metadata: { type: 'list', heading: heading || undefined }
      });
      current = [item];
      currentSize = item.length;
    } else {
      current.push(item);
      currentSize += item.length + 1;
    }
  }

  if (current.length > 0) {
    chunks.push({
      content: current.join("\n"),
      index: chunks.length,
      metadata: { type: 'list', heading: heading || undefined }
    });
  }

  return chunks;
};

/**
 * Divide texto por sentenças respeitando tamanho
 */
const splitBySentences = (
  content: string,
  maxSize: number,
  minSize: number,
  heading: string
): Chunk[] => {
  // Divide por sentenças (., !, ? seguidos de espaço ou fim)
  const sentences = content.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/);
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentSize = 0;

  for (const sentence of sentences) {
    // Se a sentença é maior que maxSize, divide por palavras
    if (sentence.length > maxSize) {
      if (current.length > 0) {
        chunks.push({
          content: current.join(" "),
          index: chunks.length,
          metadata: { type: 'paragraph', heading: heading || undefined }
        });
        current = [];
        currentSize = 0;
      }

      // Divide sentença longa por palavras
      const words = sentence.split(/\s+/);
      let temp: string[] = [];
      let tempSize = 0;

      for (const word of words) {
        if (tempSize + word.length + 1 > maxSize && temp.length > 0) {
          chunks.push({
            content: temp.join(" "),
            index: chunks.length,
            metadata: { type: 'paragraph', heading: heading || undefined }
          });
          temp = [word];
          tempSize = word.length;
        } else {
          temp.push(word);
          tempSize += word.length + 1;
        }
      }

      if (temp.length > 0) {
        current = temp;
        currentSize = tempSize;
      }
      continue;
    }

    if (currentSize + sentence.length + 1 > maxSize && current.length > 0) {
      chunks.push({
        content: current.join(" "),
        index: chunks.length,
        metadata: { type: 'paragraph', heading: heading || undefined }
      });
      current = [sentence];
      currentSize = sentence.length;
    } else {
      current.push(sentence);
      currentSize += sentence.length + 1;
    }
  }

  // Último chunk
  if (current.length > 0) {
    // Se muito pequeno, merge com anterior
    if (currentSize < minSize && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content = lastChunk.content + " " + current.join(" ");
    } else {
      chunks.push({
        content: current.join(" "),
        index: chunks.length,
        metadata: { type: 'paragraph', heading: heading || undefined }
      });
    }
  }

  return chunks;
};

/**
 * Aplica overlap entre chunks adjacentes
 */
const applyOverlap = (chunks: Chunk[], overlap: number, maxSize: number): Chunk[] => {
  if (chunks.length <= 1) return chunks;

  const result: Chunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const current = chunks[i];
    let content = current.content;

    // Adiciona overlap do final do chunk anterior
    if (i > 0) {
      const prev = chunks[i - 1];
      const prevEnd = prev.content.slice(-overlap);
      content = prevEnd + "\n---\n" + content;
    }

    // Adiciona overlap do início do próximo chunk
    if (i < chunks.length - 1) {
      const next = chunks[i + 1];
      const nextStart = next.content.slice(0, overlap);
      content = content + "\n---\n" + nextStart;
    }

    // Trunca se exceder maxSize
    if (content.length > maxSize * 1.5) {
      content = content.slice(0, maxSize * 1.5);
    }

    result.push({
      ...current,
      content
    });
  }

  return result;
};

/**
 * Wrapper para compatibilidade com ChunkUtils existente
 */
export const splitIntoChunks = (
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): string[] => {
  const chunks = semanticChunk(text, {
    maxChunkSize: options.chunkSize || 1200,
    overlap: options.overlap || 150
  });

  return chunks.map(c => c.content);
};

export default { semanticChunk, splitIntoChunks };
