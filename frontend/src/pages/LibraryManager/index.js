import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    TextField,
    InputAdornment,
    FormControl,
    Select,
    IconButton,
    Table,
    TableBody
} from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { Folder as FolderIcon } from '@material-ui/icons';
import {
    Search as SearchIcon,
    FolderPlus as NewFolderIcon,
    Upload as UploadIcon,
    Database as IndexIcon,
    LayoutGrid as GridViewIcon,
    List as ListViewIcon,
    FolderOpen as EmptyIcon
} from 'lucide-react';

import MainContainer from '../../components/MainContainer';
import Title from '../../components/Title';
import TableRowSkeleton from '../../components/TableRowSkeleton';
import ForbiddenPage from '../../components/ForbiddenPage';
import { AuthContext } from '../../context/Auth/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import toastError from '../../errors/toastError';
import ConfirmationModal from '../../components/ConfirmationModal';

import Sidebar from './components/Sidebar';
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
import RenameModal from './components/RenameModal';

import useLibraryNavigation from './hooks/useLibraryNavigation';
import * as libraryApi from '../../services/libraryApi';

// ===== Estilos no padrão de layout de listagem (referência: /connections) =====
const useStyles = makeStyles((theme) => ({
    paper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        borderRadius: 12,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(2),
        flexWrap: 'wrap',
        padding: theme.spacing(2, 2.5)
    },
    headerText: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
    },
    subtitle: {
        color: theme.palette.text.secondary,
        fontSize: '0.85rem'
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        flexWrap: 'wrap'
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1.5),
        flexWrap: 'wrap',
        padding: theme.spacing(1.5, 2.5),
        borderTop: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        background:
            theme.palette.type === 'dark'
                ? theme.palette.background.default
                : '#fafafa'
    },
    searchField: {
        minWidth: 220,
        flex: '1 1 280px',
        maxWidth: 380
    },
    filterSelect: {
        minWidth: 150
    },
    // Alternador lista/grade — só faz sentido no desktop (mobile sempre vê cards)
    viewToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
        marginLeft: 'auto',
        [theme.breakpoints.down('sm')]: {
            display: 'none'
        }
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(1),
        padding: theme.spacing(8, 2),
        color: theme.palette.text.secondary,
        textAlign: 'center'
    },
    // Corpo da biblioteca: árvore de pastas (esquerda) + conteúdo (direita)
    libraryBody: {
        flex: 1,
        display: 'flex',
        minHeight: 0,
        overflow: 'hidden'
    },
    sidebarWrap: {
        display: 'flex',
        [theme.breakpoints.down('sm')]: {
            display: 'none'
        }
    },
    libraryMain: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden'
    },
    libraryContent: {
        flex: 1,
        padding: theme.spacing(2),
        overflowY: 'auto',
        ...theme.scrollbarStyles
    }
}));

// Filtro client-side por nome, tags e descrição — função pura em nível de módulo
// para não entrar como dependência dos useMemo do componente
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

const LibraryManager = () => {
    const classes = useStyles();
    const theme = useTheme();
    // Mobile (<sm): sempre renderiza cards, sem alternador de visualização
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { user, socket } = useContext(AuthContext);
    const { hasPermission } = usePermissions();

    const { currentFolder, breadcrumbs, navigateToFolder, navigateToBreadcrumb } = useLibraryNavigation();

    const [viewMode, setViewMode] = useState('list');
    const [searchValue, setSearchValue] = useState('');
    // Filtro de tipo da toolbar: '' (todos) | 'folders' | 'files'
    const [typeFilter, setTypeFilter] = useState('');
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

    // Estados para modais de confirmação e rename
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [itemToRename, setItemToRename] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

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
            // 403 = sem permissão library.view (admin)
            // Silencia o erro, listas ficam vazias
            if (err?.response?.status !== 403) {
                toastError(err);
            }
        } finally {
            setLoading(false);
        }
    }, [currentFolder]);

    const fetchAllFoldersList = useCallback(async () => {
        try {
            const allFoldersData = await libraryApi.fetchAllFolders();
            setAllFolders(allFoldersData);
        } catch (err) {
            // 403 = sem permissão library.view (admin)
            // Silencia o erro, lista de pastas fica vazia
            if (err?.response?.status !== 403) {
                toastError(err);
            }
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

                case 'copyLink':
                    if (item.fileOption?.url) {
                        try {
                            await navigator.clipboard.writeText(item.fileOption.url);
                            toast.success('Link copiado para a área de transferência!');
                        } catch (e) {
                            // Fallback para navegadores antigos
                            const textArea = document.createElement('textarea');
                            textArea.value = item.fileOption.url;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            toast.success('Link copiado para a área de transferência!');
                        }
                    } else {
                        toast.error('URL do arquivo não encontrada');
                    }
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
                    setItemToRename(item);
                    setRenameModalOpen(true);
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
                    setItemToDelete(item);
                    setDeleteConfirmOpen(true);
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
        setBulkDeleteConfirmOpen(true);
    };

    const executeBulkDelete = async () => {
        try {
            await libraryApi.bulkDelete(selectedItems);
            toast.success('Itens deletados com sucesso!');
            setSelectedItems([]);
            fetchData();
            fetchAllFoldersList();
        } catch (err) {
            toastError(err);
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

    // Handler para renomear item
    const handleRename = async (newName) => {
        if (!itemToRename) return;
        try {
            if (itemToRename.title) {
                await libraryApi.updateFile(itemToRename.id, { title: newName });
            } else {
                await libraryApi.updateFolder(itemToRename.id, { name: newName });
            }
            toast.success('Renomeado com sucesso!');
            fetchData();
            fetchAllFoldersList();
        } catch (err) {
            toastError(err);
        }
    };

    // Handler para deletar item
    const handleDeleteItem = async () => {
        if (!itemToDelete) return;
        try {
            if (itemToDelete.title) {
                await libraryApi.deleteFile(itemToDelete.id);
            } else {
                await libraryApi.deleteFolder(itemToDelete.id);
            }
            toast.success('Deletado com sucesso!');
            fetchData();
            fetchAllFoldersList();
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

    // Indexação completa da biblioteca (ação que ficava na TopBar, agora no header)
    const handleIndexAll = async () => {
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
    };

    // Busca + filtro por tipo (client-side, memoizado — padrão das telas de listagem)
    const filteredFolders = useMemo(
        () => (typeFilter === 'files' ? [] : filterItemsBySearch(folders, searchValue)),
        [folders, searchValue, typeFilter]
    );
    const filteredFiles = useMemo(
        () => (typeFilter === 'folders' ? [] : filterItemsBySearch(files, searchValue)),
        [files, searchValue, typeFilter]
    );
    const totalVisible = filteredFolders.length + filteredFiles.length;
    const totalItems = folders.length + files.length;

    return (
        <MainContainer>
            {!hasPermission('files.view') ? <ForbiddenPage /> : (
                <>
                    <Paper className={classes.paper} variant="outlined">
                        {/* 1. Cabeçalho */}
                        <div className={classes.header}>
                            <div className={classes.headerText}>
                                <Title>Base de Conhecimento ({totalItems})</Title>
                                <span className={classes.subtitle}>
                                    Gerencie pastas e arquivos usados como fonte de conhecimento (RAG) das filas
                                </span>
                            </div>
                            <div className={classes.headerActions}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<NewFolderIcon size={16} />}
                                    style={{ minHeight: 36 }}
                                    onClick={() => setCreateFolderModalOpen(true)}
                                >
                                    Nova Pasta
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    startIcon={<UploadIcon size={16} />}
                                    style={{ minHeight: 36 }}
                                    onClick={() => setUploadModalOpen(true)}
                                >
                                    Upload
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<IndexIcon size={16} />}
                                    style={{ minHeight: 36, backgroundColor: '#2e7d32', color: '#fff' }}
                                    onClick={handleIndexAll}
                                >
                                    Indexar
                                </Button>
                            </div>
                        </div>

                        {/* 2. Toolbar de busca/filtros */}
                        <div className={classes.toolbar}>
                            <TextField
                                className={classes.searchField}
                                size="small"
                                variant="outlined"
                                placeholder="Buscar arquivos ou pastas…"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon size={16} />
                                        </InputAdornment>
                                    )
                                }}
                            />
                            <FormControl size="small" variant="outlined" className={classes.filterSelect}>
                                <Select
                                    native
                                    displayEmpty
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    <option value="folders">Pastas</option>
                                    <option value="files">Arquivos</option>
                                </Select>
                            </FormControl>
                            <div className={classes.viewToggle}>
                                <IconButton
                                    size="small"
                                    onClick={() => setViewMode('grid')}
                                    color={viewMode === 'grid' ? 'primary' : 'default'}
                                >
                                    <GridViewIcon size={18} />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => setViewMode('list')}
                                    color={viewMode === 'list' ? 'primary' : 'default'}
                                >
                                    <ListViewIcon size={18} />
                                </IconButton>
                            </div>
                        </div>

                        {/* 3. Conteúdo: árvore de pastas + lista/grade de itens */}
                        <div className={classes.libraryBody}>
                            <div className={classes.sidebarWrap}>
                                <Sidebar
                                    currentFolderId={currentFolder}
                                    onFolderClick={handleFolderClick}
                                />
                            </div>

                            <div className={classes.libraryMain}>
                                <BreadcrumbNav
                                    breadcrumbs={breadcrumbs}
                                    onNavigate={navigateToBreadcrumb}
                                />

                                <div className={classes.libraryContent}>
                                    {loading ? (
                                        <Table size="small">
                                            <TableBody>
                                                <TableRowSkeleton columns={5} />
                                            </TableBody>
                                        </Table>
                                    ) : totalVisible === 0 ? (
                                        <div className={classes.emptyState}>
                                            <EmptyIcon size={44} style={{ color: theme.palette.text.disabled }} />
                                            <div>Nenhum registro encontrado.</div>
                                        </div>
                                    ) : isMobile || viewMode === 'grid' ? (
                                        // Cards — mobile (sempre) e desktop em modo grade
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
                                        // Tabela — desktop (modo lista)
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
                    </Paper>

                    <BulkActionsBar
                        selectedCount={selectedItems.length}
                        onClearSelection={() => setSelectedItems([])}
                        onBulkDelete={handleBulkDelete}
                        onBulkMove={handleBulkMove}
                        onBulkCopy={handleBulkCopy}
                        onBulkIndex={handleBulkIndex}
                    />
                </>
            )}

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

            {/* Modal de Renomear */}
            <RenameModal
                open={renameModalOpen}
                onClose={() => {
                    setRenameModalOpen(false);
                    setItemToRename(null);
                }}
                onConfirm={handleRename}
                item={itemToRename}
            />

            {/* Modal de Confirmação de Delete */}
            <ConfirmationModal
                title="Confirmar exclusão"
                open={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={handleDeleteItem}
            >
                {`Deletar "${itemToDelete?.name || itemToDelete?.title}"?`}
            </ConfirmationModal>

            {/* Modal de Confirmação de Bulk Delete */}
            <ConfirmationModal
                title="Confirmar exclusão em lote"
                open={bulkDeleteConfirmOpen}
                onClose={() => setBulkDeleteConfirmOpen(false)}
                onConfirm={executeBulkDelete}
            >
                {`Deletar ${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'itens'}?`}
            </ConfirmationModal>
        </MainContainer>
    );
};

export default LibraryManager;
