/**
 * Script para indexação em massa de materiais no RAG
 * 
 * Uso:
 * ts-node src/scripts/bulk-index-rag.ts <companyId> <collection>
 * 
 * Exemplo:
 * ts-node src/scripts/bulk-index-rag.ts 1 produtos_vendas
 * 
 * Este script procura arquivos no FileManager e indexa no RAG
 */

import FilesOptions from "../models/FilesOptions";
import Files from "../models/Files";
import { indexFileAuto } from "../services/RAG/RAGIndexService";
import path from "path";
import fs from "fs";
import "../database";

interface BulkIndexOptions {
  companyId: number;
  collection: string;
  fileIds?: number[];
  extensions?: string[];
  limit?: number;
  skipExisting?: boolean;
}

interface IndexResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

async function bulkIndexFiles(options: BulkIndexOptions): Promise<IndexResult> {
  const { companyId, collection, fileIds, extensions, limit = 100, skipExisting = true } = options;

  const result: IndexResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    console.log("=== Indexação em Massa RAG ===");
    console.log(`🏢 Empresa: ${companyId}`);
    console.log(`📦 Coleção: ${collection}`);
    console.log(`📊 Limite: ${limit} arquivos\n`);

    // Buscar arquivos elegíveis
    const whereClause: any = {};
    
    if (fileIds && fileIds.length > 0) {
      whereClause.fileId = fileIds;
    }

    const fileOptions = await FilesOptions.findAll({
      where: whereClause,
      include: [{
        model: Files,
        as: "file",
        where: { companyId },
        required: true
      }],
      limit,
      order: [["createdAt", "DESC"]]
    });

    console.log(`📁 Arquivos encontrados: ${fileOptions.length}\n`);

    if (fileOptions.length === 0) {
      console.log("⚠️  Nenhum arquivo para processar");
      return result;
    }

    // Filtrar por extensão se especificado
    let filteredOptions = fileOptions;
    if (extensions && extensions.length > 0) {
      filteredOptions = fileOptions.filter(opt => {
        const ext = path.extname(opt.path || "").toLowerCase();
        return extensions.includes(ext);
      });
      console.log(`🔍 Após filtro de extensões (${extensions.join(", ")}): ${filteredOptions.length}\n`);
    }

    // Tipos suportados
    const supportedExtensions = [
      ".pdf", ".txt", ".md", ".csv", ".json",
      ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif",
      ".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv", ".m4v",
      ".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".wma"
    ];

    // Processar cada arquivo
    for (const [index, option] of filteredOptions.entries()) {
      const fileData = (option as any).file;
      const fileId = (option as any).fileId;
      const relPath = option.path || "";
      const mediaType = option.mediaType || "";
      
      const ext = path.extname(relPath).toLowerCase();
      const fileName = path.basename(relPath);
      
      console.log(`\n[${index + 1}/${filteredOptions.length}] 📄 ${fileName}`);

      // Verificar se é tipo suportado
      if (!supportedExtensions.includes(ext)) {
        console.log(`   ⏭️  Tipo não suportado: ${ext}`);
        result.skipped++;
        continue;
      }

      // Construir caminho absoluto
      const basePublic = path.resolve(__dirname, "..", "..", "public", `company${companyId}`, "files", String(fileId));
      const absPath = path.resolve(basePublic, relPath);

      // Verificar se arquivo existe
      if (!fs.existsSync(absPath)) {
        console.log(`   ❌ Arquivo não encontrado no disco`);
        result.failed++;
        result.errors.push({ file: fileName, error: "Arquivo não encontrado" });
        continue;
      }

      try {
        // Indexar
        console.log(`   🔄 Indexando...`);
        const indexResult = await indexFileAuto({
          companyId,
          title: `${fileData.name} - ${option.name || fileName}`,
          filePath: absPath,
          tags: [collection, `file:${fileId}`, ext.replace(".", "")],
          source: `file:${fileId}:${relPath}`,
          chunkSize: 1000,
          overlap: 200
        });

        console.log(`   ✅ Indexado: ${indexResult.chunks} chunks, documento ID ${indexResult.documentId}`);
        result.success++;

      } catch (error: any) {
        console.log(`   ❌ Erro: ${error.message}`);
        result.failed++;
        result.errors.push({ file: fileName, error: error.message });
      }
    }

    // Resumo final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RESUMO DA INDEXAÇÃO");
    console.log("=".repeat(80));
    console.log(`✅ Sucesso:  ${result.success}`);
    console.log(`❌ Falhas:   ${result.failed}`);
    console.log(`⏭️  Pulados:  ${result.skipped}`);
    console.log(`📁 Total:    ${filteredOptions.length}`);
    
    if (result.errors.length > 0) {
      console.log("\n❌ Erros encontrados:");
      for (const err of result.errors) {
        console.log(`   • ${err.file}: ${err.error}`);
      }
    }

    return result;

  } catch (error: any) {
    console.error("❌ Erro fatal:", error.message);
    throw error;
  }
}

// Executar se rodado diretamente
if (require.main === module) {
  const companyId = parseInt(process.argv[2]);
  const collection = process.argv[3];
  const extensions = process.argv[4]?.split(",");

  if (!companyId || !collection) {
    console.error("❌ Uso: ts-node bulk-index-rag.ts <companyId> <collection> [extensions]");
    console.error("   Exemplo: ts-node bulk-index-rag.ts 1 produtos_vendas");
    console.error("   Exemplo: ts-node bulk-index-rag.ts 1 produtos_vendas .pdf,.jpg,.png");
    process.exit(1);
  }

  bulkIndexFiles({
    companyId,
    collection,
    extensions,
    limit: 100,
    skipExisting: true
  })
    .then(result => {
      console.log("\n🎉 Script finalizado!");
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error("\n💥 Erro fatal:", error);
      process.exit(1);
    });
}

export { bulkIndexFiles };
