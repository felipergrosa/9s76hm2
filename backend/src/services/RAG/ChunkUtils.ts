// Re-exporta do SemanticChunker para compatibilidade
export { splitIntoChunks, semanticChunk, Chunk, SemanticChunkOptions } from "./SemanticChunker";

// Tipos mantidos para compatibilidade
export interface ChunkOptions {
  chunkSize?: number; // tamanho em caracteres
  overlap?: number;   // sobreposição entre chunks
}
