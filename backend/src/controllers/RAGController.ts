import { Request, Response } from "express";
import KnowledgeDocument from "../models/KnowledgeDocument";
import sequelize from "../database";
import { QueryTypes } from "sequelize";
import { indexTextDocument, indexFileAuto, indexPDFDocument, indexImageDocument } from "../services/RAG/RAGIndexService";
import { search as ragSearch } from "../services/RAG/RAGSearchService";
import AutoIndexService from "../services/RAG/AutoIndexService";
import FilesOptions from "../models/FilesOptions";
import path from "path";
import fs from "fs";
import uploadConfig from "../config/upload";

export const indexText = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { title, text, tags, chunkSize, overlap, collection, ragCollection } = req.body || {};
    const tagsArr = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

    const coll = (ragCollection || collection || "").toString().trim();
    if (coll) {
      tagsArr.push(`collection:${coll}`);
    }
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
    const { fileOptionId, title, tags, chunkSize, overlap, collection, ragCollection } = req.body || {};
    const tagsArr = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

    const coll = (ragCollection || collection || "").toString().trim();
    if (coll) {
      tagsArr.push(`collection:${coll}`);
    }

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
    const publicRoot = uploadConfig.directory;

    let absPath: string;
    if (path.isAbsolute(relPath)) {
      absPath = relPath;
    } else if (relPath.startsWith("company")) {
      absPath = path.resolve(publicRoot, relPath);
    } else {
      absPath = path.resolve(
        publicRoot,
        `company${companyId}`,
        "files",
        String(fileId),
        relPath
      );
    }

    // Tipos suportados expandidos (texto, PDF, imagens)
    const ext = path.extname(relPath || '').toLowerCase();
    const isText = mediaType.startsWith('text/') || [".txt", ".md", ".csv", ".json"].includes(ext);
    const isPDF = ext === '.pdf' || mediaType === 'application/pdf';
    const isImage = mediaType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(ext);
    
    if (!isText && !isPDF && !isImage) {
      return res.status(415).json({ error: `Tipo de arquivo não suportado para indexação: ${mediaType || ext}` });
    }

    console.log(`[RAG] Processing file: ${relPath} (${mediaType || ext})`);

    try {
      // Usa indexação automática baseada no tipo
      const result = await indexFileAuto({
        companyId,
        title: title || path.basename(relPath, ext),
        filePath: absPath,
        tags: tagsArr,
        source: `file:${fileId}:${relPath}`,
        chunkSize,
        overlap
      });

      return res.status(200).json(result);

    } catch (error: any) {
      console.error(`[RAG] Failed to index file ${relPath}:`, error.message);
      
      // Fallback para método legado (apenas texto)
      if (isText) {
        console.log(`[RAG] Trying legacy text processing for ${relPath}`);
        
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
        const legacyResult = await indexTextDocument({
          companyId,
          title: docTitle,
          text: textContent,
          tags: tagsArr,
          source: absPath,
          mimeType: mediaType,
          chunkSize,
          overlap
        });
        
        return res.status(200).json(legacyResult);
      }
      
      throw error;
    }
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao indexar arquivo' });
  }
};

/**
 * Auto-indexa conversas históricas
 */
export const autoIndexConversations = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const {
      batchSize = 50,
      maxMessages = 1000,
      onlyResolved = true,
      minMessageLength = 20,
      excludeMediaMessages = true,
      days
    } = req.body || {};

    console.log(`[RAG] Starting auto-index for company ${companyId}`);

    let result;
    
    if (days) {
      // Indexa conversas dos últimos N dias
      result = await AutoIndexService.indexRecentConversations(companyId, days, {
        batchSize,
        maxMessages,
        onlyResolved,
        minMessageLength,
        excludeMediaMessages
      });
    } else {
      // Indexa conversas históricas gerais
      result = await AutoIndexService.indexHistoricalConversations({
        companyId,
        batchSize,
        maxMessages,
        onlyResolved,
        minMessageLength,
        excludeMediaMessages
      });
    }

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error("[RAG] Auto-index failed:", error);
    return res.status(500).json({ 
      error: error?.message || 'Erro na auto-indexação de conversas',
      success: false
    });
  }
};

/**
 * Obtém estatísticas de conversas indexáveis
 */
export const getIndexableStats = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    
    const stats = await AutoIndexService.getIndexableStats(companyId);
    
    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error("[RAG] Failed to get indexable stats:", error);
    return res.status(500).json({ 
      error: error?.message || 'Erro ao obter estatísticas',
      success: false
    });
  }
};

/**
 * Auto-indexa conversas por período
 */
export const autoIndexByDateRange = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { startDate, endDate, ...options } = req.body || {};

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate e endDate são obrigatórios' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Datas inválidas' });
    }

    console.log(`[RAG] Auto-indexing conversations from ${start.toISOString()} to ${end.toISOString()}`);

    const result = await AutoIndexService.indexConversationsByDateRange(
      companyId,
      start,
      end,
      options
    );

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error("[RAG] Auto-index by date range failed:", error);
    return res.status(500).json({ 
      error: error?.message || 'Erro na indexação por período',
      success: false
    });
  }
};

// Listar fontes da base de conhecimento
export const listSources = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    
    // Buscar arquivos do FileManager indexados
    const fileManagerFiles = await FilesOptions.findAll({
      attributes: ['id', 'name', 'path', 'mediaType', 'createdAt'],
      include: [{
        association: 'file',
        attributes: ['name', 'message'],
        where: { companyId },
        required: true
      }],
      limit: 50,
      order: [['createdAt', 'DESC']]
    });
    
    // Links externos indexados (SQL bruto para robustez)
    const extRows: any[] = await sequelize.query(
      `SELECT id, title, metadata, size, "updatedAt", source, "companyId" FROM "KnowledgeDocuments"
       WHERE "companyId" = :companyId
       ORDER BY "updatedAt" DESC
       LIMIT 100`,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    ) as any[];

    const externalLinks = extRows.map(r => {
      let meta: any = {};
      try { meta = r.metadata ? JSON.parse(r.metadata) : {}; } catch {}
      
      return {
        id: r.id,
        url: meta.url || undefined,
        title: r.title,
        contentLength: meta.contentLength || r.size || undefined,
        updatedAt: r.updatedAt,
        source: r.source
      };
    }).filter(e => e.source === 'external' || !!e.url);

    return res.json({
      fileManager: fileManagerFiles.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        mediaType: f.mediaType,
        createdAt: f.createdAt,
        description: (f as any).file?.message || 'Arquivo do FileManager',
        category: (f as any).file?.name || 'Geral'
      })),
      conversations: 150, // Simulado por enquanto
      externalLinks
    });
  } catch (error) {
    console.error("Erro ao listar fontes RAG:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Indexar URL externa
export const indexUrl = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { url, title } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL é obrigatória" });
    }
    
    // Função para fazer fetch com suporte a redirects
    const fetchWithRedirects = async (targetUrl: string, maxRedirects = 5): Promise<{ body: string; finalUrl: string; hostname: string; }> => {
      if (maxRedirects <= 0) {
        throw new Error('Muitos redirects');
      }

      const https = require('https');
      const http = require('http');
      
      const client = targetUrl.startsWith('https:') ? https : http;
      
      return new Promise((resolve, reject) => {
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        };
        
        const req = client.get(targetUrl, options, (res) => {
          // Seguir redirects 301/302
          if (res.statusCode === 301 || res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              // Resolver URL relativa
              const resolved = new (require('url').URL)(redirectUrl, targetUrl).toString();
              console.log(`[RAG] Seguindo redirect: ${targetUrl} -> ${resolved}`);
              // Recursivamente seguir o redirect
              return fetchWithRedirects(resolved, maxRedirects - 1).then(resolve).catch(reject);
            }
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const { hostname } = new (require('url').URL)(targetUrl);
              resolve({ body: data, finalUrl: targetUrl, hostname });
            } catch {
              resolve({ body: data, finalUrl: targetUrl, hostname: '' });
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout ao acessar a URL'));
        });
      });
    };
    
    const response = await fetchWithRedirects(url);
    
    // Extrair título e meta description
    const html = String(response.body);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    const extractedTitle = titleMatch ? titleMatch[1].trim() : (title || response.finalUrl || url);
    const extractedDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

    // Extrair texto do body (implementação simples)
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const textContent = [extractedTitle, extractedDesc, bodyText].filter(Boolean).join('\n\n');
    
    if (textContent.length < 30) {
      return res.status(400).json({ error: "Conteúdo da página muito pequeno ou inacessível" });
    }
    
    // Indexar no RAG
    try {
      const indexResult = await indexTextDocument({
        companyId,
        text: textContent,
        title: extractedTitle,
        tags: ['external', response.hostname].filter(Boolean),
        source: 'external',
        mimeType: 'text/html',
        metadata: { url: response.finalUrl || url, title: extractedTitle, description: extractedDesc, contentLength: textContent.length, hostname: response.hostname }
      });
      
      console.log('[RAG] URL indexada com sucesso:', response.finalUrl || url, 'documentId:', indexResult.documentId);
      
    } catch (indexError) {
      console.error('[RAG] Erro ao indexar texto:', indexError);
      throw new Error('Erro ao indexar conteúdo da URL: ' + indexError.message);
    }
    
    return res.json({ 
      success: true, 
      message: "URL indexada com sucesso",
      url: response.finalUrl || url,
      title: title || response.finalUrl || url,
      contentLength: textContent.length
    });
  } catch (error) {
    console.error("Erro ao indexar URL:", error);
    return res.status(500).json({ error: "Erro ao indexar URL" });
  }
};

// Remover link externo
export const removeExternalLink = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL é obrigatória" });
    }
    
    // Encontrar documentos e deletar chunks antes (corrigido para PostgreSQL)
    const docs: any[] = await sequelize.query(
      `SELECT id FROM "KnowledgeDocuments" WHERE "companyId" = :companyId AND "source" = 'external' AND metadata::jsonb->>'url' = :url`,
      { replacements: { companyId, url }, type: QueryTypes.SELECT }
    ) as any[];

    for (const d of docs) {
      const docId = Number(d.id);
      await sequelize.query(`DELETE FROM "KnowledgeChunks" WHERE "companyId" = :companyId AND "documentId" = :docId`, {
        replacements: { companyId, docId }, type: QueryTypes.DELETE
      });
      await sequelize.query(`DELETE FROM "KnowledgeDocuments" WHERE "companyId" = :companyId AND "id" = :docId`, {
        replacements: { companyId, docId }, type: QueryTypes.DELETE
      });
    }
    
    return res.json({ success: true, message: "Link externo removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover link externo:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * Recalcular embeddings de um documento
 */
export const reindexDocument = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params as any;
    const docId = Number(id);
    if (!docId) return res.status(400).json({ error: 'id inválido' });

    // Buscar chunks e re-embedar
    const rows: any[] = await sequelize.query(
      `SELECT id, content FROM "KnowledgeChunks" WHERE "companyId" = :companyId AND "documentId" = :docId ORDER BY "chunkIndex" ASC`,
      { replacements: { companyId, docId }, type: QueryTypes.SELECT }
    ) as any[];
    if (rows.length === 0) return res.status(404).json({ error: 'Documento sem chunks' });

    const { embedTexts } = require('../services/RAG/EmbeddingService');
    const embeddings = await embedTexts(companyId, rows.map(r => r.content));
    for (let i = 0; i < rows.length; i++) {
      const vector = `[${embeddings[i].join(',')}]`;
      await sequelize.query(
        `UPDATE "KnowledgeChunks" SET embedding = :emb::vector, "updatedAt" = NOW() WHERE id = :id`,
        { replacements: { emb: vector, id: rows[i].id }, type: QueryTypes.UPDATE }
      );
    }
    return res.status(200).json({ success: true, updated: rows.length });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao reindexar documento' });
  }
};

/**
 * Reindexar toda a base da empresa (cuidado com custo)
 */
export const reindexAll = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const limit = Math.min(5000, Number((req.body || {}).limit) || 1000);
    const docs: any[] = await sequelize.query(
      `SELECT id FROM "KnowledgeDocuments" WHERE "companyId" = :companyId ORDER BY "updatedAt" DESC LIMIT :limit`,
      { replacements: { companyId, limit }, type: QueryTypes.SELECT }
    ) as any[];

    let totalUpdated = 0; const errors: any[] = [];
    for (const d of docs) {
      try {
        const fakeReq: any = { user: { companyId }, params: { id: d.id } };
        const fakeRes: any = { status: () => ({ json: () => null }) };
        await reindexDocument(fakeReq, fakeRes);
        totalUpdated++;
      } catch (e: any) {
        errors.push({ id: d.id, error: e?.message });
      }
    }

    return res.status(200).json({ success: true, documentsProcessed: docs.length, reindexed: totalUpdated, errors });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao reindexar base' });
  }
};

/**
 * Indexar URLs a partir de um sitemap XML (ou sitemapindex)
 */
export const indexSitemap = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { url, maxUrls = 100, sameHostOnly = true, tags = [] } = (req.body || {}) as any;
    if (!url) return res.status(400).json({ error: 'url é obrigatória' });

    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    const client = url.startsWith('https:') ? https : http;

    const get = (u: string) => new Promise<string>((resolve, reject) => {
      const req2 = client.get(u, (resp: any) => {
        if (resp.statusCode && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          const resolved = new URL(resp.headers.location, u).toString();
          return get(resolved).then(resolve).catch(reject);
        }
        let data = '';
        resp.on('data', (chunk: any) => data += chunk);
        resp.on('end', () => resolve(data));
      });
      req2.on('error', reject);
    });

    const xml = await get(url);
    const urls: string[] = [];
    const host = new URL(url).hostname;
    // sitemapindex
    const indexMatches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/gi);
    if (indexMatches) {
      for (const sm of indexMatches) {
        const loc = (sm.match(/<loc>([\s\S]*?)<\/loc>/i) || [])[1];
        if (loc) {
          try {
            const child = await get(loc.trim());
            const urlMatches = child.match(/<url>[\s\S]*?<\/url>/gi) || [];
            for (const u of urlMatches) {
              const loc2 = (u.match(/<loc>([\s\S]*?)<\/loc>/i) || [])[1];
              if (!loc2) continue;
              const final = new URL(loc2.trim(), loc).toString();
              if (!sameHostOnly || new URL(final).hostname === host) urls.push(final);
              if (urls.length >= maxUrls) break;
            }
          } catch {}
        }
        if (urls.length >= maxUrls) break;
      }
    } else {
      // sitemap de urls
      const urlMatches = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
      for (const u of urlMatches) {
        const loc = (u.match(/<loc>([\s\S]*?)<\/loc>/i) || [])[1];
        if (!loc) continue;
        const final = new URL(loc.trim(), url).toString();
        if (!sameHostOnly || new URL(final).hostname === host) urls.push(final);
        if (urls.length >= maxUrls) break;
      }
    }

    let count = 0;
    const errors: any[] = [];
    for (const u of urls) {
      try {
        await indexUrl({ ...req, body: { url: u, title: u } } as any, { status: () => ({ json: () => null }) } as any);
        count++;
      } catch (e: any) {
        errors.push({ url: u, error: e?.message });
      }
    }

    return res.status(200).json({ success: true, indexed: count, total: urls.length, errors });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao indexar sitemap' });
  }
};

export default { 
  indexText, 
  search, 
  listDocuments, 
  removeDocument, 
  indexFile,
  autoIndexConversations,
  getIndexableStats,
  autoIndexByDateRange,
  listSources,
  indexUrl,
  removeExternalLink,
  indexSitemap,
  reindexDocument,
  reindexAll
};
