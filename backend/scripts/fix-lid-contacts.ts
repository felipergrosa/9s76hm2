import { sequelize } from "../dist/config/database";
import Contact from "../dist/models/Contact";
import LidMapping from "../dist/models/LidMapping";
import logger from "../dist/utils/logger";
import { safeNormalizePhoneNumber } from "../dist/utils/phone";

/**
 * Script para corrigir contatos criados com remoteJid @lid
 * 
 * Problema:
 * - Contatos criados com remoteJid = "xxx@lid" em vez de "xxx@s.whatsapp.net"
 * - Números salvos são LIDs em vez de telefones reais
 * 
 * Solução:
 * 1. Identificar contatos com remoteJid @lid
 * 2. Tentar encontrar contato similar pelo número
 * 3. Mesclar contatos se encontrado
 * 4. Corrigir remoteJid se possível
 */

async function fixLidContacts(companyId: number) {
  console.log(`🔧 Iniciando correção de contatos LID para empresa ${companyId}`);
  
  try {
    // 1. Buscar todos os contatos com remoteJid @lid
    const lidContacts = await Contact.findAll({
      where: {
        companyId,
        remoteJid: { [sequelize.Sequelize.Op.like]: "%@lid" },
        isGroup: false
      }
    });

    console.log(`📊 Encontrados ${lidContacts.length} contatos com remoteJid @lid`);

    let fixed = 0;
    let merged = 0;
    let errors = 0;

    for (const contact of lidContacts) {
      try {
        const lidDigits = contact.number?.replace(/\D/g, "") || "";
        
        // Se o número não tem comprimento de telefone, pular
        if (lidDigits.length < 10 || lidDigits.length > 15) {
          console.log(`⚠️  Contato ${contact.id} número inválido: ${contact.number}`);
          continue;
        }

        // 2. Buscar contato similar pelos últimos dígitos
        const similarContact = await Contact.findOne({
          where: {
            companyId,
            id: { [sequelize.Sequelize.Op.ne]: contact.id },
            isGroup: false,
            [sequelize.Sequelize.Op.or]: [
              { number: { [sequelize.Sequelize.Op.like]: `%${lidDigits.slice(-10)}` } },
              { canonicalNumber: { [sequelize.Sequelize.Op.like]: `%${lidDigits.slice(-10)}` } }
            ]
          }
        });

        if (similarContact) {
          // 3. Encontrado contato similar - mesclar
          console.log(`🔄 Contato ${contact.id} ("${contact.name}") similar a ${similarContact.id} ("${similarContact.name}")`);
          
          // Atualizar contato similar com lidJid se não tiver
          if (!similarContact.lidJid) {
            await similarContact.update({ lidJid: contact.remoteJid });
          }
          
          // Migrar tickets do contato LID para o contato similar
          await sequelize.query(`
            UPDATE Tickets 
            SET contactId = :similarId 
            WHERE contactId = :lidId AND companyId = :companyId
          `, {
            replacements: { similarId: similarContact.id, lidId: contact.id, companyId },
            type: sequelize.QueryTypes.UPDATE
          });
          
          // Migrar mensagens do contato LID para o contato similar
          await sequelize.query(`
            UPDATE Messages 
            SET contactId = :similarId 
            WHERE contactId = :lidId AND companyId = :companyId
          `, {
            replacements: { similarId: similarContact.id, lidId: contact.id, companyId },
            type: sequelize.QueryTypes.UPDATE
          });
          
          // Excluir contato LID duplicado
          await contact.destroy();
          
          merged++;
          console.log(`✅ Contato ${contact.id} mesclado com ${similarContact.id}`);
        } else {
          // 4. Tentar corrigir remoteJid do contato atual
          const { canonical } = safeNormalizePhoneNumber(lidDigits);
          
          if (canonical) {
            const newRemoteJid = `${lidDigits}@s.whatsapp.net`;
            
            await contact.update({
              remoteJid: newRemoteJid,
              number: lidDigits,
              canonicalNumber: canonical
            });
            
            fixed++;
            console.log(`✅ Contato ${contact.id} corrigido: ${contact.remoteJid} → ${newRemoteJid}`);
          } else {
            console.log(`❌ Contato ${contact.id} não pôde ser normalizado: ${lidDigits}`);
          }
        }
        
      } catch (error) {
        errors++;
        console.error(`❌ Erro ao processar contato ${contact.id}:`, error);
      }
    }

    console.log(`\n📋 RESUMO:`);
    console.log(`- Contatos corrigidos: ${fixed}`);
    console.log(`- Contatos mesclados: ${merged}`);
    console.log(`- Erros: ${errors}`);
    console.log(`- Total processado: ${lidContacts.length}`);
    
  } catch (error) {
    console.error("❌ Erro geral no script:", error);
  }
}

// Executar script
if (require.main === module) {
  const companyId = process.argv[2];
  
  if (!companyId) {
    console.error("❌ Uso: npx ts-node scripts/fix-lid-contacts.ts <companyId>");
    process.exit(1);
  }
  
  fixLidContacts(parseInt(companyId))
    .then(() => {
      console.log("✅ Script concluído");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erro fatal:", error);
      process.exit(1);
    });
}

export default fixLidContacts;
