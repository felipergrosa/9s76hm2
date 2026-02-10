const { Sequelize, DataTypes } = require('sequelize');

// Configuração do banco (mesma do app)
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

// Modelo Whatsapp (simplificado)
const Whatsapp = sequelize.define('Whatsapp', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING },
  number: { type: DataTypes.STRING },
  channelType: { type: DataTypes.STRING, defaultValue: 'baileys' },
  companyId: { type: DataTypes.INTEGER },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
}, {
  tableName: 'Whatsapps',
  timestamps: true
});

async function checkConnections() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco PostgreSQL');
    
    // Verificar todas as conexões, inclusive as que possam ter IDs específicos
    const [allConnections] = await sequelize.query(`
      SELECT id, name, status, number, "channelType", "isDefault", "companyId", "updatedAt"
      FROM "Whatsapps" 
      ORDER BY id ASC
    `);
    
    console.log('\n=== TODAS AS CONEXÕES WHATSAPP ===');
    if (allConnections.length === 0) {
      console.log('❌ Nenhuma conexão encontrada no banco');
    } else {
      allConnections.forEach(conn => {
        const statusIcon = conn.status === 'connected' ? '🟢' : 
                          conn.status === 'connecting' ? '🟡' : 
                          conn.status === 'disconnected' ? '🔴' : '⚪';
        
        const defaultIcon = conn.isDefault ? ' ⭐' : '';
        
        console.log(`${statusIcon} ID: ${conn.id}${defaultIcon} (Empresa: ${conn.companyId})`);
        console.log(`   Nome: ${conn.name || 'Sem nome'}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Número: ${conn.number || 'Não configurado'}`);
        console.log(`   Canal: ${conn.channelType}`);
        console.log(`   Última atualização: ${conn.updatedAt}`);
        console.log('');
      });
    }
    
    // Verificar especificamente pelas conexões #26 e #31 mencionadas
    const [specificConnections] = await sequelize.query(`
      SELECT id, name, status, number, "channelType", "isDefault", "companyId", "updatedAt"
      FROM "Whatsapps" 
      WHERE id IN (26, 31)
      ORDER BY id ASC
    `);
    
    console.log('\n=== CONEXÕES #26 e #31 (MENCIONADAS NO LOG) ===');
    if (specificConnections.length === 0) {
      console.log('❌ Conexões #26 e #31 não encontradas no banco!');
    } else {
      specificConnections.forEach(conn => {
        const statusIcon = conn.status === 'connected' ? '🟢' : 
                          conn.status === 'connecting' ? '🟡' : 
                          conn.status === 'disconnected' ? '🔴' : '⚪';
        
        const defaultIcon = conn.isDefault ? ' ⭐' : '';
        
        console.log(`${statusIcon} ID: ${conn.id}${defaultIcon} (Empresa: ${conn.companyId})`);
        console.log(`   Nome: ${conn.name || 'Sem nome'}`);
        console.log(`   Status: ${conn.status}`);
        console.log(`   Número: ${conn.number || 'Não configurado'}`);
        console.log(`   Canal: ${conn.channelType}`);
        console.log(`   Última atualização: ${conn.updatedAt}`);
        console.log('');
      });
    }
    
    // Verificar tickets recentes por whatsappId
    const [ticketStats] = await sequelize.query(`
      SELECT 
        t."whatsappId",
        COUNT(t.id) as tickets_count,
        MAX(t."updatedAt") as last_ticket_activity,
        MAX(CASE WHEN t."updatedAt" > NOW() - INTERVAL '1 hour' THEN t.id END) as recent_tickets
      FROM "Tickets" t
      WHERE t."whatsappId" IS NOT NULL
      GROUP BY t."whatsappId"
      ORDER BY t."whatsappId"
    `);
    
    console.log('\n=== ESTATÍSTICAS DE TICKETS POR WHATSAPP ===');
    ticketStats.forEach(stat => {
      console.log(`WhatsApp ID: ${stat.whatsappId}`);
      console.log(`   Total de tickets: ${stat.tickets_count}`);
      console.log(`   Última atividade: ${stat.last_ticket_activity}`);
      console.log(`   Tickets recentes (1h): ${stat.recent_tickets ? 'Sim' : 'Não'}`);
      console.log('');
    });
    
    // Verificar tickets específicos mencionados nos logs
    const [specificTickets] = await sequelize.query(`
      SELECT t.id, t.uuid, t."whatsappId", t.status, t."lastMessage", t."updatedAt",
             c.name as contact_name, c.number as contact_number
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON t."contactId" = c.id
      WHERE t.id IN (3656, 4285) OR t."whatsappId" = 31
      ORDER BY t.id
    `);
    
    console.log('\n=== TICKETS ESPECÍFICOS DOS LOGS ===');
    if (specificTickets.length === 0) {
      console.log('❌ Tickets 3656, 4285 ou com whatsappId=31 não encontrados');
    } else {
      specificTickets.forEach(ticket => {
        console.log(`🎫 Ticket ID: ${ticket.id} (UUID: ${ticket.uuid})`);
        console.log(`   WhatsApp ID: ${ticket.whatsappId} ⚠️`);
        console.log(`   Status: ${ticket.status}`);
        console.log(`   Contato: ${ticket.contact_name || 'N/A'} (${ticket.contact_number || 'N/A'})`);
        console.log(`   Última mensagem: ${ticket.lastMessage || 'N/A'}`);
        console.log(`   Última atualização: ${ticket.updatedAt}`);
        console.log('');
      });
    }
    
    // Buscar pelos UUIDs mencionados nos logs
    const [uuidTickets] = await sequelize.query(`
      SELECT t.id, t.uuid, t."whatsappId", t.status, t."lastMessage", t."updatedAt",
             c.name as contact_name, c.number as contact_number
      FROM "Tickets" t
      LEFT JOIN "Contacts" c ON t."contactId" = c.id
      WHERE t.uuid IN ('bfdb079e-3cef-4e56-9b67-4c179b91d4d2', 'd27b110a-cbdd-46b8-a7df-866f4db0bcb3')
      ORDER BY t.id
    `);
    
    console.log('\n=== TICKETS PELOS UUIDs DOS LOGS ===');
    if (uuidTickets.length === 0) {
      console.log('❌ Tickets com esses UUIDs não encontrados');
    } else {
      uuidTickets.forEach(ticket => {
        console.log(`🎫 Ticket ID: ${ticket.id} (UUID: ${ticket.uuid})`);
        console.log(`   WhatsApp ID: ${ticket.whatsappId} ⚠️`);
        console.log(`   Status: ${ticket.status}`);
        console.log(`   Contato: ${ticket.contact_name || 'N/A'} (${ticket.contact_number || 'N/A'})`);
        console.log(`   Última mensagem: ${ticket.lastMessage || 'N/A'}`);
        console.log(`   Última atualização: ${ticket.updatedAt}`);
        console.log('');
      });
    }
    
    // Verificar todos os tickets com whatsappId inválido
    const [orphanTickets] = await sequelize.query(`
      SELECT 
        t."whatsappId",
        COUNT(t.id) as orphan_count,
        MAX(t.id) as sample_ticket_id
      FROM "Tickets" t
      LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
      WHERE w.id IS NULL
      GROUP BY t."whatsappId"
      ORDER BY t."whatsappId"
    `);
    
    console.log('\n=== TICKETS ÓRFÃOS (WHATSAPP ID INVÁLIDO) ===');
    if (orphanTickets.length === 0) {
      console.log('✅ Nenhum ticket órfão encontrado');
    } else {
      orphanTickets.forEach(orphan => {
        console.log(`⚠️  WhatsApp ID: ${orphan.whatsappId}`);
        console.log(`   Tickets órfãos: ${orphan.orphan_count}`);
        console.log(`   Exemplo ticket ID: ${orphan.sample_ticket_id}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkConnections();
