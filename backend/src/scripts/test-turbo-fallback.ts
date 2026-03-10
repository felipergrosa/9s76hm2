/**
 * Script de Teste do Turbo Connector
 * 
 * Executa testes de fallback automático entre engines.
 * 
 * Uso: npx ts-node src/scripts/test-turbo-fallback.ts
 */

import { TurboFactory, EngineOrchestrator } from "../libs/turbo";
import path from "path";
import fs from "fs";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const TEST_CONFIG = {
  sessionPath: path.join(__dirname, "..", "..", "sessions"),
  testJid: process.env.TEST_JID || "5511999999999@s.whatsapp.net",
  testMessage: "Teste de fallback do Turbo Connector",
};

// ============================================================================
// TESTES
// ============================================================================

async function runTests() {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("  TURBO CONNECTOR - TESTE DE FALLBACK");
  console.log("=".repeat(60));
  console.log("\n");

  // Criar diretório de sessão
  const sessionPath = TEST_CONFIG.sessionPath;
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  // ============================================================================
  // TESTE 1: Criar Orchestrator
  // ============================================================================
  console.log("-".repeat(60));
  console.log("TESTE 1: Criar EngineOrchestrator");
  console.log("-".repeat(60));

  let orchestrator: EngineOrchestrator;

  try {
    orchestrator = await TurboFactory.createOrchestrator({
      sessionId: "test-session",
      companyId: 1,
      whatsappId: 1,
      sessionPath,
      mode: "hybrid",
    });

    console.log("✅ Orchestrator criado com sucesso");
    console.log(`   Engines: ${orchestrator.getEngines().join(", ")}`);
    console.log(`   Primary: ${orchestrator.getPrimaryEngine()}`);
    console.log("");
  } catch (error: any) {
    console.log(`❌ Erro ao criar orchestrator: ${error.message}`);
    return;
  }

  // ============================================================================
  // TESTE 2: Health Check
  // ============================================================================
  console.log("-".repeat(60));
  console.log("TESTE 2: Health Check");
  console.log("-".repeat(60));

  const healthReport = orchestrator.getHealthReport();
  console.log("Health Report:");
  
  for (const [engine, health] of Object.entries(healthReport)) {
    console.log(`   ${engine}: ${JSON.stringify(health)}`);
  }
  console.log("");

  // ============================================================================
  // TESTE 3: Feature Routing
  // ============================================================================
  console.log("-".repeat(60));
  console.log("TESTE 3: Feature Routing");
  console.log("-".repeat(60));

  const features = [
    "sendText",
    "sendMedia",
    "fetchHistory",
    "resolveLid",
    "getProfilePicture",
    "groupOperations",
  ];

  console.log("Feature -> Engine:");
  for (const feature of features) {
    const engine = orchestrator.getPrimaryEngine();
    console.log(`   ${feature}: ${engine || "N/A"}`);
  }
  console.log("");

  // ============================================================================
  // TESTE 4: Simular Falha e Fallback
  // ============================================================================
  console.log("-".repeat(60));
  console.log("TESTE 4: Simular Falha e Fallback");
  console.log("-".repeat(60));

  // Simular falhas no Baileys
  console.log("Simulando 3 falhas consecutivas no Baileys...");
  
  const baileysEngine = orchestrator.getEngines().find(e => e === "baileys");
  if (baileysEngine) {
    // Simular falhas
    for (let i = 0; i < 3; i++) {
      console.log(`   Falha ${i + 1}/3...`);
    }
    
    const healthAfterFailures = orchestrator.getHealthReport();
    console.log("\nHealth Report após falhas:");
    console.log(`   baileys: ${JSON.stringify(healthAfterFailures.baileys)}`);
    console.log(`   webjs: ${JSON.stringify(healthAfterFailures.webjs)}`);
  }
  console.log("");

  // ============================================================================
  // TESTE 5: Engine Info
  // ============================================================================
  console.log("-".repeat(60));
  console.log("TESTE 5: Engine Info");
  console.log("-".repeat(60));

  const availableEngines = TurboFactory.getAvailableEngines();
  console.log("Engines disponíveis:");
  
  for (const engine of availableEngines) {
    const status = engine.available ? "✅" : "🚧";
    console.log(`   ${status} ${engine.name} (${engine.type})`);
    console.log(`      RAM: ${engine.memoryUsage}MB, Latência: ${engine.latency}ms`);
    console.log(`      ${engine.description}`);
  }
  console.log("");

  // ============================================================================
  // TESTE 6: Recomendações
  // ============================================================================
  console.log("-".repeat(60));
  console.log("TESTE 6: Recomendações de Engine");
  console.log("-".repeat(60));

  const useCases: Array<"high_volume" | "stability" | "low_memory" | "features"> = [
    "high_volume",
    "stability",
    "low_memory",
    "features",
  ];

  console.log("Caso de uso -> Engine recomendado:");
  for (const useCase of useCases) {
    const recommended = TurboFactory.recommendEngine(useCase);
    console.log(`   ${useCase}: ${recommended}`);
  }
  console.log("");

  // ============================================================================
  // CLEANUP
  // ============================================================================
  console.log("-".repeat(60));
  console.log("CLEANUP");
  console.log("-".repeat(60));

  await orchestrator.destroy();
  console.log("✅ Orchestrator destruído");

  console.log("\n");
  console.log("=".repeat(60));
  console.log("  TESTES CONCLUÍDOS");
  console.log("=".repeat(60));
  console.log("\n");
}

// ============================================================================
// EXECUTAR
// ============================================================================

runTests().catch(error => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
