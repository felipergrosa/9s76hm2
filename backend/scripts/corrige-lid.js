const { Sequelize, QueryTypes } = require("sequelize");
const config = require("../dist/config/database.js");

const sequelize = new Sequelize(config);

async function corrigirLid() {
  try {
    console.log("Corrigindo associação LID→PN...");
    
    // 1. Remover LID do contato duplicado
    await sequelize.query(`
      UPDATE "Contacts" 
      SET "lidJid" = NULL 
      WHERE id = 2502 AND "companyId" = 1
    `);
    console.log("✅ LID removido do contato duplicado");
    
    // 2. Atualizar contato REAL com o LID
    await sequelize.query(`
      UPDATE "Contacts" 
      SET "lidJid" = '267439107498000@lid' 
      WHERE id = 2247 AND "companyId" = 1
    `);
    console.log("✅ Contato real atualizado com LID");
    
    // 3. Criar LidMapping
    await sequelize.query(`
      INSERT INTO "LidMappings" ("lid", "phoneNumber", "companyId", "whatsappId", "verified", "createdAt", "updatedAt")
      VALUES ('267439107498000@lid', '5519991244679', 1, 13, true, NOW(), NOW())
      ON CONFLICT ("lid", "companyId") DO UPDATE SET
        "phoneNumber" = EXCLUDED."phoneNumber",
        "verified" = true,
        "updatedAt" = NOW()
    `);
    console.log("✅ LidMapping criado");
    
    // 4. Soft delete do contato LID duplicado
    await sequelize.query(`
      UPDATE "Contacts" 
      SET name = '[DUPLICADO] Bruna Zanóbio Nobre Luminárias' 
      WHERE id = 2502 AND "companyId" = 1
    `);
    console.log("✅ Contato duplicado marcado");
    
    // 5. Verificar
    const contato = await sequelize.query(`
      SELECT id, name, number, "remoteJid", "lidJid" 
      FROM "Contacts" 
      WHERE id = 2247
    `, { type: QueryTypes.SELECT });
    
    console.log("\nContato corrigido:", contato[0]);
    
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await sequelize.close();
  }
}

corrigirLid();
