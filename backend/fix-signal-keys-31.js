/**
 * Script para limpar chaves de sessão Signal corrompidas da conexão #31
 * 
 * O MessageCounterError ocorre quando as chaves criptográficas do Signal Protocol
 * ficam dessincronizadas (ex: após recriar uma conexão com o mesmo número).
 * 
 * Este script remove APENAS as chaves de sessão Signal (session-*, sender-key-*, pre-key-*)
 * mantendo as credenciais (creds) intactas para não precisar escanear QR novamente.
 * 
 * Uso: node fix-signal-keys-31.js [--dry-run]
 */

const Redis = require("ioredis");

const WHATSAPP_ID = 31;
const DRY_RUN = process.argv.includes("--dry-run");

// Mesma config do .env
const REDIS_URI = process.env.REDIS_URI || "redis://:SuaSenhaForteAqui123!@redis:6379/0";

async function fixSignalKeys() {
  const redis = new Redis(REDIS_URI);
  
  try {
    console.log(`Conectado ao Redis`);
    console.log(`Modo: ${DRY_RUN ? "DRY-RUN (sem alteracoes)" : "EXECUCAO REAL"}\n`);
    
    // 1. Listar todas as chaves da sessao #31
    const allKeys = await redis.keys(`sessions:${WHATSAPP_ID}:*`);
    console.log(`Total de chaves para sessions:${WHATSAPP_ID}: ${allKeys.length}\n`);
    
    if (allKeys.length === 0) {
      console.log("Nenhuma chave encontrada. A sessao pode estar em filesystem.");
      return;
    }
    
    // 2. Classificar chaves
    const creds = [];
    const signalSessions = [];  // session-* (sessoes criptograficas por contato)
    const senderKeys = [];      // sender-key-* (chaves de grupo)
    const preKeys = [];         // pre-key-* (chaves pre-compartilhadas)
    const appState = [];        // app-state-* (estado do app)
    const other = [];
    
    for (const key of allKeys) {
      const suffix = key.replace(`sessions:${WHATSAPP_ID}:`, "");
      
      if (suffix === "creds") {
        creds.push(key);
      } else if (suffix.startsWith("session-")) {
        signalSessions.push(key);
      } else if (suffix.startsWith("sender-key-")) {
        senderKeys.push(key);
      } else if (suffix.startsWith("pre-key-")) {
        preKeys.push(key);
      } else if (suffix.startsWith("app-state-")) {
        appState.push(key);
      } else {
        other.push(key);
      }
    }
    
    console.log("=== CLASSIFICACAO DAS CHAVES ===");
    console.log(`  creds: ${creds.length} (MANTER)`);
    console.log(`  session-*: ${signalSessions.length} (REMOVER - sessoes Signal corrompidas)`);
    console.log(`  sender-key-*: ${senderKeys.length} (REMOVER - chaves de grupo)`);
    console.log(`  pre-key-*: ${preKeys.length} (REMOVER - pre-keys)`);
    console.log(`  app-state-*: ${appState.length} (MANTER)`);
    console.log(`  outros: ${other.length} (MANTER)`);
    
    // 3. Chaves a remover (sessoes Signal corrompidas)
    const toRemove = [...signalSessions, ...senderKeys, ...preKeys];
    
    console.log(`\nTotal a remover: ${toRemove.length}`);
    console.log(`Total a manter: ${allKeys.length - toRemove.length}`);
    
    if (toRemove.length === 0) {
      console.log("\nNenhuma chave Signal para limpar.");
      return;
    }
    
    // Mostrar algumas chaves que serao removidas
    console.log("\nExemplos de chaves a remover:");
    toRemove.slice(0, 5).forEach(k => console.log(`  - ${k}`));
    if (toRemove.length > 5) {
      console.log(`  ... e mais ${toRemove.length - 5}`);
    }
    
    // 4. Executar limpeza
    if (DRY_RUN) {
      console.log("\n[DRY-RUN] Nenhuma chave foi removida.");
      console.log("Execute sem --dry-run para aplicar.");
    } else {
      console.log("\nRemovendo chaves corrompidas...");
      
      // Remover em batches de 100
      for (let i = 0; i < toRemove.length; i += 100) {
        const batch = toRemove.slice(i, i + 100);
        await redis.del(...batch);
        console.log(`  Removidas ${Math.min(i + 100, toRemove.length)}/${toRemove.length}`);
      }
      
      console.log("\nLimpeza concluida!");
      console.log("\nProximo passo:");
      console.log("  1. Reinicie o backend (ou desconecte/reconecte a conexao #31 pela interface)");
      console.log("  2. O Baileys vai renegociar as sessoes Signal automaticamente");
      console.log("  3. O MessageCounterError deve desaparecer");
      console.log("  4. NAO precisa escanear QR code novamente (creds mantidas)");
    }
    
  } catch (error) {
    console.error("Erro:", error.message);
  } finally {
    await redis.quit();
  }
}

console.log("=== LIMPEZA DE CHAVES SIGNAL CORROMPIDAS ===\n");
fixSignalKeys();
