/**
 * Script para deduplicar e normalizar contatos
 * 
 * Uso: npx ts-node src/scripts/deduplicate-contacts.ts <companyId>
 * 
 * Funcionalidades:
 * 1. Normaliza todos os números de telefone
 * 2. Detecta duplicatas por variações (551199... vs 1199...)
 * 3. Mescla contatos duplicados preservando dados
 * 4. Move tickets e mensagens para contato principal
 */

import "../bootstrap";
import ContactDeduplicationService from "../services/ContactServices/ContactDeduplicationService";
import Contact from "../models/Contact";
import logger from "../utils/logger";

async function main() {
  const companyId = parseInt(process.argv[2] || "1");

  if (isNaN(companyId)) {
    console.error("❌ CompanyId inválido. Uso: npx ts-node src/scripts/deduplicate-contacts.ts <companyId>");
    process.exit(1);
  }

  console.log(`\n🔧 Deduplicação de Contatos - Company ${companyId}`);
  console.log("=".repeat(50));

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. ESTATÍSTICAS INICIAIS
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n📊 Estatísticas iniciais...");
    
    const totalContacts = await Contact.count({ where: { companyId, isGroup: false } });
    const pendingContacts = await Contact.count({ 
      where: { 
        companyId, 
        isGroup: false, 
        number: { [require("sequelize").Op.like]: "PENDING_%" } 
      } 
    });
    const groupContacts = await Contact.count({ where: { companyId, isGroup: true } });

    console.log(`   Total de contatos individuais: ${totalContacts}`);
    console.log(`   Contatos pendentes (PENDING_): ${pendingContacts}`);
    console.log(`   Grupos: ${groupContacts}`);

    // ═══════════════════════════════════════════════════════════════════
    // 2. NORMALIZAR NÚMEROS
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n📝 Normalizando números...");
    
    const normalizeResult = await ContactDeduplicationService.normalizeAll(companyId);
    
    console.log(`   ✅ ${normalizeResult.normalized} números normalizados`);
    if (normalizeResult.errors.length > 0) {
      console.log(`   ⚠️  ${normalizeResult.errors.length} erros:`);
      normalizeResult.errors.slice(0, 5).forEach(e => console.log(`      - ${e}`));
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. DETECTAR DUPLICATAS
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n🔍 Detectando duplicatas...");
    
    const duplicates = await ContactDeduplicationService.findDuplicates(companyId);
    
    console.log(`   📋 ${duplicates.size} grupos de duplicatas encontrados`);
    
    if (duplicates.size === 0) {
      console.log("\n✅ Nenhuma duplicata encontrada!");
      process.exit(0);
    }

    // Mostrar exemplos
    console.log("\n   Exemplos:");
    let count = 0;
    for (const [canonical, contacts] of duplicates) {
      if (count >= 5) break;
      console.log(`   - ${canonical}: ${contacts.length} duplicatas (${contacts.map(c => c.id).join(", ")})`);
      count++;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. CONFIRMAR DEDUPLICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n⚠️  ATENÇÃO: Esta operação irá mesclar contatos duplicados.");
    console.log("   - O contato mais antigo com mais dados será mantido");
    console.log("   - Tickets e mensagens serão movidos para o contato principal");
    console.log("   - Contatos duplicados serão removidos");
    
    // Em ambiente não-interativo, prosseguir automaticamente
    const isInteractive = process.stdin.isTTY;
    
    if (isInteractive) {
      console.log("\n   Deseja continuar? (y/N)");
      
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>(resolve => {
        rl.question("", resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== "y") {
        console.log("❌ Operação cancelada.");
        process.exit(0);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. EXECUTAR DEDUPLICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n🧹 Executando deduplicação...");
    
    const result = await ContactDeduplicationService.deduplicate(companyId);
    
    console.log("\n📊 Resultado:");
    console.log(`   - Contatos escaneados: ${result.totalScanned}`);
    console.log(`   - Grupos de duplicatas: ${result.duplicateGroups}`);
    console.log(`   - Contatos mesclados: ${result.contactsMerged}`);
    console.log(`   - Contatos removidos: ${result.contactsRemoved}`);
    
    if (result.errors.length > 0) {
      console.log(`   - Erros: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`     ❌ ${e}`));
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. ESTATÍSTICAS FINAIS
    // ═══════════════════════════════════════════════════════════════════
    console.log("\n📊 Estatísticas finais...");
    
    const finalTotal = await Contact.count({ where: { companyId, isGroup: false } });
    const finalPending = await Contact.count({ 
      where: { 
        companyId, 
        isGroup: false, 
        number: { [require("sequelize").Op.like]: "PENDING_%" } 
      } 
    });

    console.log(`   Total de contatos individuais: ${finalTotal} (era ${totalContacts})`);
    console.log(`   Contatos pendentes (PENDING_): ${finalPending}`);
    console.log(`   Contatos removidos: ${totalContacts - finalTotal}`);

    console.log("\n✅ Deduplicação concluída com sucesso!");
    console.log("\n💡 Próximos passos:");
    console.log("   1. Execute a migration para criar índice único:");
    console.log("      npx sequelize-cli db:migrate");
    console.log("   2. Reinicie o backend para aplicar as correções");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Erro:", error.message);
    logger.error({ err: error }, "[deduplicate-contacts] Erro");
    process.exit(1);
  }
}

main();
