import { Router } from "express";
import { getIO } from "../libs/socket";
import User from "../models/User";

const router = Router();

// Endpoint para testar emissão de status de usuário
router.post("/test-user-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { online = true } = req.body;

    // Buscar usuário no banco
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "profile", "online", "companyId", "profileImage", "startWork", "endWork", "lastActivityAt", "status"]
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Atualizar status
    await user.update({ 
      online, 
      lastActivityAt: online ? new Date() : user.lastActivityAt 
    });

    // Emitir evento Socket.IO
    const io = getIO();
    io.of(`/workspace-${user.companyId}`)
      .emit(`company-${user.companyId}-user`, {
        action: "update",
        user: {
          ...user.toJSON(),
          online: online
        }
      });

    console.log(`[TestStatus] Evento emitido para usuário ${userId}, online=${online}`);

    res.json({ 
      success: true, 
      userId: user.id,
      online: user.online,
      lastActivityAt: user.lastActivityAt
    });

  } catch (error) {
    console.error("[TestStatus] Erro:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
