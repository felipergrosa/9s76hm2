/**
 * Script para corrigir contatos que foram criados com dígitos de LID como número de telefone
 * ou com nome no campo number.
 * 
 * Problemas encontrados:
 * 1. Contatos com dígitos do LID (10-13 chars) usados como número (ex: "2809646841981")
 * 2. Contatos com nome no campo number (ex: "Maiza Brucieri Rosa")
 * 3. Contatos com remoteJid errado (@s.whatsapp.net ao invés de @lid)
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'whaticket'
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Buscar contatos com lidJid preenchido E number que parece ser dígitos do LID
    const lidContacts = await client.query(`
      SELECT c.id, c.name, c.number, c."remoteJid", c."lidJid", c."canonicalNumber",
             c."companyId",
             (SELECT COUNT(*) FROM "Tickets" t WHERE t."contactId" = c.id) as ticket_count,
             (SELECT COUNT(*) FROM "Messages" m 
              JOIN "Tickets" t2 ON m."ticketId" = t2.id 
              WHERE t2."contactId" = c.id) as msg_count
      FROM "Contacts" c
      WHERE c."isGroup" = false
        AND c."lidJid" IS NOT NULL
        AND c."lidJid" != ''
      ORDER BY c.id DESC
    `);

    console.log(`\n=== CONTATOS COM LID (${lidContacts.rows.length}) ===\n`);

    let fixCount = 0;

    for (const c of lidContacts.rows) {
      const lidDigits = (c.lidJid || '').replace(/\D/g, '');
      const numberDigits = (c.number || '').replace(/\D/g, '');
      const hasLettersInNumber = /[a-zA-ZÀ-ÿ]/.test(c.number || '');
      
      // Detectar problemas
      const isLidAsNumber = numberDigits === lidDigits && lidDigits.length > 0;
      const isNameAsNumber = hasLettersInNumber && !c.number?.startsWith('PENDING_');
      const hasWrongRemoteJid = c.remoteJid && c.remoteJid.includes('@s.whatsapp.net') && 
                                 c.remoteJid.replace(/\D/g, '') === lidDigits;

      if (!isLidAsNumber && !isNameAsNumber && !hasWrongRemoteJid) {
        // Contato OK
        continue;
      }

      console.log(`--- Contato ID ${c.id} (${c.ticket_count} tickets, ${c.msg_count} msgs) ---`);
      console.log(`  Name:      ${c.name}`);
      console.log(`  Number:    ${c.number}`);
      console.log(`  RemoteJid: ${c.remoteJid}`);
      console.log(`  LidJid:    ${c.lidJid}`);
      
      if (isLidAsNumber) console.log(`  ❌ PROBLEMA: Dígitos do LID usados como número`);
      if (isNameAsNumber) console.log(`  ❌ PROBLEMA: Nome no campo number`);
      if (hasWrongRemoteJid) console.log(`  ❌ PROBLEMA: remoteJid com @s.whatsapp.net mas é LID`);

      // Buscar se existe LidMapping para resolver
      const mapping = await client.query(
        `SELECT "phoneNumber" FROM "LidMappings" WHERE lid = $1 LIMIT 1`,
        [c.lidJid]
      );

      if (mapping.rows.length > 0 && mapping.rows[0].phoneNumber) {
        const realNumber = mapping.rows[0].phoneNumber;
        console.log(`  ✅ CORREÇÃO: LidMapping encontrado → ${realNumber}`);

        // Verificar se já existe contato com esse número real
        const existing = await client.query(
          `SELECT id, name FROM "Contacts" WHERE "companyId" = $1 AND "isGroup" = false 
           AND (number = $2 OR "canonicalNumber" = $2) AND id != $3 LIMIT 1`,
          [c.companyId, realNumber, c.id]
        );

        if (existing.rows.length > 0) {
          console.log(`  ⚠️  Contato real já existe (ID ${existing.rows[0].id} "${existing.rows[0].name}") - necessário merge manual`);
        } else {
          // Atualizar contato com número real
          await client.query(`
            UPDATE "Contacts" 
            SET number = $1, 
                "canonicalNumber" = $1,
                "remoteJid" = $2,
                "updatedAt" = NOW()
            WHERE id = $3
          `, [realNumber, `${realNumber}@s.whatsapp.net`, c.id]);
          console.log(`  ✅ CORRIGIDO: number=${realNumber}, remoteJid=${realNumber}@s.whatsapp.net`);
          fixCount++;
        }
      } else {
        // Sem LidMapping - converter para PENDING_
        const pendingNumber = `PENDING_${c.lidJid}`;
        console.log(`  ⚠️  Sem LidMapping - convertendo para PENDING_`);
        
        await client.query(`
          UPDATE "Contacts"
          SET number = $1,
              "canonicalNumber" = NULL,
              "remoteJid" = $2,
              "updatedAt" = NOW()
          WHERE id = $3
        `, [pendingNumber, c.lidJid, c.id]);
        console.log(`  ✅ CORRIGIDO: number=${pendingNumber}, remoteJid=${c.lidJid}`);
        fixCount++;
      }
      console.log('');
    }

    console.log(`\n=== RESUMO: ${fixCount} contatos corrigidos ===`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
