import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField
} from '@material-ui/core';

const RenameModal = ({ open, onClose, onConfirm, item }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (open && item) {
            setName(item.name || item.title || '');
        }
    }, [open, item]);

    const handleSubmit = () => {
        if (name.trim()) {
            onConfirm(name.trim());
            onClose();
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Renomear</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Novo nome"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    Cancelar
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    color="primary" 
                    variant="contained"
                    disabled={!name.trim()}
                >
                    Salvar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RenameModal;
