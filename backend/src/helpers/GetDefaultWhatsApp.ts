import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import GetDefaultWhatsAppByUser from "./GetDefaultWhatsAppByUser";

const CONNECTED_STATUS = "CONNECTED";

const GetDefaultWhatsApp = async (
  whatsappId?: number,
  companyId: number | null = null,
  userId?: number
): Promise<Whatsapp> => {
  let connection: Whatsapp | null = null;

  console.log({ whatsappId, companyId, userId })
  
  if (whatsappId) {
    const explicitWhatsapp = await Whatsapp.findOne({
      where: { id: whatsappId, companyId }
    });

    if (explicitWhatsapp) {
      connection = explicitWhatsapp;
      if (explicitWhatsapp.status !== CONNECTED_STATUS) {
        const connectedFallback = await Whatsapp.findOne({
          where: { status: CONNECTED_STATUS, companyId }
        });
        if (connectedFallback) {
          connection = connectedFallback;
        }
      }
    }
  } else {
    connection = await Whatsapp.findOne({
      where: { status: CONNECTED_STATUS, companyId, isDefault: true }
    });

    if (!connection) {
      connection = await Whatsapp.findOne({
        where: { status: CONNECTED_STATUS, companyId }
      });
    }
  }

  if (userId) {
    const whatsappByUser = await GetDefaultWhatsAppByUser(userId);
    if (whatsappByUser) {
      connection = whatsappByUser.status === CONNECTED_STATUS ? whatsappByUser : connection || whatsappByUser;
    }
    if (!connection || connection.status !== CONNECTED_STATUS) {
      const connectedFallback = await Whatsapp.findOne({
        where: { status: CONNECTED_STATUS, companyId }
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