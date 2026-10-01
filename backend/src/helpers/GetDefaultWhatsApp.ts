import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import GetDefaultWhatsAppByUser from "./GetDefaultWhatsAppByUser";

const CONNECTED_STATUS = "CONNECTED";

// Conexões capazes de falar WhatsApp (Baileys ou API Oficial).
// Facebook/Instagram/WebChat aparecem como CONNECTED mas não têm socket
// Baileys — selecioná-las quebrava validação de números e envios com
// timeouts de 30s por contato.
const WHATSAPP_CHANNEL_FILTER = {
  [Op.or]: [{ channel: "whatsapp" }, { channel: null }],
  channelType: { [Op.or]: ["baileys", "official", null] }
};

const GetDefaultWhatsApp = async (
  whatsappId?: number,
  companyId: number | null = null,
  userId?: number
): Promise<Whatsapp> => {
  let connection: Whatsapp | null = null;

  if (whatsappId) {
    const explicitWhatsapp = await Whatsapp.findOne({
      where: { id: whatsappId, companyId }
    });

    if (explicitWhatsapp) {
      connection = explicitWhatsapp;
    }

    if (!connection) {
      connection = await Whatsapp.findOne({
        where: { status: CONNECTED_STATUS, companyId, ...WHATSAPP_CHANNEL_FILTER }
      });
    }
  } else {
    connection = await Whatsapp.findOne({
      where: { status: CONNECTED_STATUS, companyId, isDefault: true, ...WHATSAPP_CHANNEL_FILTER }
    });

    if (!connection) {
      connection = await Whatsapp.findOne({
        where: { status: CONNECTED_STATUS, companyId, ...WHATSAPP_CHANNEL_FILTER }
      });
    }
  }

  if (userId) {
    const whatsappByUser = await GetDefaultWhatsAppByUser(userId);
    if (whatsappByUser && whatsappByUser.status === CONNECTED_STATUS &&
        (!whatsappByUser.channel || whatsappByUser.channel === "whatsapp")) {
      connection = whatsappByUser;
    }
    if (!connection || connection.status !== CONNECTED_STATUS ||
        (connection.channel && connection.channel !== "whatsapp")) {
      const connectedFallback = await Whatsapp.findOne({
        where: { status: CONNECTED_STATUS, companyId, ...WHATSAPP_CHANNEL_FILTER }
      });
      if (connectedFallback) {
        connection = connectedFallback;
      }
    }
  }

  if (!connection) {
    throw new AppError(`ERR_NO_DEF_WAPP_FOUND in COMPANY ${companyId}`);
  }

  return connection;
};

export default GetDefaultWhatsApp;