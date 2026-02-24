const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whaticket',
  password: process.env.DB_PASS || 'whaticket',
  database: process.env.DB_NAME || 'whaticket_dev',
});

// Importar função para obter wbot
const { getWbot } = require('../dist/libs/wbot');

async function resolveLidNumbers() {
  const client = await pool.connect();
  
  try {
    // Buscar contatos com @lid e number inválido (não numérico)
    const contacts = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid", "companyId", "whatsappId"
      FROM "Contacts"
      WHERE ("remoteJid" LIKE '%@lid%' OR "lidJid" IS NOT NULL)
        AND (number IS NULL OR number = '' OR number ~ '[^0-9]')
        AND "isGroup" = false
      LIMIT 10;
    `);
    
    console.log(`=== CONTATOS COM NUMBER INVÁLIDO: ${contacts.rows.length} ===\n`);
    
    for (const contact of contacts.rows) {
      const lid = contact.lidJid || contact.remoteJid;
      console.log(`[${contact.id}] ${contact.name}`);
      console.log(`    LID: ${lid}`);
      console.log(`    Number atual: ${contact.number}`);
      
      try {
        // Tentar obter o wbot para este contato
        const wbot = contact.whatsappId ? getWbot(contact.whatsappId) : null;
        
        if (wbot && lid) {
          const sock = wbot;
          const lidNumber = lid.replace('@lid', '');
          
          // Tentar resolver via signalRepository.lidMapping
          const lidStore = sock.signalRepository?.lidMapping;
          if (lidStore?.getPNForLID) {
            const resolvedPN = await lidStore.getPNForLID(lidNumber);
            if (resolvedPN) {
              const pnDigits = resolvedPN.replace(/\D/g, '');
              console.log(`    ✓ Resolvido via Baileys: ${pnDigits}`);
              
              // Atualizar contato
              await client.query(`
                UPDATE "Contacts" 
                SET number = $1, "updatedAt" = NOW()
                WHERE id = $2
              `, [pnDigits, contact.id]);
              
              // Inserir/Atualizar LidMapping
              await client.query(`
                INSERT INTO "LidMappings" (lid, "phoneNumber", "companyId", "whatsappId", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (lid) DO UPDATE SET
                  "phoneNumber" = EXCLUDED."phoneNumber",
                  "updatedAt" = NOW()
              `, [lid, pnDigits, contact.companyId, contact.whatsappId]);
              
              console.log(`    ✓ Contato atualizado!`);
              continue;
            }
          }
          
          // Tentar via authState.keys
          const authKeys = sock.authState?.keys;
          if (authKeys?.get) {
            const data = await authKeys.get('lid-mapping', [lidNumber]);
            const raw = data?.[lidNumber];
            if (raw) {
              const jidStr = typeof raw === 'string' ? raw : String(raw?.jid || raw?.pnJid || raw?.pn || '');
              if (jidStr) {
                const pnDigits = jidStr.replace(/\D/g, '');
                console.log(`    ✓ Resolvido via authState.keys: ${pnDigits}`);
                
                await client.query(`
                  UPDATE "Contacts" 
                  SET number = $1, "updatedAt" = NOW()
                  WHERE id = $2
                `, [pnDigits, contact.id]);
                
                await client.query(`
                  INSERT INTO "LidMappings" (lid, "phoneNumber", "companyId", "whatsappId", "createdAt", "updatedAt")
                  VALUES ($1, $2, $3, $4, NOW(), NOW())
                  ON CONFLICT (lid) DO UPDATE SET
                    "phoneNumber" = EXCLUDED."phoneNumber",
                    "updatedAt" = NOW()
                `, [lid, pnDigits, contact.companyId, contact.whatsappId]);
                
                console.log(`    ✓ Contato atualizado!`);
                continue;
              }
            }
          }
          
          console.log(`    ✗ Não foi possível resolver via Baileys`);
        } else {
          console.log(`    ✗ Wbot não disponível para whatsappId=${contact.whatsappId}`);
        }
      } catch (err) {
        console.log(`    ✗ Erro: ${err.message}`);
      }
      
      console.log('');
    }
    
    console.log('\n=== RESUMO ===');
    const updated = await client.query(`
      SELECT id, name, number, "remoteJid", "lidJid"
      FROM "Contacts"
      WHERE id IN (6215, 6220);
    `);
    
    updated.rows.forEach(c => {
      console.log(`[${c.id}] ${c.name}: number=${c.number}`);
    });
    
  } catch (err) {
    console.error('Erro geral:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resolveLidNumbers();
