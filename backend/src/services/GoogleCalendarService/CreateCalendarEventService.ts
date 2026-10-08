import { google, calendar_v3 } from "googleapis";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";

// Criação de evento no Google Agenda a partir do FlowBuilder.
// Estratégia de credencial: Service Account via variáveis de ambiente
// (sem fluxo OAuth interativo). A agenda de destino precisa estar
// compartilhada com o e-mail da service account (permissão de edição).
//
// Env vars:
//   GOOGLE_CALENDAR_CLIENT_EMAIL — e-mail da service account (…gserviceaccount.com)
//   GOOGLE_CALENDAR_PRIVATE_KEY  — chave privada PEM (aceita "\n" literais)
//   GOOGLE_CALENDAR_ID           — id da agenda (ex.: e-mail da agenda ou "primary")

interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  location?: string;
  startAt: Date;
  durationMinutes?: number;
  attendees?: string[];
}

interface CreateCalendarEventResult {
  id: string;
  htmlLink?: string;
  start: string;
  end: string;
}

const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 24 * 60; // teto de 24h por evento

// Normaliza a chave privada: .env costuma escapar quebras de linha como
// "\n" literais e/ou envolver o valor em aspas.
const normalizePrivateKey = (raw: string): string =>
  raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

// Cliente autenticado via JWT da service account. Lança AppError amigável
// quando as credenciais não estão configuradas — o executor do fluxo
// captura e segue pela saída padrão.
const getCalendarClient = (): calendar_v3.Calendar => {
  const clientEmail = (process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || "").trim();
  const privateKeyRaw = (process.env.GOOGLE_CALENDAR_PRIVATE_KEY || "").trim();

  if (!clientEmail || !privateKeyRaw) {
    throw new AppError(
      "Google Agenda não configurado: defina GOOGLE_CALENDAR_CLIENT_EMAIL e GOOGLE_CALENDAR_PRIVATE_KEY",
      500
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: normalizePrivateKey(privateKeyRaw),
    scopes: ["https://www.googleapis.com/auth/calendar.events"]
  });

  return google.calendar({ version: "v3", auth });
};

const CreateCalendarEventService = async ({
  summary,
  description,
  location,
  startAt,
  durationMinutes,
  attendees
}: CreateCalendarEventParams): Promise<CreateCalendarEventResult> => {
  if (!summary || !summary.trim()) {
    throw new AppError("Evento do Google Agenda sem título (summary)", 400);
  }

  if (!(startAt instanceof Date) || isNaN(startAt.getTime())) {
    throw new AppError("Data/hora de início do evento inválida", 400);
  }

  const calendarId = (process.env.GOOGLE_CALENDAR_ID || "primary").trim();

  const duration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? Math.min(Math.floor(durationMinutes), MAX_DURATION_MINUTES)
      : DEFAULT_DURATION_MINUTES;

  const endAt = new Date(startAt.getTime() + duration * 60000);

  const requestBody: calendar_v3.Schema$Event = {
    summary: summary.trim(),
    description: description || undefined,
    location: location || undefined,
    start: { dateTime: startAt.toISOString() },
    end: { dateTime: endAt.toISOString() }
  };

  // Attendees só é enviado quando há e-mails válidos — service account sem
  // Domain-Wide Delegation não consegue convidar participantes (a API
  // retorna erro); filtramos antes para não quebrar a criação do evento.
  const validAttendees = (attendees || [])
    .map(email => String(email).trim())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  if (validAttendees.length > 0) {
    requestBody.attendees = validAttendees.map(email => ({ email }));
  }

  const calendar = getCalendarClient();

  try {
    const { data } = await calendar.events.insert(
      {
        calendarId,
        requestBody
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    return {
      id: data.id,
      htmlLink: data.htmlLink || undefined,
      start: startAt.toISOString(),
      end: endAt.toISOString()
    };
  } catch (err) {
    const apiMessage =
      err?.response?.data?.error?.message || err?.message || String(err);
    logger.error(
      `[GoogleCalendar] Falha ao criar evento na agenda ${calendarId}: ${apiMessage}`
    );
    throw new AppError(
      `Falha ao criar evento no Google Agenda: ${apiMessage}`,
      502
    );
  }
};

export default CreateCalendarEventService;
