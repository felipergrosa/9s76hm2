const { QueryTypes } = require('sequelize');
const { initDb } = require('./backend/dist/database');

async function diagnosticar() {
  const sequelize = await initDb();
  
  console.log('\n=== DIAGNÓSTICO: Grupos Falsos ===\n');
  
  // Identificar contatos com isGroup=true mas number não termina em @g.us
  const gruposFalsos = await sequelize.query(`
    SELECT 
        id,
        name,
        number,
        "remoteJid",
        "whatsappId",
        "isGroup",
        "createdAt",
        CASE 
            WHEN number LIKE '%@g.us' THEN '✓ Grupo válido'
            WHEN number ~ '^[0-9]+$' THEN '✗ Número individual (sem @)'
            WHEN number ~ '^55[0-9]+$' THEN '✗ Telefone brasileiro'
            ELSE '? Formato desconhecido'
        END as status
    FROM "Contacts"
    WHERE "companyId" = 1
      AND "isGroup" = true
      AND number NOT LIKE '%@g.us'
    ORDER BY name, "createdAt" DESC
    LIMIT 20
  `, { type: QueryTypes.SELECT });
  
  console.log('Grupos Falsos encontrados:', gruposFalsos.length);
  console.table(gruposFalsos);
  
  // Contar
  const [totais] = await sequelize.query(`
    SELECT 
        COUNT(*) as total_grupos_falsos,
        COUNT(DISTINCT name) as nomes_unicos
    FROM "Contacts"
    WHERE "companyId" = 1
      AND "isGroup" = true
      AND number NOT LIKE '%@g.us'
  `, { type: QueryTypes.SELECT });
  
  console.log('\nTotais:', totais);
  
  // Ver grupos duplicados pelo remoteJid
  const duplicados = await sequelize.query(`
    SELECT 
        "remoteJid",
        COUNT(*) as total,
        STRING_AGG(id::text, ', ') as ids,
        STRING_AGG(name, ' | ') as nomes,
        STRING_AGG("whatsappId"::text, ', ') as whatsapp_ids
    FROM "Contacts"
    WHERE "companyId" = 1
      AND "isGroup" = true
      AND "remoteJid" IS NOT NULL
      AND "remoteJid" LIKE '%@g.us'
    GROUP BY "remoteJid"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `, { type: QueryTypes.SELECT });
  
  console.log('\n=== Grupos Duplicados (mesmo remoteJid) ===');
  console.log('Total:', duplicados.length);
  console.table(duplicados);
  
  await sequelize.close();
}

diagnosticar().catch(console.error);
