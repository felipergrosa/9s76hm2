import { CronJob } from "cron";
import { Op } from "sequelize";
import User from "../models/User";
import { getIO } from "../libs/socket";

/**
 * Job para verificar inatividade dos usuários e atualizar status
 * 
 * Regras:
 * - Online: lastActivityAt < 2 horas
 * - Ausente: lastActivityAt entre 2h e 3h
 * - Offline: lastActivityAt > 3h OU online=false
 */
const startUserStatusJob = () => {
  const job = new CronJob("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      // Buscar usuários que estão online mas inativos
      const usersToUpdate = await User.findAll({
        where: {
          online: true,
          lastActivityAt: {
            [Op.lt]: twoHoursAgo // Inativos por mais de 2h
          }
        },
        attributes: ["id", "companyId", "lastActivityAt", "online"]
      });

      for (const user of usersToUpdate) {
        const lastActivity = user.lastActivityAt;
        let newStatus: "online" | "ausente" | "offline" = "online";
        
        if (lastActivity && lastActivity < threeHoursAgo) {
          // Offline: mais de 3h sem atividade
          newStatus = "offline";
        } else if (lastActivity && lastActivity < twoHoursAgo) {
          // Ausente: entre 2h e 3h sem atividade
          newStatus = "ausente";
        }

        if (newStatus === "offline") {
          // Atualiza para offline
          await user.update({ online: false });
          
          // Emite evento socket
          const io = getIO();
          io.of(`/workspace-${user.companyId}`)
            .emit(`company-${user.companyId}-user`, {
              action: "update",
              user: {
                id: user.id,
                online: false,
                status: "offline"
              }
            });
          
          console.log(`[UserStatusJob] Usuário ${user.id} → offline (inativo por 3h+)`);
        } else if (newStatus === "ausente") {
          // Emite evento de ausente (não muda online, apenas status visual)
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
          
          console.log(`[UserStatusJob] Usuário ${user.id} → ausente (inativo por 2-3h)`);
        }
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
