import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Chip,
    Box,
    Typography
} from '@material-ui/core';

const EditFolderModal = ({ open, onClose, onSubmit, folder }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (folder) {
            setName(folder.name || '');
            setDescription(folder.description || '');
            setTags(folder.defaultTags || []);
        }
    }, [folder]);

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleDeleteTag = (tagToDelete) => {
        setTags(tags.filter(tag => tag !== tagToDelete));
    };

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
                    <Typography variant="body2" gutterBottom>
                        Tags
                    </Typography>
                    <Box display="flex" gap={1} mb={1}>
                        <TextField
                            size="small"
                            placeholder="Adicionar tag"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <Button onClick={handleAddTag} variant="outlined" size="small">
                            Adicionar
                        </Button>
                    </Box>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                        {tags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                onDelete={() => handleDeleteTag(tag)}
                                size="small"
                            />
                        ))}
                    </Box>
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
