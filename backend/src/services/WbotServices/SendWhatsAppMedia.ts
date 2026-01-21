import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs, { unlink, unlinkSync } from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
// Usar require para compatibilidade com Jimp v1.x e evitar conflitos de tipos
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jimp = require("jimp");

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import mime from "mime-types";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import CreateMessageService from "../MessageServices/CreateMessageService";
import formatBody from "../../helpers/Mustache";
interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  companyId?: number;
  body?: string;
  isPrivate?: boolean;
  isForwarded?: boolean;
}
const os = require("os");

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudio = async (audio: string, companyId: string): Promise<string> => {
  const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.ogg`;

  return new Promise((resolve, reject) => {
    const inputQuoted = `"${audio}"`;
    const outputQuoted = `"${outputAudio}"`;
    // Conversão para OGG/Opus (PTT WhatsApp): mono, 16kHz, ~24kbps, VOIP
    const cmd = `${ffmpegPath.path} -y -i ${inputQuoted} -map 0:a:0 -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k -vbr on -compression_level 10 -application voip ${outputQuoted}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[ffmpeg][processAudio] ERROR:', error.message);
        return reject(error);
      }
      resolve(outputAudio);
    });
  });
};

// Processamento de imagem para padrão HD (mantendo qualidade alta)
const processImage = async (
  imagePath: string,
  companyId: string,
  mimeType?: string
): Promise<{ output: string; mime: string }> => {
  const companyFolder = path.join(publicFolder, `company${companyId}`);
  try {
    if (!fs.existsSync(companyFolder)) fs.mkdirSync(companyFolder, { recursive: true });

    const img = await Jimp.read(imagePath);
    const maxDim = 2048; // Limite "HD" alto mantendo qualidade
    const { width, height } = img.bitmap as { width: number; height: number };
    if (Math.max(width, height) > maxDim) {
      // Redimensiona para caber dentro de maxDim mantendo proporção
      // @ts-ignore - constantes existem em Jimp v1
      img.scaleToFit(maxDim, maxDim, (Jimp as any).RESIZE_BILINEAR);
    }

    // Por padrão, enviaremos JPEG de alta qualidade; mantém PNG se a origem é PNG
    const outMimeIsPng = mimeType?.includes("png") === true;
    const ts = new Date().getTime();
    const output = path.join(companyFolder, outMimeIsPng ? `${ts}.png` : `${ts}.jpg`);

    if (outMimeIsPng) {
      await img.writeAsync(output);
      return { output, mime: "image/png" };
    } else {
      img.quality(90); // JPEG qualidade alta
      await img.writeAsync(output);
      return { output, mime: "image/jpeg" };
    }
  } catch (e) {
    // Em caso de falha, retorna a própria imagem original
    return { output: imagePath, mime: mimeType || "image/jpeg" };
  }
};

// Processamento de vídeo para padrão HD consistente (H.264/AAC em MP4)
const processVideo = async (videoPath: string, companyId: string): Promise<string> => {
  const companyFolder = path.join(publicFolder, `company${companyId}`);
  if (!fs.existsSync(companyFolder)) fs.mkdirSync(companyFolder, { recursive: true });

  const outputVideo = path.join(companyFolder, `${new Date().getTime()}.mp4`);
  return new Promise((resolve, reject) => {
    const inputQuoted = `"${videoPath}"`;
    const outputQuoted = `"${outputVideo}"`;
    const vf = `scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease`;
    const cmd = `${ffmpegPath.path} -y -i ${inputQuoted} -vf "${vf}" -c:v libx264 -preset veryfast -crf 21 -movflags +faststart -c:a aac -b:a 128k ${outputQuoted}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[ffmpeg][processVideo] ERROR:', error.message);
        return reject(error);
      }
      resolve(outputVideo);
    });
  });
};


const processAudioFile = async (audio: string, companyId: string): Promise<string> => {
  const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.ogg`;
  return new Promise((resolve, reject) => {
    const inputQuoted = `"${audio}"`;
    const outputQuoted = `"${outputAudio}"`;
    const cmd = `${ffmpegPath.path} -y -i ${inputQuoted} -map 0:a:0 -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k -vbr on -compression_level 10 -application voip ${outputQuoted}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[ffmpeg][processAudioFile] ERROR:', error.message);
        return reject(error);
      }
      // fs.unlinkSync(audio);
      resolve(outputAudio);
    });
  });
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  companyId?: string,
  body: string = " "
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      let videoPath = pathMedia;
      if (companyId) {
        try {
          videoPath = await processVideo(pathMedia, companyId);
        } catch {
          videoPath = pathMedia;
        }
      }
      options = {
        video: fs.readFileSync(videoPath),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: "video/mp4"
      };
      if (videoPath !== pathMedia) {
        try { unlinkSync(videoPath); } catch { }
      }
    } else if (typeMessage === "audio") {
      const convert = await processAudio(pathMedia, companyId);
      options = {
        audio: fs.readFileSync(convert),
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      };
    } else if (typeMessage === "document") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      // imagem
      if (mimeType.includes("gif")) {
        options = {
          image: fs.readFileSync(pathMedia),
          caption: body ? body : null,
          mimetype: "image/gif",
          gifPlayback: true
        };
      } else if (companyId) {
        const { output, mime: outMime } = await processImage(pathMedia, companyId, String(mimeType));
        options = {
          image: fs.readFileSync(output),
          caption: body ? body : null,
          mimetype: outMime
        };
        if (output !== pathMedia) {
          try { unlinkSync(output); } catch { }
        }
      } else {
        options = {
          image: fs.readFileSync(pathMedia),
          caption: body ? body : null,
        };
      }
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body = "",
  isPrivate = false,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await getWbot(ticket.whatsappId);
    const companyId = ticket.companyId.toString()

    const pathMedia = media.path;
    const typeMessage = media.mimetype.split("/")[0];
    let options: AnyMessageContent;
    let bodyTicket = "";
    const bodyMedia = ticket ? formatBody(body, ticket) : body;

    // console.log(media.mimetype)
    if (typeMessage === "video") {
      let videoPath = pathMedia;
      if (companyId) {
        try {
          videoPath = await processVideo(pathMedia, companyId);
        } catch {
          videoPath = pathMedia;
        }
      }
      options = {
        video: fs.readFileSync(videoPath),
        caption: bodyMedia,
        fileName: media.originalname.replace('/', '-'),
        mimetype: "video/mp4",
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded },
      };
      if (videoPath !== pathMedia) {
        try { unlinkSync(videoPath); } catch { }
      }
      bodyTicket = bodyMedia || "🎥 Arquivo de vídeo"
    } else if (typeMessage === "audio") {
      const convert = await processAudio(media.path, companyId);
      options = {
        audio: fs.readFileSync(convert),
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        caption: bodyMedia,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded },
      };
      unlinkSync(convert);
      bodyTicket = "🎵 Arquivo de áudio"
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMedia,
        fileName: media.originalname.replace('/', '-'),
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded },
      };
      bodyTicket = "📂 Documento"
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMedia,
        fileName: media.originalname.replace('/', '-'),
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded },
      };
      bodyTicket = "📎 Outros anexos"
    } else {
      if (media.mimetype.includes("gif")) {
        options = {
          image: fs.readFileSync(pathMedia),
          caption: bodyMedia,
          mimetype: "image/gif",
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded },
          gifPlayback: true

        };
      } else {
        let outPath = pathMedia;
        let outMime: string | undefined = undefined;
        try {
          const processed = await processImage(pathMedia, companyId, media.mimetype);
          outPath = processed.output;
          outMime = processed.mime;
        } catch {
          outPath = pathMedia;
        }
        options = {
          image: fs.readFileSync(outPath),
          caption: bodyMedia,
          mimetype: outMime,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded },
        };
        if (outPath !== pathMedia) {
          try { unlinkSync(outPath); } catch { }
        }
      }
      bodyTicket = "🖼️ Imagem"
    }

    if (isPrivate === true) {
      const messageData = {
        wid: `PVT${companyId}${ticket.id}${body.substring(0, 6)}`,
        ticketId: ticket.id,
        contactId: undefined,
        body: bodyMedia,
        fromMe: true,
        mediaUrl: media.filename,
        mediaType: media.mimetype.split("/")[0],
        read: true,
        quotedMsgId: null,
        ack: 2,
        remoteJid: null,
        participant: null,
        dataJson: null,
        ticketTrakingId: null,
        isPrivate
      };

      await CreateMessageService({ messageData, companyId: ticket.companyId });

      return
    }

    const contactNumber = await Contact.findByPk(ticket.contactId)

    let number: string;

    if (contactNumber.remoteJid && contactNumber.remoteJid !== "" && contactNumber.remoteJid.includes("@")) {
      number = contactNumber.remoteJid;
    } else {
      number = `${contactNumber.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`;
    }

    const sentMessage = await wbot.sendMessage(
      number,
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: body !== media.filename ? body : bodyMedia, imported: null });

    return sentMessage;
  } catch (err) {
    console.log(`ERRO AO ENVIAR MIDIA ${ticket.id} media ${media.originalname}`)
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
