const { Sequelize } = require('sequelize');

// Configuração do banco de produção
const sequelize = new Sequelize(
  process.env.DB_NAME || 'whaticket',
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASS || 'efe487b6a861100fb704ad9f5c160cb8',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

async function fixOrphanTickets() {
  try {
    await sequelize.authenticate();
    console.log('Conectado ao banco\n');
    
    // 1. Mostrar conexão #31 (a nova, com número 5519991244679)
    const [conn31] = await sequelize.query(`
      SELECT id, name, status, number, "companyId"
      FROM "Whatsapps" WHERE id = 31
    `);
    
    if (conn31.length === 0) {
      console.log('Conexao #31 nao encontrada!');
      return;
    }
    
    console.log('=== CONEXAO #31 (NOVA) ===');
    console.log(`  Nome: ${conn31[0].name}`);
    console.log(`  Numero: ${conn31[0].number}`);
    console.log(`  Status: ${conn31[0].status}`);
    console.log(`  Empresa: ${conn31[0].companyId}`);
    
    // 2. Listar TODAS as conexoes da empresa
    const [allConns] = await sequelize.query(`
      SELECT id, name, status, number
      FROM "Whatsapps" 
      WHERE "companyId" = :companyId
      ORDER BY id
    `, { replacements: { companyId: conn31[0].companyId } });
    
    console.log('\n=== TODAS AS CONEXOES ===');
    allConns.forEach(c => {
      console.log(`  #${c.id}: ${c.name || 'N/A'} | ${c.number || 'sem numero'} | ${c.status}`);
    });
    
    // 3. Encontrar tickets orfaos (whatsappId aponta para conexao que NAO existe)
    const [orphans] = await sequelize.query(`
      SELECT t."whatsappId", COUNT(*) as total,
             MAX(t."updatedAt") as ultimo_update,
             MIN(t."createdAt") as primeiro_criado
      FROM "Tickets" t
      LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
      WHERE w.id IS NULL 
        AND t."whatsappId" IS NOT NULL
        AND t."companyId" = :companyId
      GROUP BY t."whatsappId"
      ORDER BY total DESC
    `, { replacements: { companyId: conn31[0].companyId } });
    
    if (orphans.length === 0) {
      console.log('\nNenhum ticket orfao encontrado!');
      
      // Verificar se ha tickets na #31
      const [t31] = await sequelize.query(`
        SELECT COUNT(*) as total FROM "Tickets" WHERE "whatsappId" = 31
      `);
      console.log(`Tickets na conexao #31: ${t31[0].total}`);
      console.log('\nSe mensagens nao estao chegando, o problema nao e de tickets orfaos.');
      return;
    }
    
    console.log('\n=== TICKETS ORFAOS (conexao apagada) ===');
    orphans.forEach(o => {
      console.log(`  whatsappId=#${o.whatsappId}: ${o.total} tickets (ultimo: ${o.ultimo_update})`);
    });
    
    const totalOrfaos = orphans.reduce((sum, o) => sum + parseInt(o.total), 0);
    console.log(`\n  TOTAL ORFAOS: ${totalOrfaos} tickets`);
    
    // 4. Migrar todos os orfaos para conexao #31
    console.log(`\n=== MIGRANDO ORFAOS PARA CONEXAO #31 ===`);
    
    let totalMigrados = 0;
    for (const orphan of orphans) {
      const [, rowCount] = await sequelize.query(`
        UPDATE "Tickets" 
        SET "whatsappId" = 31
        WHERE "whatsappId" = :oldId
          AND "companyId" = :companyId
      `, { 
        replacements: { oldId: orphan.whatsappId, companyId: conn31[0].companyId }
      });
      
      const migrados = rowCount?.rowCount || parseInt(orphan.total);
      totalMigrados += migrados;
      console.log(`  #${orphan.whatsappId} -> #31: ${migrados} tickets migrados`);
    }
    
    console.log(`\n  TOTAL MIGRADOS: ${totalMigrados} tickets`);
    
    // 5. Verificacao final
    const [check] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM "Tickets" t
      LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
      WHERE w.id IS NULL AND t."whatsappId" IS NOT NULL
        AND t."companyId" = :companyId
    `, { replacements: { companyId: conn31[0].companyId } });
    
    const remaining = parseInt(check[0].total);
    if (remaining === 0) {
      console.log('\nTodos os tickets orfaos foram migrados!');
    } else {
      console.log(`\nAinda restam ${remaining} tickets orfaos.`);
    }
    
    console.log('\nProximo passo: reinicie o backend para aplicar.');
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

console.log('=== DIAGNOSTICO E CORRECAO DE TICKETS ORFAOS ===\n');
fixOrphanTickets();
