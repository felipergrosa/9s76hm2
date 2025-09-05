import { getIO } from "../../libs/socket";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import fs from "fs";
import path, { join } from "path";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import * as Sentry from "@sentry/node";

const axios = require('axios');

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  channel?: string;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  whatsappId?: number;
  wbot?: any;
  userId?: string | number;
  // Novos campos
  cpfCnpj?: string;
  representativeCode?: string;
  city?: string;
  instagram?: string;
  situation?: string;
  fantasyName?: string;
  foundationDate?: Date;
  creditLimit?: string;
  segment?: string;
}

const downloadProfileImage = async ({
  profilePicUrl,
  companyId,
  contact
}) => {
  const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
  let filename;


  const folder = path.resolve(publicFolder, `company${companyId}`, "contacts");

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }

  try {

    const response = await axios.get(profilePicUrl, {
      responseType: 'arraybuffer'
    });

    filename = `${new Date().getTime()}.jpeg`;
    fs.writeFileSync(join(folder, filename), response.data);

  } catch (error) {
    console.error(error)
  }

  return filename
}

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email,
  channel = "whatsapp",
  companyId,
  extraInfo = [],
  remoteJid,
  whatsappId,
  wbot,
  userId,
  // Novos campos
  cpfCnpj,
  representativeCode,
  city,
  instagram,
  situation,
  fantasyName,
  foundationDate,
  creditLimit,
  segment
}: Request): Promise<Contact> => {
  try {
    let createContact = false;
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
    // Após sanitizar o número…
if (!isGroup) {
  const numLen = number.length;
  if (numLen < 10 || numLen > 13) {
    try {
      const existing = await Contact.findOne({ where: { number, companyId } });
      if (existing) {
        return existing;
      }
    } catch (err) {
      logger.warn("Falha ao buscar contato existente para número inválido", err);
    }
    return null as any;
  }
}


    // Garante que creditLimit seja null se não estiver definido
    const sanitizedCreditLimit = (creditLimit === null || creditLimit === undefined || creditLimit === '') ? null : String(creditLimit);
    const sanitizedCpfCnpj = cpfCnpj ? cpfCnpj.replace(/[^0-9]/g, "") : null;

    // Normalização de email: nunca null
    const normalizedEmail = ((): string | undefined => {
      if (email === null) return "";
      if (typeof email === "string") return email.trim();
      return undefined;
    })();

    const normalizedSegment = ((): string | null | undefined => {
      if (typeof segment === 'undefined') return undefined;
      if (segment === null) return null;
      if (typeof segment === 'string') {
        const s = segment.trim();
        return s === '' ? null : s;
      }
      return undefined;
    })();

    const contactData = {
      name,
      number,
      email: normalizedEmail,
      isGroup,
      companyId,
      profilePicUrl: profilePicUrl || undefined,
      cpfCnpj: sanitizedCpfCnpj,
      representativeCode: representativeCode || undefined,
      city: city || undefined,
      instagram: instagram || undefined,
      situation: situation || "Ativo",
      fantasyName: fantasyName || undefined,
      foundationDate: foundationDate || undefined,
      creditLimit: sanitizedCreditLimit,
      segment: normalizedSegment
    };

    const io = getIO();
    let contact: Contact | null;

    contact = await Contact.findOne({
      where: { number, companyId }
    });

    let updateImage = (!contact || contact?.profilePicUrl !== profilePicUrl && profilePicUrl !== "") && wbot || false;

    if (contact) {
      contact.remoteJid = remoteJid;
      contact.profilePicUrl = profilePicUrl || null;
      contact.isGroup = isGroup;
      // Atualiza os novos campos se eles forem fornecidos
      contact.cpfCnpj = sanitizedCpfCnpj === undefined ? contact.cpfCnpj : sanitizedCpfCnpj;
      contact.representativeCode = representativeCode || contact.representativeCode;
      contact.city = city || contact.city;
      contact.instagram = instagram || contact.instagram;
      contact.situation = situation || contact.situation;
      contact.fantasyName = fantasyName || contact.fantasyName;
      contact.foundationDate = foundationDate || contact.foundationDate;
      contact.creditLimit = creditLimit !== undefined ? (creditLimit || null) : contact.creditLimit;
      contact.segment = normalizedSegment !== undefined ? (normalizedSegment as any) : (contact as any).segment;

      if (isNil(contact.whatsappId)) {
        const whatsapp = await Whatsapp.findOne({
          where: { id: whatsappId, companyId }
        });

        

        if (whatsapp) {
          contact.whatsappId = whatsappId;
        }
      }
      const folder = path.resolve(publicFolder, `company${companyId}`, "contacts");

      let fileName, oldPath = "";
      if (contact.urlPicture) {

        oldPath = path.resolve(contact.urlPicture.replace(/\\/g, '/'));
        fileName = path.join(folder, oldPath.split('\\').pop());
      }
      // Sempre tenta atualizar imagem se não tem urlPicture ou se arquivo não existe
      if (!contact.urlPicture || !fs.existsSync(fileName) || contact.profilePicUrl === "") {
        if (wbot && ['whatsapp'].includes(channel)) {
          try {
            profilePicUrl = await wbot.profilePictureUrl(remoteJid, "image");
          } catch (e) {
            Sentry.captureException(e);
            profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
          }
          contact.profilePicUrl = profilePicUrl;
          updateImage = true;
        }
      }

      // Proteção: nunca sobrescrever nome personalizado já válido
      // Somente definir/atualizar nome quando o atual estiver vazio ou igual ao número
      const incomingName = (name || "").trim();
      const currentName = (contact.name || "").trim();
      const currentIsNumber = currentName.replace(/\D/g, "") === String(number);
      const hasValidExistingName = currentName !== "" && !currentIsNumber;

      if (hasValidExistingName) {
        // Não atualizar o campo name em hipótese alguma
        delete (contactData as any).name;
      } else {
        // Nome salvo é vazio ou igual ao número: podemos definir um melhor, senão manter número
        const incomingIsNumber = incomingName.replace(/\D/g, "") === String(number);
        contactData.name = incomingName && !incomingIsNumber ? incomingName : String(number);
      }

      // Garantir que email não fique null ao salvar
      if ((contactData as any).email === undefined) {
        (contactData as any).email = contact.email ?? "";
      }
      await contact.update(contactData);
      await contact.reload();

    } else if (wbot && ['whatsapp'].includes(channel)) {
      const settings = await CompaniesSettings.findOne({ where: { companyId } });
      const { acceptAudioMessageContact } = settings;
      let newRemoteJid = remoteJid;

      if (!remoteJid && remoteJid !== "") {
        newRemoteJid = isGroup ? `${rawNumber}@g.us` : `${rawNumber}@s.whatsapp.net`;
      }

      try {
        profilePicUrl = await wbot.profilePictureUrl(remoteJid, "image");
      } catch (e) {
        Sentry.captureException(e);
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      // Definir nome efetivo na criação: se não vier nome válido, usa o número como fallback
      {
        const incomingName = (name || "").trim();
        const effectiveName = incomingName && incomingName !== number ? incomingName : number;
        contact = await Contact.create({
          ...contactData,
          name: effectiveName,
          channel,
          acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
          remoteJid: newRemoteJid,
          whatsappId
        });
      }
      
      createContact = true;
    } else if (['facebook', 'instagram'].includes(channel)) {
      // Mesma proteção ao criar via outros canais
      {
        const incomingName = (name || "").trim();
        const effectiveName = incomingName && incomingName !== number ? incomingName : number;
        contact = await Contact.create({
          ...contactData,
          name: effectiveName,
          channel,
          whatsappId
        });
      }
    }



    if (updateImage) {


      let filename;

      filename = await downloadProfileImage({
        profilePicUrl,
        companyId,
        contact
      })


      await contact.update({
        urlPicture: filename,
        pictureUpdated: true
      });

      await contact.reload();
    } else {
      if (['facebook', 'instagram'].includes(channel)) {
        let filename;

        filename = await downloadProfileImage({
          profilePicUrl,
          companyId,
          contact
        })


        await contact.update({
          urlPicture: filename,
          pictureUpdated: true
        });

        await contact.reload();
      }
    }

    // Recarrega contato completo antes de emitir e retornar
    const Tag = require("../../models/Tag").default;
    contact = await Contact.findOne({
      where: { id: contact.id, companyId },
      include: [
        { model: Tag, as: "tags", attributes: ["id", "name", "color", "updatedAt"] }
      ]
    });

    if (createContact) {
      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "create",
          contact
        });
    } else {
      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
    }

    // Chama o serviço centralizado para atualizar nome/avatar com proteção
    try {
      const RefreshContactAvatarService = (await import("./RefreshContactAvatarService")).default;
      await RefreshContactAvatarService({ contactId: contact.id, companyId, whatsappId });
    } catch (err) {
      logger.warn("Falha ao atualizar avatar/nome centralizado", err);
    }

    return contact;
  } catch (err) {
    logger.error("Error to find or create a contact:", err);
    throw err;
  }
};

export default CreateOrUpdateContactService;
