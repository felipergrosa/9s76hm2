const { Sequelize, QueryTypes } = require("sequelize");
const config = require("../dist/config/database.js");

const sequelize = new Sequelize(config);

async function consultarContato() {
  try {
    console.log("Buscando contato da Bruna...");
    
    // Buscar por número
    const porNumero = await sequelize.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "isGroup" 
      FROM "Contacts" 
      WHERE number LIKE '%991244679%' 
      ORDER BY "updatedAt" DESC
    `, { type: QueryTypes.SELECT });
    
    console.log("\n--- Por número (991244679) ---");
    console.log(porNumero);
    
    // Buscar por nome
    const porNome = await sequelize.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "isGroup" 
      FROM "Contacts" 
      WHERE name ILIKE '%Bruna%' AND "isGroup" = false
      ORDER BY "updatedAt" DESC
    `, { type: QueryTypes.SELECT });
    
    console.log("\n--- Por nome (Bruna) ---");
    console.log(porNome);
    
    // Buscar por LID
    const porLid = await sequelize.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "isGroup" 
      FROM "Contacts" 
      WHERE "lidJid" LIKE '%267439107498000%'
      ORDER BY "updatedAt" DESC
    `, { type: QueryTypes.SELECT });
    
    console.log("\n--- Por LID (267439107498000) ---");
    console.log(porLid);
    
    // Buscar LidMapping
    const mapping = await sequelize.query(`
      SELECT * FROM "LidMappings" 
      WHERE lid = '267439107498000@lid'
    `, { type: QueryTypes.SELECT });
    
    console.log("\n--- LidMapping ---");
    console.log(mapping);
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await sequelize.close();
  }
}

consultarContato();
