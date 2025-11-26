import React from 'react';
import {
    Box,
    Typography,
    IconButton,
    Chip,
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
    Info as InfoIcon,
    Share as ShareIcon,
    FileCopy as FileCopyIcon,
    OpenWith as MoveIcon,
    GetApp as DownloadIcon,
    Edit as RenameIcon,
    Delete as DeleteIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon
} from '@material-ui/icons';
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

const FileItem = ({ item, type, onClick, onMenuAction }) => {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = React.useState(null);

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAction = (action) => {
        handleMenuClose();
        onMenuAction(action, item);
    };

    const isFolder = type === 'folder';

    return (
        <Box
            className={isFolder ? classes.folderCard : classes.fileCard}
            onClick={onClick}
        >
            {!isFolder && item.statusRag && (
                <Chip
                    label={item.statusRag === 'indexed' ? 'Indexado' :
                        item.statusRag === 'indexing' ? 'Indexando' :
                            item.statusRag === 'failed' ? 'Falhou' : 'Pendente'}
                    size="small"
                    className={classes.statusBadge}
                    color={item.statusRag === 'indexed' ? 'primary' : 'default'}
                />
            )}

            <IconButton
                size="small"
                className={classes.menuButton}
                onClick={handleMenuClick}
            >
                <MoreVertIcon fontSize="small" />
            </IconButton>

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

            <div className={classes.itemIcon}>
                {isFolder ? <FolderIcon color="primary" fontSize="inherit" /> : getFileIcon(item.mediaType)}
            </div>

            <Typography className={classes.itemName} variant="body2">
                {item.name || item.title}
            </Typography>

            <Typography className={classes.itemMeta}>
                {isFolder
                    ? `${item.files?.length || 0} arquivos`
                    : item.lastIndexedAt
                        ? `Indexado em ${new Date(item.lastIndexedAt).toLocaleDateString()}`
                        : 'Não indexado'
                }
            </Typography>
        </Box>
    );
};

export default FileItem;
