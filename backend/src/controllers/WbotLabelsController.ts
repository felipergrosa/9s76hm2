import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import { getAllChatLabels, getLabels } from "../libs/labelCache";
import RebuildDeviceTagsService from "../services/WbotServices/RebuildDeviceTagsService";

export const getLabelsDebug = async (req: Request, res: Response) => {
  try {
    const whatsappId = Number(req.params.whatsappId);
    if (!whatsappId) return res.status(400).json({ error: "whatsappId inválido" });

    const labels = getLabels(whatsappId);
    const chatMap = getAllChatLabels(whatsappId);

    const associationsPreview: Array<{ chatId: string; labels: string[] }> = [];
    for (const [chatId, set] of chatMap.entries()) {
      associationsPreview.push({ chatId, labels: Array.from(set) });
      if (associationsPreview.length >= 50) break;
    }

    // Testar getUnlabeledJids
    const { getUnlabeledJids } = require("../services/WbotServices/GetDeviceContactsService");
    let unlabeledCount = 0;
    try {
      const unlabeled = await getUnlabeledJids(1, whatsappId); // assumindo companyId=1
      unlabeledCount = unlabeled.size;
    } catch (err: any) {
      logger.warn(`[getLabelsDebug] Erro ao buscar unlabeled: ${err?.message}`);
    }

    return res.json({
      whatsappId,
      labelsCount: labels.length,
      labels,
      chatsWithLabels: chatMap.size,
      unlabeledCount,
      associationsPreview
    });
  } catch (e: any) {
    logger.warn(`[getLabelsDebug] error: ${e?.message}`);
    return res.status(500).json({ error: e?.message || "debug failed" });
  }
};

export const listGroups = async (req: Request, res: Response) => {
  try {
    const whatsappId = Number(req.params.whatsappId);
    if (!whatsappId) return res.status(400).json({ error: "whatsappId inválido" });

    const wpp = await Whatsapp.findByPk(whatsappId);
    if (!wpp) return res.status(404).json({ error: "Whatsapp não encontrado" });

    let wbot: any;
    try {
      const { getWbot } = require("../libs/wbot");
      wbot = getWbot(whatsappId);
    } catch (err: any) {
      return res.status(400).json({ error: "WhatsApp não conectado" });
    }

    if (!wbot?.groupFetchAllParticipating) {
      return res.status(400).json({ error: "Sessão não suporta listagem de grupos" });
    }

    const groupsMap = await wbot.groupFetchAllParticipating();
    const groups = Object.values(groupsMap || {}).map((g: any) => ({
      id: String(g?.id || ""),
      subject: String(g?.subject || ""),
      participantsCount: Array.isArray(g?.participants) ? g.participants.length : 0,
      owner: g?.owner ? String(g.owner) : null
    })).filter((g: any) => Boolean(g.id));

    groups.sort((a: any, b: any) => (a.subject || "").localeCompare(b.subject || ""));

    return res.json({ whatsappId, groups });
  } catch (e: any) {
    logger.warn(`[listGroups] error: ${e?.message}`);
    return res.status(500).json({ error: e?.message || "list groups failed" });
  }
};

export const rebuildTags = async (req: Request, res: Response) => {
  try {
    const whatsappId = Number(req.params.whatsappId);
    if (!whatsappId) return res.status(400).json({ error: "whatsappId inválido" });

    const wpp = await Whatsapp.findByPk(whatsappId);
    if (!wpp) return res.status(404).json({ error: "Whatsapp não encontrado" });

    const result = await RebuildDeviceTagsService(wpp.companyId, whatsappId);
    return res.json({ ok: true, result });
  } catch (e: any) {
    logger.warn(`[rebuildTags] error: ${e?.message}`);
    return res.status(500).json({ error: e?.message || "rebuild failed" });
  }
};

export const forceLabelsSync = async (req: Request, res: Response) => {
  try {
    const whatsappId = Number(req.params.whatsappId);
    if (!whatsappId) return res.status(400).json({ error: "whatsappId inválido" });

    const wpp = await Whatsapp.findByPk(whatsappId);
    if (!wpp) return res.status(404).json({ error: "Whatsapp não encontrado" });

    // Forçar resync específico de labels
    const { getWbot } = require("../libs/wbot");
    const wbot = getWbot(whatsappId);
    
    if (!wbot) {
      return res.status(400).json({ error: "WhatsApp não conectado" });
    }

    logger.info(`[forceLabelsSync] Forçando resync de labels para whatsappId=${whatsappId}`);
    
    // Tentar resync focado em labels
    try {
      const { ALL_WA_PATCH_NAMES } = require("@whiskeysockets/baileys");
      const labelPatches = (ALL_WA_PATCH_NAMES || []).filter((n: string) => /label/i.test(n));
      
      if (labelPatches.length > 0) {
        await wbot.resyncAppState(labelPatches, true);
        logger.info(`[forceLabelsSync] Label patches resync solicitado: ${labelPatches.join(', ')}`);
      }
      
      // Resync completo como fallback
      await wbot.resyncAppState(ALL_WA_PATCH_NAMES, true);
      logger.info(`[forceLabelsSync] Full resync solicitado como fallback`);
      
    } catch (syncErr: any) {
      logger.warn(`[forceLabelsSync] Erro no resync: ${syncErr?.message}`);
    }

    // Aguardar um pouco e verificar cache
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { getLabels } = require("../libs/labelCache");
    const labels = getLabels(whatsappId);
    
    return res.json({ 
      ok: true, 
      message: "Resync de labels solicitado",
      labelsInCache: labels.length,
      labels: labels.slice(0, 10) // Primeiras 10 para debug
    });
    
  } catch (e: any) {
    logger.warn(`[forceLabelsSync] error: ${e?.message}`);
    return res.status(500).json({ error: e?.message || "force sync failed" });
  }
};

export const rebuildCacheFromBaileys = async (req: Request, res: Response) => {
  try {
    const whatsappId = Number(req.params.whatsappId);
    if (!whatsappId) return res.status(400).json({ error: "whatsappId inválido" });

    const wpp = await Whatsapp.findByPk(whatsappId);
    if (!wpp) return res.status(404).json({ error: "Whatsapp não encontrado" });

    logger.info(`[rebuildCacheFromBaileys] Reconstruindo cache para whatsappId=${whatsappId}`);

    const { upsertLabel, addChatLabelAssociation, clearCache } = require("../libs/labelCache");
    const ShowBaileysService = require("../services/BaileysServices/ShowBaileysService").default;

    // Limpar cache atual
    clearCache(whatsappId);
    logger.info(`[rebuildCacheFromBaileys] Cache limpo`);

    // Buscar dados do Baileys
    const baileysData = await ShowBaileysService(whatsappId);
    const parseMaybeJSON = (val: any) => {
      try { if (!val) return null; if (typeof val === 'string') return JSON.parse(val); return val; } catch { return null; }
    };

    const chats = parseMaybeJSON((baileysData as any).chats) || [];
    const contacts = parseMaybeJSON((baileysData as any).contacts) || [];

    logger.info(`[rebuildCacheFromBaileys] Dados encontrados: ${chats.length} chats, ${contacts.length} contacts`);

    let labelsFound = new Set<string>();
    let associationsCount = 0;

    // Processar chats para extrair labels e associações
    if (Array.isArray(chats)) {
      for (const chat of chats) {
        const chatId = String(chat?.id || "");
        if (!chatId) continue;

        const labels = Array.isArray(chat?.labels) ? chat.labels : (Array.isArray(chat?.labelIds) ? chat.labelIds : []);
        
        for (const label of labels) {
          const labelId = String(typeof label === 'object' ? (label?.id || label?.value || label) : label);
          if (!labelId) continue;

          labelsFound.add(labelId);
          
          // Se o label veio como objeto, extrair nome e cor
          if (typeof label === 'object' && label?.name) {
            upsertLabel(whatsappId, {
              id: labelId,
              name: String(label.name),
              color: label.color
            });
          }

          // Adicionar associação
          addChatLabelAssociation(whatsappId, chatId, labelId, true);
          associationsCount++;
        }
      }
    }

    // Criar labels básicas para IDs que não têm nome
    for (const labelId of labelsFound) {
      upsertLabel(whatsappId, {
        id: labelId,
        name: labelId, // Fallback para o ID
        color: "#A4CCCC"
      });
    }

    const { getLabels, getAllChatLabels } = require("../libs/labelCache");
    const finalLabels = getLabels(whatsappId);
    const finalAssociations = getAllChatLabels(whatsappId);

    logger.info(`[rebuildCacheFromBaileys] Reconstrução concluída: ${finalLabels.length} labels, ${finalAssociations.size} chats com associações`);

    return res.json({
      ok: true,
      message: "Cache reconstruído com sucesso",
      labelsCount: finalLabels.length,
      chatsWithLabels: finalAssociations.size,
      associationsCount,
      labels: finalLabels
    });

  } catch (e: any) {
    logger.error(`[rebuildCacheFromBaileys] error: ${e?.message}`);
    return res.status(500).json({ error: e?.message || "rebuild cache failed" });
  }
};
