import * as Sentry from "@sentry/node";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import CreateContactService from "../ContactServices/CreateContactService";
import { isString, isArray } from "lodash";
import path from "path";
import fs from 'fs';
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { Op } from "sequelize";

const ImportContactsService = async (companyId: number): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(undefined, companyId);
  const wbot = getWbot(defaultWhatsapp.id);

  let phoneContacts;

  try {
    const contactsString = await ShowBaileysService(wbot.id);
    phoneContacts = JSON.parse(JSON.stringify(contactsString.contacts));

    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const beforeFilePath = path.join(publicFolder, `company${companyId}`, 'contatos_antes.txt');
    fs.writeFile(beforeFilePath, JSON.stringify(phoneContacts, null, 2), (err) => {
      if (err) {
        logger.error(`Failed to write contacts to file: ${err}`);
        throw err;
      }
      // console.log('O arquivo contatos_antes.txt foi criado!');
    });

  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Could not get whatsapp contacts from phone. Err: ${err}`);
  }

  const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
  const afterFilePath = path.join(publicFolder, `company${companyId}`, 'contatos_depois.txt');
  fs.writeFile(afterFilePath, JSON.stringify(phoneContacts, null, 2), (err) => {
    if (err) {
      logger.error(`Failed to write contacts to file: ${err}`);
      throw err;
    }
    // console.log('O arquivo contatos_depois.txt foi criado!');
  });

  const phoneContactsList = isString(phoneContacts)
    ? JSON.parse(phoneContacts)
    : phoneContacts;

  if (isArray(phoneContactsList)) {
    for (const item of phoneContactsList) {
      const { id, name, notify } = item as any;
      if (!id || id === "status@broadcast" || String(id).includes("g.us") || String(id).includes("@lid")) continue;
      const rawDigits = String(id).replace(/\D/g, "");
      const { canonical } = safeNormalizePhoneNumber(rawDigits);
      const number = canonical || rawDigits;

      try {
        const existingContact = await Contact.findOne({
          where: {
            companyId,
            [Op.or]: [
              { canonicalNumber: number },
              { number }
            ]
          }
        });
        const phoneName = (name || notify || "").trim();

        if (existingContact) {
          const currentName = (existingContact.name || "").trim();
          const isNumberName = currentName.replace(/\D/g, "") === number;

          if (!currentName || isNumberName) {
            // Atualiza nome principal quando vazio/igual ao número e armazena também em contactName
            await existingContact.update({
              name: phoneName || number,
              contactName: phoneName || null,
              remoteJid: id
            });
          } else {
            // Nome já curado pelo usuário: não sobrescrever; apenas guarda referência em contactName
            if (phoneName) {
              await existingContact.update({ contactName: phoneName, remoteJid: id });
            } else {
              await existingContact.update({ remoteJid: id });
            }
          }
        } else {
          // Criar um novo contato com name e contactName a partir do nome do aparelho
          await CreateContactService({
            number,
            name: phoneName || number,
            companyId,
            // novos campos
            // contactName espelha o nome de origem do aparelho na criação
            // florder permanece default false
            // @ts-ignore: parâmetro extra suportado pelo serviço
            contactName: phoneName || null,
            remoteJid: id
          } as any);
        }
      } catch (error) {
        Sentry.captureException(error);
        logger.warn(`Could not import phone contact ${number}. Err: ${error}`);
      }
    }
  }
};

export default ImportContactsService;
