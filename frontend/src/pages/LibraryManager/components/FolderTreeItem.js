import React, { useState } from 'react';
import {
    Box,
    Typography,
    Collapse,
    IconButton
} from '@material-ui/core';
import {
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    ChevronRight as ChevronRightIcon,
    ExpandMore as ExpandMoreIcon
} from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    item: {
        display: 'flex',
        alignItems: 'center',
        padding: theme.spacing(0.5, 1),
        cursor: 'pointer',
        borderRadius: 4,
        transition: 'background-color 0.2s',
        '&:hover': {
            backgroundColor: theme.palette.action.hover
        }
    },
    itemSelected: {
        backgroundColor: theme.palette.primary.light,
        color: theme.palette.primary.contrastText,
        '&:hover': {
            backgroundColor: theme.palette.primary.main
        }
    },
    expandIcon: {
        padding: 4,
        marginRight: 4
    },
    folderIcon: {
        marginRight: theme.spacing(1),
        fontSize: 20
    },
    label: {
        fontSize: 14,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    children: {
        paddingLeft: theme.spacing(2)
    },
    count: {
        fontSize: 11,
        color: theme.palette.text.secondary,
        marginLeft: theme.spacing(0.5)
    }
}));

const FolderTreeItem = ({ folder, level = 0, currentFolderId, onFolderClick, allFolders = [] }) => {
    const classes = useStyles();
    const [expanded, setExpanded] = useState(folder.id === currentFolderId);

    // Encontrar subpastas
    const children = allFolders.filter(f => f.parentId === folder.id);
    const hasChildren = children.length > 0;
    const isSelected = currentFolderId === folder.id;

    const handleToggle = (e) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const handleClick = () => {
        onFolderClick(folder);
        if (hasChildren) {
            setExpanded(true);
        }
    };

    // Auto-expandir se contém a pasta atual
    React.useEffect(() => {
        if (currentFolderId) {
            // Verificar se esta pasta está no caminho da pasta atual
            const isInPath = (folderId) => {
                if (folderId === folder.id) return true;
                const child = allFolders.find(f => f.id === folderId);
                if (child && child.parentId) {
                    return isInPath(child.parentId);
                }
                return false;
            };

            if (isInPath(currentFolderId) && hasChildren) {
                setExpanded(true);
            }
        }
    }, [currentFolderId, folder.id, allFolders, hasChildren]);

    return (
        <Box>
            <Box
                className={`${classes.item} ${isSelected ? classes.itemSelected : ''}`}
                onClick={handleClick}
                style={{ paddingLeft: level * 16 + 8 }}
            >
                {hasChildren ? (
                    <IconButton
                        size="small"
                        className={classes.expandIcon}
                        onClick={handleToggle}
                    >
                        {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </IconButton>
                ) : (
                    <Box style={{ width: 28 }} />
                )}

                {expanded && hasChildren ? (
                    <FolderOpenIcon className={classes.folderIcon} color="primary" />
                ) : (
                    <FolderIcon className={classes.folderIcon} color="action" />
                )}

                <Typography className={classes.label}>
                    {folder.name}
                </Typography>

                {folder.files && folder.files.length > 0 && (
                    <Typography className={classes.count}>
                        ({folder.files.length})
                    </Typography>
                )}
            </Box>

            {hasChildren && (
                <Collapse in={expanded} timeout="auto">
                    <Box className={classes.children}>
                        {children.map(child => (
                            <FolderTreeItem
                                key={child.id}
                                folder={child}
                                level={level + 1}
                                currentFolderId={currentFolderId}
                                onFolderClick={onFolderClick}
                                allFolders={allFolders}
                            />
                        ))}
                    </Box>
                </Collapse>
            )}
        </Box>
    );
};

export default FolderTreeItem;
