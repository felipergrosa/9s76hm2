import { getIO } from "../libs/socket";
import ShowUserService from "../services/UserServices/ShowUserService";
import { SerializeUser } from "./SerializeUser";

export const updateUser = async (userId, companyId) => {
  const user = await ShowUserService(userId, companyId);

  user.changed('updatedAt', true);

  let update = null;

  update = { updatedAt: new Date() };
  if (!user.online) {
    // console.log("updateUser", user.online, update)

    update = { ...update, online: true };
    await user.update(update);

    await user.reload();

    // Emitir o shape serializado (permissões EFETIVAS) — o model cru expõe
    // só a coluna ACL e zera as permissões do usuário logado no frontend.
    // O token de sessão nunca é transmitido via socket.
    user.queues = await user.$get("queues");
    const serializedUser = await SerializeUser(user);
    delete serializedUser.token;

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${user.companyId}-user`, {
        action: "update",
        user: serializedUser
      });
  } else {
    await user.update(update);
  }
}
