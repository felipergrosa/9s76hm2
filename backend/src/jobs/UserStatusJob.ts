import { CronJob } from "cron";
import { Op } from "sequelize";
import User from "../models/User";
import { getIO } from "../libs/socket";

/**
 * Job para verificar inatividade dos usuários e atualizar status
 * 
 * Regras:
 * - Online: lastActivityAt < 2 horas
 * - Ausente: lastActivityAt entre 2h e 3h (online=true, status="ausente")
 * - Offline: lastActivityAt > 3h (online=false, status=null)
 */
const startUserStatusJob = () => {
  const job = new CronJob("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      // 1. Usuários online há mais de 3h -> marcar como offline
      const usersToOffline = await User.findAll({
        where: {
          online: true,
          lastActivityAt: {
            [Op.lt]: threeHoursAgo
          }
        },
        attributes: ["id", "companyId", "name"]
      });

      for (const user of usersToOffline) {
        await user.update({ 
          online: false,
          status: null
        });

        // Emitir evento
        const io = getIO();
        io.of(`/workspace-${user.companyId}`)
          .emit(`company-${user.companyId}-user`, {
            action: "update",
            user: {
              id: user.id,
              online: false,
              status: null
            }
          });
        
        console.log(`[UserStatusJob] ${user.name} (${user.id}) → offline (3h+ inativo)`);
      }

      // 2. Usuários online entre 2h e 3h -> marcar como ausente
      const usersToAway = await User.findAll({
        where: {
          online: true,
          lastActivityAt: {
            [Op.gte]: threeHoursAgo,
            [Op.lt]: twoHoursAgo
          },
          [Op.or]: [
            { status: null },
            { status: { [Op.ne]: "ausente" } }
          ]
        },
        attributes: ["id", "companyId", "name"]
      });

      for (const user of usersToAway) {
        await user.update({ status: "ausente" });

        // Emitir evento
        const io = getIO();
        io.of(`/workspace-${user.companyId}`)
          .emit(`company-${user.companyId}-user`, {
            action: "update",
            user: {
              id: user.id,
              online: true,
              status: "ausente"
            }
          });
        
        console.log(`[UserStatusJob] ${user.name} (${user.id}) → ausente (2-3h inativo)`);
      }

      // 3. Usuários online há menos de 2h -> garantir status online
      const usersToOnline = await User.findAll({
        where: {
          online: true,
          lastActivityAt: {
            [Op.gte]: twoHoursAgo
          },
          status: { [Op.ne]: null }
        },
        attributes: ["id", "companyId", "name"]
      });

      for (const user of usersToOnline) {
        await user.update({ status: null });

        // Emitir evento
        const io = getIO();
        io.of(`/workspace-${user.companyId}`)
          .emit(`company-${user.companyId}-user`, {
            action: "update",
            user: {
              id: user.id,
              online: true,
              status: null
            }
          });
        
        console.log(`[UserStatusJob] ${user.name} (${user.id}) → online (<2h inativo)`);
      }

      if (usersToOffline.length > 0 || usersToAway.length > 0 || usersToOnline.length > 0) {
        console.log(`[UserStatusJob] Atualizados: ${usersToOffline.length} offline, ${usersToAway.length} ausente, ${usersToOnline.length} online`);
      }
    } catch (error) {
      console.error("[UserStatusJob] Erro:", error);
    }
  });

  job.start();
  console.log("[UserStatusJob] Iniciado - verificação a cada 5 minutos");
  return job;
};

export default startUserStatusJob;
