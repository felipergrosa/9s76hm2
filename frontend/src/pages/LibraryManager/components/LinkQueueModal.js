import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    FormLabel,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Typography,
    CircularProgress,
    Box
} from '@material-ui/core';
import { toast } from 'react-toastify';
import api from '../../../services/api';
import toastError from '../../../errors/toastError';

const LinkQueueModal = ({ open, onClose, folder, onSuccess }) => {
    const [queues, setQueues] = useState([]);
    const [selectedQueues, setSelectedQueues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && folder) {
            fetchData();
        }
    }, [open, folder]);

    // Busca filas e vinculadas em paralelo (elimina N+1)
    const fetchData = async () => {
        try {
            setLoading(true);

            // Busca todas as filas e filas vinculadas em paralelo
            const [queuesRes, linkedRes] = await Promise.all([
                api.get('/queue'),
                api.get(`/library/folders/${folder.id}/queues`)
            ]);

            setQueues(queuesRes.data || []);
            
            // Extrai IDs das filas vinculadas
            const linkedIds = (linkedRes.data || []).map(q => q.id);
            setSelectedQueues(linkedIds);
        } catch (err) {
            if (err?.response?.status !== 403) {
                toastError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggleQueue = (queueId) => {
        setSelectedQueues(prev =>
            prev.includes(queueId)
                ? prev.filter(id => id !== queueId)
                : [...prev, queueId]
        );
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);

            // Busca estado atual das filas vinculadas
            const { data: currentLinked } = await api.get(`/library/folders/${folder.id}/queues`);
            const currentLinkedIds = (currentLinked || []).map(q => q.id);

            // Vincular novas filas
            const toLink = selectedQueues.filter(id => !currentLinkedIds.includes(id));
            for (const queueId of toLink) {
                await api.post(`/queues/${queueId}/rag-sources`, {
                    folderId: folder.id,
                    weight: 1.0
                });
            }

            // Desvincular filas removidas
            const toUnlink = currentLinkedIds.filter(id => !selectedQueues.includes(id));
            for (const queueId of toUnlink) {
                await api.delete(`/queues/${queueId}/rag-sources/${folder.id}`);
            }

            toast.success('Filas vinculadas com sucesso!');
            if (onSuccess) onSuccess();
            handleClose();
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setSelectedQueues([]);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Vincular Pasta à Fila</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                    Pasta: <strong>{folder?.name}</strong>
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    Selecione as filas que terão acesso ao conhecimento desta pasta:
                </Typography>

                {loading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <FormControl component="fieldset">
                        <FormLabel component="legend">Filas Disponíveis</FormLabel>
                        <FormGroup>
                            {queues.map((queue) => (
                                <FormControlLabel
                                    key={queue.id}
                                    control={
                                        <Checkbox
                                            checked={selectedQueues.includes(queue.id)}
                                            onChange={() => handleToggleQueue(queue.id)}
                                            color="primary"
                                        />
                                    }
                                    label={`${queue.name} ${queue.color ? '●' : ''}`}
                                />
                            ))}
                        </FormGroup>
                    </FormControl>
                )}

                {queues.length === 0 && !loading && (
                    <Typography variant="body2" color="textSecondary" align="center">
                        Nenhuma fila disponível
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={saving}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleSubmit}
                    color="primary"
                    variant="contained"
                    disabled={saving || loading}
                >
                    {saving ? 'Salvando...' : 'Salvar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LinkQueueModal;
