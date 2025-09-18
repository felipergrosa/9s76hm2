import { Request, Response } from "express";
import KnowledgeDocument from "../models/KnowledgeDocument";
import sequelize from "../database";
import { indexTextDocument } from "../services/RAG/RAGIndexService";
import { search as ragSearch } from "../services/RAG/RAGSearchService";
import FilesOptions from "../models/FilesOptions";
import path from "path";
import fs from "fs";

export const indexText = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { title, text, tags, chunkSize, overlap } = req.body || {};
    const tagsArr = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

    const result = await indexTextDocument({ companyId, title, text, tags: tagsArr, chunkSize, overlap });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao indexar documento' });
  }
};

export const search = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { q, k, tags, documentId } = req.query as any;
    const tagsArr = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const kNum = Math.min(Math.max(1, Number(k) || 5), 20);
    const docIdNum = documentId ? Number(documentId) : undefined;

    const results = await ragSearch({ companyId, query: String(q || ''), k: kNum, tags: tagsArr, documentId: docIdNum });
    return res.status(200).json({ results });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro na busca' });
  }
};

export const listDocuments = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const docs = await KnowledgeDocument.findAll({ where: { companyId }, order: [["updatedAt", "DESC"]] });
    return res.status(200).json({ documents: docs });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao listar documentos' });
  }
};

export const removeDocument = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params as any;
    const docId = Number(id);
    if (!docId) return res.status(400).json({ error: 'id inválido' });

    await sequelize.query('DELETE FROM "KnowledgeChunks" WHERE "companyId" = :companyId AND "documentId" = :docId', { replacements: { companyId, docId } });
    await sequelize.query('DELETE FROM "KnowledgeDocuments" WHERE "companyId" = :companyId AND "id" = :docId', { replacements: { companyId, docId } });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao remover documento' });
  }
};

export const indexFile = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { fileOptionId, title, tags, chunkSize, overlap } = req.body || {};
    const tagsArr = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

    const optId = Number(fileOptionId);
    if (!optId) return res.status(400).json({ error: 'fileOptionId inválido' });

    const option = await FilesOptions.findByPk(optId, { include: ["file"] as any });
    const anyOpt: any = option as any;
    if (!option || !anyOpt?.file || anyOpt.file.companyId !== companyId) {
      return res.status(404).json({ error: 'Arquivo não encontrado para esta empresa' });
    }

    const fileId: number = anyOpt.fileId;
    const relPath: string = anyOpt.path;
    const mediaType: string = anyOpt.mediaType || '';
    const basePublic = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`, "files", String(fileId));
    const absPath = path.resolve(basePublic, relPath);

    // Tipos suportados (texto)
    const ext = path.extname(relPath || '').toLowerCase();
    const isText = mediaType.startsWith('text/') || [".txt", ".md", ".csv", ".json"].includes(ext);
    if (!isText) {
      return res.status(415).json({ error: `Tipo de arquivo não suportado para indexação: ${mediaType || ext}` });
    }

    let textContent = '';
    try {
      const buf = await fs.promises.readFile(absPath);
      if (ext === '.json' || mediaType === 'application/json') {
        try {
          const obj = JSON.parse(buf.toString('utf-8'));
          textContent = JSON.stringify(obj, null, 2);
        } catch {
          textContent = buf.toString('utf-8');
        }
      } else {
        textContent = buf.toString('utf-8');
      }
    } catch (e: any) {
      return res.status(500).json({ error: `Falha ao ler arquivo no disco: ${e?.message || 'erro desconhecido'}` });
    }

    const docTitle = title || `${anyOpt?.file?.name || 'Arquivo'} - ${anyOpt?.name || path.basename(relPath)}`;
    const result = await indexTextDocument({
      companyId,
      title: docTitle,
      text: textContent,
      tags: tagsArr,
      source: absPath,
      mimeType: mediaType,
      chunkSize,
      overlap,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao indexar arquivo' });
  }
};

export default { indexText, search, listDocuments, removeDocument, indexFile };
