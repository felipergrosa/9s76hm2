import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";

interface Request {
  whatsappId: number;
  companyId: number;
}

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  ticketsCreated: number;
  errors: number;
}

/**
 * Sincroniza TODOS os grupos do WhatsApp como contatos e cria tickets
 * para que apareçam na aba "Grupos" automaticamente.
 */
const SyncAllGroupsService = async ({
  whatsappId,
  companyId
}: Request): Promise<SyncResult> => {
  const result: SyncResult = {
    total: 0,
    created: 0,
    updated: 0,
    ticketsCreated: 0,
    errors: 0
  };

  // Verificar conexão
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || whatsapp.status !== "CONNECTED") {
    throw new Error("Conexão WhatsApp não está ativa");
  }

  // Obter instância do Baileys
  const wbot = getWbot(whatsappId);
  if (!wbot?.groupFetchAllParticipating) {
    throw new Error("Sessão não suporta listagem de grupos");
  }

  // Buscar todos os grupos do WhatsApp
  const groupsMap = await wbot.groupFetchAllParticipating();
  const groups = Object.values(groupsMap || {});
  result.total = groups.length;

  logger.info(`[SyncAllGroups] Iniciando sync de ${groups.length} grupos para whatsappId=${whatsappId} companyId=${companyId}`);

  for (const group of groups as any[]) {
    if (!group?.id) continue;

    const groupJid = String(group.id);
    const groupName = (group.subject && group.subject.trim() !== "") 
      ? group.subject 
      : "Grupo desconhecido";

    try {
      // Buscar foto do grupo (com timeout curto para não travar)
      let profilePicUrl = "";
      try {
        profilePicUrl = await Promise.race([
          wbot.profilePictureUrl(groupJid, "image"),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
        ]) as string;
      } catch {
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      // Criar ou atualizar contato do grupo
      const contact = await CreateOrUpdateContactService({
        name: groupName,
        number: groupJid,
        isGroup: true,
        companyId,
        remoteJid: groupJid,
        profilePicUrl,
        whatsappId,
        wbot,
        checkProfilePic: false // Não verificar foto novamente
      });

      if (!contact) {
        result.errors++;
        continue;
      }

      // Verificar se já existe ticket para este grupo
      const existingTicket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId,
          isGroup: true
        },
        order: [["id", "DESC"]]
      });

      if (existingTicket) {
        // Atualizar whatsappId se necessário e reabrir se fechado
        const updates: any = {};
        if (!existingTicket.whatsappId || existingTicket.whatsappId !== whatsappId) {
          updates.whatsappId = whatsappId;
        }
        if (existingTicket.status === "closed") {
          updates.status = "group";
        }
        if (Object.keys(updates).length > 0) {
          await existingTicket.update(updates);
          result.updated++;
        }
      } else {
        // Criar ticket para o grupo
        await Ticket.create({
          contactId: contact.id,
          companyId,
          whatsappId,
          isGroup: true,
          status: "group",
          unreadMessages: 0,
          isBot: false,
          channel: "whatsapp",
          isActiveDemand: false
        });
        result.ticketsCreated++;
        result.created++;
      }
    } catch (err: any) {
      logger.warn(`[SyncAllGroups] Erro ao sincronizar grupo ${groupJid}: ${err.message}`);
      result.errors++;
    }
  }

  logger.info(`[SyncAllGroups] Sync concluído: ${JSON.stringify(result)}`);
  return result;
};

export default SyncAllGroupsService;
