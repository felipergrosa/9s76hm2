// Script para verificar se o WhatsApp retorna o nome para os contatos
const { Sequelize } = require('sequelize');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
require('dotenv').config();

async function checkWhatsAppName() {
  const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false
  });

  try {
    // Buscar sessão ativa do WhatsApp
    const [sessions] = await sequelize.query(`
      SELECT id, name, status, "sessionFile"
      FROM "Whatsapps"
      WHERE status = 'CONNECTED'
      LIMIT 1
    `);

    if (sessions.length === 0) {
      console.log('❌ Nenhuma sessão WhatsApp conectada encontrada');
      return;
    }

    console.log('📱 Sessão encontrada:', sessions[0].name);

    // Buscar token de autenticação
    const [authData] = await sequelize.query(`
      SELECT "session"
      FROM "Whatsapps"
      WHERE id = ${sessions[0].id}
    `);

    if (!authData[0]?.session) {
      console.log('❌ Token de autenticação não encontrado');
      return;
    }

    // Carregar estado de autenticação
    const authState = JSON.parse(authData[0].session);
    
    // Criar socket temporário para consulta
    const { state, saveCreds } = await useMultiFileAuthState(`./temp_auth_${sessions[0].id}`);
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Whaticket', 'Chrome', '1.0.0'],
    });

    // Aguardar conexão
    await new Promise((resolve, reject) => {
      sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
          console.log('✅ Conectado ao WhatsApp');
          resolve();
        }
        if (update.connection === 'close') {
          reject(new Error('Falha ao conectar'));
        }
      });
    });

    // Consultar nomes dos contatos
    const numbers = ['551138303005', '5511994234501'];
    
    for (const num of numbers) {
      console.log(`\n🔍 Consultando ${num}...`);
      const jid = `${num}@s.whatsapp.net`;
      
      try {
        const results = await sock.onWhatsApp(jid);
        console.log('Resultado:', JSON.stringify(results, null, 2));
        
        if (results && results[0]) {
          console.log(`  - jid: ${results[0].jid}`);
          console.log(`  - exists: ${results[0].exists}`);
          console.log(`  - notify (nome da agenda): ${results[0].notify || 'NÃO RETORNADO'}`);
          console.log(`  - verifiedName: ${results[0].verifiedName || 'NÃO RETORNADO'}`);
        }
      } catch (err) {
        console.error(`❌ Erro ao consultar ${num}:`, err.message);
      }
    }

    sock.end();
    
  } catch (err) {
    console.error('Erro geral:', err.message);
  } finally {
    await sequelize.close();
  }
}

checkWhatsAppName();
