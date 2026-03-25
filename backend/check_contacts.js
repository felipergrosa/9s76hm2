// Script para testar se onWhatsApp retorna nome
const { Sequelize } = require('sequelize');
require('dotenv').config();

async function testOnWhatsApp() {
  const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');

    // Buscar sessão ativa
    const [sessions] = await sequelize.query(`
      SELECT id, name, status FROM "Whatsapps" WHERE status = 'CONNECTED' LIMIT 1
    `);
    
    if (sessions.length === 0) {
      console.log('❌ Nenhuma sessão ativa');
      return;
    }
    
    console.log(`📱 Sessão: ${sessions[0].name} (ID: ${sessions[0].id})`);

    // Verificar se o backend está rodando para usar o wbot
    // Se não estiver, não podemos testar onWhatsApp diretamente
    console.log('\n⚠️ Para testar onWhatsApp, o backend precisa estar rodando.');
    console.log('Verifique os logs do backend quando uma mensagem chegar desses números.');
    
    // Verificar quando os contatos foram criados vs atualizados
    console.log('\n=== HISTÓRICO DOS CONTATOS ===');
    const [contacts] = await sequelize.query(`
      SELECT id, name, number, "createdAt", "updatedAt", "lidJid"
      FROM "Contacts" 
      WHERE number IN ('551138303005', '5511994234501')
    `);
    console.table(contacts);

    // Verificar mensagens recebidas desses contatos
    console.log('\n=== MENSAGENS RECEBIDAS ===');
    const [messages] = await sequelize.query(`
      SELECT m.id, m.body, m."fromMe", m."createdAt", t.id as ticket_id
      FROM "Messages" m
      JOIN "Tickets" t ON m."ticketId" = t.id
      JOIN "Contacts" c ON t."contactId" = c.id
      WHERE c.number IN ('551138303005', '5511994234501')
      ORDER BY m."createdAt" DESC
      LIMIT 10
    `);
    console.table(messages);

    // Verificar se há logs de atualização de nome
    console.log('\n=== ANÁLISE ===');
    console.log('Contato 6556 (FinanZero):');
    console.log('  - Criado em: 2026-03-25 15:17');
    console.log('  - lidJid: null (sem LID)');
    console.log('  - Nome era igual ao número');
    console.log('');
    console.log('Contato 6344 (Mercado Livre):');
    console.log('  - Criado em: 2026-03-11 16:12');
    console.log('  - lidJid: 135888721998075@lid (TEM LID)');
    console.log('  - Nome era igual ao número');
    console.log('');
    console.log('HIPÓTESE: O contato 6344 tem LID, o que pode ter afetado a resolução de nome.');
    console.log('O sistema pode não estar buscando nome para contatos com LID corretamente.');
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await sequelize.close();
  }
}

testOnWhatsApp();
