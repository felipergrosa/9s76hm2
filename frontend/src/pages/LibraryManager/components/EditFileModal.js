import React, { useEffect, useState } from 'react';
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

const EditFileModal = ({ open, onClose, file, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);

  useEffect(() => {
    if (file) {
      setTitle(file.title || '');
      setTags(Array.isArray(file.tags) ? file.tags : []);
    }
  }, [file]);

  const handleSave = () => {
    if (!file) return;
    onSubmit({ title: title.trim() || file.title, tags });
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
          <TagAutocomplete
            value={tags}
            onChange={setTags}
            label="Tags"
            placeholder="Digite para buscar ou criar tag..."
          />
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
