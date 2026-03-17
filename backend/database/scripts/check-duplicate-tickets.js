// Script para verificar tickets duplicados
// Rodar de dentro da pasta backend: node database/scripts/check-duplicate-tickets.js

const path = require('path');

// Ajustar caminho do require
const dbPath = path.join(__dirname, '..', '..', 'src', 'database');
const { sequelize } = require(dbPath);

(async () => {
  try {
    // Verificar duplicados
    const [results] = await sequelize.query(`
      SELECT 
        "contactId",
        "whatsappId",
        "companyId",
        COUNT(*) as total_tickets,
        array_agg(id ORDER BY id DESC) as ticket_ids,
        array_agg(status ORDER BY id DESC) as statuses
      FROM "Tickets"
      WHERE "contactId" IS NOT NULL 
        AND "whatsappId" IS NOT NULL
        AND "isGroup" = false
      GROUP BY "contactId", "whatsappId", "companyId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);
    
    console.log('=== DUPLICADOS ENCONTRADOS ===');
    console.log(JSON.stringify(results, null, 2));
    console.log(`\nTotal de grupos duplicados: ${results.length}`);
    
    // Contar total de tickets a serem removidos
    let totalToRemove = 0;
    results.forEach(r => {
      totalToRemove += r.total_tickets - 1;
    });
    console.log(`Total de tickets duplicados a remover: ${totalToRemove}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
})();
