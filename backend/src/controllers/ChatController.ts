import * as Yup from "yup";
import { Request, Response } from "express";
import { emitToCompanyNamespace } from "../libs/socketEmit";
import AppError from "../errors/AppError";

import CreateService from "../services/ChatService/CreateService";
import ListService from "../services/ChatService/ListService";
import ShowFromUuidService from "../services/ChatService/ShowFromUuidService";
import DeleteService from "../services/ChatService/DeleteService";
import FindMessages from "../services/ChatService/FindMessages";
import UpdateService from "../services/ChatService/UpdateService";

import Chat from "../models/Chat";
import CreateMessageService from "../services/ChatService/CreateMessageService";
import User from "../models/User";
import ChatUser from "../models/ChatUser";

type IndexQuery = {
  pageNumber: string;
  companyId: string | number;
  ownerId?: number;
};

type StoreData = {
  users: any[];
  title: string;
};

type FindParams = {
  companyId: number;
  ownerId?: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber } = req.query as unknown as IndexQuery;
  const { companyId } = req.user;
  const ownerId = +req.user.id;

  const { records, count, hasMore } = await ListService({
    companyId,
    ownerId,
    pageNumber
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const ownerId = +req.user.id;
    const data = req.body as StoreData;

    console.log("[ChatController.store] Creating chat with data:", { ownerId, companyId, users: data.users, title: data.title });

    const record = await CreateService({
      ...data,
      ownerId,
      companyId
    });

    if (!(record as any).wasExisting) {
      record.users.forEach(async user => {
        await emitToCompanyNamespace(
          companyId,
          `company-${companyId}-chat-user-${user.userId}`,
          {
            action: "create",
            record
          }
        );
      });
    }

    return res.status(200).json(record);
  } catch (error) {
    console.error("[ChatController.store] Error creating chat:", error);
    throw error;
  }
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const userId = +req.user.id;
  const data = req.body;
  const { id } = req.params;

  const record = await UpdateService({
    ...data,
    id: +id,
    companyId,
    userId
  });

  record.users.forEach(async user => {
    await emitToCompanyNamespace(
      companyId,
      `company-${companyId}-chat-user-${user.userId}`,
      {
        action: "update",
        record,
        userId: user.userId
      }
    );
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const userId = +req.user.id;

  const record = await ShowFromUuidService({
    uuid: id,
    userId,
    companyId
  });

  return res.status(200).json(record);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const userId = +req.user.id;

  await DeleteService({ id, companyId, userId });

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-chat`,
    {
      action: "delete",
      id
    }
  );

  return res.status(200).json({ message: "Chat deleted" });
};

export const saveMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { message } = req.body;
  const { id } = req.params;
  const senderId = +req.user.id;
  const chatId = +id;

  const newMessage = await CreateMessageService({
    chatId,
    senderId,
    message
  });

  const chat = await Chat.findByPk(chatId, {
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
    ]
  });

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-chat-${chatId}`,
    {
      action: "new-message",
      newMessage,
      chat
    }
  );

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-chat`,
    {
      action: "new-message",
      newMessage,
      chat
    }
  );

  return res.json(newMessage);
};

export const checkAsRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const userId = +req.user.id;
  const { id } = req.params;

  const existingChat = await Chat.findOne({ where: { id, companyId } });

  if (!existingChat) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const chatUser = await ChatUser.findOne({ where: { chatId: id, userId } });

  if (!chatUser) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  await chatUser.update({ unreads: 0 });

  const updatedChat = await Chat.findByPk(id, {
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
    ]
  });

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-chat-${id}`,
    {
      action: "update",
      chat: updatedChat
    }
  );

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-chat`,
    {
      action: "update",
      chat: updatedChat
    }
  );

  return res.json(updatedChat);
};

export const messages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { pageNumber } = req.query as unknown as IndexQuery;
  const { id: chatId } = req.params;
  const { companyId } = req.user;
  const ownerId = +req.user.id;

  const { records, count, hasMore } = await FindMessages({
    chatId,
    companyId,
    ownerId,
    pageNumber
  });

  return res.json({ records, count, hasMore });
};
