import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateLibraryFileService from "../services/LibraryFileService/CreateLibraryFileService";
import ListLibraryFilesService from "../services/LibraryFileService/ListLibraryFilesService";
import UpdateLibraryFileService from "../services/LibraryFileService/UpdateLibraryFileService";
import DeleteLibraryFileService from "../services/LibraryFileService/DeleteLibraryFileService";
import ListLibraryTagsService from "../services/LibraryFileService/ListLibraryTagsService";
import CheckDuplicateFilesInFolderService from "../services/LibraryFileService/CheckDuplicateFilesInFolderService";
import IndexLibraryFileService from "../services/RAG/IndexLibraryFileService";
import ReindexLibraryFileService from "../services/RAG/ReindexLibraryFileService";
import { LibraryFileStatus } from "../models/LibraryFile";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { folderId, statusRag } = req.query;

    const files = await ListLibraryFilesService({
        folderId: Number(folderId),
        statusRag: statusRag as LibraryFileStatus | undefined
    });

    return res.status(200).json(files);
};

export const listTags = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    const tags = await ListLibraryTagsService({ companyId });

    return res.status(200).json(tags);
};

export const checkDuplicates = async (req: Request, res: Response): Promise<Response> => {
    const { folderId, files } = req.body;

    const duplicates = await CheckDuplicateFilesInFolderService({
        folderId: Number(folderId),
        files: (files || []).map((f: any, index: number) => ({
            index: typeof f.index === 'number' ? f.index : index,
            name: String(f.name || ''),
            size: typeof f.size === 'number' ? f.size : undefined
        }))
    });

    return res.status(200).json({ duplicates });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const {
        folderId,
        fileOptionId,
        title,
        tags
    } = req.body;

    const file = await CreateLibraryFileService({
        folderId: Number(folderId),
        fileOptionId: Number(fileOptionId),
        title,
        tags
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-library-file`, {
            action: "create",
            file
        });

    return res.status(200).json(file);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { fileId } = req.params;
    const { title, tags, folderId, fileOptionId } = req.body;

    const file = await UpdateLibraryFileService({
        fileId: Number(fileId),
        title,
        tags,
        folderId,
        fileOptionId
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-library-file`, {
            action: "update",
            file
        });

    return res.status(200).json(file);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { fileId } = req.params;

    await DeleteLibraryFileService({ fileId: Number(fileId) });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-library-file`, {
            action: "delete",
            fileId: Number(fileId)
        });

    return res.status(200).send();
};

export const indexFile = async (req: Request, res: Response): Promise<Response> => {
    const { fileId } = req.params;

    const result = await IndexLibraryFileService({
        fileId: Number(fileId)
    });

    return res.status(200).json(result);
};

export const reindexFile = async (req: Request, res: Response): Promise<Response> => {
    const { fileId } = req.params;

    const result = await ReindexLibraryFileService({
        fileId: Number(fileId)
    });

    return res.status(200).json(result);
};
