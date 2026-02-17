import React, { useState } from 'react';
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

const CreateFolderModal = ({ open, onClose, onSubmit, parentFolder }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);

    const handleSubmit = () => {
        if (name.trim()) {
            onSubmit({
                name: name.trim(),
                description: description.trim(),
                defaultTags: tags,
                parentId: parentFolder?.id || null
            });
            handleClose();
        }
    };

    const handleClose = () => {
        setName('');
        setDescription('');
        setTags([]);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Criar Nova Pasta</DialogTitle>
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
                    Criar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateFolderModal;
