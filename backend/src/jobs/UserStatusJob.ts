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

      console.log(`[UserStatusJob] Verificando status - ${now.toISOString()}`);

      // 0. Primeiro, atualizar usuários com lastActivityAt=null que estão online
      // Isso acontece quando o usuário fica online mas lastActivityAt não foi setado
      const usersWithNullActivity = await User.findAll({
        where: {
          online: true,
          lastActivityAt: null
        },
        attributes: ["id", "companyId", "name"]
      });

      if (usersWithNullActivity.length > 0) {
        console.log(`[UserStatusJob] ${usersWithNullActivity.length} usuários online com lastActivityAt=null - atualizando`);
        for (const user of usersWithNullActivity) {
          await User.update(
            { lastActivityAt: now },
            { where: { id: user.id } }
          );
          console.log(`[UserStatusJob] Usuário ${user.name} (ID: ${user.id}) - lastActivityAt atualizado`);
        }
      }

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

      if (usersToOffline.length > 0) {
        console.log(`[UserStatusJob] ${usersToOffline.length} usuários para offline`);
      }

      for (const user of usersToOffline) {
        await User.update(
          { online: false, status: null },
          { where: { id: user.id } }
        );

        // Buscar dados completos do usuário para emitir
        const fullUser = await User.findByPk(user.id, {
          attributes: ["id", "name", "email", "profile", "online", "companyId", "profileImage", "startWork", "endWork", "lastActivityAt", "status"]
        });

        // Emitir evento com dados completos
        const io = getIO();
        io.of(`/workspace-${user.companyId}`)
          .emit(`company-${user.companyId}-user`, {
            action: "update",
            user: {
              ...fullUser.toJSON(),
              online: false,
              status: null
            }
          });

        console.log(`[UserStatusJob] Usuário ${user.name} (ID: ${user.id}) -> offline`);
      }

      // 2. Usuários online entre 2h e 3h -> marcar como ausente
      const usersToAway = await User.findAll({
        where: {
          online: true,
          lastActivityAt: {
            [Op.gte]: twoHoursAgo,
            [Op.lt]: threeHoursAgo
          }
        },
        attributes: ["id", "companyId", "name", "status"]
      });

      if (usersToAway.length > 0) {
        console.log(`[UserStatusJob] ${usersToAway.length} usuários para ausente`);
      }

      for (const user of usersToAway) {
        // Só atualiza se não estiver já como ausente
        if (user.status !== "ausente") {
          await User.update(
            { status: "ausente" },
            { where: { id: user.id } }
          );

          // Buscar dados completos do usuário para emitir
          const fullUser = await User.findByPk(user.id, {
            attributes: ["id", "name", "email", "profile", "online", "companyId", "profileImage", "startWork", "endWork", "lastActivityAt", "status"]
          });

          // Emitir evento com dados completos
          const io = getIO();
          io.of(`/workspace-${user.companyId}`)
            .emit(`company-${user.companyId}-user`, {
              action: "update",
              user: {
                ...fullUser.toJSON(),
                online: true,
                status: "ausente"
              }
            });

          console.log(`[UserStatusJob] Usuário ${user.name} (ID: ${user.id}) -> ausente`);
        }
      }

      // 3. Usuários online há menos de 2h -> garantir status null
      const usersToOnline = await User.findAll({
        where: {
          online: true,
          lastActivityAt: {
            [Op.gte]: twoHoursAgo
          }
        },
        attributes: ["id", "companyId", "name", "status"]
      });

      if (usersToOnline.length > 0) {
        console.log(`[UserStatusJob] ${usersToOnline.length} usuários online confirmados`);
      }

      for (const user of usersToOnline) {
        // Limpar status se estiver como ausente
        if (user.status === "ausente") {
          await User.update(
            { status: null },
            { where: { id: user.id } }
          );

          // Buscar dados completos do usuário para emitir
          const fullUser = await User.findByPk(user.id, {
            attributes: ["id", "name", "email", "profile", "online", "companyId", "profileImage", "startWork", "endWork", "lastActivityAt", "status"]
          });

          // Emitir evento com dados completos
          const io = getIO();
          io.of(`/workspace-${user.companyId}`)
            .emit(`company-${user.companyId}-user`, {
              action: "update",
              user: {
                ...fullUser.toJSON(),
                online: true,
                status: null
              }
            });

          console.log(`[UserStatusJob] Usuário ${user.name} (ID: ${user.id}) -> online (status limpo)`);
        }
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
