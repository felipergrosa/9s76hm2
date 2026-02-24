const axios = require('axios');

// Configuração
const API_URL = 'http://localhost:8080';
const TICKET_ID = 255; // Ticket da Bruna - deve funcionar

async function testSendMessage() {
  console.log('========================================');
  console.log('TESTE DE ENVIO DE MENSAGEM');
  console.log(`Ticket ID: ${TICKET_ID}`);
  console.log('========================================\n');
  
  const message = `Teste LID ${new Date().toLocaleTimeString()}`;
  
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Enviando mensagem: "${message}"`);
    
    const response = await axios.post(`${API_URL}/api/messages/${TICKET_ID}`, {
      body: message,
      quotedMsg: null
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Token de autenticação se necessário
      },
      timeout: 30000
    });
    
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Mensagem enviada com sucesso!`);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log(`[${new Date().toLocaleTimeString()}] ❌ ERRO ao enviar:`);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Erro:', error.message);
    }
  }
  
  console.log('\n========================================');
  console.log('VERIFIQUE OS LOGS DO BACKEND');
  console.log('Procurar por: ResolveSendJid, JID resolvido, @lid, Bad MAC');
  console.log('========================================');
}

testSendMessage();
