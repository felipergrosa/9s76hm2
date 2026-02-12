import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import GetDeviceContactsService from "../WbotServices/GetDeviceContactsService";
import logger from "../../utils/logger";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";
import { getIO } from "../../libs/socket";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { Op } from "sequelize";
import { ImportContactLog } from "../../types/importTypes";
import ContactImportReportService from "./ContactImportReportService";

interface Params {
  companyId: number;
  whatsappId?: number;
  selectedJids?: string[];
  autoCreateTags?: boolean;
  targetTagId?: number;
  importMode?: "all" | "newOnly" | "manual";
  generateDetailedReport?: boolean; // Toggle para gerar relatório detalhado
}

const ImportDeviceContactsAutoService = async ({
  companyId,
  whatsappId,
  selectedJids,
  autoCreateTags = true,
  targetTagId,
  importMode = "manual",
  generateDetailedReport = false // Por padrão não gera relatório
}: Params) => {
  const io = getIO();
  const deviceContacts = await GetDeviceContactsService(companyId, whatsappId);

  // Determinar quais contatos processar baseado no modo
  let want = Array.isArray(selectedJids) && selectedJids.length > 0
    ? deviceContacts.filter(c => selectedJids.includes(c.id))
    : deviceContacts;

  // Se modo "newOnly", filtrar apenas contatos que não existem no sistema
  if (importMode === "newOnly") {
    const existingNumbers = new Set<string>();

    // Buscar todos os contatos existentes de uma vez (mais eficiente)
    const existingContacts = await Contact.findAll({
      where: { companyId },
      attributes: ['number'],
      raw: true
    });

    // Normalizar números existentes para comparação consistente
    existingContacts.forEach(c => {
      const normalizedNumber = String(c.number || '').replace(/\D/g, '');
      existingNumbers.add(normalizedNumber);
    });

    const beforeFilterCount = want.length;
    want = want.filter(c => {
      // Extrair e normalizar número do JID
      const rawNumber = String(c.id || '').split('@')[0];
      const normalizedNumber = rawNumber.replace(/\D/g, '');
      const exists = existingNumbers.has(normalizedNumber);
      return !exists;
    });

    logger.info(`[ImportDeviceContacts] Modo newOnly: ${want.length} contatos novos de ${beforeFilterCount} total (${existingNumbers.size} já existiam no sistema)`);
  }

  let created = 0;
  let updated = 0;
  let tagged = 0;
  let failed = 0;
  let skipped = 0;
  let duplicated = 0; // Contatos que já existiam mas receberam tags
  const total = want.length;

  // Array para logs detalhados (apenas se ativado)
  const importLogs: ImportContactLog[] = [];

  // Emitir progresso inicial
  io.to(`company-${companyId}-mainchannel`).emit(`importContacts-${companyId}`, {
    action: "progress",
    total,
    processed: 0,
    created: 0,
    updated: 0,
    tagged: 0,
    skipped: 0
  });

  let processed = 0;
  for (const c of want) {
    let contact: Contact | null = null;
    let wasExisting = false;
    let tagApplied = false;

    try {
      const jid = String(c.id || '');
      // Normalizar número: extrair do JID e remover caracteres não-dígitos
      const rawNumber = jid.split('@')[0];
      const number = rawNumber.replace(/\D/g, ''); // Remove qualquer caractere não-dígito

      // Variáveis para log detalhado
      let logStatus: 'CREATED' | 'ALREADY_EXISTS' | 'UPDATED' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
      let logAction = '';
      let logSearchMethod: 'canonicalNumber' | 'number' | 'both' | 'not_found' | 'special_jid' = 'not_found';
      let logMatchCriteria = '';
      let logError: string | null = null;
      let logTags: string[] = [];

      // Filtrar JIDs especiais que não são contatos válidos
      if (!number) {
        skipped++;
        processed++;
        if (generateDetailedReport) {
          importLogs.push({
            sequenceNumber: processed,
            originalJid: jid,
            extractedNumber: rawNumber,
            normalizedNumber: number,
            canonicalNumber: null,
            whatsappName: c.name || c.notify || '',
            status: 'SKIPPED',
            action: 'Número vazio',
            contactIdInDb: null,
            nameInDb: null,
            searchMethod: 'special_jid',
            matchCriteria: null,
            tagsApplied: [],
            errorMessage: 'JID sem número válido',
            errorStack: null,
            timestamp: new Date()
          });
        }
        continue;
      }

      // Ignorar grupos, broadcasts, LIDs e contatos especiais
      const lowerJid = jid.toLowerCase();
      if (lowerJid.includes('@g.us') ||
        lowerJid.includes('@broadcast') ||
        lowerJid.includes('status@broadcast') ||
        lowerJid.includes('@lid') ||
        lowerJid.includes('lid:') ||
        number.length < 8) { // Números muito curtos não são válidos
        logger.info(`[ImportDeviceContactsAutoService] Ignorando JID especial: ${jid}`);
        skipped++;
        processed++;
        if (generateDetailedReport) {
          importLogs.push({
            sequenceNumber: processed,
            originalJid: jid,
            extractedNumber: rawNumber,
            normalizedNumber: number,
            canonicalNumber: null,
            whatsappName: c.name || c.notify || '',
            status: 'SKIPPED',
            action: 'JID especial ignorado',
            contactIdInDb: null,
            nameInDb: null,
            searchMethod: 'special_jid',
            matchCriteria: number.length < 8 ? 'Número muito curto' : 'Grupo/Broadcast/LID',
            tagsApplied: [],
            errorMessage: 'JID especial (grupo, broadcast, LID)',
            errorStack: null,
            timestamp: new Date()
          });
        }
        continue;
      }

      // VALIDAÇÃO CRÍTICA: Verificar se o número é válido antes de criar contato
      const { canonical } = safeNormalizePhoneNumber(number);
      if (!canonical) {
        logger.warn(`[ImportDeviceContactsAutoService] Número inválido ignorado: ${number} (JID: ${jid})`);
        skipped++;
        processed++;
        if (generateDetailedReport) {
          importLogs.push({
            sequenceNumber: processed,
            originalJid: jid,
            extractedNumber: rawNumber,
            normalizedNumber: number,
            canonicalNumber: null,
            whatsappName: c.name || c.notify || '',
            status: 'SKIPPED',
            action: 'Número inválido',
            contactIdInDb: null,
            nameInDb: null,
            searchMethod: 'not_found' as const,
            matchCriteria: null,
            tagsApplied: [],
            errorMessage: 'Número de telefone inválido',
            errorStack: null,
            timestamp: new Date()
          });
        }
        continue;
      }

      // Normalizar número usando a mesma lógica do modelo Contact
      const { canonical: canonicalNumber } = safeNormalizePhoneNumber(number);
      const searchNumber = canonicalNumber || number; // Usa canonical se disponível

      // Primeiro, buscar se já existe (por canonicalNumber OU number original)
      contact = await Contact.findOne({
        where: {
          companyId,
          [Op.or]: [
            { number: searchNumber },
            { canonicalNumber: searchNumber },
            { number: number }, // Busca também pelo número original
          ]
        }
      });
      wasExisting = !!contact;

      // Atualizar variáveis de tracking se contato encontrado
      if (contact) {
        logSearchMethod = 'both';
        if (contact.number === searchNumber) {
          logMatchCriteria = `Match por number: ${searchNumber}`;
        } else if (contact.canonicalNumber === searchNumber) {
          logMatchCriteria = `Match por canonicalNumber: ${searchNumber}`;
        } else {
          logMatchCriteria = `Match por number original: ${number}`;
        }
      }

      if (!contact) {
        // Tentar criar novo contato
        try {
          logger.info(`[ImportDeviceContactsAutoService] Criando contato: number=${number}, name=${c.name || c.notify || number}`);
          contact = await Contact.create({
            number,
            name: (c.name || c.notify || number),
            email: '',
            companyId,
            whatsappId
          } as any);
          created++;
          logStatus = 'CREATED';
          logAction = 'Contato criado com sucesso';
          logSearchMethod = 'not_found';
          logMatchCriteria = 'Novo contato';
          logger.info(`[ImportDeviceContactsAutoService] Contato CRIADO com sucesso: ${number} (total criados até agora: ${created})`);
        } catch (createError: any) {
          if (createError.name === 'SequelizeUniqueConstraintError') {
            // Race condition: contato foi criado entre o findOne e o create
            contact = await Contact.findOne({ where: { number, companyId } });
            wasExisting = true;
            if (!contact) {
              // Contato realmente não pode ser recuperado
              failed++;
              processed++;
              continue;
            }
          } else {
            throw createError;
          }
        }
      }

      // A partir daqui, contact está garantido
      if (contact) {
        // Atualizar nome e whatsappId se necessário
        const currentName = (contact.name || '').trim();
        const isNumberName = currentName.replace(/\D/g, '') === number;
        const incomingName = (c.name || c.notify || '').trim();
        const shouldUpdateName = (!currentName || isNumberName) && incomingName;
        const shouldUpdateWhatsapp = whatsappId && !contact.whatsappId;

        if (shouldUpdateName || shouldUpdateWhatsapp) {
          const updateData: any = {};
          if (shouldUpdateName) updateData.name = incomingName;
          if (shouldUpdateWhatsapp) updateData.whatsappId = whatsappId;
          await contact.update(updateData);
          if (!wasExisting) updated++;
        }

        // Aplicar tags do dispositivo
        const tags = Array.isArray(c.tags) ? c.tags : [];
        for (const t of tags) {
          const tagName = (t?.name || '').toString().trim();
          if (!tagName) continue;

          let tagRow: Tag | null = await Tag.findOne({ where: { name: tagName, companyId } });
          if (!tagRow && autoCreateTags) {
            tagRow = await Tag.create({ name: tagName, color: '#A4CCCC', kanban: 0, companyId } as any);
          }

          if (tagRow) {
            await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tagRow.id } });
            tagged++;
            tagApplied = true;
          }
        }

        // Aplicar tag alvo
        if (targetTagId) {
          try {
            await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: targetTagId } });
            tagged++;
            tagApplied = true;
          } catch (tagError) {
            // Ignora erro de tag duplicada, ainda é sucesso
            logger.warn(`[ImportDeviceContacts] Erro ao aplicar tag ${targetTagId} ao contato ${contact.id}: ${tagError}`);
          }
        }

        // Contar como duplicado se já existia
        if (wasExisting) {
          duplicated++;
          logStatus = 'ALREADY_EXISTS';
          logAction = 'Contato já existia no sistema';
        } else if (created > 0) {
          logStatus = 'CREATED';
          logAction = 'Contato criado com sucesso';
        }

        // Sincronizar carteiras se teve tags
        if (tags.length > 0 || tagApplied) {
          try {
            await SyncContactWalletsAndPersonalTagsService({
              companyId,
              contactId: contact.id,
              source: "tags"
            });
          } catch (err) {
            // Não falha a importação por causa de sync de carteiras
          }
        }

        // Registrar log detalhado se ativado
        if (generateDetailedReport) {
          const { canonical: canonicalNum } = safeNormalizePhoneNumber(number);
          importLogs.push({
            sequenceNumber: processed + 1,
            originalJid: jid,
            extractedNumber: rawNumber,
            normalizedNumber: number,
            canonicalNumber: canonicalNum,
            whatsappName: c.name || c.notify || '',
            status: logStatus,
            action: logAction || (tagApplied ? 'Tag aplicada' : 'Processado'),
            contactIdInDb: contact.id,
            nameInDb: contact.name,
            searchMethod: logSearchMethod,
            matchCriteria: logMatchCriteria,
            tagsApplied: logTags,
            errorMessage: null,
            errorStack: null,
            timestamp: new Date()
          });
        }
      }
    } catch (e: any) {
      // Distinguir tipos de erro para melhor diagnóstico
      const errorMessage = e?.message || String(e);
      const errorNumber = String(c?.id || '').split('@')[0];
      const errorJid = String(c?.id || '');

      if (e?.name === 'SequelizeUniqueConstraintError') {
        // Contato duplicado - não contar como falha real
        logger.info(`[ImportDeviceContactsAutoService] Contato duplicado ignorado: ${errorNumber}`);
        duplicated++;

        if (generateDetailedReport) {
          importLogs.push({
            sequenceNumber: processed + 1,
            originalJid: errorJid,
            extractedNumber: errorNumber,
            normalizedNumber: errorNumber.replace(/\D/g, ''),
            canonicalNumber: null,
            whatsappName: c?.name || c?.notify || '',
            status: 'ALREADY_EXISTS',
            action: 'Contato duplicado (constraint)',
            contactIdInDb: null,
            nameInDb: null,
            searchMethod: 'not_found',
            matchCriteria: 'SequelizeUniqueConstraintError',
            tagsApplied: [],
            errorMessage: 'Contato já existe (constraint de unicidade)',
            errorStack: null,
            timestamp: new Date()
          });
        }
      } else if (errorMessage.includes('validation') || errorMessage.includes('constraint')) {
        logger.warn(`[ImportDeviceContactsAutoService] Erro de validação para ${errorNumber}: ${errorMessage}`);
        failed++;

        if (generateDetailedReport) {
          importLogs.push({
            sequenceNumber: processed + 1,
            originalJid: errorJid,
            extractedNumber: errorNumber,
            normalizedNumber: errorNumber.replace(/\D/g, ''),
            canonicalNumber: null,
            whatsappName: c?.name || c?.notify || '',
            status: 'FAILED',
            action: 'Erro de validação',
            contactIdInDb: null,
            nameInDb: null,
            searchMethod: 'not_found',
            matchCriteria: null,
            tagsApplied: [],
            errorMessage: errorMessage,
            errorStack: e?.stack?.slice(0, 300) || null,
            timestamp: new Date()
          });
        }
      } else {
        // Log detalhado para debug - SEMPRE mostrar em produção
        logger.error(`[ImportDeviceContactsAutoService] FALHA: JID=${c?.id}, numero=${errorNumber}, erro=${errorMessage}, stack=${e?.stack?.slice(0, 300)}`);
        failed++;

        if (generateDetailedReport) {
          importLogs.push({
            sequenceNumber: processed + 1,
            originalJid: errorJid,
            extractedNumber: errorNumber,
            normalizedNumber: errorNumber.replace(/\D/g, ''),
            canonicalNumber: null,
            whatsappName: c?.name || c?.notify || '',
            status: 'FAILED',
            action: 'Erro inesperado',
            contactIdInDb: null,
            nameInDb: null,
            searchMethod: 'not_found',
            matchCriteria: null,
            tagsApplied: [],
            errorMessage: errorMessage,
            errorStack: e?.stack?.slice(0, 300) || null,
            timestamp: new Date()
          });
        }
      }
    }


    processed++;

    // Emitir progresso a cada 10 contatos ou no final
    if (processed % 10 === 0 || processed === total) {
      io.to(`company-${companyId}-mainchannel`).emit(`importContacts-${companyId}`, {
        action: "progress",
        total,
        processed,
        created,
        updated,
        tagged,
        skipped
      });
    }
  }

  // Emitir conclusão
  io.to(`company-${companyId}-mainchannel`).emit(`importContacts-${companyId}`, {
    action: "complete",
    total,
    processed,
    created,
    updated,
    tagged,
    skipped,
    failed
  });

  // Log final do resultado
  logger.info(`[ImportDeviceContactsAutoService] RESULTADO FINAL: total=${want.length}, created=${created}, updated=${updated}, tagged=${tagged}, failed=${failed}, skipped=${skipped}, duplicated=${duplicated}`);

  // Gerar relatório detalhado se solicitado
  let reportUrl: string | null = null;
  if (generateDetailedReport && importLogs.length > 0) {
    try {
      const { fileName } = await ContactImportReportService.generate({
        logs: importLogs,
        companyId
      });
      reportUrl = ContactImportReportService.getDownloadUrl(fileName);
      logger.info(`[ImportDeviceContactsAutoService] Relatório detalhado gerado: ${reportUrl}`);
    } catch (error) {
      logger.error('[ImportDeviceContactsAutoService] Erro ao gerar relatório detalhado:', error);
    }
  }

  return {
    count: want.length,
    created,
    updated,
    tagged,
    failed,
    skipped,
    duplicated,
    reportUrl // URL do relatório (null se não gerado)
  };
};

export default ImportDeviceContactsAutoService;

