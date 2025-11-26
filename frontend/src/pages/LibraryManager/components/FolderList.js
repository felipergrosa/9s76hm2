import React from 'react';
import {
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Checkbox,
    IconButton,
    Chip,
    Typography,
    Box,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@material-ui/core';
import {
    Folder as FolderIcon,
    PictureAsPdf as PdfIcon,
    Image as ImageIcon,
    VideoLibrary as VideoIcon,
    Audiotrack as AudioIcon,
    InsertDriveFile as FileIcon,
    MoreVert as MoreVertIcon,
    Description as DocIcon,
    TableChart as ExcelIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Info as InfoIcon,
    Share as ShareIcon,
    FileCopy as FileCopyIcon,
    OpenWith as MoveIcon,
    GetApp as DownloadIcon,
    Edit as RenameIcon,
    Delete as DeleteIcon
} from '@material-ui/icons';
import { FolderOpen as FolderOpenIcon } from '@material-ui/icons';
import useStyles from '../styles';

const getFileIcon = (mediaType) => {
    if (!mediaType) return <FileIcon />;
    const type = mediaType.toLowerCase();

    if (type.includes('pdf')) return <PdfIcon color="error" />;
    if (type.includes('image')) return <ImageIcon color="primary" />;
    if (type.includes('video')) return <VideoIcon color="secondary" />;
    if (type.includes('audio')) return <AudioIcon style={{ color: '#9c27b0' }} />;
    if (type.includes('word') || type.includes('document')) return <DocIcon style={{ color: '#2196f3' }} />;
    if (type.includes('excel') || type.includes('sheet')) return <ExcelIcon style={{ color: '#4caf50' }} />;

    return <FileIcon />;
};

const FolderList = ({ folders, files, onFolderClick, onFileClick, onMenuAction, selectedItems, onSelectItem, onSelectAll }) => {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [selectedItem, setSelectedItem] = React.useState(null);

    const allItems = [
        ...folders.map(f => ({ ...f, type: 'folder' })),
        ...files.map(f => ({ ...f, type: 'file' }))
    ];

    const handleMenuClick = (e, item) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
        setSelectedItem(item);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedItem(null);
    };

    const handleAction = (action) => {
        if (selectedItem) {
            onMenuAction(action, selectedItem);
        }
        handleMenuClose();
    };

    const isFolder = selectedItem?.type === 'folder';
    const isSelected = (item) => selectedItems.includes(`${item.type}-${item.id}`);
    const allSelected = allItems.length > 0 && allItems.every(item => isSelected(item));

    if (allItems.length === 0) {
        return (
            <Box className={classes.emptyState}>
                <FolderOpenIcon style={{ fontSize: 80, color: '#ccc', marginBottom: 16 }} />
                <Typography variant="h6" color="textSecondary">
                    Nenhum arquivo ou pasta ainda
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    Clique em "Criar" para adicionar uma pasta ou "Upload" para adicionar arquivos
                </Typography>
            </Box>
        );
    }

    return (
        <>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={selectedItems.length > 0 && !allSelected}
                                onChange={(e) => onSelectAll(e.target.checked, allItems)}
                            />
                        </TableCell>
                        <TableCell>Nome</TableCell>
                        <TableCell>Última Abertura</TableCell>
                        <TableCell>Membros</TableCell>
                        <TableCell align="right">Ações</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {allItems.map((item) => {
                        const itemKey = `${item.type}-${item.id}`;
                        const isItemSelected = isSelected(item);

                        return (
                            <TableRow
                                key={itemKey}
                                hover
                                selected={isItemSelected}
                                style={{ cursor: 'pointer' }}
                            >
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={isItemSelected}
                                        onChange={() => onSelectItem(itemKey)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </TableCell>

                                <TableCell onClick={() => item.type === 'folder' ? onFolderClick(item) : onFileClick(item)}>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        {item.type === 'folder' ? (
                                            <FolderIcon color="primary" />
                                        ) : (
                                            getFileIcon(item.mediaType)
                                        )}
                                        <Box>
                                            <Typography variant="body2">
                                                {item.name || item.title}
                                            </Typography>
                                            {item.type === 'file' && item.statusRag && (
                                                <Chip
                                                    label={item.statusRag === 'indexed' ? 'Indexado' :
                                                        item.statusRag === 'indexing' ? 'Indexando' :
                                                            item.statusRag === 'failed' ? 'Falhou' : 'Pendente'}
                                                    size="small"
                                                    color={item.statusRag === 'indexed' ? 'primary' : 'default'}
                                                    style={{ marginTop: 4 }}
                                                />
                                            )}
                                        </Box>
                                    </Box>
                                </TableCell>

                                <TableCell>
                                    <Typography variant="body2" color="textSecondary">
                                        {item.updatedAt
                                            ? new Date(item.updatedAt).toLocaleString('pt-BR')
                                            : 'Hoje'}
                                    </Typography>
                                    {item.type === 'folder' && item.files && (
                                        <Typography variant="caption" color="textSecondary">
                                            {item.files.length} arquivos
                                        </Typography>
                                    )}
                                </TableCell>

                                <TableCell>
                                    <Typography variant="body2" color="textSecondary">
                                        Somente Eu
                                    </Typography>
                                </TableCell>

                                <TableCell align="right">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleMenuClick(e, item)}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => handleAction('details')}>
                    <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Detalhes" />
                </MenuItem>

                <MenuItem onClick={() => handleAction('share')}>
                    <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Compartilhar" />
                </MenuItem>

                <MenuItem onClick={() => handleAction('copy')}>
                    <ListItemIcon><FileCopyIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Copiar" />
                </MenuItem>

                <MenuItem onClick={() => handleAction('move')}>
                    <ListItemIcon><MoveIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Mover" />
                </MenuItem>

                {!isFolder && (
                    <MenuItem onClick={() => handleAction('download')}>
                        <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Download" />
                    </MenuItem>
                )}

                <MenuItem onClick={() => handleAction('edit')}>
                    <ListItemIcon><RenameIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Editar" />
                </MenuItem>

                {isFolder ? (
                    <MenuItem onClick={() => handleAction('index')}>
                        <ListItemIcon><StarIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Indexar Pasta" />
                    </MenuItem>
                ) : ([
                    <MenuItem key="index" onClick={() => handleAction('index')}>
                        <ListItemIcon><StarIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Indexar Arquivo" />
                    </MenuItem>,
                    <MenuItem key="reindex" onClick={() => handleAction('reindex')}>
                        <ListItemIcon><StarBorderIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Reindexar" />
                    </MenuItem>
                ])}

                <MenuItem onClick={() => handleAction('delete')}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText primary="Deletar" />
                </MenuItem>
            </Menu>
        </>
    );
};

export default FolderList;
