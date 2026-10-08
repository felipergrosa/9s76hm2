import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as WalletController from "../controllers/WalletController";

const walletRoutes = express.Router();

// Listagem de contatos com carteira (tag pessoal # de usuário) + agregados
walletRoutes.get("/wallets", isAuth, checkPermission("contacts.view"), WalletController.index);

export default walletRoutes;
