/**
 * Script para auto-indexação de conversas históricas por fila
 * 
 * Uso:
 * ts-node src/scripts/auto-index-conversations.ts <companyId> [days]
 * 
 * Exemplo:
 * ts-node src/scripts/auto-index-conversations.ts 1 30
 * 
 * Indexa conversas dos últimos N dias (padrão: 30)
 */

import AutoIndexService from "../services/RAG/AutoIndexService";
import Queue from "../models/Queue";
import "../database";

interface AutoIndexConversationsOptions {
  companyId: number;
  days?: number;
  batchSize?: number;
  queueIds?: number[];
  onlyResolved?: boolean;
}

async function autoIndexConversationsByQueue(options: AutoIndexConversationsOptions) {
  const { companyId, days = 30, batchSize = 50, queueIds, onlyResolved = true } = options;

  try {
    console.log("=== Auto-indexação de Conversas por Fila ===");
    console.log(`🏢 Empresa: ${companyId}`);
    console.log(`📅 Período: últimos ${days} dias`);
    console.log(`📦 Batch: ${batchSize} tickets por vez`);
    console.log(`✅ Apenas resolvidos: ${onlyResolved ? "Sim" : "Não"}\n`);

    // Buscar filas com ragCollection configurada
    const whereClause: any = { companyId };
    if (queueIds && queueIds.length > 0) {
      whereClause.id = queueIds;
    }

    const queues = await Queue.findAll({
      where: whereClause,
      order: [["name", "ASC"]]
    });

    const queuesWithCollection = queues.filter(q => !!(q as any).ragCollection);

    console.log(`📋 Filas encontradas: ${queues.length}`);
    console.log(`🎯 Filas com coleção configurada: ${queuesWithCollection.length}\n`);

    if (queuesWithCollection.length === 0) {
      console.log("⚠️  Nenhuma fila com ragCollection configurada.");
      console.log("💡 Configure primeiro usando: ts-node setup-rag-collections.ts");
      return;
    }

    // Estatísticas gerais
    console.log("📊 Obtendo estatísticas...\n");
    const stats = await AutoIndexService.getIndexableStats(companyId);
    
    console.log("Estatísticas gerais:");
    console.log(`   • Total de tickets: ${stats.totalTickets}`);
    console.log(`   • Tickets resolvidos: ${stats.resolvedTickets}`);
    console.log(`   • Total de mensagens: ${stats.totalMessages}`);
    console.log(`   • Média msg/ticket: ${stats.avgMessagesPerTicket}\n`);

    // Processar cada fila
    let totalProcessed = 0;
    let totalMessagesIndexed = 0;
    let totalDocsCreated = 0;

    for (const queue of queuesWithCollection) {
      const collection = (queue as any).ragCollection;
      console.log("─".repeat(80));
      console.log(`📁 Fila: ${queue.name}`);
      console.log(`🏷️  Coleção: ${collection}`);
      console.log("─".repeat(80));

      try {
        const result = await AutoIndexService.indexRecentConversations(
          companyId,
          days,
          {
            batchSize,
            onlyResolved,
            minMessageLength: 20,
            excludeMediaMessages: true
          }
        );

        console.log(`✅ Processados: ${result.ticketsProcessed} tickets`);
        console.log(`📝 Mensagens: ${result.messagesIndexed}`);
        console.log(`📄 Documentos criados: ${result.documentsCreated}`);
        console.log(`⏱️  Tempo: ${result.processingTime}ms`);

        if (result.errors.length > 0) {
          console.log(`❌ Erros: ${result.errors.length}`);
          for (const error of result.errors.slice(0, 5)) {
            console.log(`   • ${error}`);
          }
          if (result.errors.length > 5) {
            console.log(`   ... e mais ${result.errors.length - 5} erros`);
          }
        }

        totalProcessed += result.ticketsProcessed;
        totalMessagesIndexed += result.messagesIndexed;
        totalDocsCreated += result.documentsCreated;

      } catch (error: any) {
        console.log(`❌ Erro ao processar fila: ${error.message}`);
      }

      console.log();
    }

    // Resumo final
    console.log("=".repeat(80));
    console.log("📊 RESUMO GERAL");
    console.log("=".repeat(80));
    console.log(`🎯 Filas processadas: ${queuesWithCollection.length}`);
    console.log(`✅ Tickets processados: ${totalProcessed}`);
    console.log(`📝 Mensagens indexadas: ${totalMessagesIndexed}`);
    console.log(`📄 Documentos criados: ${totalDocsCreated}`);
    console.log();

    console.log("💡 Próximos passos:");
    console.log("   1. Teste a busca: GET /helps/rag/search?q=<consulta>&tags=collection:<nome>");
    console.log("   2. Configure RAG na integração 'knowledge'");
    console.log("   3. Teste o bot no WhatsApp com perguntas reais");

  } catch (error: any) {
    console.error("❌ Erro fatal:", error.message);
    throw error;
  }
}

// Executar se rodado diretamente
if (require.main === module) {
  const companyId = parseInt(process.argv[2]);
  const days = parseInt(process.argv[3]) || 30;

  if (!companyId) {
    console.error("❌ Uso: ts-node auto-index-conversations.ts <companyId> [days]");
    console.error("   Exemplo: ts-node auto-index-conversations.ts 1 30");
    process.exit(1);
  }

  autoIndexConversationsByQueue({
    companyId,
    days,
    batchSize: 50,
    onlyResolved: true
  })
    .then(() => {
      console.log("\n🎉 Script finalizado!");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n💥 Erro fatal:", error);
      process.exit(1);
    });
}

export { autoIndexConversationsByQueue };
