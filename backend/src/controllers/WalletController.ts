import { Request, Response } from "express";

import ListWalletsService from "../services/ContactServices/ListWalletsService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
  userId?: string;
  queueId?: string;
  limit?: string;
};

/**
 * GET /wallets — Lista contatos que possuem carteira (tag pessoal # de usuário).
 * Retorna contatos paginados + agregados (total, usuários, filas, com email).
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, userId, queueId, limit } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { contacts, count, hasMore, stats, walletUsers } = await ListWalletsService({
    searchParam,
    pageNumber,
    companyId,
    userId,
    queueId,
    limit
  });

  return res.json({ contacts, count, hasMore, stats, walletUsers });
};
