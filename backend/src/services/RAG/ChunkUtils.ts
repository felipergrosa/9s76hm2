export interface ChunkOptions {
  chunkSize?: number; // tamanho em caracteres
  overlap?: number;   // sobreposição entre chunks
}

export const splitIntoChunks = (text: string, options: ChunkOptions = {}): string[] => {
  const chunkSize = Math.max(200, options.chunkSize ?? 1200);
  const overlap = Math.max(0, Math.min(Math.floor(chunkSize / 3), options.overlap ?? 200));
  const chunks: string[] = [];

  if (!text || typeof text !== "string") return chunks;
  const clean = text.replace(/\r/g, "");

  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const slice = clean.slice(start, end);

    // tenta cortar em final de frase
    let cut = slice.length;
    const lastDot = slice.lastIndexOf(".\n");
    const lastNewLine = slice.lastIndexOf("\n\n");
    if (lastDot > chunkSize * 0.5) cut = lastDot + 1;
    else if (lastNewLine > chunkSize * 0.5) cut = lastNewLine + 1;

    const chunk = slice.slice(0, cut).trim();
    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;
    start += cut - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
};
