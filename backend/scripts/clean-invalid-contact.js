// Script para limpar contato inválido específico
require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "whaticket",
  process.env.DB_USER || "postgres", 
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    port: parseInt(process.env.DB_PORT || "5432"),
    logging: false
  }
);

async function cleanInvalidContact() {
  const contactId = 2502;
  
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de dados");

    // Verificar se contato tem mensagens
    console.log(`\n🔍 Verificando contato ${contactId}...`);
    
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM "Messages" 
      WHERE contactId = ${contactId}
    `);
    
    const messageCount = results[0].count;
    console.log(`📊 Contato ${contactId} tem ${messageCount} mensagens`);
    
    if (messageCount == 0) {
      console.log("🗑️  Excluindo contato inválido...");
      
      // Backup antes de excluir
      const [contactInfo] = await sequelize.query(`
        SELECT * FROM "Contacts" WHERE id = ${contactId}
      `);
      
      console.log("📋 Backup do contato:");
      console.log(JSON.stringify(contactInfo[0], null, 2));
      
      // Excluir contato
      await sequelize.query(`DELETE FROM "Contacts" WHERE id = ${contactId}`);
      console.log("✅ Contato inválido excluído com sucesso!");
    } else {
      console.log("⚠️  Contato tem mensagens - não excluído automaticamente");
      console.log("   Verifique manualmente se as mensagens são importantes");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await sequelize.close();
  }
}

cleanInvalidContact()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
