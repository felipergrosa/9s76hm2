const { Sequelize } = require('sequelize');

async function main() {
  const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
    host: 'localhost',
    dialect: 'postgres',
    logging: false
  });

  try {
    // Buscar contato Ruy Miranda
    const [contacts] = await sequelize.query(`
      SELECT c.id, c.name, c.number
      FROM "Contacts" c
      WHERE c.name ILIKE '%Ruy%Miranda%' AND c."companyId" = 1
      LIMIT 5
    `);
    
    console.log('Contatos encontrados:');
    contacts.forEach(c => {
      console.log(`  ID: ${c.id} | Nome: ${c.name} | Número: ${c.number}`);
    });

    if (contacts.length === 0) {
      console.log('Nenhum contato encontrado com nome "Ruy Miranda"');
      return;
    }

    const contactId = contacts[0].id;
    console.log(`\nBuscando tickets do contato ${contactId}...`);

    // Buscar todos os tickets desse contato
    const [tickets] = await sequelize.query(`
      SELECT t.id, t."whatsappId", t.status, t."queueId", t."userId", t."createdAt", q.name as queue_name
      FROM "Tickets" t
      LEFT JOIN "Queues" q ON q.id = t."queueId"
      WHERE t."contactId" = ${contactId}
      ORDER BY t."createdAt" DESC
    `);
    
    console.log(`\nTickets encontrados (${tickets.length}):`);
    tickets.forEach(t => {
      console.log(`  Ticket ${t.id} | whatsappId: ${t.whatsappId} | Status: ${t.status} | Fila: ${t.queue_name || 'SEM FILA'} | User: ${t.userId || 'SEM USER'} | Criado: ${t.createdAt}`);
    });

    // Buscar mensagens
    const [messages] = await sequelize.query(`
      SELECT m.id, m."ticketId", m.body, m."createdAt"
      FROM "Messages" m
      WHERE m."ticketId" IN (SELECT id FROM "Tickets" WHERE "contactId" = ${contactId})
      ORDER BY m."createdAt" DESC
      LIMIT 20
    `);
    
    console.log(`\nMensagens encontradas (${messages.length}):`);
    const ticketIds = [...new Set(messages.map(m => m.ticketId))];
    console.log(`  ticketIds únicos nas mensagens: ${JSON.stringify(ticketIds)}`);
    
    messages.slice(0, 5).forEach(m => {
      console.log(`  Msg ${m.id} | ticketId: ${m.ticketId} | ${m.body?.substring(0, 40)}...`);
    });

  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await sequelize.close();
  }
}

main();
