import { getIO } from "../../libs/socket";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import ContactWallet from "../../models/ContactWallet";
import fs from "fs";
import path, { join } from "path";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import * as Sentry from "@sentry/node";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import DispatchContactWebhookService from "./DispatchContactWebhookService";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";
import { Op, UniqueConstraintError } from "sequelize";

const axios = require("axios");

const applyAutoTagFromWhatsapp = async (
  contact: Contact | null,
  companyId: number,
  whatsappId?: number
): Promise<void> => {
  if (!contact || !whatsappId || Number.isNaN(Number(whatsappId))) return;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["id", "contactTagId"]
  });

  const tagId = Number((whatsapp as any)?.contactTagId);
  if (!tagId || Number.isNaN(tagId)) return;

  const tag = await Tag.findOne({
    where: { id: tagId, companyId },
    attributes: ["id"]
  });
  if (!tag) return;

  await ContactTag.findOrCreate({
    where: { contactId: contact.id, tagId: tag.id },
    defaults: { contactId: contact.id, tagId: tag.id }
  });

  try {
    await SyncContactWalletsAndPersonalTagsService({
      companyId,
      contactId: contact.id,
      source: "tags"
    });
  } catch (err) {
    logger.warn("[CreateOrUpdateContactService] Falha ao sincronizar carteiras/tags após auto tag", err);
  }
};

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
  region?: string;
  instagram?: string;
  situation?: string;
  fantasyName?: string;
  foundationDate?: Date;
  creditLimit?: string;
  segment?: string;
  clientCode?: string;
  checkProfilePic?: boolean; // Novo parametro para evitar rate limit na importação
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
    // Se não tem URL, não tenta baixar
    if (!profilePicUrl) return null;

    const response = await axios.get(profilePicUrl, {
      responseType: 'arraybuffer'
    });

    filename = `${new Date().getTime()}.jpeg`;
    fs.writeFileSync(join(folder, filename), response.data);

  } catch (error) {
    console.error("Erro ao baixar profile image:", error?.message);
    return null; // Retorna null em caso de erro para não sobrescrever
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
  region,
  instagram,
  situation,
  fantasyName,
  foundationDate,
  creditLimit,
  segment,
  clientCode,
  checkProfilePic = true // Por padrão verifica (comportamento antigo)
}: Request): Promise<Contact> => {
  try {
    let createContact = false;
    let shouldEmitUpdate = false;
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

    const rawNumberDigits = isGroup ? (rawNumber || "").toString().trim() : (rawNumber || "").toString();
    const isLinkedDevice = !!remoteJid && remoteJid.includes("@lid");
    const { canonical } = !isGroup ? safeNormalizePhoneNumber(rawNumberDigits) : { canonical: null };

    // Para LID, não bloquear pela canonical: usa rawNumberDigits ou remoteJid como fallback
    let number = isGroup ? rawNumberDigits : canonical;

    // =================================================================
    // VALIDAÇÃO ROBUSTA DE GRUPOS: Garantir que grupos tenham @g.us
    // =================================================================
    if (isGroup) {
      // Garantir que número de grupo tenha @g.us
      if (!number.includes("@g.us")) {
        // Remover qualquer sufixo existente e adicionar @g.us
        const cleanGroupNumber = number.replace(/@.*$/, "");
        number = `${cleanGroupNumber}@g.us`;
        logger.info("[CreateOrUpdateContactService] Grupo corrigido: adicionado @g.us", {
          original: rawNumberDigits,
          corrected: number,
          companyId
        });
      }
    }
    if (!isGroup && isLinkedDevice) {
      number = canonical || rawNumberDigits || remoteJid || "";
    }

    // VALIDAÇÃO CRÍTICA: Rejeitar IDs internos da Meta/Facebook (> 13 dígitos)
    // Números brasileiros válidos têm no máximo 13 dígitos (55 + DDD + 9 + 8 dígitos)
    // IDs da Meta como "247540473708749" têm 15+ dígitos
    const numberDigitsOnly = (number || "").replace(/\D/g, "");
    if (!isGroup && !isLinkedDevice && numberDigitsOnly.length > 13) {
      logger.error("[CreateOrUpdateContactService] REJEITADO: Número muito longo (provável ID Meta/Facebook)", {
        rawNumber,
        number,
        length: numberDigitsOnly.length,
        companyId,
        isLinkedDevice,
        remoteJid
      });
      return null as any;
    }

    if (!isGroup && !number) {
      logger.warn("[CreateOrUpdateContactService] Número inválido após normalização", {
        rawNumber,
        companyId,
        isLinkedDevice,
        remoteJid
      });
      return null as any;
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

    const normalizedRegion = ((): string | null | undefined => {
      if (typeof region === 'undefined') return undefined;
      if (region === null) return null;
      if (typeof region === 'string') {
        const r = region.trim();
        return r === '' ? null : r;
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
      region: normalizedRegion,
      instagram: instagram || undefined,
      situation: situation || "Ativo",
      fantasyName: fantasyName || undefined,
      foundationDate: foundationDate || undefined,
      creditLimit: sanitizedCreditLimit,
      segment: normalizedSegment,
      clientCode: clientCode || undefined
    };

    const io = getIO();
    let contact: Contact | null;

    // Busca por número/canonical E pelo remoteJid quando for LID, para evitar duplicados
    contact = await Contact.findOne({
      where: isGroup
        ? { number: rawNumberDigits, companyId }
        : {
          companyId,
          [Op.or]: [
            { canonicalNumber: number },
            { number },
            remoteJid ? { remoteJid } : {}
          ]
        }
    });

    // Só tenta atualizar imagem se checkProfilePic for true
    let updateImage = checkProfilePic && (!contact || contact?.profilePicUrl !== profilePicUrl && profilePicUrl !== "") && wbot || false;

    if (contact) {
      // Captura valores anteriores para detectar mudanças
      const oldName = contact.name;
      const oldProfilePicUrl = contact.profilePicUrl;

      contact.remoteJid = remoteJid;
      contact.profilePicUrl = profilePicUrl || null;
      contact.isGroup = isGroup;
      if (!isGroup) {
        contact.number = number;
        contact.canonicalNumber = number;
      }
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
      contact.region = normalizedRegion !== undefined ? (normalizedRegion as any) : (contact as any).region;
      contact.clientCode = clientCode || contact.clientCode;

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
      if (checkProfilePic && (!contact.urlPicture || !fs.existsSync(fileName) || contact.profilePicUrl === "")) {
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

      // Marca para emitir update se nome ou avatar mudaram
      if (oldName !== contact.name || oldProfilePicUrl !== contact.profilePicUrl) {
        shouldEmitUpdate = true;
      }

    } else if (wbot && ['whatsapp'].includes(channel)) {
      const settings = await CompaniesSettings.findOne({ where: { companyId } });
      const { acceptAudioMessageContact } = settings;
      let newRemoteJid = remoteJid;

      if (!remoteJid && remoteJid !== "") {
        newRemoteJid = isGroup ? `${rawNumber}@g.us` : `${rawNumber}@s.whatsapp.net`;
      }

      try {
        if (checkProfilePic) {
          profilePicUrl = await wbot.profilePictureUrl(remoteJid, "image");
        } else {
          profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
        }
      } catch (e) {
        Sentry.captureException(e);
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      // Definir nome efetivo na criação: se não vier nome válido, usa o número como fallback
      {
        const incomingName = (name || "").trim();
        const effectiveName = incomingName && incomingName !== number ? incomingName : number;
        
        // =================================================================
        // PROTEÇÃO CONTRA DUPLICAÇÃO DE LIDs
        // Antes de criar novo contato, verificar se existe LID com mesmo nome
        // Se existir, mesclar automaticamente
        // =================================================================
        let lidContactToMerge: Contact | null = null;
        
        if (!isGroup && effectiveName && effectiveName !== number) {
          // Buscar contato LID com mesmo nome
          lidContactToMerge = await Contact.findOne({
            where: {
              companyId,
              name: effectiveName,
              remoteJid: { [Op.like]: '%@lid' },
              isGroup: false
            }
          });
          
          if (lidContactToMerge) {
            logger.info({
              message: "[CreateOrUpdateContactService] LID duplicado detectado - mesclando automaticamente",
              lidContactId: lidContactToMerge.id,
              lidRemoteJid: lidContactToMerge.remoteJid,
              newContactName: effectiveName,
              newContactNumber: number,
              companyId
            });
            
            // Importar serviço de mesclagem dinamicamente
            try {
              const MergeContactsService = (await import("./MergeContactsService")).default;
              await MergeContactsService({
                primaryContactId: lidContactToMerge.id,
                secondaryContactId: lidContactToMerge.id, // Mesmo ID - apenas atualizar
                companyId
              });
              
              // Retornar o contato LID existente (agora atualizado)
              await lidContactToMerge.update({
                number,
                canonicalNumber: number,
                remoteJid: newRemoteJid,
                profilePicUrl: profilePicUrl || null,
                whatsappId
              });
              await lidContactToMerge.reload();
              
              logger.info({
                message: "[CreateOrUpdateContactService] LID atualizado com número real",
                contactId: lidContactToMerge.id,
                newNumber: number,
                newRemoteJid
              });
              
              return lidContactToMerge;
            } catch (mergeError) {
              logger.warn({
                message: "[CreateOrUpdateContactService] Erro ao mesclar LID, continuando com criação normal",
                error: mergeError.message
              });
            }
          }
        }
        
        // Criação normal (se não houve mesclagem)
        try {
          contact = await Contact.create({
            ...contactData,
            name: effectiveName,
            channel,
            acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
            remoteJid: newRemoteJid,
            whatsappId,
            canonicalNumber: isGroup ? null : number
          });
          createContact = true;
        } catch (error) {
          if (error instanceof UniqueConstraintError) {
            logger.warn(
              { number, companyId, remoteJid: newRemoteJid },
              "CreateOrUpdateContactService: contato já existe (constraint) — reutilizando."
            );
            contact = await Contact.findOne({
              where: {
                companyId,
                [Op.or]: [
                  { canonicalNumber: number },
                  { number },
                  newRemoteJid ? { remoteJid: newRemoteJid } : {}
                ]
              }
            });
            if (contact) {
              await contact.update({
                ...contactData,
                name: contact.name || effectiveName,
                channel,
                acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
                remoteJid: newRemoteJid,
                whatsappId,
                canonicalNumber: isGroup ? null : number
              });
              createContact = false;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    } else if (['facebook', 'instagram'].includes(channel)) {
      // Mesma proteção ao criar via outros canais
      {
        const incomingName = (name || "").trim();
        const effectiveName = incomingName && incomingName !== number ? incomingName : number;
        try {
          contact = await Contact.create({
            ...contactData,
            name: effectiveName,
            channel,
            whatsappId,
            canonicalNumber: isGroup ? null : number
          });
          createContact = true;
        } catch (error) {
          if (error instanceof UniqueConstraintError) {
            logger.warn(
              { number, companyId, remoteJid },
              "CreateOrUpdateContactService: contato já existe (constraint) — reutilizando."
            );
            contact = await Contact.findOne({
              where: {
                companyId,
                [Op.or]: [
                  { canonicalNumber: number },
                  { number },
                  remoteJid ? { remoteJid } : {}
                ]
              }
            });
            if (contact) {
              await contact.update({
                ...contactData,
                name: contact.name || effectiveName,
                channel,
                whatsappId,
                canonicalNumber: isGroup ? null : number
              });
              createContact = false;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
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
      shouldEmitUpdate = true; // Avatar atualizado
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
        shouldEmitUpdate = true; // Avatar atualizado (facebook/instagram)
      }
    }

    // Aplica tag automática configurada na conexão
    try {
      await applyAutoTagFromWhatsapp(contact, companyId, whatsappId);
      await contact?.reload();
    } catch (err) {
      logger.warn("[CreateOrUpdateContactService] Falha ao aplicar tag automática da conexão", err);
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
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "create",
          contact
        });
    } else if (shouldEmitUpdate) {
      // Só emite update se houve mudança real (nome, avatar, etc)
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
    }

    try {
      if (createContact && contact) {
        await DispatchContactWebhookService({
          companyId,
          contact,
          event: "create",
          source: "wbot"
        });
      } else if (shouldEmitUpdate && contact) {
        await DispatchContactWebhookService({
          companyId,
          contact,
          event: "update",
          source: "wbot"
        });
      }
    } catch (err) {
      logger.warn("[CreateOrUpdateContactService] Falha ao disparar webhook de contato", err);
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
