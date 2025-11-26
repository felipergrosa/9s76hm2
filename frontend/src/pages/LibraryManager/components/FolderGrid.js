import React from 'react';
import { Box, Typography, Checkbox } from '@material-ui/core';
import { FolderOpen as FolderOpenIcon } from '@material-ui/icons';
import FileItem from './FileItem';
import useStyles from '../styles';

const FolderGrid = ({ folders, files, onFolderClick, onFileClick, onMenuAction, selectedItems, onSelectItem }) => {
    const classes = useStyles();

    const hasContent = folders.length > 0 || files.length > 0;

    if (!hasContent) {
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

    const isSelected = (type, id) => selectedItems.includes(`${type}-${id}`);

    return (
        <div className={classes.gridContainer}>
            {folders.map((folder) => {
                const itemKey = `folder-${folder.id}`;
                const selected = isSelected('folder', folder.id);

                return (
                    <div key={itemKey} style={{ position: 'relative' }}>
                        <Checkbox
                            checked={selected}
                            onChange={() => onSelectItem(itemKey)}
                            style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                zIndex: 1,
                                backgroundColor: 'white',
                                borderRadius: 4
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <FileItem
                            item={folder}
                            type="folder"
                            onClick={() => onFolderClick(folder)}
                            onMenuAction={onMenuAction}
                        />
                    </div>
                );
            })}

            {files.map((file) => {
                const itemKey = `file-${file.id}`;
                const selected = isSelected('file', file.id);

                return (
                    <div key={itemKey} style={{ position: 'relative' }}>
                        <Checkbox
                            checked={selected}
                            onChange={() => onSelectItem(itemKey)}
                            style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                zIndex: 1,
                                backgroundColor: 'white',
                                borderRadius: 4
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <FileItem
                            item={file}
                            type="file"
                            onClick={() => onFileClick(file)}
                            onMenuAction={onMenuAction}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default FolderGrid;
