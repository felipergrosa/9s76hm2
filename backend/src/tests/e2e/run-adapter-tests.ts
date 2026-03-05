/**
 * SCRIPT PARA EXECUTAR TESTES E2E DOS ADAPTERS
 * 
 * Uso:
 * npm run test:adapter -- --whatsappId=32
 * 
 * Ou via ts-node:
 * npx ts-node src/tests/e2e/run-adapter-tests.ts --whatsappId=32
 */

import adapterTests from "./adapter-tests";
import logger from "../../utils/logger";

// Parse argumentos da linha de comando
const args = process.argv.slice(2);
const whatsappIdArg = args.find(arg => arg.startsWith("--whatsappId="));

if (!whatsappIdArg) {
  logger.error("❌ Uso: npm run test:adapter -- --whatsappId=<ID>");
  logger.error("   Exemplo: npm run test:adapter -- --whatsappId=32");
  process.exit(1);
}

const whatsappId = parseInt(whatsappIdArg.split("=")[1]);

if (isNaN(whatsappId)) {
  logger.error("❌ whatsappId deve ser um número válido");
  process.exit(1);
}

// Executar testes
(async () => {
  try {
    await adapterTests.runAllTests(whatsappId);
    process.exit(0);
  } catch (error: any) {
    logger.error(`❌ Erro ao executar testes: ${error.message}`);
    process.exit(1);
  }
})();
