import { sequelize } from "../dist/config/database";
import Contact from "../dist/models/Contact";
import logger from "../dist/utils/logger";
import { safeNormalizePhoneNumber } from "../dist/utils/phone";

// Importar tipos do Sequelize
const { Op } = require("sequelize");

// Interface para contatos (TypeScript não reconhece campos dinamicamente)
interface ContactInstance extends Contact {
  id: number;
  name: string;
  number: string;
  remoteJid: string | null;
  canonicalNumber: string | null;
  companyId: number;
  update(data: any): Promise<ContactInstance>;
}

/**
 * Script para normalizar remoteJid de contatos
 * 
 * Problema:
 * - Muitos contatos têm remoteJid = NULL mesmo com número válido
 * - Isso causa problemas na identificação e roteamento de mensagens
 * 
 * Solução:
 * 1. Identificar contatos com remoteJid NULL e número válido
 * 2. Normalizar o número (remover formatação)
 * 3. Atualizar remoteJid para formato "numero@s.whatsapp.net"
 * 4. Lidar com casos especiais (grupos, LIDs, etc.)
 */

async function normalizeRemoteJid(companyId: number) {
  console.log(`🔧 Iniciando normalização de remoteJid para empresa ${companyId}`);
  
  try {
    // 1. Buscar contatos com remoteJid NULL
    const nullRemoteJidContacts = await Contact.findAll({
      where: {
        companyId,
        remoteJid: null,
        number: { [sequelize.Sequelize.Op.ne]: null }
      }
    });

    console.log(`📊 Encontrados ${nullRemoteJidContacts.length} contatos com remoteJid NULL`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const contact of nullRemoteJidContacts) {
      try {
        // 2. Validar e normalizar o número
        const rawNumber = String(contact.number || "").trim();
        
        // Pular se o número for inválido ou parecer ser LID/PENDING
        if (!rawNumber || 
            rawNumber.includes("@lid") || 
            rawNumber.startsWith("PENDING_") ||
            rawNumber.includes("@g.us")) {
          console.log(`⚠️  Contato ${contact.id} número inválido ou especial: ${rawNumber}`);
          skipped++;
          continue;
        }

        // 3. Normalizar o número
        const { canonical } = safeNormalizePhoneNumber(rawNumber);
        
        if (!canonical) {
          console.log(`⚠️  Contato ${contact.id} número não normalizável: ${rawNumber}`);
          skipped++;
          continue;
        }

        // 4. Montar remoteJid correto
        const digitsOnly = canonical.replace(/\D/g, "");
        const newRemoteJid = `${digitsOnly}@s.whatsapp.net`;

        // 5. Atualizar o contato
        await contact.update({
          remoteJid: newRemoteJid,
          // Se canonicalNumber também estiver NULL, preencher
          ...(contact.canonicalNumber ? {} : { canonicalNumber: canonical })
        });

        updated++;
        console.log(`✅ Contato ${contact.id} atualizado: ${contact.name} → ${newRemoteJid}`);

      } catch (error) {
        errors++;
        console.error(`❌ Erro ao processar contato ${contact.id}:`, error);
      }
    }

    // 6. Buscar contatos com remoteJid em formato incorreto (sem @s.whatsapp.net)
    const wrongFormatContacts = await Contact.findAll({
      where: {
        companyId,
        remoteJid: {
          [sequelize.Sequelize.Op.and]: [
            { [sequelize.Sequelize.Op.ne]: null },
            { [sequelize.Sequelize.Op.notLike]: "%@s.whatsapp.net" },
            { [sequelize.Sequelize.Op.notLike]: "%@lid" },
            { [sequelize.Sequelize.Op.notLike]: "%@g.us" }
          ]
        }
      }
    });

    console.log(`📊 Encontrados ${wrongFormatContacts.length} contatos com remoteJid em formato incorreto`);

    for (const contact of wrongFormatContacts) {
      try {
        const rawNumber = String(contact.number || "").trim();
        
        if (!rawNumber || rawNumber.includes("@lid") || rawNumber.startsWith("PENDING_")) {
          skipped++;
          continue;
        }

        const { canonical } = safeNormalizePhoneNumber(rawNumber);
        
        if (!canonical) {
          skipped++;
          continue;
        }

        const digitsOnly = canonical.replace(/\D/g, "");
        const newRemoteJid = `${digitsOnly}@s.whatsapp.net`;

        await contact.update({
          remoteJid: newRemoteJid,
          ...(contact.canonicalNumber ? {} : { canonicalNumber: canonical })
        });

        updated++;
        console.log(`✅ Contato ${contact.id} corrigido: ${contact.remoteJid} → ${newRemoteJid}`);

      } catch (error) {
        errors++;
        console.error(`❌ Erro ao corrigir contato ${contact.id}:`, error);
      }
    }

    console.log(`\n📋 RESUMO:`);
    console.log(`- Contatos atualizados: ${updated}`);
    console.log(`- Contatos pulados: ${skipped}`);
    console.log(`- Erros: ${errors}`);
    console.log(`- Total processado: ${nullRemoteJidContacts.length + wrongFormatContacts.length}`);
    
  } catch (error) {
    console.error("❌ Erro geral no script:", error);
  }
}

// Executar script
if (require.main === module) {
  const companyId = process.argv[2];
  
  if (!companyId) {
    console.error("❌ Uso: npx ts-node scripts/normalize-remoteJid.ts <companyId>");
    process.exit(1);
  }
  
  normalizeRemoteJid(parseInt(companyId))
    .then(() => {
      console.log("✅ Script concluído");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erro fatal:", error);
      process.exit(1);
    });
}

export default normalizeRemoteJid;
