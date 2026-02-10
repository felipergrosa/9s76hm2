const { Sequelize, DataTypes } = require('sequelize');

// Configuração do banco de produção
const sequelize = new Sequelize(
  process.env.DB_NAME || 'whaticket',
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASS || 'efe487b6a861100fb704ad9f5c160cb8',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

async function diagnoseConnection31() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de produção');
    
    // 1. Verificar se conexão #31 existe
    const [connection31] = await sequelize.query(`
      SELECT id, name, status, number, "channelType", "isDefault", "companyId", "updatedAt"
      FROM "Whatsapps" 
      WHERE id = 31
    `);
    
    console.log('\n=== CONEXÃO #31 ===');
    if (connection31.length === 0) {
      console.log('❌ CONEXÃO #31 NÃO EXISTE NO BANCO!');
      console.log('⚠️  Isso explica por que as mensagens não são entregues');
    } else {
      const conn = connection31[0];
      const statusIcon = conn.status === 'connected' ? '🟢' : 
                        conn.status === 'connecting' ? '🟡' : 
                        conn.status === 'disconnected' ? '🔴' : '⚪';
      
      console.log(`${statusIcon} ID: ${conn.id} (Empresa: ${conn.companyId})`);
      console.log(`   Nome: ${conn.name || 'Sem nome'}`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Número: ${conn.number || 'Não configurado'}`);
      console.log(`   Canal: ${conn.channelType}`);
      console.log(`   Última atualização: ${conn.updatedAt}`);
    }
    
    // 2. Verificar tickets com whatsappId=31
    const [tickets31] = await sequelize.query(`
      SELECT 
        t.id, t.uuid, t.status, t."lastMessage", t."updatedAt",
        c.name as contact_name, c.number as contact_number,
        COUNT(m.id) as message_count
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON t."contactId" = c.id
      LEFT JOIN "Messages" m ON t.id = m."ticketId"
      WHERE t."whatsappId" = 31
      GROUP BY t.id, t.uuid, t.status, t."lastMessage", t."updatedAt", c.name, c.number
      ORDER BY t."updatedAt" DESC
      LIMIT 10
    `);
    
    console.log('\n=== TICKETS COM WHATSAPPID=31 ===');
    if (tickets31.length === 0) {
      console.log('❌ Nenhum ticket encontrado com whatsappId=31');
    } else {
      tickets31.forEach(ticket => {
        console.log(`🎫 Ticket ID: ${ticket.id} (UUID: ${ticket.uuid})`);
        console.log(`   Status: ${ticket.status}`);
        console.log(`   Contato: ${ticket.contact_name || 'N/A'} (${ticket.contact_number || 'N/A'})`);
        console.log(`   Mensagens: ${ticket.message_count}`);
        console.log(`   Última mensagem: ${ticket.lastMessage || 'N/A'}`);
        console.log(`   Última atualização: ${ticket.updatedAt}`);
        console.log('');
      });
    }
    
    // 3. Verificar mensagens recentes enviadas com whatsappId=31
    const [recentMessages] = await sequelize.query(`
      SELECT 
        m.id, m.wid, m.body, m."fromMe", m."mediaType", m.ack, m."createdAt",
        t.id as ticket_id, t.uuid as ticket_uuid
      FROM "Messages" m
      INNER JOIN "Tickets" t ON m."ticketId" = t.id
      WHERE t."whatsappId" = 31 
        AND m."fromMe" = true
        AND m."createdAt" > NOW() - INTERVAL '2 hours'
      ORDER BY m."createdAt" DESC
      LIMIT 20
    `);
    
    console.log('\n=== MENSAGENS ENVIADAS (ÚLTIMAS 2 HORAS) ===');
    if (recentMessages.length === 0) {
      console.log('❌ Nenhuma mensagem enviada encontrada');
    } else {
      recentMessages.forEach(msg => {
        const ackIcon = msg.ack === 4 ? '✅' : 
                        msg.ack === 3 ? '🟡' : 
                        msg.ack === 2 ? '🟠' : 
                        msg.ack === 1 ? '🔴' : '⚪';
        
        console.log(`${ackIcon} Msg ID: ${msg.id} (WID: ${msg.wid})`);
        console.log(`   Ticket: ${msg.ticket_id} (${msg.ticket_uuid})`);
        console.log(`   ACK: ${msg.ack} (1=sent, 2=received, 3=read, 4=played)`);
        console.log(`   Tipo: ${msg.mediaType || 'text'}`);
        console.log(`   Conteúdo: ${msg.body?.substring(0, 50) || 'N/A'}${msg.body?.length > 50 ? '...' : ''}`);
        console.log(`   Enviada: ${msg.createdAt}`);
        console.log('');
      });
    }
    
    // 4. Verificar conexões alternativas disponíveis
    const [availableConnections] = await sequelize.query(`
      SELECT id, name, status, number, "channelType", "isDefault"
      FROM "Whatsapps" 
      WHERE status = 'connected' AND id != 31
      ORDER BY id
    `);
    
    console.log('\n=== CONEXÕES ALTERNATIVAS DISPONÍVEIS ===');
    if (availableConnections.length === 0) {
      console.log('❌ Nenhuma conexão alternativa disponível');
    } else {
      availableConnections.forEach(conn => {
        const defaultIcon = conn.isDefault ? ' ⭐' : '';
        console.log(`🟢 ID: ${conn.id}${defaultIcon} - ${conn.name || 'Sem nome'}`);
        console.log(`   Número: ${conn.number || 'N/A'} | Canal: ${conn.channelType}`);
      });
    }
    
    // 5. Recomendações
    console.log('\n=== RECOMENDAÇÕES ===');
    if (connection31.length === 0) {
      console.log('🔧 AÇÃO NECESSÁRIA:');
      console.log('   1. A conexão #31 foi deletada do banco');
      console.log('   2. Tickets com whatsappId=31 estão órfãos');
      console.log('   3. Migrar tickets para uma conexão válida:');
      console.log(`      UPDATE "Tickets" SET "whatsappId" = ${availableConnections[0]?.id || 'ID_DISPONÍVEL'} WHERE "whatsappId" = 31;`);
      console.log('   4. Ou recriar a conexão #31 se necessário');
    } else if (connection31[0].status !== 'connected') {
      console.log('🔧 AÇÃO NECESSÁRIA:');
      console.log('   1. Conexão #31 existe mas não está conectada');
      console.log('   2. Verificar se o WhatsApp foi desconectado/banido');
      console.log('   3. Reconectar o dispositivo na interface');
      console.log('   4. Se falhar, migrar tickets para conexão disponível');
    } else {
      console.log('ℹ️  CONEXÃO #31 ESTÁ ATIVA:');
      console.log('   1. Verificar logs de erro específicos');
      console.log('   2. Testar envio manual de mensagem');
      console.log('   3. Verificar se há rate limiting do WhatsApp');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

diagnoseConnection31();
