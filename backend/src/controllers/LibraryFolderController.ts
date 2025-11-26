import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateLibraryFolderService from "../services/LibraryFolderService/CreateLibraryFolderService";
import ListLibraryFoldersService from "../services/LibraryFolderService/ListLibraryFoldersService";
import ShowLibraryFolderService from "../services/LibraryFolderService/ShowLibraryFolderService";
import UpdateLibraryFolderService from "../services/LibraryFolderService/UpdateLibraryFolderService";
import DeleteLibraryFolderService from "../services/LibraryFolderService/DeleteLibraryFolderService";
import IndexFolderService from "../services/RAG/IndexFolderService";
import ReindexFolderService from "../services/RAG/ReindexFolderService";
import IndexAllLibraryFilesService from "../services/RAG/IndexAllLibraryFilesService";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { parentId } = req.query;

    const folders = await ListLibraryFoldersService({
        companyId,
        parentId: parentId ? Number(parentId) : undefined
    });

    return res.status(200).json(folders);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const {
        name,
        parentId,
        description,
        defaultTags,
        defaultLanguage,
        ragPriority
    } = req.body;

    const folder = await CreateLibraryFolderService({
        companyId,
        name,
        parentId: parentId || undefined,
        description,
        defaultTags,
        defaultLanguage,
        ragPriority
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-library-folder`, {
            action: "create",
            folder
        });

    return res.status(200).json(folder);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { folderId } = req.params;

    const folder = await ShowLibraryFolderService({
        folderId: Number(folderId),
        companyId
    });

    return res.status(200).json(folder);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { folderId } = req.params;
    const {
        name,
        description,
        defaultTags,
        defaultLanguage,
        ragPriority
    } = req.body;

    const folder = await UpdateLibraryFolderService({
        folderId: Number(folderId),
        companyId,
        name,
        description,
        defaultTags,
        defaultLanguage,
        ragPriority
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-library-folder`, {
            action: "update",
            folder
        });

    return res.status(200).json(folder);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { folderId } = req.params;

    await DeleteLibraryFolderService({ folderId: Number(folderId) });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-library-folder`, {
            action: "delete",
            folderId: Number(folderId)
        });

    return res.status(200).send();
};

export const indexFolder = async (req: Request, res: Response): Promise<Response> => {
    const { folderId } = req.params;
    const { recursive } = req.body;

    const result = await IndexFolderService({
        folderId: Number(folderId),
        recursive: recursive || false
    });

    return res.status(200).json(result);
};

export const reindexFolder = async (req: Request, res: Response): Promise<Response> => {
    const { folderId } = req.params;
    const { recursive } = req.body;

    const result = await ReindexFolderService({
        folderId: Number(folderId),
        recursive: recursive || false
    });

    return res.status(200).json(result);
};

export const indexAll = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    const result = await IndexAllLibraryFilesService({
        companyId
    });

    return res.status(200).json(result);
};
