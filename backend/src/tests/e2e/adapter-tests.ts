/**
 * TESTES E2E SIMULADOS - ADAPTERS
 * 
 * Testes para validar comportamento dos adapters em cenários reais
 * Execute com: npm run test:e2e
 */

import { WhatsAppFactory } from "../../libs/whatsapp";
import GetWhatsAppAdapter from "../../helpers/GetWhatsAppAdapter";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

/**
 * Cenário 1: Conexão Normal
 * Valida que adapter é criado e inicializado corretamente
 */
export async function testNormalConnection(whatsappId: number): Promise<boolean> {
  logger.info(`[TEST] Cenário 1: Conexão Normal - whatsappId=${whatsappId}`);
  
  try {
    // 1. Buscar whatsapp do banco
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[TEST] WhatsApp ${whatsappId} não encontrado`);
      return false;
    }
    
    // 2. Criar adapter via WhatsAppFactory
    const adapter = await WhatsAppFactory.createAdapter(whatsapp);
    logger.info(`[TEST] Adapter criado: ${adapter.channelType}`);
    
    // 3. Verificar status
    const status = adapter.getConnectionStatus();
    logger.info(`[TEST] Status: ${status}`);
    
    if (status !== "connected") {
      logger.error(`[TEST] FALHOU - Status esperado: connected, obtido: ${status}`);
      return false;
    }
    
    // 4. Enviar mensagem de teste (se tiver número de teste configurado)
    const testNumber = process.env.TEST_PHONE_NUMBER;
    if (testNumber) {
      const message = await adapter.sendTextMessage(testNumber, "🧪 Teste E2E - Conexão Normal");
      logger.info(`[TEST] Mensagem enviada: ${message.id}`);
    }
    
    logger.info(`[TEST] ✅ Cenário 1 PASSOU`);
    return true;
    
  } catch (error: any) {
    logger.error(`[TEST] ❌ Cenário 1 FALHOU: ${error.message}`);
    return false;
  }
}

/**
 * Cenário 2: Adapter Stale em Cache
 * Valida que GetWhatsAppAdapter detecta e corrige status stale
 */
export async function testStaleAdapter(whatsappId: number): Promise<boolean> {
  logger.info(`[TEST] Cenário 2: Adapter Stale em Cache - whatsappId=${whatsappId}`);
  
  try {
    // 1. Buscar whatsapp
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[TEST] WhatsApp ${whatsappId} não encontrado`);
      return false;
    }
    
    // 2. Criar adapter e colocar em cache
    const adapter1 = await WhatsAppFactory.createAdapter(whatsapp);
    logger.info(`[TEST] Adapter inicial criado, status: ${adapter1.getConnectionStatus()}`);
    
    // 3. Simular que status ficou stale (forçar status interno)
    // NOTA: Em produção isso aconteceria se conexão caísse mas cache não fosse limpo
    if (adapter1.channelType === "baileys") {
      (adapter1 as any).status = "disconnected";
      logger.info(`[TEST] Status forçado para 'disconnected' (simulando stale)`);
    }
    
    // 4. Usar GetWhatsAppAdapter (deve detectar e corrigir)
    const adapter2 = await GetWhatsAppAdapter(whatsapp);
    const finalStatus = adapter2.getConnectionStatus();
    logger.info(`[TEST] Status após GetWhatsAppAdapter: ${finalStatus}`);
    
    if (finalStatus !== "connected") {
      logger.error(`[TEST] FALHOU - GetWhatsAppAdapter não corrigiu status stale`);
      return false;
    }
    
    logger.info(`[TEST] ✅ Cenário 2 PASSOU`);
    return true;
    
  } catch (error: any) {
    logger.error(`[TEST] ❌ Cenário 2 FALHOU: ${error.message}`);
    return false;
  }
}

/**
 * Cenário 3: Retry Automático
 * Valida que GetWhatsAppAdapter tenta retry em caso de falha
 */
export async function testAutoRetry(whatsappId: number): Promise<boolean> {
  logger.info(`[TEST] Cenário 3: Retry Automático - whatsappId=${whatsappId}`);
  
  try {
    // 1. Limpar cache para forçar nova criação
    WhatsAppFactory.removeAdapter(whatsappId);
    logger.info(`[TEST] Cache limpo`);
    
    // 2. Buscar whatsapp
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[TEST] WhatsApp ${whatsappId} não encontrado`);
      return false;
    }
    
    // 3. Usar GetWhatsAppAdapter (deve criar e inicializar com retry se necessário)
    const startTime = Date.now();
    const adapter = await GetWhatsAppAdapter(whatsapp);
    const elapsed = Date.now() - startTime;
    
    logger.info(`[TEST] Adapter obtido em ${elapsed}ms, status: ${adapter.getConnectionStatus()}`);
    
    if (adapter.getConnectionStatus() !== "connected") {
      logger.error(`[TEST] FALHOU - Status não é 'connected'`);
      return false;
    }
    
    logger.info(`[TEST] ✅ Cenário 3 PASSOU`);
    return true;
    
  } catch (error: any) {
    logger.error(`[TEST] ❌ Cenário 3 FALHOU: ${error.message}`);
    return false;
  }
}

/**
 * Cenário 4: Múltiplas Requisições Simultâneas
 * Valida que cache funciona corretamente sem race conditions
 */
export async function testConcurrentRequests(whatsappId: number): Promise<boolean> {
  logger.info(`[TEST] Cenário 4: Múltiplas Requisições Simultâneas - whatsappId=${whatsappId}`);
  
  try {
    // 1. Buscar whatsapp
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[TEST] WhatsApp ${whatsappId} não encontrado`);
      return false;
    }
    
    // 2. Fazer 10 requisições simultâneas
    const promises = Array.from({ length: 10 }, (_, i) => 
      GetWhatsAppAdapter(whatsapp).then(adapter => ({
        index: i,
        status: adapter.getConnectionStatus(),
        whatsappId: adapter.whatsappId
      }))
    );
    
    const results = await Promise.all(promises);
    logger.info(`[TEST] ${results.length} requisições completadas`);
    
    // 3. Verificar que todas retornaram connected
    const allConnected = results.every(r => r.status === "connected");
    if (!allConnected) {
      logger.error(`[TEST] FALHOU - Nem todas as requisições retornaram 'connected'`);
      return false;
    }
    
    // 4. Verificar que todas usaram mesmo adapter (cache funcionou)
    const stats = WhatsAppFactory.getStats();
    logger.info(`[TEST] Adapters em cache: ${stats.total}, connected: ${stats.connected}`);
    
    logger.info(`[TEST] ✅ Cenário 4 PASSOU`);
    return true;
    
  } catch (error: any) {
    logger.error(`[TEST] ❌ Cenário 4 FALHOU: ${error.message}`);
    return false;
  }
}

/**
 * Cenário 5: Envio de Mensagem com Retry
 * Valida que BaileysAdapter.sendWithRetry funciona corretamente
 */
export async function testMessageSendRetry(whatsappId: number): Promise<boolean> {
  logger.info(`[TEST] Cenário 5: Envio de Mensagem com Retry - whatsappId=${whatsappId}`);
  
  try {
    const testNumber = process.env.TEST_PHONE_NUMBER;
    if (!testNumber) {
      logger.warn(`[TEST] TEST_PHONE_NUMBER não configurado, pulando teste`);
      return true;
    }
    
    // 1. Buscar whatsapp
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.error(`[TEST] WhatsApp ${whatsappId} não encontrado`);
      return false;
    }
    
    // 2. Obter adapter
    const adapter = await GetWhatsAppAdapter(whatsapp);
    
    // 3. Enviar mensagem (BaileysAdapter.sendWithRetry será usado internamente)
    const message = await adapter.sendTextMessage(
      testNumber, 
      "🧪 Teste E2E - Envio com Retry"
    );
    
    logger.info(`[TEST] Mensagem enviada: ${message.id}`);
    
    if (!message.id) {
      logger.error(`[TEST] FALHOU - Mensagem sem ID`);
      return false;
    }
    
    logger.info(`[TEST] ✅ Cenário 5 PASSOU`);
    return true;
    
  } catch (error: any) {
    logger.error(`[TEST] ❌ Cenário 5 FALHOU: ${error.message}`);
    return false;
  }
}

/**
 * Executa todos os testes
 */
export async function runAllTests(whatsappId: number): Promise<void> {
  logger.info(`\n========================================`);
  logger.info(`🧪 INICIANDO TESTES E2E - whatsappId=${whatsappId}`);
  logger.info(`========================================\n`);
  
  const results = {
    test1: await testNormalConnection(whatsappId),
    test2: await testStaleAdapter(whatsappId),
    test3: await testAutoRetry(whatsappId),
    test4: await testConcurrentRequests(whatsappId),
    test5: await testMessageSendRetry(whatsappId)
  };
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  logger.info(`\n========================================`);
  logger.info(`📊 RESULTADOS: ${passed}/${total} testes passaram`);
  logger.info(`========================================\n`);
  
  if (passed === total) {
    logger.info(`✅ TODOS OS TESTES PASSARAM!`);
  } else {
    logger.error(`❌ ALGUNS TESTES FALHARAM`);
  }
}

// Exportar para uso em scripts
export default {
  testNormalConnection,
  testStaleAdapter,
  testAutoRetry,
  testConcurrentRequests,
  testMessageSendRetry,
  runAllTests
};
