/**
 * Script para configurar coleções RAG nas filas
 * 
 * Uso:
 * ts-node src/scripts/setup-rag-collections.ts
 * 
 * Este script facilita a configuração de ragCollection em filas existentes
 */

import Queue from "../models/Queue";
import "../database";

interface QueueCollectionConfig {
  queueName: string;
  ragCollection: string;
  description: string;
}

// Configurações sugeridas - ajuste conforme suas filas
const suggestedCollections: QueueCollectionConfig[] = [
  {
    queueName: "Vendas",
    ragCollection: "produtos_vendas",
    description: "Catálogos, tabelas de preço, fichas técnicas de produtos"
  },
  {
    queueName: "Suporte",
    ragCollection: "suporte_tecnico",
    description: "Manuais, troubleshooting, FAQs técnicos"
  },
  {
    queueName: "Financeiro",
    ragCollection: "financeiro",
    description: "Políticas de pagamento, condições comerciais, contratos"
  },
  {
    queueName: "Atendimento",
    ragCollection: "atendimento_geral",
    description: "Informações gerais, políticas da empresa, procedimentos"
  }
];

async function setupCollections(companyId?: number) {
  try {
    console.log("=== Configuração de Coleções RAG ===\n");

    // Listar filas existentes
    const whereClause: any = {};
    if (companyId) {
      whereClause.companyId = companyId;
    }

    const queues = await Queue.findAll({
      where: whereClause,
      order: [["name", "ASC"]]
    });

    if (queues.length === 0) {
      console.log("❌ Nenhuma fila encontrada.");
      return;
    }

    console.log(`📋 Filas encontradas: ${queues.length}\n`);

    // Mostrar status atual
    console.log("Status atual das coleções:");
    console.log("─".repeat(80));
    for (const queue of queues) {
      const hasCollection = !!(queue as any).ragCollection;
      const icon = hasCollection ? "✅" : "⚪";
      const collection = (queue as any).ragCollection || "(sem coleção)";
      console.log(`${icon} ${queue.name.padEnd(30)} → ${collection}`);
    }
    console.log("─".repeat(80));
    console.log();

    // Aplicar configurações sugeridas
    console.log("🔧 Aplicando configurações sugeridas...\n");

    for (const config of suggestedCollections) {
      const queue = queues.find(q => q.name.toLowerCase().includes(config.queueName.toLowerCase()));
      
      if (queue) {
        const currentCollection = (queue as any).ragCollection;
        
        if (!currentCollection) {
          await queue.update({ ragCollection: config.ragCollection } as any);
          console.log(`✅ ${queue.name}: configurado com coleção "${config.ragCollection}"`);
          console.log(`   📝 ${config.description}\n`);
        } else {
          console.log(`⏭️  ${queue.name}: já tem coleção "${currentCollection}"\n`);
        }
      }
    }

    // Filas sem coleção
    const queuesWithoutCollection = queues.filter(q => !(q as any).ragCollection);
    
    if (queuesWithoutCollection.length > 0) {
      console.log("\n⚠️  Filas sem coleção definida:");
      for (const queue of queuesWithoutCollection) {
        console.log(`   • ${queue.name} (ID: ${queue.id})`);
      }
      console.log("\n💡 Dica: Configure manualmente via UI ou banco de dados");
      console.log("   UPDATE \"Queues\" SET \"ragCollection\" = 'nome_colecao' WHERE id = X;");
    }

    console.log("\n✅ Configuração concluída!");

  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    throw error;
  }
}

// Executar se rodado diretamente
if (require.main === module) {
  const companyId = process.argv[2] ? parseInt(process.argv[2]) : undefined;
  
  if (companyId) {
    console.log(`🏢 Configurando para empresa ID: ${companyId}\n`);
  } else {
    console.log("🌍 Configurando para todas as empresas\n");
  }

  setupCollections(companyId)
    .then(() => {
      console.log("\n🎉 Script finalizado!");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n💥 Erro fatal:", error);
      process.exit(1);
    });
}

export default setupCollections;
