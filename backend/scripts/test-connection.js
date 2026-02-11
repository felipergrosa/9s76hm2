// Script para testar se a conexão WhatsApp está funcionando
require("dotenv").config();

async function testConnection() {
  try {
    // Importar getWbot do sistema
    const { getWbot } = require("../dist/libs/wbot");
    
    console.log("🔍 Testando conexão WhatsApp ID 13...");
    
    const wbot = getWbot(13);
    
    if (!wbot) {
      console.log("❌ Socket não encontrado - WhatsApp não está conectado");
      return false;
    }
    
    if (wbot.user) {
      console.log(`✅ WhatsApp conectado!`);
      console.log(`   Número: ${wbot.user.id.split("@")[0]}`);
      console.log(`   Nome: ${wbot.user.name || "Não definido"}`);
      console.log(`   Ready State: ${wbot.ws?.readyState || "Desconhecido"}`);
      return true;
    } else {
      console.log("❌ Socket existe mas usuário não autenticado");
      return false;
    }
    
  } catch (error) {
    console.error("❌ Erro ao testar conexão:", error.message);
    return false;
  }
}

testConnection()
  .then((connected) => {
    if (connected) {
      console.log("\n✅ CONEXÃO OK - Tente enviar uma mensagem de teste");
    } else {
      console.log("\n❌ CONEXÃO FALHOU - Siga os passos abaixo:");
      console.log("1. Abra o Whaticket");
      console.log("2. Vá em WhatsApp > Conexões");
      console.log("3. Encontre a conexão ID 13");
      console.log("4. Clique em 'Conectar' ou 'Reconectar'");
      console.log("5. Escaneie o QR Code com seu WhatsApp");
      console.log("6. Após conectar, teste enviar mensagem novamente");
    }
    process.exit(connected ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
