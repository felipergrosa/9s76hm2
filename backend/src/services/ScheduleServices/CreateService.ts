import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  ticketUserId?: number | string;
  queueId?: number | string;
  openTicket?: string;
  statusTicket?: string;
  whatsappId?: number | string;
  intervalo?: number;
  valorIntervalo?: number;
  enviarQuantasVezes?: number;
  tipoDias?: number;
  contadorEnvio?: number;
  assinar?: boolean;
}

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  ticketUserId,
  queueId,
  openTicket,
  statusTicket,
  whatsappId,
  intervalo,
  valorIntervalo,
  enviarQuantasVezes,
  tipoDias,
  assinar,
  contadorEnvio
}: Request): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.string().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Referências precisam pertencer ao tenant — evita agendar mensagem
  // usando contato/conexão/fila/usuário de outra empresa.
  if (contactId) {
    const contact = await Contact.findOne({ where: { id: contactId, companyId } });
    if (!contact) throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }
  if (whatsappId) {
    const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
    if (!whatsapp) throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }
  if (queueId) {
    const queue = await Queue.findOne({ where: { id: queueId, companyId } });
    if (!queue) throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }
  if (userId) {
    const user = await User.findOne({ where: { id: userId, companyId } });
    if (!user) throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const schedule = await Schedule.create(
    {
      body,
      sendAt,
      contactId,
      companyId,
      userId,
      status: 'PENDENTE',
      ticketUserId,
      queueId,
      openTicket,
      statusTicket,
      whatsappId,
      intervalo,
      valorIntervalo,
      enviarQuantasVezes,
      tipoDias,
      assinar,
      contadorEnvio
    }
  );

  await schedule.reload();

  return schedule;
};

export default CreateService;
