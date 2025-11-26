import React, { useState, useEffect, useContext, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemIcon, ListItemText } from '@material-ui/core';
import { Folder as FolderIcon } from '@material-ui/icons';

import MainContainer from '../../components/MainContainer';
import { AuthContext } from '../../context/Auth/AuthContext';
import toastError from '../../errors/toastError';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import BreadcrumbNav from './components/BreadcrumbNav';
import FolderGrid from './components/FolderGrid';
import FolderList from './components/FolderList';
import CreateFolderModal from './components/CreateFolderModal';
import EditFolderModal from './components/EditFolderModal';
import LinkQueueModal from './components/LinkQueueModal';
import UploadModal from './components/UploadModal';
import BulkActionsBar from './components/BulkActionsBar';
import FileViewerModal from './components/FileViewerModal';
import EditFileModal from './components/EditFileModal';

import useLibraryNavigation from './hooks/useLibraryNavigation';
import useStyles from './styles';
import * as libraryApi from '../../services/libraryApi';

const LibraryManager = () => {
    const classes = useStyles();
    const { user, socket } = useContext(AuthContext);

    const { currentFolder, breadcrumbs, navigateToFolder, navigateToBreadcrumb } = useLibraryNavigation();

    const [viewMode, setViewMode] = useState('list');
    const [searchValue, setSearchValue] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);

    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [allFolders, setAllFolders] = useState([]);
    const [loading, setLoading] = useState(false);

    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
    const [editFolderModalOpen, setEditFolderModalOpen] = useState(false);
    const [linkQueueModalOpen, setLinkQueueModalOpen] = useState(false);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [fileViewerModalOpen, setFileViewerModalOpen] = useState(false);
    const [moveFolderModalOpen, setMoveFolderModalOpen] = useState(false);

    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [editFileModalOpen, setEditFileModalOpen] = useState(false);
    const [fileToEdit, setFileToEdit] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            const foldersData = await libraryApi.fetchFolders(currentFolder);
            setFolders(foldersData);

            if (currentFolder) {
                const filesData = await libraryApi.fetchFiles(currentFolder);
                setFiles(filesData);
            } else {
                setFiles([]);
            }

            setSelectedItems([]);
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    }, [currentFolder]);

    const fetchAllFoldersList = useCallback(async () => {
        try {
            const allFoldersData = await libraryApi.fetchAllFolders();
            setAllFolders(allFoldersData);
        } catch (err) {
            toastError(err);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [currentFolder, fetchData]);

    useEffect(() => {
        fetchAllFoldersList();
    }, [fetchAllFoldersList]);

    useEffect(() => {
        const onFolderEvent = (data) => {
            if (data.action === 'create' || data.action === 'update') {
                setFolders(prev => {
                    const existing = prev.findIndex(f => f.id === data.folder.id);
                    if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = data.folder;
                        return updated;
                    }
                    return [...prev, data.folder];
                });
                fetchAllFoldersList();
            }
            if (data.action === 'delete') {
                setFolders(prev => prev.filter(f => f.id !== data.folderId));
                fetchAllFoldersList();
            }
        };

        const onFileEvent = (data) => {
            if (data.action === 'create' || data.action === 'update') {
                setFiles(prev => {
                    const existing = prev.findIndex(f => f.id === data.file.id);
                    if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = data.file;
                        return updated;
                    }
                    return [...prev, data.file];
                });
            }
            if (data.action === 'delete') {
                setFiles(prev => prev.filter(f => f.id !== data.fileId));
            }
        };

        socket.on(`company-${user.companyId}-library-folder`, onFolderEvent);
        socket.on(`company-${user.companyId}-library-file`, onFileEvent);

        return () => {
            socket.off(`company-${user.companyId}-library-folder`, onFolderEvent);
            socket.off(`company-${user.companyId}-library-file`, onFileEvent);
        };
    }, [socket, user.companyId, fetchAllFoldersList]);

    const handleCreateFolder = async (folderData) => {
        try {
            await libraryApi.createFolder({
                ...folderData,
                companyId: user.companyId
            });
            toast.success('Pasta criada com sucesso!');
            fetchData();
            fetchAllFoldersList();
        } catch (err) {
            toastError(err);
        }
    };

    const handleEditFolder = async (folderData) => {
        try {
            await libraryApi.updateFolder(selectedFolder.id, folderData);
            toast.success('Pasta atualizada com sucesso!');
            setSelectedFolder(null);
            fetchData();
            fetchAllFoldersList();
        } catch (err) {
            toastError(err);
        }
    };

    const handleFolderClick = (folder) => {
        navigateToFolder(folder.id, folder.name);
    };

    const handleFileClick = (file) => {
        setSelectedFile(file);
        setFileViewerModalOpen(true);
    };

    const handleSelectItem = (itemKey) => {
        setSelectedItems(prev =>
            prev.includes(itemKey)
                ? prev.filter(k => k !== itemKey)
                : [...prev, itemKey]
        );
    };

    const handleSelectAll = (checked, allItems) => {
        if (checked) {
            const allKeys = allItems.map(item => `${item.type}-${item.id}`);
            setSelectedItems(allKeys);
        } else {
            setSelectedItems([]);
        }
    };

    const handleMenuAction = async (action, item) => {
        try {
            switch (action) {
                case 'edit':
                    if (item.title) {
                        setFileToEdit(item);
                        setEditFileModalOpen(true);
                    } else {
                        setSelectedFolder(item);
                        setEditFolderModalOpen(true);
                    }
                    break;

                case 'linkQueue':
                    setSelectedFolder(item);
                    setLinkQueueModalOpen(true);
                    break;

                case 'details':
                    toast.info(`Detalhes de: ${item.name || item.title}`);
                    break;

                case 'share':
                    toast.info('Funcionalidade de compartilhar em breve!');
                    break;

                case 'copy':
                    toast.info('Funcionalidade de copiar em breve!');
                    break;

                case 'move':
                    setSelectedItems([`${item.title ? 'file' : 'folder'}-${item.id}`]);
                    setMoveFolderModalOpen(true);
                    break;

                case 'download':
                    if (item.fileOption?.url) {
                        try {
                            const response = await fetch(item.fileOption.url, { credentials: 'include' });
                            const blob = await response.blob();
                            const downloadUrl = window.URL.createObjectURL(blob);

                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = item.title || item.fileOption?.name || 'arquivo';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(downloadUrl);

                            toast.success('Download iniciado!');
                        } catch (e) {
                            console.error('Erro ao iniciar download', e);
                            toast.error('Erro ao fazer download do arquivo');
                        }
                    } else {
                        toast.error('URL do arquivo não encontrada');
                    }
                    break;

                case 'rename':
                    const newName = window.prompt('Novo nome:', item.name || item.title);
                    if (newName && newName.trim()) {
                        if (item.title) {
                            await libraryApi.updateFile(item.id, { title: newName.trim() });
                        } else {
                            await libraryApi.updateFolder(item.id, { name: newName.trim() });
                        }
                        toast.success('Renomeado com sucesso!');
                        fetchData();
                        fetchAllFoldersList();
                    }
                    break;

                case 'index':
                    if (item.title) {
                        await libraryApi.indexFile(item.id);
                        toast.success('Indexação do arquivo iniciada!');
                    } else {
                        await libraryApi.indexFolder(item.id, false);
                        toast.success('Indexação da pasta iniciada!');
                    }
                    break;

                case 'reindex':
                    await libraryApi.reindexFile(item.id);
                    toast.success('Reindexação do arquivo iniciada!');
                    break;

                case 'delete':
                    if (window.confirm(`Deletar ${item.name || item.title}?`)) {
                        if (item.title) {
                            await libraryApi.deleteFile(item.id);
                        } else {
                            await libraryApi.deleteFolder(item.id);
                        }
                        toast.success('Deletado com sucesso!');
                        fetchData();
                        fetchAllFoldersList();
                    }
                    break;

                default:
                    console.log('Ação não implementada:', action);
            }
        } catch (err) {
            toastError(err);
        }
    };

    // Bulk Actions
    const handleBulkDelete = async () => {
        if (window.confirm(`Deletar ${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'itens'}?`)) {
            try {
                await libraryApi.bulkDelete(selectedItems);
                toast.success('Itens deletados com sucesso!');
                setSelectedItems([]);
                fetchData();
                fetchAllFoldersList();
            } catch (err) {
                toastError(err);
            }
        }
    };

    const handleBulkMove = () => {
        setMoveFolderModalOpen(true);
    };

    const handleBulkCopy = () => {
        toast.info('Funcionalidade de copiar em lote em breve!');
    };

    const handleBulkIndex = async () => {
        try {
            const results = await libraryApi.bulkIndex(selectedItems);
            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            if (failed > 0) {
                toast.warning(`${succeeded} indexados, ${failed} falharam`);
            } else {
                toast.success(`${succeeded} ${succeeded === 1 ? 'item indexado' : 'itens indexados'} com sucesso!`);
            }
            setSelectedItems([]);
        } catch (err) {
            toastError(err);
        }
    };

    const handleEditFile = async ({ title, tags }) => {
        if (!fileToEdit) return;
        try {
            await libraryApi.updateFile(fileToEdit.id, { title, tags });
            toast.success('Arquivo atualizado com sucesso!');
            setEditFileModalOpen(false);
            setFileToEdit(null);
            fetchData();
        } catch (err) {
            toastError(err);
        }
    };

    const handleMoveToFolder = async (targetFolderId) => {
        try {
            await libraryApi.moveItems(selectedItems, targetFolderId);
            toast.success('Itens movidos com sucesso!');
            setSelectedItems([]);
            setMoveFolderModalOpen(false);
            fetchData();
            fetchAllFoldersList();
        } catch (err) {
            toastError(err);
        }
    };

    // Busca
    const filterItemsBySearch = (items, searchTerm) => {
        if (!searchTerm) return items;
        const term = searchTerm.toLowerCase();
        return items.filter(item => {
            const name = (item.name || item.title || '').toLowerCase();
            const tags = (item.defaultTags || []).join(' ').toLowerCase();
            const description = (item.description || '').toLowerCase();
            return name.includes(term) || tags.includes(term) || description.includes(term);
        });
    };

    const filteredFolders = filterItemsBySearch(folders, searchValue);
    const filteredFiles = filterItemsBySearch(files, searchValue);

    return (
        <MainContainer>
            <div className={classes.root}>
                <Sidebar
                    currentFolderId={currentFolder}
                    onFolderClick={handleFolderClick}
                />

                <div className={classes.mainContent}>
                    <TopBar
                        searchValue={searchValue}
                        onSearchChange={setSearchValue}
                        onCreateClick={() => setCreateFolderModalOpen(true)}
                        onUploadClick={() => setUploadModalOpen(true)}
                        onIndexAllClick={async () => {
                            try {
                                const result = await libraryApi.indexAllLibrary();

                                if (result.failed > 0) {
                                    toast.warning(`${result.indexed} indexados, ${result.failed} falharam, ${result.skipped} pulados`);
                                } else {
                                    toast.success(`${result.indexed} arquivo(s) indexado(s) com sucesso!`);
                                }

                                fetchData();
                            } catch (err) {
                                toastError(err);
                            }
                        }}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />

                    <BreadcrumbNav
                        breadcrumbs={breadcrumbs}
                        onNavigate={navigateToBreadcrumb}
                    />

                    <div className={classes.contentArea}>
                        {viewMode === 'grid' ? (
                            <FolderGrid
                                folders={filteredFolders}
                                files={filteredFiles}
                                onFolderClick={handleFolderClick}
                                onFileClick={handleFileClick}
                                onMenuAction={handleMenuAction}
                                selectedItems={selectedItems}
                                onSelectItem={handleSelectItem}
                            />
                        ) : (
                            <FolderList
                                folders={filteredFolders}
                                files={filteredFiles}
                                onFolderClick={handleFolderClick}
                                onFileClick={handleFileClick}
                                onMenuAction={handleMenuAction}
                                selectedItems={selectedItems}
                                onSelectItem={handleSelectItem}
                                onSelectAll={handleSelectAll}
                            />
                        )}
                    </div>
                </div>
            </div>

            <BulkActionsBar
                selectedCount={selectedItems.length}
                onClearSelection={() => setSelectedItems([])}
                onBulkDelete={handleBulkDelete}
                onBulkMove={handleBulkMove}
                onBulkCopy={handleBulkCopy}
                onBulkIndex={handleBulkIndex}
            />

            <CreateFolderModal
                open={createFolderModalOpen}
                onClose={() => setCreateFolderModalOpen(false)}
                onSubmit={handleCreateFolder}
                parentFolder={currentFolder ? { id: currentFolder } : null}
            />

            <EditFolderModal
                open={editFolderModalOpen}
                onClose={() => {
                    setEditFolderModalOpen(false);
                    setSelectedFolder(null);
                }}
                onSubmit={handleEditFolder}
                folder={selectedFolder}
            />

            <LinkQueueModal
                open={linkQueueModalOpen}
                onClose={() => {
                    setLinkQueueModalOpen(false);
                    setSelectedFolder(null);
                }}
                folder={selectedFolder}
                onSuccess={() => {
                    fetchData();
                }}
            />

            <UploadModal
                open={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                currentFolder={currentFolder}
                user={user}
                onUploadComplete={() => {
                    fetchData();
                    toast.success('Upload concluído!');
                }}
            />

            <FileViewerModal
                open={fileViewerModalOpen}
                onClose={() => {
                    setFileViewerModalOpen(false);
                    setSelectedFile(null);
                }}
                file={selectedFile}
                files={filteredFiles}
                onNavigate={(file) => setSelectedFile(file)}
            />

            <EditFileModal
                open={editFileModalOpen}
                onClose={() => {
                    setEditFileModalOpen(false);
                    setFileToEdit(null);
                }}
                file={fileToEdit}
                onSubmit={handleEditFile}
            />

            <Dialog
                open={moveFolderModalOpen}
                onClose={() => setMoveFolderModalOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Selecione a pasta destino</DialogTitle>
                <DialogContent>
                    <List>
                        <ListItem
                            button
                            onClick={() => handleMoveToFolder(null)}
                        >
                            <ListItemIcon>
                                <FolderIcon />
                            </ListItemIcon>
                            <ListItemText primary="Raiz (sem pasta pai)" />
                        </ListItem>
                        {allFolders.map(folder => (
                            <ListItem
                                key={folder.id}
                                button
                                onClick={() => handleMoveToFolder(folder.id)}
                                disabled={selectedItems.includes(`folder-${folder.id}`)}
                            >
                                <ListItemIcon>
                                    <FolderIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={folder.name}
                                    secondary={folder.description}
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMoveFolderModalOpen(false)}>
                        Cancelar
                    </Button>
                </DialogActions>
            </Dialog>
        </MainContainer>
    );
};

export default LibraryManager;
