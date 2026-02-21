const { Sequelize } = require('sequelize');

// Configuração do banco - ajuste conforme necessário
const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: 'localhost',
  dialect: 'postgres',
  logging: console.log
});

/**
 * Script para normalizar remoteJid de contatos
 */
async function normalizeRemoteJid(companyId = 1) {
  console.log(`🔧 Iniciando normalização de remoteJid para empresa ${companyId}`);
  
  try {
    // 1. Atualizar contatos com remoteJid NULL
    const update1 = await sequelize.query(`
      UPDATE "Contacts"
      SET "remoteJid" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        "number", 
        '(', ''), 
        ')', ''), 
        ' ', ''), 
        '-', ''), 
        '.', '') || '@s.whatsapp.net'
      WHERE "remoteJid" IS NULL 
        AND "number" IS NOT NULL 
        AND "number" NOT LIKE '%@lid%'
        AND "number" NOT LIKE 'PENDING_%'
        AND "number" NOT LIKE '%@g.us%'
        AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          "number", 
          '(', ''), 
          ')', ''), 
          ' ', ''), 
          '-', ''), 
          '.', '')) >= 10
        AND "companyId" = :companyId
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.UPDATE
    });

    console.log(`✅ Atualizados ${update1[1]} contatos com remoteJid NULL`);

    // 2. Corrigir contatos com formato incorreto
    const update2 = await sequelize.query(`
      UPDATE "Contacts"
      SET "remoteJid" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        "number", 
        '(', ''), 
        ')', ''), 
        ' ', ''), 
        '-', ''), 
        '.', '') || '@s.whatsapp.net'
      WHERE "remoteJid" IS NOT NULL 
        AND "remoteJid" NOT LIKE '%@s.whatsapp.net'
        AND "remoteJid" NOT LIKE '%@lid%'
        AND "remoteJid" NOT LIKE '%@g.us%'
        AND "number" IS NOT NULL
        AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          "number", 
          '(', ''), 
          ')', ''), 
          ' ', ''), 
          '-', ''), 
          '.', '')) >= 10
        AND "companyId" = :companyId
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.UPDATE
    });

    console.log(`✅ Corrigidos ${update2[1]} contatos com formato incorreto`);

    // 3. Preencher canonicalNumber se estiver NULL
    const update3 = await sequelize.query(`
      UPDATE "Contacts"
      SET "canonicalNumber" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        "number", 
        '(', ''), 
        ')', ''), 
        ' ', ''), 
        '-', ''), 
        '.', '')
      WHERE "canonicalNumber" IS NULL 
        AND "number" IS NOT NULL 
        AND "number" NOT LIKE '%@lid%'
        AND "number" NOT LIKE 'PENDING_%'
        AND "number" NOT LIKE '%@g.us%'
        AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          "number", 
          '(', ''), 
          ')', ''), 
          ' ', ''), 
          '-', ''), 
          '.', '')) >= 10
        AND "companyId" = :companyId
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.UPDATE
    });

    console.log(`✅ Preenchidos canonicalNumber em ${update3[1]} contatos`);

    // 4. Relatório final
    const [results] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_contatos,
        COUNT(CASE WHEN "remoteJid" IS NOT NULL THEN 1 END) as com_remoteJid,
        COUNT(CASE WHEN "remoteJid" IS NULL THEN 1 END) as remoteJid_null,
        COUNT(CASE WHEN "remoteJid" LIKE '%@s.whatsapp.net' THEN 1 END) as formato_correto,
        COUNT(CASE WHEN "remoteJid" LIKE '%@lid' THEN 1 END) as formato_lid
      FROM "Contacts"
      WHERE "companyId" = :companyId
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.SELECT
    });

    console.log(`\n📋 RELATÓRIO FINAL:`);
    console.log(`- Total contatos: ${results.total_contatos}`);
    console.log(`- Com remoteJid: ${results.com_remoteJid}`);
    console.log(`- remoteJid NULL: ${results.remoteJid_null}`);
    console.log(`- Formato correto (@s.whatsapp.net): ${results.formato_correto}`);
    console.log(`- Formato LID (@lid): ${results.formato_lid}`);

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await sequelize.close();
  }
}

// Executar script
if (require.main === module) {
  const companyId = process.argv[2] || 1;
  
  console.log(`🚀 Executando normalização para companyId: ${companyId}`);
  normalizeRemoteJid(parseInt(companyId))
    .then(() => {
      console.log("✅ Script concluído com sucesso");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erro fatal:", error);
      process.exit(1);
    });
}

module.exports = normalizeRemoteJid;
