import axios from "axios";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";

const GRAPH = "https://graph.facebook.com/v19.0";

interface CommentPayload {
  commentId: string;
  postId: string;
  senderId: string;
  senderName: string;
  message: string;
}

// Sends a Private Reply (DM) in response to a Facebook/Instagram comment.
// Meta Private Reply API: https://developers.facebook.com/docs/messenger-platform/send-messages/private-replies
export const replyCommentWithDM = async (whatsapp: Whatsapp, payload: CommentPayload): Promise<void> => {
  const token = whatsapp.metaPageAccessToken || whatsapp.facebookUserToken;
  if (!token) {
    logger.warn(`[CommentToDM] No page token for whatsapp ${whatsapp.id}`);
    return;
  }

  const autoReply = `Olá, ${payload.senderName}! Recebemos seu comentário e entraremos em contato via mensagem privada. 😊`;

  try {
    await axios.post(`${GRAPH}/${payload.commentId}/private_replies`, {
      message: autoReply
    }, {
      params: { access_token: token }
    });
    logger.info(`[CommentToDM] Replied to comment ${payload.commentId} for sender ${payload.senderId}`);
  } catch (err: any) {
    logger.error(`[CommentToDM] Failed to send private reply: ${err.response?.data?.error?.message || err.message}`);
  }
};

// Parses a Meta webhook payload looking for comment events
export const extractCommentFromWebhook = (body: any): CommentPayload | null => {
  try {
    const entries = body.entry || [];
    for (const entry of entries) {
      // Facebook/Instagram comment events come under "changes"
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === "comments" || change.field === "feed") {
          const val = change.value || {};
          if (val.item === "comment" && val.verb === "add") {
            return {
              commentId: val.comment_id || val.id,
              postId: val.post_id || val.parent_id || "",
              senderId: val.from?.id || "",
              senderName: val.from?.name || "Usuário",
              message: val.message || ""
            };
          }
        }
      }
    }
  } catch {}
  return null;
};
