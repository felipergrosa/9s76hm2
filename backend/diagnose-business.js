/**
 * Diagnóstico específico para problema WhatsApp Business vs Normal
 * 
 * Uso: node diagnose-business.js [whatsappId]
 * 
 * Este script verifica:
 * 1. Diferenças entre conexões WhatsApp Business e Normal
 * 2. Problemas de mapeamento LID
 * 3. Taxa de confirmação de mensagens enviadas (ACK)
 */

const { Sequelize, DataTypes } = require('sequelize');

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

async function diagnoseBusinessVsNormal(targetWhatsappId = null) {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco PostgreSQL\n');
    
    // Buscar todas as conexões
    const [connections] = await sequelize.query(`
      SELECT id, name, status, number, "channelType", "isDefault", "companyId"
      FROM "Whatsapps"
      ORDER BY id ASC
    `);
    
    console.log('=== ANÁLISE WHATSAPP BUSINESS VS NORMAL ===\n');
    
    for (const conn of connections) {
      // Se especificou um ID, pular outros
      if (targetWhatsappId && conn.id !== parseInt(targetWhatsappId)) {
        continue;
      }
      
      console.log(`📱 WhatsApp ID: ${conn.id} (${conn.name || 'Sem nome'})`);
      console.log(`   Status: ${conn.status} | Canal: ${conn.channelType}`);
      console.log(`   Número: ${conn.number || 'N/A'}`);
      
      // 1. Contar contatos LID
      const [lidStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN c."remoteJid" LIKE '%@lid' OR c."lidJid" IS NOT NULL THEN 1 END) as lid_contacts,
          COUNT(CASE WHEN c."isGroup" = true THEN 1 END) as groups
        FROM "Contacts" c
        JOIN "Tickets" t ON c.id = t."contactId"
        WHERE t."whatsappId" = ${conn.id}
      `);
      
      const stats = lidStats[0];
      const lidPercentage = stats.total_contacts > 0 
        ? ((parseInt(stats.lid_contacts) / parseInt(stats.total_contacts)) * 100).toFixed(1)
        : 0;
      
      console.log(`\n   👥 Contatos: ${stats.total_contacts} total`);
      console.log(`      🔒 LID: ${stats.lid_contacts} (${lidPercentage}%) ${parseInt(stats.lid_contacts) > 0 ? '⚠️ WhatsApp Business?' : ''}`);
      console.log(`      👥 Grupos: ${stats.groups}`);
      
      // 2. Analisar mensagens enviadas (fromMe=true)
      const [sentStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_enviadas,
          COUNT(CASE WHEN m.ack = 3 THEN 1 END) as lidas,
          COUNT(CASE WHEN m.ack = 2 THEN 1 END) as entregues,
          COUNT(CASE WHEN m.ack = 1 THEN 1 END) as enviadas_sem_confirmacao,
          COUNT(CASE WHEN m.ack = 0 OR m.ack IS NULL THEN 1 END) as pendentes,
          COUNT(CASE WHEN m.ack < 2 THEN 1 END) as problemas_potenciais,
          MAX(m."createdAt") as ultima_mensagem
        FROM "Messages" m
        JOIN "Tickets" t ON m."ticketId" = t.id
        WHERE t."whatsappId" = ${conn.id}
          AND m."fromMe" = true
          AND m."createdAt" > NOW() - INTERVAL '7 days'
      `);
      
      const sent = sentStats[0];
      const totalSent = parseInt(sent.total_enviadas);
      
      if (totalSent > 0) {
        const confirmadas = parseInt(sent.lidas) + parseInt(sent.entregues);
        const taxaSucesso = ((confirmadas / totalSent) * 100).toFixed(1);
        const taxaProblemas = ((parseInt(sent.problemas_potenciais) / totalSent) * 100).toFixed(1);
        
        console.log(`\n   📤 Mensagens Enviadas (7 dias): ${totalSent}`);
        console.log(`      ✅ Lidas: ${sent.lidas}`);
        console.log(`      📬 Entregues: ${sent.entregues}`);
        console.log(`      ⏳ Sem confirmação: ${sent.enviadas_sem_confirmacao}`);
        console.log(`      ❓ Pendentes: ${sent.pendentes}`);
        console.log(`      🔴 Problemas potenciais: ${sent.problemas_potenciais} (${taxaProblemas}%)`);
        console.log(`      📊 Taxa de sucesso: ${taxaSucesso}%`);
        
        if (parseFloat(taxaSucesso) < 70 && totalSent > 10) {
          console.log(`      ⚠️  ALERTA: Taxa de sucesso baixa! Possível problema.`);
        }
        
        if (parseInt(stats.lid_contacts) > 0 && parseFloat(taxaSucesso) < 80) {
          console.log(`      🔴 CRÍTICO: LIDs detectados com baixa taxa de sucesso!`);
          console.log(`         Possível falha na resolução de LID para mensagens enviadas.`);
        }
      } else {
        console.log(`\n   📤 Nenhuma mensagem enviada nos últimos 7 dias`);
      }
      
      // 3. Verificar mapeamentos LID
      const [lidMappings] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_mappings,
          COUNT(CASE WHEN confidence >= 0.95 THEN 1 END) as alta_confiança,
          MAX("LidMappings"."createdAt") as ultimo_mapeamento
        FROM "LidMappings"
        WHERE "whatsappId" = ${conn.id}
      `);
      
      const mappings = lidMappings[0];
      console.log(`\n   🗺️  Mapeamentos LID: ${mappings.total_mappings}`);
      console.log(`      Alta confiança (>=0.95): ${mappings.alta_confiança}`);
      console.log(`      Último: ${mappings.ultimo_mapeamento || 'N/A'}`);
      
      // 4. Contatos com problema de mapeamento
      const [problemContacts] = await sequelize.query(`
        SELECT 
          c.number,
          c.name,
          c."remoteJid",
          c."lidJid",
          COUNT(m.id) as msgs_enviadas,
          COUNT(CASE WHEN m.ack < 2 THEN 1 END) as msgs_sem_confirmacao
        FROM "Contacts" c
        JOIN "Tickets" t ON c.id = t."contactId"
        JOIN "Messages" m ON t.id = m."ticketId"
        WHERE t."whatsappId" = ${conn.id}
          AND m."fromMe" = true
          AND m."createdAt" > NOW() - INTERVAL '7 days'
          AND (c."remoteJid" LIKE '%@lid' OR c."lidJid" IS NOT NULL)
        GROUP BY c.id, c.number, c.name, c."remoteJid", c."lidJid"
        HAVING COUNT(CASE WHEN m.ack < 2 THEN 1 END) > 0
        LIMIT 5
      `);
      
      if (problemContacts.length > 0) {
        console.log(`\n   🔴 Contatos LID com mensagens sem confirmação:`);
        problemContacts.forEach(pc => {
          console.log(`      - ${pc.name || 'Sem nome'} (${pc.number})`);
          console.log(`        remoteJid: ${pc.remoteJid}`);
          console.log(`        Enviadas: ${pc.msgs_enviadas}, Sem confirmação: ${pc.msgs_sem_confirmacao}`);
        });
      }
      
      console.log(`\n   ${'='.repeat(50)}\n`);
    }
    
    // Resumo e recomendações
    console.log('=== RESUMO E RECOMENDAÇÕES ===\n');
    console.log('🔍 Indicadores de WhatsApp Business:');
    console.log('   - Alto percentual de contatos LID (>30%)');
    console.log('   - Mensagens enviadas sem confirmação de entrega');
    console.log('   - Taxa de sucesso baixa (<70%)\n');
    
    console.log('🔧 Possíveis soluções:');
    console.log('   1. Verificar se mapeamentos LID estão sendo criados corretamente');
    console.log('   2. Garantir que mensagens enviadas usem número real, não LID');
    console.log('   3. Monitorar logs de resolução LID em tempo real');
    console.log('   4. Forçar sincronização de contatos no WhatsApp Business\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Executar
const targetId = process.argv[2];
diagnoseBusinessVsNormal(targetId);
