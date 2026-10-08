import axios from "axios";
import FormData from "form-data";
import { createReadStream } from "fs";
import logger from "../../utils/logger";
import { signPublicMediaUrl } from "../../utils/publicMediaAccess";

const formData: FormData = new FormData();

// Log sanitizado de erro da Graph API — nunca logar o objeto error/config
// inteiro: error.config carrega o access_token na URL e nos params.
const logGraphError = (label: string, error: any): void => {
  logger.error(
    `[graphAPI][${label}] ${error?.message || error} ` +
    `(status=${error?.response?.status ?? "n/a"}, meta=${JSON.stringify(error?.response?.data?.error ?? null)})`
  );
};

const apiBase = (token: string) =>
  axios.create({
    baseURL: "https://graph.facebook.com/v18.0/",
    params: {
      access_token: token
    }
  });

export const getAccessToken = async (): Promise<string> => {
  const { data } = await axios.get(
    "https://graph.facebook.com/v18.0/oauth/access_token",
    {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        grant_type: "client_credentials"
      }
    }
  );

  return data.access_token;
};

export const markSeen = async (id: string, token: string): Promise<void> => {
  await apiBase(token).post(`${id}/messages`, {
    recipient: {
      id
    },
    sender_action: "mark_seen"
  });
};

export const showTypingIndicator = async (
  id: string, 
  token: string,
  action: string
): Promise<void> => {

  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: {
        id: id
      },
      sender_action: action
    })

    return data;
  } catch (error) {
    logGraphError("showTypingIndicator", error);
  }

}


export const sendText = async (
  id: string | number,
  text: string,
  token: string,
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: {
        id
      },
      message: {
        text: `${text}`,
      }
    });
    return data;
  } catch (error) {
    logGraphError("sendText", error);
  }
};

// URLs locais de /public/companyX são protegidas — os servidores da Meta
// baixam o anexo sem cookie/JWT, então a URL precisa ir assinada (TTL curto).
const maybeSignPublicMediaUrl = (url: string): string => {
  const match = /\/public\/company(\d+)\//i.exec(url || "");
  if (!match) return url;
  try {
    return signPublicMediaUrl(url, Number(match[1]));
  } catch {
    return url;
  }
};

export const sendAttachmentFromUrl = async (
  id: string,
  url: string,
  type: string,
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: {
        id
      },
      message: {
        attachment: {
          type,
          payload: {
            url: maybeSignPublicMediaUrl(url)
          }
        }
      }
    });

    return data;
  } catch (error) {
    logGraphError("sendAttachmentFromUrl", error);
  }
};

export const sendAttachment = async (
  id: string,
  file: Express.Multer.File,
  type: string,
  token: string
): Promise<void> => {
  formData.append(
    "recipient",
    JSON.stringify({
      id
    })
  );

  formData.append(
    "message",
    JSON.stringify({
      attachment: {
        type,
        payload: {
          is_reusable: true
        }
      }
    })
  );

  const fileReaderStream = createReadStream(file.path);

  formData.append("filedata", fileReaderStream);

  try {
    await apiBase(token).post("me/messages", formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  } catch (error) {
    throw new Error(error);
  }
};

export const genText = (text: string): any => {
  const response = {
    text
  };

  return response;
};

export const getProfile = async (id: string, token: string): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(id);

    return data;
  } catch (error) {
    logGraphError("getProfile", error);
    throw new Error("ERR_FETCHING_FB_USER_PROFILE_2");
  }
};

export const getPageProfile = async (
  id: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(
      `${id}/accounts?fields=name,access_token,instagram_business_account{id,username,profile_picture_url,name}`
    );
    return data;
  } catch (error) {
    logGraphError("getPageProfile", error);
    throw new Error("ERR_FETCHING_FB_PAGES");
  }
};

// Conjuntos de campos por canal, do mais completo ao mínimo — alguns campos
// exigem permissões avançadas do app, então tentamos o rico e degradamos.
const PROFILE_FIELD_SETS: Record<string, string[]> = {
  instagram: [
    "name,username,profile_pic,follower_count,is_verified_user,is_user_follow_business,is_business_follow_user",
    "name,username,profile_pic"
  ],
  facebook: [
    "first_name,last_name,name,profile_pic,locale,timezone",
    "first_name,last_name,profile_pic"
  ]
};

export const profilePsid = async (
  id: string,
  token: string,
  channel: string = "facebook"
): Promise<any> => {
  // IGSID (Instagram) exige fields explícitos — GET /{id} puro falha.
  const fieldSets = PROFILE_FIELD_SETS[channel] || PROFILE_FIELD_SETS.facebook;
  for (const fields of fieldSets) {
    try {
      const { data } = await axios.get(
        `https://graph.facebook.com/v18.0/${id}`,
        { params: { access_token: token, fields } }
      );
      return data;
    } catch (error) {
      logGraphError("profilePsid", error);
    }
  }
  // Fallback precisava retornar o perfil — antes o resultado era
  // descartado e o caller recebia undefined (contact null → crash).
  try {
    return await getProfile(id, token);
  } catch (fallbackError) {
    logGraphError("profilePsid.fallback", fallbackError);
    return null;
  }
};

// Handover protocol: quando o app não é o receptor primário da página,
// mensagens chegam em entry.standby. take_thread_control devolve o controle.
export const takeThreadControl = async (
  psid: string,
  token: string
): Promise<boolean> => {
  try {
    await apiBase(token).post("me/take_thread_control", {
      recipient: { id: psid }
    });
    return true;
  } catch (error) {
    logGraphError("takeThreadControl", error);
    return false;
  }
};

export const subscribeApp = async (id: string, token: string): Promise<any> => {
  const doSubscribe = (subscribedFields: string[]) =>
    axios.post(
      `https://graph.facebook.com/v18.0/${id}/subscribed_apps?access_token=${token}`,
      { subscribed_fields: subscribedFields }
    );
  try {
    // standby + messaging_handovers: sem eles, se outro app for o receptor
    // primário da página, mensagens não chegam nem em messaging nem em standby
    const { data } = await doSubscribe([
      "messages",
      "messaging_postbacks",
      "message_deliveries",
      "message_reads",
      "message_echoes",
      "standby",
      "messaging_handovers"
    ]);
    return data;
  } catch (error) {
    logGraphError("subscribeApp", error);
    // Fallback: mantém standby/handovers (essencial p/ receptor secundário)
    try {
      const { data } = await doSubscribe([
        "messages",
        "messaging_postbacks",
        "standby",
        "messaging_handovers"
      ]);
      return data;
    } catch {
      throw new Error("ERR_SUBSCRIBING_PAGE_TO_MESSAGE_WEBHOOKS");
    }
  }
};

export const unsubscribeApp = async (
  id: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await axios.delete(
      `https://graph.facebook.com/v18.0/${id}/subscribed_apps?access_token=${token}`
    );
    return data;
  } catch (error) {
    throw new Error("ERR_UNSUBSCRIBING_PAGE_TO_MESSAGE_WEBHOOKS");
  }
};


export const getSubscribedApps = async (
  id: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(`${id}/subscribed_apps`);
    return data;
  } catch (error) {
    throw new Error("ERR_GETTING_SUBSCRIBED_APPS");
  }
};

export const getAccessTokenFromPage = async (
  token: string
): Promise<string> => {
  try {

    if (!token) throw new Error("ERR_FETCHING_FB_USER_TOKEN");

    const data = await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          grant_type: "fb_exchange_token",
          fb_exchange_token: token
        }
      }
    );

    return data.data.access_token;
  } catch (error) {
    logGraphError("getAccessTokenFromPage", error);
    throw new Error("ERR_FETCHING_FB_USER_TOKEN");
  }
};

export const removeApplcation = async (
  id: string,
  token: string
): Promise<void> => {
  try {
    await axios.delete(`https://graph.facebook.com/v18.0/${id}/permissions`, {
      params: {
        access_token: token
      }
    });
  } catch (error) {
    logger.error("ERR_REMOVING_APP_FROM_PAGE");
  }
};

// Quick replies: botões de resposta rápida (Messenger/IG). Título máx 20
// chars; o payload volta no webhook (postback) quando o usuário toca.
export const sendQuickReplies = async (
  recipientId: string,
  text: string,
  replies: { title: string; payload?: string }[],
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: {
        id: recipientId
      },
      messaging_type: "RESPONSE",
      message: {
        text,
        quick_replies: replies.map(r => ({
          content_type: "text",
          title: r.title.slice(0, 20),
          payload: r.payload || r.title
        }))
      }
    });
    return data;
  } catch (error) {
    logGraphError("sendQuickReplies", error);
  }
};

type TemplateButton = {
  type: "postback" | "web_url";
  title: string;
  payload?: string;
  url?: string;
};

// Botões de template: postback volta no webhook; web_url abre link externo.
const mapTemplateButtons = (buttons: TemplateButton[]) =>
  buttons.map(b =>
    b.type === "web_url"
      ? { type: "web_url", title: b.title.slice(0, 20), url: b.url }
      : {
          type: "postback",
          title: b.title.slice(0, 20),
          payload: b.payload || b.title
        }
  );

export const sendButtonTemplate = async (
  recipientId: string,
  text: string,
  buttons: TemplateButton[],
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: {
        id: recipientId
      },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons: mapTemplateButtons(buttons)
          }
        }
      }
    });
    return data;
  } catch (error) {
    logGraphError("sendButtonTemplate", error);
  }
};

// Generic template: carrossel de cards (título/subtítulo/imagem/botões).
// A Graph API aceita no máx 10 elementos — o excedente é truncado.
export const sendGenericTemplate = async (
  recipientId: string,
  elements: {
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons?: TemplateButton[];
  }[],
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: {
        id: recipientId
      },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: elements.slice(0, 10).map(e => ({
              ...e,
              buttons: e.buttons ? mapTemplateButtons(e.buttons) : undefined
            }))
          }
        }
      }
    });
    return data;
  } catch (error) {
    logGraphError("sendGenericTemplate", error);
  }
};

// Resposta PÚBLICA a um comentário (post FB ou mídia IG) — não é DM.
export const replyToComment = async (
  commentId: string,
  message: string,
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post(`${commentId}/replies`, {
      message
    });
    return data;
  } catch (error) {
    logGraphError("replyToComment", error);
  }
};

// Oculta/exibe comentário na thread pública (moderação).
export const hideComment = async (
  commentId: string,
  hide: boolean,
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post(`${commentId}`, {
      is_hidden: hide
    });
    return data;
  } catch (error) {
    logGraphError("hideComment", error);
  }
};

// subscribeApp assina a PÁGINA; o objeto Instagram (igUserId) é outro nó do
// grafo e precisa de subscribed_apps próprio p/ receber comments/mentions.
export const subscribeInstagramObject = async (
  igUserId: string,
  fields: string[],
  token: string
): Promise<void> => {
  try {
    const { data } = await apiBase(token).post(`${igUserId}/subscribed_apps`, {
      subscribed_fields: fields
    });
    return data;
  } catch (error) {
    logGraphError("subscribeInstagramObject", error);
  }
};