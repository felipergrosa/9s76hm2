import sequelize from "../../database";
import { embedTexts } from "./EmbeddingService";

export interface SearchParams {
  companyId: number;
  query: string;
  k?: number;
  tags?: string[];
  tagsMode?: "AND" | "OR"; // Modo de filtro de tags: AND (todas) ou OR (qualquer uma)
  documentId?: number;
}

export interface SearchResultItem {
  chunkId: number;
  documentId: number;
  title: string;
  content: string;
  distance: number; // cosine distance (menor é melhor)
}

export const search = async (params: SearchParams): Promise<SearchResultItem[]> => {
  const { companyId, query, k = 5, tags = [], tagsMode = "AND", documentId } = params;
  if (!query || !query.trim()) return [];

  const [qvec] = await embedTexts(companyId, [query]);
  const qvecStr = `[${qvec.join(",")}]`;

  const whereParts: string[] = ['c."companyId" = :companyId'];
  const replacements: any = { companyId, qvec: qvecStr, k };

  if (documentId) {
    whereParts.push('c."documentId" = :documentId');
    replacements.documentId = documentId;
  }

  if (Array.isArray(tags) && tags.length) {
    if (tagsMode === "OR") {
      // Modo OR: documento deve ter pelo menos UMA das tags
      const tagConditions = tags.map((t, idx) => {
        replacements[`tag_${idx}`] = `%"${t}"%`;
        return `c."tags" ILIKE :tag_${idx}`;
      });
      whereParts.push(`(${tagConditions.join(' OR ')})`);
    } else {
      // Modo AND: documento deve ter TODAS as tags (comportamento original)
      tags.forEach((t, idx) => {
        whereParts.push(`c."tags" ILIKE :tag_${idx}`);
        replacements[`tag_${idx}`] = `%"${t}"%`;
      });
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [rows] = await sequelize.query(
    `SELECT c."id" as "chunkId", c."documentId", d."title", c."content",
            (c."embedding" <=> :qvec::vector) as distance
       FROM "KnowledgeChunks" c
       JOIN "KnowledgeDocuments" d ON d."id" = c."documentId"
      ${whereSql}
   ORDER BY distance ASC
      LIMIT :k`,
    { replacements }
  );

  return (rows as any[]).map(r => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    title: r.title,
    content: r.content,
    distance: Number(r.distance)
  }));
};
