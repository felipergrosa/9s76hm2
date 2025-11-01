import Contact from "../../models/Contact";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { Op } from "sequelize";
import logger from "../../utils/logger";

/**
 * Script para normalizar todos os números de contatos existentes
 * e identificar/mesclar duplicatas baseado no canonicalNumber.
 * 
 * Uso: npx ts-node src/database/scripts/normalizeAllContacts.ts
 */

interface NormalizationStats {
  total: number;
  normalized: number;
  duplicatesFound: number;
  errors: number;
}

const normalizeAllContacts = async (): Promise<NormalizationStats> => {
  const stats: NormalizationStats = {
    total: 0,
    normalized: 0,
    duplicatesFound: 0,
    errors: 0
  };

  try {
    // Busca todos os contatos não-grupo
    const contacts = await Contact.findAll({
      where: {
        isGroup: false
      },
      order: [["id", "ASC"]]
    });

    stats.total = contacts.length;
    logger.info(`[normalizeAllContacts] Processando ${stats.total} contatos...`);

    const canonicalMap = new Map<string, Contact[]>();

    for (const contact of contacts) {
      try {
        const rawNumber = contact.number;
        if (!rawNumber) {
          logger.warn(`[normalizeAllContacts] Contato ${contact.id} sem número, pulando`);
          continue;
        }

        // Normaliza o número
        const { canonical } = safeNormalizePhoneNumber(rawNumber);

        if (!canonical) {
          logger.warn(`[normalizeAllContacts] Contato ${contact.id} com número inválido: ${rawNumber}`);
          stats.errors++;
          continue;
        }

        // Verifica se o canonical mudou
        const needsUpdate = contact.canonicalNumber !== canonical || contact.number !== canonical;

        if (needsUpdate) {
          await contact.update({
            number: canonical,
            canonicalNumber: canonical
          });
          stats.normalized++;
          logger.info(`[normalizeAllContacts] Contato ${contact.id} normalizado: ${rawNumber} -> ${canonical}`);
        }

        // Agrupa por canonical para detectar duplicatas
        if (!canonicalMap.has(canonical)) {
          canonicalMap.set(canonical, []);
        }
        canonicalMap.get(canonical)!.push(contact);

      } catch (err) {
        logger.error(`[normalizeAllContacts] Erro ao processar contato ${contact.id}:`, err);
        stats.errors++;
      }
    }

    // Identifica duplicatas
    logger.info(`[normalizeAllContacts] Verificando duplicatas...`);
    for (const [canonical, duplicates] of canonicalMap.entries()) {
      if (duplicates.length > 1) {
        stats.duplicatesFound += duplicates.length - 1;
        logger.warn(`[normalizeAllContacts] Encontradas ${duplicates.length} duplicatas para ${canonical}:`, 
          duplicates.map(c => `ID ${c.id} (${c.name})`).join(", ")
        );
      }
    }

    logger.info(`[normalizeAllContacts] Finalizado!`, stats);
    return stats;

  } catch (err) {
    logger.error(`[normalizeAllContacts] Erro fatal:`, err);
    throw err;
  }
};

// Executa se chamado diretamente
if (require.main === module) {
  normalizeAllContacts()
    .then(stats => {
      console.log("\n=== RESULTADO DA NORMALIZAÇÃO ===");
      console.log(`Total de contatos processados: ${stats.total}`);
      console.log(`Contatos normalizados: ${stats.normalized}`);
      console.log(`Duplicatas encontradas: ${stats.duplicatesFound}`);
      console.log(`Erros: ${stats.errors}`);
      console.log("==================================\n");
      process.exit(0);
    })
    .catch(err => {
      console.error("Erro ao executar normalização:", err);
      process.exit(1);
    });
}

export default normalizeAllContacts;
