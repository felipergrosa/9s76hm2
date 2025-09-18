import { Chat, Contact } from "@whiskeysockets/baileys";
import Baileys from "../../models/Baileys";
import { isString } from "lodash";

interface Request {
  whatsappId: number;
  contacts?: Contact[];
  chats?: Chat[];
}

const createOrUpdateBaileysService = async ({
  whatsappId,
  contacts,
  chats,
}: Request): Promise<Baileys> => {

  try {
    const baileysExists = await Baileys.findOne({
      where: { whatsappId }
    });

    if (baileysExists) {
      let getChats: Chat[] = [];
      let getContacts: Contact[] = [];

      // Converte/normaliza CHATS existentes (aceita string JSON ou objeto)
      if (baileysExists.chats) {
        try {
          if (isString(baileysExists.chats)) {
            getChats = JSON.parse(baileysExists.chats as any);
          } else {
            // Já veio como objeto/array do DB (JSON/JSONB)
            getChats = (baileysExists.chats as unknown) as Chat[];
          }
        } catch (err) {
          console.warn(`Chats JSON inválido, substituindo por []`);
          getChats = [];
        }
      }

      // Converte/normaliza CONTATOS existentes (aceita string JSON ou objeto)
      if (baileysExists.contacts) {
        try {
          if (isString(baileysExists.contacts)) {
            getContacts = JSON.parse(baileysExists.contacts as any);
          } else {
            getContacts = (baileysExists.contacts as unknown) as Contact[];
          }
        } catch (err) {
          console.warn(`Contacts JSON inválido, substituindo por []`);
          getContacts = [];
        }
      }

      // Função de merge: última atualização prevalece; labels = união
      const mergeChats = (base: any[], updates: any[]): any[] => {
        const byId = new Map<string, any>();
        for (const c of base || []) {
          if (c && c.id) byId.set(String(c.id), c);
        }
        for (const u of updates || []) {
          if (!u || !u.id) continue;
          const id = String(u.id);
          const prev = byId.get(id) || {};
          let merged: any = { ...prev, ...u };
          const prevLabels = Array.isArray(prev.labels) ? prev.labels : [];
          const newLabels = Array.isArray(u.labels) ? u.labels : [];
          if (prevLabels.length || newLabels.length) {
            // Se updates marcar 'labelsAbsolute', substitui; senão, faz união
            const source = (u as any).labelsAbsolute ? newLabels : [...prevLabels, ...newLabels];
            const flat = source.map((x: any) => {
              if (x && typeof x === 'object') return String(x.id ?? x.value ?? x);
              return String(x);
            });
            const uniq = Array.from(new Set(flat));
            merged.labels = uniq;
          }
          byId.set(id, merged);
        }
        return Array.from(byId.values());
      };

      const mergeContactsArr = (base: any[], updates: any[]): any[] => {
        const byId = new Map<string, any>();
        for (const c of base || []) {
          if (c && c.id) byId.set(String(c.id), c);
        }
        for (const u of updates || []) {
          if (!u || !u.id) continue;
          const id = String(u.id);
          const prev = byId.get(id) || {};
          const merged = { ...prev, ...u };
          byId.set(id, merged);
        }
        return Array.from(byId.values());
      };

      // A partir daqui o fluxo continua com merge robusto
      if (chats) {
        const incoming = Array.isArray(chats) ? chats : [chats as any];
        const newChats = mergeChats(getChats, incoming);
        return await baileysExists.update({
          chats: JSON.stringify(newChats),
        });
      }

      if (contacts) {
        const incoming = Array.isArray(contacts) ? contacts : [contacts as any];
        const newContacts = mergeContactsArr(getContacts, incoming);
        return await baileysExists.update({
          contacts: JSON.stringify(newContacts),
        });
      }
    }

    const baileys = await Baileys.create({
      whatsappId,
      contacts: JSON.stringify(contacts),
      chats: JSON.stringify(chats)
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    return baileys;
  } catch (error) {
    console.log(error, whatsappId, contacts);
    throw new Error(error);
  }
};

export default createOrUpdateBaileysService;