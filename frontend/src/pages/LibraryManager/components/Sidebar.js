import React, { useState, useEffect } from 'react';
import { Box, Typography, Divider } from '@material-ui/core';
import { Folder as FolderIcon } from '@material-ui/icons';
import useStyles from '../styles';
import FolderTreeItem from './FolderTreeItem';
import * as libraryApi from '../../../services/libraryApi';
import toastError from '../../../errors/toastError';

const Sidebar = ({ currentFolderId, onFolderClick }) => {
    const classes = useStyles();
    const [allFolders, setAllFolders] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchAllFolders();
    }, []);

    const fetchAllFolders = async () => {
        try {
            setLoading(true);
            // Buscar todas as pastas sem filtro de pai
            const folders = await libraryApi.fetchAllFolders();
            setAllFolders(folders);
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    // Pastas raiz (sem pai)
    const rootFolders = allFolders.filter(f => !f.parentId);

    return (
        <Box className={classes.sidebar}>
            <Box mb={2}>
                <Box display="flex" alignItems="center" mb={1} px={1}>
                    <FolderIcon style={{ marginRight: 8 }} color="action" />
                    <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                        Arquivos
                    </Typography>
                </Box>
                <Divider />
            </Box>

            <Box style={{ overflowY: 'auto', flex: 1 }}>
                {loading ? (
                    <Typography variant="body2" color="textSecondary" align="center">
                        Carregando...
                    </Typography>
                ) : rootFolders.length === 0 ? (
                    <Typography variant="body2" color="textSecondary" align="center" style={{ padding: 16 }}>
                        Nenhuma pasta criada
                    </Typography>
                ) : (
                    rootFolders.map(folder => (
                        <FolderTreeItem
                            key={folder.id}
                            folder={folder}
                            level={0}
                            currentFolderId={currentFolderId}
                            onFolderClick={onFolderClick}
                            allFolders={allFolders}
                        />
                    ))
                )}
            </Box>
        </Box>
    );
};

export default Sidebar;
