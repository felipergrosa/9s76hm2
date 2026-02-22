const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DB_HOST 
    ? `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
    : 'postgresql://postgres:postgres@localhost:5432/whaticket'
});

(async () => {
  try {
    await client.connect();
    
    // 1. Verificar configuração LGPD
    const settings = await client.query(`
      SELECT key, value FROM "Settings" 
      WHERE key LIKE '%LGPD%' OR key LIKE '%lgpd%'
    `);
    console.log('\n=== CONFIGURAÇÕES LGPD ===');
    console.log(JSON.stringify(settings.rows, null, 2));

    // 2. Contar tickets por status
    const statusCount = await client.query(`
      SELECT status, COUNT(*) as total FROM "Tickets" GROUP BY status ORDER BY total DESC
    `);
    console.log('\n=== TICKETS POR STATUS ===');
    console.log(JSON.stringify(statusCount.rows, null, 2));

    // 3. Ver tickets LGPD
    const lgpdTickets = await client.query(`
      SELECT t.id, t.status, t."contactId", c.name, c.number, c."lgpdAcceptedAt"
      FROM "Tickets" t
      JOIN "Contacts" c ON c.id = t."contactId"
      WHERE t.status = 'lgpd'
      LIMIT 10
    `);
    console.log('\n=== TICKETS LGPD (primeiros 10) ===');
    console.log(JSON.stringify(lgpdTickets.rows, null, 2));

    // 4. Se LGPD está desabilitado, corrigir todos tickets
    const enableLGPD = settings.rows.find(s => s.key === 'enableLGPD');
    if (enableLGPD?.value === 'disabled') {
      console.log('\n=== LGPD DESABILITADO - Corrigindo todos tickets ===');
      
      // Aceitar termos para todos contatos
      const contactsResult = await client.query(`
        UPDATE "Contacts" SET "lgpdAcceptedAt" = NOW() WHERE "lgpdAcceptedAt" IS NULL
      `);
      console.log(`✅ Contatos atualizados: ${contactsResult.rowCount}`);

      // Mudar status de todos tickets LGPD para open
      const ticketsResult = await client.query(`
        UPDATE "Tickets" SET status = 'open' WHERE status = 'lgpd'
      `);
      console.log(`✅ Tickets corrigidos: ${ticketsResult.rowCount}`);
      
      console.log('\n=== CORRIGIDO! Reinicie o backend e verifique o frontend ===');
    } else {
      console.log('\n=== LGPD HABILITADO - Tickets LGPD são normais ===');
      console.log('Para desabilitar, vá em Configurações > LGPD no Whaticket');
    }

    await client.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await client.end();
  }
})();
