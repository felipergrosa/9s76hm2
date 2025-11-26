import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import LinkFolderToQueueService from "../services/QueueRAGSourceService/LinkFolderToQueueService";
import UnlinkFolderFromQueueService from "../services/QueueRAGSourceService/UnlinkFolderFromQueueService";
import ListFoldersByQueueService from "../services/QueueRAGSourceService/ListFoldersByQueueService";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { queueId } = req.params;

    const folders = await ListFoldersByQueueService({
        queueId: Number(queueId)
    });

    return res.status(200).json(folders);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { queueId } = req.params;
    const { folderId, weight } = req.body;

    const ragSource = await LinkFolderToQueueService({
        queueId: Number(queueId),
        folderId: Number(folderId),
        weight
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-queue-rag-source`, {
            action: "create",
            queueId: Number(queueId),
            ragSource
        });

    return res.status(200).json(ragSource);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { queueId, folderId } = req.params;

    await UnlinkFolderFromQueueService({
        queueId: Number(queueId),
        folderId: Number(folderId)
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-queue-rag-source`, {
            action: "delete",
            queueId: Number(queueId),
            folderId: Number(folderId)
        });

    return res.status(200).send();
};
