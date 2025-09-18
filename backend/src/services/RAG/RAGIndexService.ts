import sequelize from "../../database";
import KnowledgeDocument from "../../models/KnowledgeDocument";
import KnowledgeChunk from "../../models/KnowledgeChunk";
import { splitIntoChunks } from "./ChunkUtils";
import { embedTexts } from "./EmbeddingService";

export interface IndexTextParams {
  companyId: number;
  title: string;
  text: string;
  tags?: string[];
  source?: string;
  mimeType?: string;
  chunkSize?: number;
  overlap?: number;
}

export interface IndexResult {
  documentId: number;
  chunks: number;
}

export const indexTextDocument = async (params: IndexTextParams): Promise<IndexResult> => {
  const { companyId, title, text, tags = [], source, mimeType, chunkSize, overlap } = params;
  if (!text || !title) throw new Error("title e text são obrigatórios");

  const chunks = splitIntoChunks(text, { chunkSize, overlap });
  if (!chunks.length) throw new Error("Nenhum conteúdo válido para indexar");

  const embeddings = await embedTexts(companyId, chunks);

  const now = new Date();
  const doc = await KnowledgeDocument.create({
    companyId,
    title,
    source,
    mimeType,
    size: text.length,
    tags: JSON.stringify(tags),
    createdAt: now,
    updatedAt: now,
  } as any);

  const valuesSql = chunks.map((c, i) =>
    `(${companyId}, ${doc.id}, ${i}, :content_${i}, :emb_${i}::vector, :tags_${i}, NULL, :now, :now)`
  ).join(",\n");

  const replacements: any = { now: now.toISOString() };
  chunks.forEach((c, i) => {
    replacements[`content_${i}`] = c;
    replacements[`tags_${i}`] = JSON.stringify(tags);
    const vector = `[${embeddings[i].join(",")}]`;
    replacements[`emb_${i}`] = vector;
  });

  await sequelize.query(
    `INSERT INTO "KnowledgeChunks" ("companyId","documentId","chunkIndex","content","embedding","tags","metadata","createdAt","updatedAt") VALUES\n${valuesSql}`,
    { replacements }
  );

  return { documentId: doc.id, chunks: chunks.length };
};
