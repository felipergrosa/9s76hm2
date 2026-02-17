import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box
} from '@material-ui/core';
import TagAutocomplete from '../../../../components/TagAutocomplete';

const EditFolderModal = ({ open, onClose, onSubmit, folder }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);

    useEffect(() => {
        if (folder) {
            setName(folder.name || '');
            setDescription(folder.description || '');
            setTags(folder.defaultTags || []);
        }
    }, [folder]);

    const handleSubmit = () => {
        if (name.trim()) {
            onSubmit({
                name: name.trim(),
                description: description.trim(),
                defaultTags: tags
            });
            handleClose();
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar Pasta</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    label="Nome da Pasta"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    margin="dense"
                    required
                />

                <TextField
                    label="Descrição"
                    fullWidth
                    multiline
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    margin="dense"
                />

                <Box mt={2}>
                    <TagAutocomplete
                        value={tags}
                        onChange={setTags}
                        label="Tags padrão (herdadas pelos arquivos)"
                        placeholder="Digite para buscar ou criar tag..."
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleSubmit} color="primary" variant="contained">
                    Salvar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditFolderModal;
