// Script para resetar e verificar campanha 20
const { Sequelize } = require('sequelize');

// Carregar variáveis de ambiente
require('dotenv').config();

const seq = new Sequelize(
  process.env.DB_NAME || 'whaticket',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false
  }
);

(async () => {
  try {
    const action = process.argv[2] || 'check';
    
    if (action === 'reset') {
      // Resetar campanha para PROGRAMADA e limpar shippings
      console.log('=== RESETANDO CAMPANHA 20 ===');
      
      // Atualizar campanha para PROGRAMADA com scheduledAt no futuro próximo
      const newScheduledAt = new Date(Date.now() + 60000); // 1 minuto no futuro
      await seq.query(
        `UPDATE "Campaigns" SET status = 'PROGRAMADA', "scheduledAt" = '${newScheduledAt.toISOString()}' WHERE id = 20`
      );
      console.log('Campanha atualizada para PROGRAMADA');
      
      // Limpar shippings para reprocessar
      await seq.query(
        `DELETE FROM "CampaignShipping" WHERE "campaignId" = 20`
      );
      console.log('Shippings removidos para reprocessamento');
      
      console.log('\nCampanha resetada! Aguarde 1 minuto para o processamento automático.');
    }
    
    // Verificar campanha
    const [campaigns] = await seq.query(
      'SELECT id, name, status, "scheduledAt", "whatsappId", "contactListId" FROM "Campaigns" WHERE id = 20'
    );
    console.log('\n=== CAMPANHA ===');
    console.log(JSON.stringify(campaigns, null, 2));

    // Verificar shippings
    const [shippings] = await seq.query(
      'SELECT id, status, "jobId", "deliveredAt", "lastError", attempts FROM "CampaignShipping" WHERE "campaignId" = 20 LIMIT 10'
    );
    console.log('\n=== SHIPPINGS ===');
    console.log(JSON.stringify(shippings, null, 2));

    // Verificar total de contatos na lista
    if (campaigns.length > 0) {
      const contactListId = campaigns[0].contactListId;
      const [contactCount] = await seq.query(
        `SELECT COUNT(*) as total FROM "ContactListItems" WHERE "contactListId" = ${contactListId}`
      );
      console.log('\n=== TOTAL CONTATOS NA LISTA ===');
      console.log(contactCount);
    }

    // Verificar status do WhatsApp
    if (campaigns.length > 0) {
      const whatsappId = campaigns[0].whatsappId;
      const [whatsapp] = await seq.query(
        `SELECT id, name, status, "channelType" FROM "Whatsapps" WHERE id = ${whatsappId}`
      );
      console.log('\n=== WHATSAPP ===');
      console.log(JSON.stringify(whatsapp, null, 2));
    }

  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await seq.close();
  }
})();
