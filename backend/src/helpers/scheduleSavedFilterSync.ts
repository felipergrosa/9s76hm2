import { Op } from "sequelize";
import ContactList from "../models/ContactList";
import logger from "../utils/logger";

/**
 * Re-sincronização automática de ContactLists com savedFilter.
 *
 * Coalescência por empresa (leading edge): a primeira alteração de
 * contato/tag agenda a sincronização; alterações subsequentes dentro da
 * janela não criam novos timers. Resultado: staleness máximo ~60s e no
 * máximo 1 sync por janela por empresa, mesmo sob tráfego contínuo.
 * O cron diário (SavedFilterCronManager) segue como rede de segurança.
 */
const SYNC_DELAY_MS = 60 * 1000;
const timers = new Map<number, NodeJS.Timeout>();

const runSyncForCompany = async (companyId: number): Promise<void> => {
  const lists = await ContactList.findAll({
    where: { companyId, savedFilter: { [Op.ne]: null } },
    attributes: ["id", "companyId"]
  });
  if (!lists.length) return;

  // Import tardio: chamado a partir de hooks de model — evita ciclo de imports
  const SyncContactListBySavedFilterService = (
    await import("../services/ContactListService/SyncContactListBySavedFilterService")
  ).default;

  for (const list of lists) {
    try {
      const result = await SyncContactListBySavedFilterService({
        contactListId: list.id,
        companyId
      });
      if (result.added || result.removed) {
        logger.info(
          `[savedFilterSync] Lista ${list.id} atualizada: +${result.added} novos, -${result.removed} removidos`
        );
      }
    } catch (err: any) {
      logger.error(`[savedFilterSync] Erro ao sincronizar lista ${list.id}: ${err?.message}`);
    }
  }
};

const scheduleSavedFilterSync = (companyId?: number | null): void => {
  if (!companyId) return;
  if (timers.has(companyId)) return; // já agendado — coalescido

  const timer = setTimeout(() => {
    timers.delete(companyId);
    runSyncForCompany(companyId).catch((err: any) =>
      logger.error(`[savedFilterSync] Falha na empresa ${companyId}: ${err?.message}`)
    );
  }, SYNC_DELAY_MS);
  if (typeof (timer as any).unref === "function") timer.unref();
  timers.set(companyId, timer);
};

// Extrai companyId(s) de um where de bulk operation (escalar, array ou { Op.in })
export const extractCompanyIdsFromWhere = (where: any): number[] => {
  const isInt = (v: any): v is number => Number.isInteger(v);
  const raw = where?.companyId;
  if (typeof raw === "number") return [raw];
  if (Array.isArray(raw)) return Array.from(new Set(raw.filter(isInt)));
  if (raw && typeof raw === "object") {
    const values = Object.values(raw).flat().filter(isInt);
    return Array.from(new Set(values));
  }
  return [];
};

export default scheduleSavedFilterSync;
