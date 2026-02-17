import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Chip,
    TextField
} from '@material-ui/core';
import {
    CloudUpload as CloudUploadIcon,
    Close as CloseIcon,
    InsertDriveFile as FileIcon
} from '@material-ui/icons';
import { toast } from 'react-toastify';
import api from '../../../../services/api';
import toastError from '../../../../errors/toastError';
import Autocomplete from '@material-ui/lab/Autocomplete';

const UploadModal = ({ open, onClose, currentFolder, onUploadComplete, user }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [dragOver, setDragOver] = useState(false);
    const [tagOptions, setTagOptions] = useState([]);
    const [fileTags, setFileTags] = useState([]); // tags por arquivo
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const { data } = await api.get('/tags/autocomplete', {
                    params: { limit: 100 }
                });
                // Converter para formato esperado pelo Autocomplete
                setTagOptions((data || []).map(t => ({ name: t.tag, count: t.count })));
            } catch (err) {
                toastError(err);
            }
        };

        fetchTags();
    }, []);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        setSelectedFiles(prev => {
            setFileTags(prevTags => [...prevTags, ...files.map(() => [])]);
            return [...prev, ...files];
        });
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;

        setSelectedFiles(prev => {
            setFileTags(prevTags => [...prevTags, ...files.map(() => [])]);
            return [...prev, ...files];
        });
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleRemoveFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setFileTags(prev => prev.filter((_, i) => i !== index));
    };

    const handleFileTagsChange = (index, newValue) => {
        setFileTags(prev => {
            const clone = [...prev];
            clone[index] = newValue || [];
            return clone;
        });
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        // Plano por índice: create (default), overwrite, skip
        const uploadPlan = {};

        // Verificar duplicados na pasta atual
        if (currentFolder) {
            try {
                const { data } = await api.post('/library/files/check-duplicates', {
                    folderId: currentFolder,
                    files: selectedFiles.map((file, index) => ({
                        index,
                        name: file.name,
                        size: file.size
                    }))
                });

                const duplicates = data?.duplicates || [];

                duplicates.forEach(dup => {
                    const idx = dup.index;
                    const file = selectedFiles[idx];
                    const existing = dup.existing || {};

                    const existingSize = formatFileSize(existing.size || 0);
                    const newSize = formatFileSize(file.size);
                    const updatedAt = existing.updatedAt ? new Date(existing.updatedAt) : null;
                    const updatedStr = updatedAt ? updatedAt.toLocaleString() : 'N/D';

                    const confirmReplace = window.confirm(
                        `Já existe na pasta um arquivo com o mesmo nome e tamanho.\n\n` +
                        `Arquivo atual:\n` +
                        `- Nome: ${existing.title}\n` +
                        `- Tamanho: ${existingSize}\n` +
                        `- Última alteração: ${updatedStr}\n\n` +
                        `Novo arquivo:\n` +
                        `- Nome: ${file.name}\n` +
                        `- Tamanho: ${newSize}\n\n` +
                        `Clique em OK para substituir o arquivo existente na biblioteca.\n` +
                        `Clique em Cancelar para manter o arquivo atual e ignorar este upload.`
                    );

                    if (confirmReplace) {
                        uploadPlan[idx] = { action: 'overwrite', existingFileId: existing.id };
                    } else {
                        uploadPlan[idx] = { action: 'skip', existingFileId: existing.id };
                    }
                });
            } catch (err) {
                console.error('Erro ao verificar duplicados:', err);
                toastError(err);
                return;
            }
        }

        setUploading(true);

        try {
            // Criar um FileList (grupo de arquivos) usando o mesmo formato do sistema antigo
            const formData = new FormData();

            // Adiciona nome da Arquivos
            const listName = currentFolder ? `Arquivos-Pasta-${currentFolder}` : 'Uploads-Biblioteca';
            formData.append('name', listName);
            const allTagNames = Array.from(new Set(
                (fileTags || [])
                    .flat()
                    .map(t => (typeof t === 'string' ? t : t?.name))
                    .filter(Boolean)
            ));
            formData.append('message', allTagNames.join(', '));
            formData.append('userId', user.id);

            // Adiciona todos os arquivos
            selectedFiles.forEach((file, index) => {
                formData.append('files', file);
                formData.append(`option_${index}_name`, file.name);
                formData.append(`option_${index}_file_index`, index);

                setUploadProgress(prev => ({
                    ...prev,
                    [index]: { status: 'uploading', progress: 0 }
                }));
            });

            // Upload dos arquivos para criar FileList
            const { data: fileListData } = await api.post('/files', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    selectedFiles.forEach((_, index) => {
                        setUploadProgress(prev => ({
                            ...prev,
                            [index]: { status: 'uploading', progress: percentCompleted }
                        }));
                    });
                }
            });

            // Aguardar um pouco para garantir que os arquivos foram processados
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Buscar o FileList criado para pegar os IDs dos FileOptions
            const { data: fileListComplete } = await api.get(`/files/${fileListData.id}`);

            // Criar/atualizar LibraryFile para cada arquivo enviado
            for (let i = 0; i < fileListComplete.options.length; i++) {
                const option = fileListComplete.options[i];
                const plan = uploadPlan[i] || { action: 'create' };

                // Ignorar uploads marcados como skip (duplicados que o usuário não quis substituir)
                if (plan.action === 'skip') {
                    setUploadProgress(prev => ({
                        ...prev,
                        [i]: { status: 'completed', progress: 100 }
                    }));
                    continue;
                }

                try {
                    const tagsForFile = (fileTags[i] || []).map(t =>
                        typeof t === 'string' ? t : t?.name
                    ).filter(Boolean);

                    const payload = {
                        folderId: currentFolder || null,
                        fileOptionId: option.id,
                        title: option.name || selectedFiles[i]?.name || 'Arquivo sem nome',
                        tags: tagsForFile
                    };

                    if (plan.action === 'overwrite' && plan.existingFileId) {
                        await api.put(`/library/files/${plan.existingFileId}`, payload);
                    } else {
                        await api.post('/library/files', payload);
                    }

                    setUploadProgress(prev => ({
                        ...prev,
                        [i]: { status: 'completed', progress: 100 }
                    }));
                } catch (err) {
                    console.error(`Erro ao salvar LibraryFile para ${option.name}:`, err);
                    setUploadProgress(prev => ({
                        ...prev,
                        [i]: { status: 'failed', progress: 100 }
                    }));
                }
            }

            toast.success(`${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`);
            setUploading(false);
            onUploadComplete();
            handleClose(true);
        } catch (err) {
            console.error('Erro no upload:', err);
            toastError(err);
            setUploading(false);
        }
    };

    const handleClose = (force = false) => {
        if (!uploading || force) {
            setSelectedFiles([]);
            setUploadProgress({});
            setFileTags([]);
            onClose();
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <Dialog open={open} onClose={() => handleClose()} maxWidth="md" fullWidth>
            <DialogTitle>Fazer Upload de Arquivos</DialogTitle>
            <DialogContent>
                {/* Zona de Drag & Drop */}
                <Box
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                        border: '2px dashed',
                        borderColor: dragOver ? 'primary.main' : 'grey.400',
                        borderRadius: 2,
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        bgcolor: dragOver ? 'action.hover' : 'background.paper',
                        transition: 'all 0.3s',
                        mb: 2
                    }}
                >
                    <CloudUploadIcon style={{ fontSize: 64, color: dragOver ? '#1976d2' : '#999' }} />
                    <Typography variant="h6" gutterBottom>
                        Arraste arquivos aqui ou clique para selecionar
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Suporta PDFs, imagens, vídeos, áudios e documentos
                    </Typography>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        accept="image/*,audio/*,video/*,application/pdf,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    />
                </Box>

                {/* Arquivos */}
                {selectedFiles.length > 0 && (
                    <List>
                        {selectedFiles.map((file, index) => (
                            <ListItem key={index} divider>
                                <FileIcon style={{ marginRight: 16 }} />
                                <ListItemText
                                    primary={file.name}
                                    secondary={
                                        <>
                                            {formatFileSize(file.size)}
                                            <Box mt={1}>
                                                <Autocomplete
                                                    multiple
                                                    size="small"
                                                    options={tagOptions}
                                                    value={fileTags[index] || []}
                                                    onChange={(_e, newValue) => handleFileTagsChange(index, newValue)}
                                                    getOptionLabel={(option) => option.name || option}
                                                    getOptionSelected={(option, value) => (option.id || option.name) === (value.id || value.name)}
                                                    renderTags={(value, getTagProps) =>
                                                        value.map((option, idx2) => (
                                                            <Chip
                                                                {...getTagProps({ index: idx2 })}
                                                                key={option.id || option.name || idx2}
                                                                label={option.name || option}
                                                                size="small"
                                                            />
                                                        ))
                                                    }
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            variant="outlined"
                                                            placeholder="Tags para este arquivo"
                                                        />
                                                    )}
                                                />
                                            </Box>
                                            {uploadProgress[index] && (
                                                <Box mt={1}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={uploadProgress[index].progress}
                                                        color={uploadProgress[index].status === 'failed' ? 'secondary' : 'primary'}
                                                    />
                                                    <Typography variant="caption">
                                                        {uploadProgress[index].status === 'completed'
                                                            ? 'Concluído'
                                                            : uploadProgress[index].status === 'failed'
                                                                ? 'Falhou'
                                                                : `${uploadProgress[index].progress}%`}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </>
                                    }
                                />
                                {!uploading && (
                                    <ListItemSecondaryAction>
                                        <IconButton edge="end" onClick={() => handleRemoveFile(index)}>
                                            <CloseIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                )}
                            </ListItem>
                        ))}
                    </List>
                )}

                {selectedFiles.length === 0 && (
                    <Typography variant="body2" color="textSecondary" align="center">
                        Nenhum arquivo selecionado
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => handleClose()} disabled={uploading}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleUpload}
                    color="primary"
                    variant="contained"
                    disabled={selectedFiles.length === 0 || uploading}
                >
                    {uploading ? 'Enviando...' : `Upload (${selectedFiles.length})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UploadModal;
