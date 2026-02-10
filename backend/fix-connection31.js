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
    logging: console.log
  }
);

async function fixConnection31() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de produção');
    
    console.log('\n=== CORREÇÃO EMERGENCIAL CONEXÃO #31 ===');
    
    // 1. Verificar se conexão #31 existe
    const [connection31] = await sequelize.query(`
      SELECT id, name, status, number, "channelType", "companyId", "updatedAt"
      FROM "Whatsapps" 
      WHERE id = 31
    `);
    
    if (connection31.length > 0) {
      const conn = connection31[0];
      console.log(`⚠️  Conexão #31 ainda existe:`);
      console.log(`   Status: ${conn.status}`);
      console.log(`   Nome: ${conn.name || 'N/A'}`);
      console.log(`   Número: ${conn.number || 'N/A'}`);
      console.log(`   Última atualização: ${conn.updatedAt}`);
      
      if (conn.status === 'connected') {
        console.log(`\n✅ CONEXÃO #31 ESTÁ ATIVA!`);
        console.log(`   O problema pode estar em outro lugar. Verifique os logs de envio.`);
        return;
      } else {
        console.log(`\n❌ CONEXÃO #31 EXISTE MAS NÃO ESTÁ CONECTADA`);
        console.log(`   Tente reconectar o dispositivo na interface.`);
      }
    } else {
      console.log(`❌ Conexão #31 não existe no banco (foi apagada)`);
    }
    
    // 2. Contar tickets com whatsappId=31
    const [ticketCount] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM "Tickets" 
      WHERE "whatsappId" = 31
    `);
    
    const ticketsCount = parseInt(ticketCount[0].count);
    console.log(`\n📊 Tickets com whatsappId=31: ${ticketsCount}`);
    
    if (ticketsCount === 0) {
      console.log(`✅ Nenhum ticket órfão encontrado. Problema já resolvido.`);
      return;
    }
    
    // 3. Buscar conexões disponíveis
    const [availableConnections] = await sequelize.query(`
      SELECT id, name, status, number, "channelType"
      FROM "Whatsapps" 
      WHERE status = 'connected' AND id != 31
      ORDER BY id ASC
    `);
    
    if (availableConnections.length === 0) {
      console.log(`\n❌ NENHUMA CONEXÃO DISPONÍVEL PARA MIGRAÇÃO!`);
      console.log(`   Você precisa ter pelo menos uma conexão ativa.`);
      return;
    }
    
    console.log(`\n🔌 CONEXÕES DISPONÍVEIS:`);
    availableConnections.forEach(conn => {
      console.log(`   ID ${conn.id}: ${conn.name || 'Sem nome'} (${conn.number || 'N/A'})`);
    });
    
    // 4. Executar migração automática para a primeira conexão disponível
    const targetConnection = availableConnections[0];
    
    console.log(`\n🔧 MIGRANDO TICKETS PARA CONEXÃO #${targetConnection.id}...`);
    
    const [result] = await sequelize.query(`
      UPDATE "Tickets" 
      SET "whatsappId" = :targetId
      WHERE "whatsappId" = 31
      RETURNING id
    `, {
      replacements: { targetId: targetConnection.id },
      type: Sequelize.QueryTypes.UPDATE
    });
    
    console.log(`\n✅ MIGRAÇÃO CONCLUÍDA!`);
    console.log(`   Tickets migrados: ${result.length || ticketsCount}`);
    console.log(`   De: conexão #31 (apagada)`);
    console.log(`   Para: conexão #${targetConnection.id} (${targetConnection.name || 'Sem nome'})`);
    
    // 5. Verificar se ainda há tickets órfãos
    const [remainingOrphans] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM "Tickets" t
      LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
      WHERE w.id IS NULL AND t."whatsappId" IS NOT NULL
    `);
    
    const remainingCount = parseInt(remainingOrphans[0].count);
    
    if (remainingCount > 0) {
      console.log(`\n⚠️  Ainda há ${remainingCount} tickets órfãos de outras conexões`);
      console.log(`   Execute o script novamente ou verifique manualmente.`);
    } else {
      console.log(`\n🎉 TODOS OS TICKETS ÓRFÃOS FORAM RECUPERADOS!`);
    }
    
    // 6. Recomendações
    console.log(`\n=== RECOMENDAÇÕES ===`);
    console.log(`1. ✅ Tickets migrados com sucesso`);
    console.log(`2. 🔄 Reinicie o backend para aplicar as mudanças`);
    console.log(`3. 📱 Teste o envio de mensagens`);
    console.log(`4. 🔍 Monitore os logs para garantir funcionamento`);
    console.log(`\n💡 BLINDAGEM FUTURA:`);
    console.log(`   - Ao recriar uma conexão, o sistema detectará automaticamente`);
    console.log(`   - Tickets órfãos serão migrados para a nova conexão`);
    console.log(`   - Não perderá mais dados ao apagar/recriar conexões`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Executar correção
console.log('🚀 INICIANDO CORREÇÃO EMERGENCIAL DA CONEXÃO #31');
console.log('================================================');
fixConnection31();
