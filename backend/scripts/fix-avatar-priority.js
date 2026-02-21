const { Sequelize } = require('sequelize');

// Configuração do banco - ajuste conforme necessário
const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: 'localhost',
  dialect: 'postgres',
  logging: console.log
});

/**
 * Script para corrigir avatares que não estão sendo exibidos
 * Problema: Contatos com profilePicUrl mas urlPicture null
 * Solução: Forçar atualização do RefreshContactAvatarService
 */
async function fixAvatarPriority(companyId = 1) {
  console.log(`🔧 Iniciando correção de avatares para empresa ${companyId}`);
  
  try {
    // 1. Buscar contatos com profilePicUrl mas urlPicture null
    const [contacts] = await sequelize.query(`
      SELECT id, name, number, "profilePicUrl", "urlPicture"
      FROM "Contacts"
      WHERE "companyId" = :companyId
        AND "profilePicUrl" IS NOT NULL
        AND "profilePicUrl" NOT LIKE '%nopicture%'
        AND ("urlPicture" IS NULL OR "urlPicture" = '')
        AND "isGroup" = false
      ORDER BY id
      LIMIT 50
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Encontrados ${contacts.length} contatos com avatar para corrigir`);

    if (contacts.length === 0) {
      console.log('✅ Nenhum contato encontrado para correção');
      return;
    }

    // 2. Mostrar primeiros contatos
    console.log('\n📋 Exemplos de contatos encontrados:');
    contacts.slice(0, 5).forEach(contact => {
      console.log(`- ID: ${contact.id} | ${contact.name} | ${contact.profilePicUrl?.substring(0, 50)}...`);
    });

    // 3. Atualizar urlPicture para usar profilePicUrl diretamente
    const updateResult = await sequelize.query(`
      UPDATE "Contacts"
      SET "urlPicture" = "profilePicUrl"
      WHERE "companyId" = :companyId
        AND "profilePicUrl" IS NOT NULL
        AND "profilePicUrl" NOT LIKE '%nopicture%'
        AND ("urlPicture" IS NULL OR "urlPicture" = '')
        AND "isGroup" = false
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.UPDATE
    });

    console.log(`✅ Atualizados ${updateResult[1]} contatos`);

    // 4. Verificar resultado
    const [remaining] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "profilePicUrl" IS NOT NULL THEN 1 END) as com_profilePicUrl,
        COUNT(CASE WHEN "urlPicture" IS NOT NULL THEN 1 END) as com_urlPicture,
        COUNT(CASE WHEN "profilePicUrl" IS NOT NULL AND ("urlPicture" IS NULL OR "urlPicture" = '') THEN 1 END) as precisam_corrigir
      FROM "Contacts"
      WHERE "companyId" = :companyId
        AND "isGroup" = false
    `, {
      replacements: { companyId },
      type: Sequelize.QueryTypes.SELECT
    });

    console.log('\n📋 RESULTADO FINAL:');
    console.log(`- Total contatos: ${remaining.total}`);
    console.log(`- Com profilePicUrl: ${remaining.com_profilePicUrl}`);
    console.log(`- Com urlPicture: ${remaining.com_urlPicture}`);
    console.log(`- Precisam corrigir: ${remaining.precisam_corrigir}`);

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await sequelize.close();
  }
}

// Executar script
if (require.main === module) {
  const companyId = process.argv[2] || 1;
  
  console.log(`🚀 Executando correção de avatares para companyId: ${companyId}`);
  fixAvatarPriority(parseInt(companyId))
    .then(() => {
      console.log("✅ Script concluído com sucesso");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erro fatal:", error);
      process.exit(1);
    });
}

module.exports = fixAvatarPriority;
