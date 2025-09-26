/**
 * Script de teste para validar o AIOrchestrator
 * Execute com: npx ts-node src/scripts/testAIOrchestrator.ts
 */

import AIOrchestrator from "../services/IA/AIOrchestrator";

async function testBasicFunctionality() {
  console.log("🧪 Testando funcionalidades básicas do AIOrchestrator\n");

  // Teste 1: Enhance de texto simples
  console.log("1️⃣ Teste: Enhance de texto");
  try {
    const response = await AIOrchestrator.processRequest({
      module: "general",
      mode: "enhance",
      companyId: 1, // Substitua por um ID válido
      text: "oi tudo bem",
      metadata: { test: "enhance_basic" }
    });

    console.log("✅ Enhance - Sucesso:", {
      provider: response.provider,
      model: response.model,
      processingTime: response.processingTime,
      result: response.result?.substring(0, 100) + "..."
    });
  } catch (error: any) {
    console.log("❌ Enhance - Erro:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Teste 2: Correção ortográfica
  console.log("2️⃣ Teste: Correção ortográfica");
  try {
    const response = await AIOrchestrator.processRequest({
      module: "ticket",
      mode: "spellcheck",
      companyId: 1,
      text: "ola como voce esta? preciso de ajuda com meu pedido",
      metadata: { test: "spellcheck_basic" }
    });

    console.log("✅ Spellcheck - Sucesso:", {
      provider: response.provider,
      result: response.result
    });
  } catch (error: any) {
    console.log("❌ Spellcheck - Erro:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Teste 3: Tradução
  console.log("3️⃣ Teste: Tradução");
  try {
    const response = await AIOrchestrator.processRequest({
      module: "campaign",
      mode: "translate",
      companyId: 1,
      text: "Hello, how are you today?",
      targetLang: "pt-BR",
      metadata: { test: "translate_basic" }
    });

    console.log("✅ Translate - Sucesso:", {
      provider: response.provider,
      result: response.result
    });
  } catch (error: any) {
    console.log("❌ Translate - Erro:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");
}

async function testFallbackMechanism() {
  console.log("🔄 Testando mecanismo de fallback\n");

  // Teste com provedor específico (pode falhar e usar fallback)
  console.log("4️⃣ Teste: Fallback entre provedores");
  try {
    const response = await AIOrchestrator.processRequest({
      module: "general",
      mode: "enhance",
      companyId: 1,
      text: "teste de fallback",
      preferProvider: "openai", // Tenta OpenAI primeiro
      metadata: { test: "fallback_mechanism" }
    });

    console.log("✅ Fallback - Sucesso:", {
      provider: response.provider,
      processingTime: response.processingTime,
      result: response.result?.substring(0, 50) + "..."
    });
  } catch (error: any) {
    console.log("❌ Fallback - Erro:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");
}

async function testRAGIntegration() {
  console.log("🧠 Testando integração com RAG\n");

  // Teste 5: RAG com busca
  console.log("5️⃣ Teste: RAG Integration");
  try {
    const response = await AIOrchestrator.processRequest({
      module: "ticket",
      mode: "rag",
      companyId: 1,
      text: "Como funciona o sistema de tickets?",
      useRAG: true,
      ragQuery: "tickets sistema funcionamento",
      ragFilters: {
        k: 3,
        tags: ["help", "documentation"]
      },
      metadata: { test: "rag_integration" }
    });

    console.log("✅ RAG - Sucesso:", {
      provider: response.provider,
      ragUsed: response.ragUsed,
      ragResultsCount: response.ragResults?.length || 0,
      result: response.result?.substring(0, 100) + "..."
    });
  } catch (error: any) {
    console.log("❌ RAG - Erro:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");
}

async function testCompatibilityMode() {
  console.log("🔄 Testando modo de compatibilidade\n");

  // Teste 6: Método de compatibilidade
  console.log("6️⃣ Teste: Compatibility Mode");
  try {
    const result = await AIOrchestrator.transformText({
      companyId: 1,
      text: "teste de compatibilidade",
      mode: "enhance",
      integrationType: "openai"
    });

    console.log("✅ Compatibility - Sucesso:", {
      result: result.substring(0, 100) + "..."
    });
  } catch (error: any) {
    console.log("❌ Compatibility - Erro:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");
}

async function runAllTests() {
  console.log("🚀 Iniciando testes do AIOrchestrator");
  console.log("=" .repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    await testBasicFunctionality();
    await testFallbackMechanism();
    await testRAGIntegration();
    await testCompatibilityMode();

    const totalTime = Date.now() - startTime;
    console.log("🎉 Todos os testes concluídos!");
    console.log(`⏱️  Tempo total: ${totalTime}ms`);
    console.log();
    console.log("📝 Próximos passos:");
    console.log("   1. Verificar logs no console para erros");
    console.log("   2. Testar endpoints via API REST");
    console.log("   3. Integrar com ChatAssistantPanel");
    console.log("   4. Implementar tela de configurações globais");

  } catch (error: any) {
    console.error("💥 Erro geral nos testes:", error.message);
    console.error(error.stack);
  }
}

// Executa os testes se o script for chamado diretamente
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log("\n✅ Script de teste finalizado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script de teste falhou:", error);
      process.exit(1);
    });
}

export { runAllTests, testBasicFunctionality, testFallbackMechanism, testRAGIntegration };
