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
import { safeNormalizePhoneNumber, isRealPhoneNumber, MAX_PHONE_DIGITS } from "../../utils/phone";
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
  lidJid?: string; // LID para contatos com identificador LID
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
  dtUltCompra?: Date | string | null;
  vlUltCompra?: number | string | null;
  verifiedName?: string;
  pushName?: string;
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
  lidJid,
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
  dtUltCompra,
  vlUltCompra,
  verifiedName,
  pushName,
  checkProfilePic = true // Por padrão verifica (comportamento antigo)
}: Request): Promise<Contact> => {
  try {
    let createContact = false;
    let shouldEmitUpdate = false;
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

    const rawNumberDigits = isGroup ? (rawNumber || "").toString().trim() : (rawNumber || "").toString();
    const isLinkedDevice = !!remoteJid && remoteJid.includes("@lid");
    const { canonical } = (!isGroup && !isLinkedDevice) ? safeNormalizePhoneNumber(rawNumberDigits) : { canonical: null };

    // VALIDAÇÃO CRÍTICA: Mesmo LIDs com formato de telefone devem ser validados
    if (isLinkedDevice && rawNumberDigits.length >= 10 && rawNumberDigits.length <= 13) {
      const { canonical: lidCanonical } = safeNormalizePhoneNumber(rawNumberDigits);
      if (!lidCanonical) {
        logger.error("[CreateOrUpdateContactService] LID com formato de telefone inválido", {
          rawNumberDigits,
          remoteJid,
          companyId
        });
        throw new Error(`LID com formato de telefone inválido: ${rawNumberDigits}`);
      }
    }

    // Para LID, não bloquear pela canonical: usa rawNumberDigits ou remoteJid como fallback
    let number = (isGroup || isLinkedDevice) ? rawNumberDigits : canonical;

    // =================================================================
    // VALIDAÇÃO CRÍTICA: Detectar inconsistência isGroup vs número
    // =================================================================
    // Se isGroup=false mas número parece ser de grupo (@g.us), REJEITAR
    // Isso previne contatos individuais sendo salvos como grupos
    if (!isGroup && number && number.includes("@g.us")) {
      logger.error("[CreateOrUpdateContact] BLOQUEADO: isGroup=false mas número tem @g.us", {
        number,
        isGroup,
        remoteJid,
        companyId,
        name
      });
      return null as any;
    }

    // =================================================================
    // VALIDAÇÃO ROBUSTA DE GRUPOS: Garantir que grupos tenham @g.us
    // =================================================================
    if (isGroup) {
      // Garantir que número de grupo tenha @g.us
      if (!number.includes("@g.us")) {
        // Remover qualquer sufixo existente e adicionar @g.us
        const cleanGroupNumber = number.replace(/@.*$/, "");
        number = `${cleanGroupNumber}@g.us`;
      }
    }

    if (!isGroup && isLinkedDevice) {
      number = canonical || rawNumberDigits || remoteJid || "";
    }

    // =================================================================
    // GUARD: Número de telefone NUNCA pode ser um LID puro (>13 dígitos)
    // Telefones reais têm no máximo 13 dígitos (55 + DDD + 9 dígitos)
    // =================================================================
    if (!isGroup && number) {
      const numberDigitsOnly = number.replace(/\D/g, "");
      
      // BLOQUEAR: números com >13 dígitos são LIDs ou IDs internos da Meta
      if (numberDigitsOnly.length > MAX_PHONE_DIGITS && !number.startsWith("PENDING_")) {
        logger.error("[CreateOrUpdateContact] BLOQUEADO: Número parece ser LID/ID Meta (>13 dígitos)", {
          number,
          digitsLength: numberDigitsOnly.length,
          remoteJid,
          companyId
        });
        return null as any;
      }
      
      // BLOQUEAR: números que não passam na validação de telefone real
      if (!isRealPhoneNumber(numberDigitsOnly) && !number.startsWith("PENDING_")) {
        logger.error("[CreateOrUpdateContact] BLOQUEADO: Número não é telefone válido", {
          number,
          digitsLength: numberDigitsOnly.length,
          remoteJid,
          companyId
        });
        return null as any;
      }
    }

    // VALIDAÇÃO CRÍTICA: Rejeitar IDs internos da Meta/Facebook (> 13 dígitos)
    // Números brasileiros válidos têm no máximo 13 dígitos (55 + DDD + 9 + 8 dígitos)
    // IDs da Meta como "247540473708749" têm 15+ dígitos
    const numberDigitsOnly = (number || "").replace(/\D/g, "");
    if (!isGroup && !isLinkedDevice && numberDigitsOnly.length > MAX_PHONE_DIGITS) {
      logger.warn("[CreateOrUpdateContactService] REJEITADO: Número muito longo (provável ID Meta/Facebook)", {
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
      // logger.warn("[CreateOrUpdateContactService] Número inválido após normalização", {
      //   rawNumber,
      //   companyId,
      //   isLinkedDevice,
      //   remoteJid
      // });
      return null as any;
    }


    // Garante que creditLimit seja null se não estiver definido
    const sanitizedCreditLimit = (creditLimit === null || creditLimit === undefined || creditLimit === '') ? null : String(creditLimit);
    const sanitizedCpfCnpj = cpfCnpj ? cpfCnpj.replace(/[^0-9]/g, "") : null;

    // Validação e normalização para dtUltCompra
    let dtUltCompraValue: Date | null = null;
    if (dtUltCompra && typeof dtUltCompra === 'string' && dtUltCompra !== '') {
      const d = new Date(dtUltCompra);
      if (isNaN(d.getTime())) {
        logger.warn("[CreateOrUpdateContactService] dtUltCompra inválido, usando null", { dtUltCompra });
        dtUltCompraValue = null;
      } else {
        dtUltCompraValue = d;
      }
    } else if (dtUltCompra instanceof Date) {
      dtUltCompraValue = dtUltCompra;
    }

    // Normalização para vlUltCompra
    let vlUltCompraValue: number | null = null;
    if (vlUltCompra !== null && vlUltCompra !== undefined && vlUltCompra !== '') {
      const num = parseFloat(String(vlUltCompra).replace(/[^\d.,]/g, '').replace(',', '.'));
      vlUltCompraValue = isNaN(num) ? null : num;
    }

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
      remoteJid: remoteJid || undefined,
      lidJid: lidJid || undefined,
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
      clientCode: clientCode || undefined,
      dtUltCompra: dtUltCompraValue,
      vlUltCompra: vlUltCompraValue,
      verifiedName: verifiedName || undefined,
      pushName: pushName || undefined
    };

    const io = getIO();
    let contact: Contact | null;

    // Busca por número/canonical E pelo remoteJid quando for LID, para evitar duplicados
    contact = await Contact.findOne({
      where: isGroup
        ? { number, companyId }
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
      if (!isGroup && !isLinkedDevice) {
        // Lógica para preservar o formato do número se for o mesmo contato (mesmo canonical)
        const { canonical: currentCanonical } = safeNormalizePhoneNumber(contact.number);
        const { canonical: newCanonical } = safeNormalizePhoneNumber(number);

        if (currentCanonical && newCanonical && currentCanonical === newCanonical) {
          number = contact.number;
        }

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
      // Atualizar dtUltCompra e vlUltCompra se fornecidos
      if (dtUltCompraValue !== undefined) {
        (contact as any).dtUltCompra = dtUltCompraValue;
      }
      if (vlUltCompraValue !== undefined) {
        (contact as any).vlUltCompra = vlUltCompraValue;
      }

      // Atualizar pushName SOMENTE se nome atual for igual ao número
      if (pushName) {
        const currentNameClean = (contact.name || "").replace(/\D/g, "");
        const numberClean = String(number).replace(/\D/g, "");
        const isNameEqualNumber = !contact.name || currentNameClean === numberClean;
        
        if (isNameEqualNumber) {
          contact.pushName = pushName;
          // Substituir nome pelo pushName quando nome é igual ao número
          (contactData as any).name = pushName;
        }
        // Se nome já é personalizado, NÃO preencher pushName
      }
      
      // verifiedName tem prioridade e sempre atualiza quando nome é igual ao número
      if (verifiedName) {
        contact.verifiedName = verifiedName;
        const currentNameClean = (contact.name || "").replace(/\D/g, "");
        const numberClean = String(number).replace(/\D/g, "");
        const isNameEqualNumber = !contact.name || currentNameClean === numberClean;
        
        if (isNameEqualNumber) {
          (contactData as any).name = verifiedName;
        }
      }

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
      // Busca de avatar centralizada no RefreshContactAvatarService

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

      if (!remoteJid || remoteJid === "") {
        newRemoteJid = isGroup ? `${rawNumber}@g.us` : `${rawNumber}@s.whatsapp.net`;
      }

      // Busca de avatar centralizada no RefreshContactAvatarService
      profilePicUrl = profilePicUrl || `${process.env.FRONTEND_URL}/nopicture.png`;

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
              message: "[CreateOrUpdateContactService] LID duplicado detectado - promovendo para número real",
              lidContactId: lidContactToMerge.id,
              lidRemoteJid: lidContactToMerge.remoteJid,
              newContactName: effectiveName,
              newContactNumber: number,
              companyId
            });

            // Atualizar o contato LID existente com o número real (sem chamar merge)
            try {
              await lidContactToMerge.update({
                number,
                canonicalNumber: number,
                remoteJid: newRemoteJid,
                lidJid: lidContactToMerge.remoteJid, // Preservar LID original
                profilePicUrl: profilePicUrl || null,
                whatsappId
              });
              await lidContactToMerge.reload();

              logger.info({
                message: "[CreateOrUpdateContactService] LID promovido com número real",
                contactId: lidContactToMerge.id,
                newNumber: number,
                newRemoteJid
              });

              return lidContactToMerge;
            } catch (promoteError: any) {
              logger.warn({
                message: "[CreateOrUpdateContactService] Erro ao promover LID, continuando com criação normal",
                error: promoteError?.message
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
            logger.debug(
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
            logger.debug(
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
    // logger.error("Error to find or create a contact:", err);
    throw err;
  }
};

export default CreateOrUpdateContactService;
