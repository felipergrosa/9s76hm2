import api from "./api";

// ========== FOLDERS ==========

export const fetchFolders = async (parentId = null) => {
    const params = parentId ? { parentId } : {};
    const { data } = await api.get("/library/folders", { params });
    return data;
};

export const fetchAllFolders = async () => {
    const { data } = await api.get("/library/folders", { params: { all: true } });
    return data;
};

export const createFolder = async (folderData) => {
    const { data } = await api.post("/library/folders", folderData);
    return data;
};

export const updateFolder = async (folderId, folderData) => {
    const { data } = await api.put(`/library/folders/${folderId}`, folderData);
    return data;
};

export const deleteFolder = async (folderId) => {
    await api.delete(`/library/folders/${folderId}`);
};

export const indexFolder = async (folderId, recursive = false) => {
    const { data } = await api.post(`/library/folders/${folderId}/index`, { recursive });
    return data;
};

export const reindexFolder = async (folderId, recursive = false) => {
    const { data } = await api.post(`/library/folders/${folderId}/reindex`, { recursive });
    return data;
};

// ========== FILES ==========

export const fetchFiles = async (folderId) => {
    const { data } = await api.get("/library/files", { params: { folderId } });
    return data;
};

export const createFile = async (fileData) => {
    const { data } = await api.post("/library/files", fileData);
    return data;
};

export const updateFile = async (fileId, fileData) => {
    const { data } = await api.put(`/library/files/${fileId}`, fileData);
    return data;
};

export const deleteFile = async (fileId) => {
    await api.delete(`/library/files/${fileId}`);
};

export const indexFile = async (fileId) => {
    const { data } = await api.post(`/library/files/${fileId}/index`);
    return data;
};

export const reindexFile = async (fileId) => {
    const { data } = await api.post(`/library/files/${fileId}/reindex`);
    return data;
};

// ========== QUEUE RAG SOURCES ==========

export const fetchQueueFolders = async (queueId) => {
    const { data } = await api.get(`/queues/${queueId}/rag-sources`);
    return data;
};

export const linkFolderToQueue = async (queueId, folderId, weight = 1.0) => {
    const { data } = await api.post(`/queues/${queueId}/rag-sources`, { folderId, weight });
    return data;
};

export const unlinkFolderFromQueue = async (queueId, folderId) => {
    await api.delete(`/queues/${queueId}/rag-sources/${folderId}`);
};

// ========== BULK ACTIONS ==========

export const bulkDelete = async (itemIds) => {
    const promises = itemIds.map(id => {
        const [type, itemId] = id.split('-');
        if (type === 'folder') {
            return deleteFolder(itemId);
        } else {
            return deleteFile(itemId);
        }
    });
    await Promise.all(promises);
};

export const bulkIndex = async (itemIds) => {
    const promises = itemIds.map(id => {
        const [type, itemId] = id.split('-');
        if (type === 'folder') {
            return indexFolder(itemId, false);
        } else {
            return indexFile(itemId);
        }
    });
    const results = await Promise.allSettled(promises);
    return results;
};

export const indexAllLibrary = async () => {
    const { data } = await api.post("/library/index-all");
    return data;
};

export const moveItems = async (itemIds, targetFolderId) => {
    const promises = itemIds.map(id => {
        const [type, itemId] = id.split('-');
        if (type === 'folder') {
            return updateFolder(itemId, { parentId: targetFolderId });
        } else {
            return updateFile(itemId, { folderId: targetFolderId });
        }
    });
    await Promise.all(promises);
};

export const copyItems = async (itemIds, targetFolderId) => {
    // Por enquanto, retornar erro - precisa implementação no backend
    throw new Error('Funcionalidade de cópia ainda não implementada no backend');
};

