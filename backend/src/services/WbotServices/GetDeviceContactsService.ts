import { getWbot } from "../../libs/wbot";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import logger from "../../utils/logger";
import { isString, isArray } from "lodash";
import { getLabelMap, getChatLabelIds, getAllChatLabels, mapLabelIdsToTags } from "../../libs/labelCache";

export const getUnlabeledJids = async (companyId: number, whatsappId?: number): Promise<Set<string>> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
  const unlabeled = new Set<string>();
  try {
    const chatLabels = getAllChatLabels(defaultWhatsapp.id);
    logger.info(`[getUnlabeledJids] Cache tem ${chatLabels.size} chats com labels`);
    
    // Montar conjunto de todos os JIDs conhecidos
    const allJids = new Set<string>();
    try {
      const baileysData = await ShowBaileysService(defaultWhatsapp.id);
      const parseMaybeJSON = (val: any) => {
        try { if (!val) return null; if (isString(val)) return JSON.parse(val as string); return val; } catch { return null; }
      };
      const contacts = parseMaybeJSON((baileysData as any).contacts);
      const chats = parseMaybeJSON((baileysData as any).chats);
      
      if (isArray(contacts)) {
        contacts.forEach((c: any) => { 
          if (c?.id && c.id.includes('@') && !c.id.endsWith('@g.us')) allJids.add(String(c.id)); 
        });
        logger.info(`[getUnlabeledJids] Baileys contacts: ${contacts.length}`);
      }
      
      if (isArray(chats)) {
        chats.forEach((c: any) => { 
          if (c?.id && c.id.includes('@') && !c.id.endsWith('@g.us')) allJids.add(String(c.id)); 
        });
        logger.info(`[getUnlabeledJids] Baileys chats: ${chats.length}`);
      }
    } catch (err: any) {
      logger.warn(`[getUnlabeledJids] Erro ao acessar Baileys: ${err?.message}`);
    }
    
    // Se não veio nada persistido, usar apenas chaves do cache
    if (allJids.size === 0) {
      for (const jid of chatLabels.keys()) {
        if (jid && jid.includes('@') && !jid.endsWith('@g.us')) allJids.add(String(jid));
      }
      logger.info(`[getUnlabeledJids] Usando apenas cache, ${allJids.size} JIDs`);
    } else {
      logger.info(`[getUnlabeledJids] Total JIDs conhecidos: ${allJids.size}`);
    }
    
    // Verificar quais não têm labels
    for (const jid of allJids) {
      const set = chatLabels.get(jid);
      if (!set || set.size === 0) {
        unlabeled.add(jid);
      }
    }
    
    logger.info(`[getUnlabeledJids] Encontrados ${unlabeled.size} contatos sem etiqueta`);
  } catch (err: any) {
    logger.error(`[getUnlabeledJids] Erro geral: ${err?.message}`);
  }
  return unlabeled;
};

const GetDeviceContactsService = async (companyId: number, whatsappId?: number) => {
  const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);

  if (!defaultWhatsapp) {
    throw new Error("No WhatsApp session found for this company");
  }

  try {
    logger.info(`[GetDeviceContactsService] Buscando contatos para company=${companyId}, whatsappId=${defaultWhatsapp.id}`);

    // Método 1: Tentar via store ativo
    const wbot = getWbot(defaultWhatsapp.id);
    let deviceContacts: any[] = [];

    if (wbot && wbot.store) {
      try {
        const contacts = wbot.store.contacts;
        if (contacts) {
          const labelMap = getLabelMap(defaultWhatsapp.id);
          deviceContacts = Object.values(contacts)
            .filter((contact: any) => {
              return contact.id && !contact.id.endsWith('@g.us') && contact.id.includes('@');
            })
            .map((contact: any) => ({
              id: contact.id,
              name: contact.name || contact.notify || contact.pushname || '',
              notify: contact.notify || '',
              pushname: contact.pushname || '',
              // Preferir associações do cache para construir tags
              tags: (() => {
                const labelIds = getChatLabelIds(defaultWhatsapp.id, contact.id) || [];
                const uniq = Array.from(new Set(labelIds.map((x: any) => String(x))));
                return uniq.map((tagId: string) => ({
                  id: tagId,
                  name: (labelMap.get(tagId) as any)?.name || tagId
                }));
              })()
            }));
          
          logger.info(`[GetDeviceContactsService] Encontrados ${deviceContacts.length} contatos via store ativo`);
        }
      } catch (storeError) {
        logger.warn(`[GetDeviceContactsService] Erro ao acessar store ativo: ${storeError}`);
      }
    }

    // Método 2: Se não encontrou contatos via store, tentar via dados do Baileys
    if (deviceContacts.length === 0) {
      try {
        logger.info(`[GetDeviceContactsService] Tentando via dados persistidos do Baileys`);
        const baileysData = await ShowBaileysService(defaultWhatsapp.id);

        const parseMaybeJSON = (val: any) => {
          try {
            if (!val) return null;
            if (isString(val)) return JSON.parse(val as string);
            return val;
          } catch {
            return null;
          }
        };

        const contacts = parseMaybeJSON((baileysData as any).contacts);
        const chats = parseMaybeJSON((baileysData as any).chats);
        const labelMap = getLabelMap(defaultWhatsapp.id);

        logger.info(`[GetDeviceContactsService] Contacts parsed: ${contacts ? 'sim' : 'não'}, length: ${contacts ? contacts.length : 0}`);
        logger.info(`[GetDeviceContactsService] Chats parsed: ${chats ? 'sim' : 'não'}, length: ${chats ? chats.length : 0}`);

        // Extrair contatos dos dados do Baileys
        if (isArray(contacts)) {
          deviceContacts = contacts
            .filter((contact: any) => {
              return contact.id && !contact.id.endsWith('@g.us') && contact.id.includes('@');
            })
            .map((contact: any) => {
              const labelIdsFromCache = getChatLabelIds(defaultWhatsapp.id, contact.id) || [];
              const uniq = Array.from(new Set(labelIdsFromCache.map((x: any) => String(x))));
              const tags = uniq.map((tagId: string) => ({
                id: tagId,
                name: (labelMap.get(tagId) as any)?.name || tagId
              }));
              return {
                id: contact.id,
                name: contact.name || contact.notify || contact.pushname || '',
                notify: contact.notify || '',
                pushname: contact.pushname || '',
                tags
              };
            });
        }

        // Também extrair contatos dos CHATS (mesmo sem labels) para listar todos
        if (isArray(chats)) {
          const contactsFromChats = chats
            .filter((chat: any) => {
              return chat.id && !chat.id.endsWith('@g.us') && chat.id.includes('@');
            })
            .map((chat: any) => {
              // Montar tags com prioridade ao cache de associações
              const cacheIds = getChatLabelIds(defaultWhatsapp.id, chat.id) || [];
              const persistedIds = Array.isArray(chat.labels) ? chat.labels : [];
              const unionIds = Array.from(new Set([...cacheIds, ...persistedIds].map((x: any) => String(x))));
              const tags = unionIds.map((labelId: string) => {
                const lab = labelMap.get(String(labelId));
                return {
                  id: String(labelId),
                  name: lab?.name || String(labelId)
                };
              });

              return {
                id: chat.id,
                name: chat.name || chat.notify || chat.pushname || '',
                notify: chat.notify || '',
                pushname: chat.pushname || '',
                tags
              };
            });

          // Combinar contatos únicos e preservar tags existentes
          contactsFromChats.forEach((chatContact: any) => {
            const existing = deviceContacts.find(c => c.id === chatContact.id);
            if (!existing) {
              deviceContacts.push(chatContact);
            } else {
              const existingTagIds = new Set((existing.tags || []).map((t: any) => String(t.id)));
              const incomingNew = (chatContact.tags || []).filter((t: any) => !existingTagIds.has(String(t.id)));
              if (incomingNew.length > 0) {
                existing.tags = [...(existing.tags || []), ...incomingNew];
              }
            }
          });
        }

        logger.info(`[GetDeviceContactsService] Encontrados ${deviceContacts.length} contatos via dados do Baileys`);
      } catch (baileysError) {
        logger.warn(`[GetDeviceContactsService] Erro ao acessar dados do Baileys: ${baileysError}`);
      }
    }

    // Método 3: Fallback puro pelo cache de labels/associações (sem depender do Baileys persistido)
    if (deviceContacts.length === 0) {
      try {
        const chatLabels = getAllChatLabels(defaultWhatsapp.id);
        const labelMap = getLabelMap(defaultWhatsapp.id);
        const contactsFromCache: any[] = [];
        
        // Buscar dados do Baileys uma vez só (otimização)
        let baileysContacts: any[] = [];
        let baileysChats: any[] = [];
        try {
          const baileysData = await ShowBaileysService(defaultWhatsapp.id);
          const parseMaybeJSON = (val: any) => {
            try { if (!val) return null; if (isString(val)) return JSON.parse(val as string); return val; } catch { return null; }
          };
          const contacts = parseMaybeJSON((baileysData as any).contacts);
          const chats = parseMaybeJSON((baileysData as any).chats);
          if (isArray(contacts)) baileysContacts = contacts;
          if (isArray(chats)) baileysChats = chats;
          logger.info(`[GetDeviceContactsService] Baileys data: ${baileysContacts.length} contacts, ${baileysChats.length} chats`);
        } catch (err: any) {
          logger.warn(`[GetDeviceContactsService] Erro ao buscar dados Baileys: ${err?.message}`);
        }
        
        // Criar mapas para busca rápida
        const contactsMap = new Map();
        const chatsMap = new Map();
        
        baileysContacts.forEach((c: any) => {
          if (c?.id) contactsMap.set(String(c.id), c);
        });
        
        baileysChats.forEach((c: any) => {
          if (c?.id) chatsMap.set(String(c.id), c);
        });
        
        for (const [jid, set] of chatLabels.entries()) {
          if (!jid || jid.endsWith('@g.us') || !jid.includes('@')) continue; // apenas 1:1
          const labelIds = Array.from(set || []);
          const tags = mapLabelIdsToTags(defaultWhatsapp.id, labelIds);
          
          // Resolver nome do contato (prioridade: contact > chat > número)
          const contact = contactsMap.get(jid);
          const chat = chatsMap.get(jid);
          
          const name = contact?.name || chat?.name || '';
          const notify = contact?.notify || chat?.notify || '';
          const pushname = contact?.pushname || chat?.pushname || '';
          
          // Fallback: usar número limpo como nome se não tiver nenhum nome
          const cleanNumber = jid.split('@')[0] || '';
          const displayName = name || notify || pushname || cleanNumber;
          
          logger.debug(`[GetDeviceContactsService] JID: ${jid}, Nome: ${displayName}`);
          
          contactsFromCache.push({
            id: jid,
            name: displayName,
            notify: notify,
            pushname: pushname,
            tags
          });
        }
        if (contactsFromCache.length > 0) {
          deviceContacts = contactsFromCache;
          logger.info(`[GetDeviceContactsService] Encontrados ${deviceContacts.length} contatos via cache de labels`);
        }
      } catch (cacheErr) {
        logger.warn(`[GetDeviceContactsService] Falha no fallback via cache de labels: ${cacheErr}`);
      }
    }

    // Se ainda não encontrou contatos, criar contatos de exemplo baseados nas etiquetas conhecidas
    if (deviceContacts.length === 0) {
      logger.info(`[GetDeviceContactsService] Nenhum contato encontrado, criando contatos de exemplo`);
      
      // Buscar contatos já importados no sistema que tenham tags
      const Contact = require("../../models/Contact").default;
      const ContactTag = require("../../models/ContactTag").default;
      const Tag = require("../../models/Tag").default;

      const existingContacts = await Contact.findAll({
        where: { companyId },
        include: [{
          model: ContactTag,
          as: 'contactTags',
          include: [{
            model: Tag,
            as: 'tags'
          }]
        }],
        limit: 50 // Limitar para não sobrecarregar
      });

      deviceContacts = existingContacts
        .filter((contact: any) => contact.contactTags && contact.contactTags.length > 0)
        .map((contact: any) => ({
          id: `${contact.number}@c.us`,
          name: contact.name || contact.number,
          notify: contact.name || '',
          pushname: contact.name || '',
          tags: contact.contactTags.map((ct: any) => ({
            id: (ct.tags?.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: ct.tags?.name || ''
          }))
        }));

      logger.info(`[GetDeviceContactsService] Criados ${deviceContacts.length} contatos de exemplo baseados no sistema`);
    }

    return deviceContacts;
  } catch (error) {
    logger.error(`[GetDeviceContactsService] Erro geral: ${error}`);
    throw new Error("Failed to retrieve contacts from WhatsApp device");
  }
};

export default GetDeviceContactsService;
