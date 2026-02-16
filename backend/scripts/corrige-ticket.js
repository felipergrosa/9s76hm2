const { Sequelize, QueryTypes } = require("sequelize");
const config = require("../dist/config/database.js");

const sequelize = new Sequelize(config);

async function corrigirTicket() {
  try {
    console.log("Corrigindo status do ticket...");
    
    // Verificar ticket atual
    const ticket = await sequelize.query(`
      SELECT id, uuid, status, "contactId", "companyId" 
      FROM "Tickets" 
      WHERE id = 234
    `, { type: QueryTypes.SELECT });
    
    console.log("Ticket atual:", ticket[0]);
    
    // Atualizar para open
    await sequelize.query(`
      UPDATE "Tickets" 
      SET status = 'open',
          "updatedAt" = NOW()
      WHERE id = 234 AND "companyId" = 1
    `);
    console.log("✅ Ticket atualizado para status=open");
    
    // Verificar atualização
    const ticketAtualizado = await sequelize.query(`
      SELECT id, uuid, status, "contactId", "companyId" 
      FROM "Tickets" 
      WHERE id = 234
    `, { type: QueryTypes.SELECT });
    
    console.log("Ticket após correção:", ticketAtualizado[0]);
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await sequelize.close();
  }
}

corrigirTicket();
