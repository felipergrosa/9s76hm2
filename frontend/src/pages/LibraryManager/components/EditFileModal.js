import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Chip,
  Typography
} from '@material-ui/core';

const EditFileModal = ({ open, onClose, file, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (file) {
      setTitle(file.title || '');
      setTags(Array.isArray(file.tags) ? file.tags : []);
    }
  }, [file]);

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (!tags.includes(value)) {
      setTags(prev => [...prev, value]);
    }
    setTagInput('');
  };

  const handleDeleteTag = (tagToDelete) => {
    setTags(prev => prev.filter(t => t !== tagToDelete));
  };

  const handleSave = () => {
    if (!file) return;
    onSubmit({ title: title.trim() || file.title, tags });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar arquivo</DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <TextField
            label="Título"
            fullWidth
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </Box>

        <Box mb={1}>
          <Typography variant="body2" gutterBottom>
            Tags
          </Typography>
          <Box display="flex" gap={1} mb={1}>
            <TextField
              size="small"
              placeholder="Adicionar tag"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              fullWidth
            />
            <Button onClick={handleAddTag} variant="outlined" size="small">
              Adicionar
            </Button>
          </Box>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {tags.map(tag => (
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
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!file}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditFileModal;
