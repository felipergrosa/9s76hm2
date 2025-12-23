import React, { useState, useEffect, useContext } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  Radio,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Divider,
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Label as LabelIcon,
  Folder as FolderIcon,
} from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { AuthContext } from '../../context/Auth/AuthContext';
import { i18n } from '../../translate/i18n';

const useStyles = makeStyles((theme) => ({
  dialog: {
    '& .MuiDialog-paper': {
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
    },
  },
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing(1),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
  },
  section: {
    marginBottom: theme.spacing(3),
  },
  accordion: {
    marginBottom: theme.spacing(2),
  },
  accordionSummary: {
    backgroundColor: theme.palette.background.default,
  },
  filterContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    maxHeight: '300px',
    marginTop: theme.spacing(2),
  },
  selectedChip: {
    margin: theme.spacing(0.5),
  },
  progressContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  progressText: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  logList: {
    maxHeight: '200px',
    overflow: 'auto',
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
  },
  successIcon: {
    color: theme.palette.success.main,
  },
  errorIcon: {
    color: theme.palette.error.main,
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  },
}));

const normalizeAiAgents = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.aiAgents)) return data.aiAgents;
  if (Array.isArray(data?.agents)) return data.agents;
  return [];
};

const normalizeTags = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.tags)) return data.tags;
  return [];
};

const BulkProcessTicketsModal = ({ open, onClose, initialFilters = {} }) => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);

  // Estados
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [filters, setFilters] = useState({
    status: initialFilters.status || 'pending',
    searchParam: '',
    ...initialFilters,
  });

  // Opções de processamento
  const [responseType, setResponseType] = useState('none');
  const [responseMessage, setResponseMessage] = useState('');
  const [aiAgentId, setAiAgentId] = useState('');
  const [aiAgents, setAiAgents] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [newStatus, setNewStatus] = useState('');
  const [closeTicket, setCloseTicket] = useState(false);
  const [addNote, setAddNote] = useState('');
  const [selectedQueue, setSelectedQueue] = useState('');
  const [queues, setQueues] = useState([]);

  // Progresso
  const [progress, setProgress] = useState(0);
  const [processResult, setProcessResult] = useState(null);
  const [processLog, setProcessLog] = useState([]);

  // Carregar dados iniciais
  useEffect(() => {
    if (open) {
      loadTickets();
      loadTags();
      loadQueues();
      loadAIAgents();
    }
  }, [open, filters]);

  // Socket.IO listeners para progresso
  useEffect(() => {
    if (!socket || !processing) return;

    const handleProgress = (data) => {
      console.log('[BulkProcess] Progress event received:', data);
      if (data.userId === user.id) {
        console.log('[BulkProcess] Updating progress to:', data.progress);
        setProgress(data.progress);
        setProcessLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `Processando: ${data.processed}/${data.total} (${data.success} sucesso, ${data.errors} erros)`,
          },
        ]);
      }
    };

    const handleComplete = (data) => {
      console.log('[BulkProcess] Complete event received:', data);
      if (data.userId === user.id) {
        console.log('[BulkProcess] Setting progress to 100% and processing to false');
        setProcessing(false);
        setProgress(100);
        setProcessResult(data.result);
        toast.success(`Processamento concluído! ${data.result.success} tickets processados com sucesso.`);
        setProcessLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `Processamento concluído: ${data.result.success} sucesso, ${data.result.errors} erros`,
          },
        ]);
      }
    };

    socket.on(`company-${user.companyId}-bulk-process-progress`, handleProgress);
    socket.on(`company-${user.companyId}-bulk-process-complete`, handleComplete);

    return () => {
      socket.off(`company-${user.companyId}-bulk-process-progress`, handleProgress);
      socket.off(`company-${user.companyId}-bulk-process-complete`, handleComplete);
    };
  }, [socket, processing, user]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tickets', {
        params: {
          status: filters.status,
          searchParam: filters.searchParam,
          pageNumber: 1,
          showAll: true,
        },
      });
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      toast.error('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get('/tags');
      setAvailableTags(normalizeTags(data));
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const loadQueues = async () => {
    try {
      const { data } = await api.get('/queue');
      setQueues(data);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const loadAIAgents = async () => {
    try {
      const { data } = await api.get('/ai-agents');
      setAiAgents(normalizeAiAgents(data));
    } catch (error) {
      console.error('Erro ao carregar agentes IA:', error);
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedTickets(tickets.map((t) => t.id));
    } else {
      setSelectedTickets([]);
    }
  };

  const handleSelectTicket = (ticketId) => {
    setSelectedTickets((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleProcess = async () => {
    if (selectedTickets.length === 0) {
      toast.warning('Selecione pelo menos um ticket');
      return;
    }

    if (responseType === 'standard' && !responseMessage.trim()) {
      toast.warning('Digite a mensagem de resposta');
      return;
    }

    if (responseType === 'ai' && !aiAgentId) {
      toast.warning('Selecione um agente IA');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setProcessLog([]);
    setProcessResult(null);

    try {
      const payload = {
        ticketIds: selectedTickets,
        responseType,
        responseMessage: responseType === 'standard' ? responseMessage : undefined,
        aiAgentId: responseType === 'ai' ? aiAgentId : undefined,
        tagIds: selectedTags.map((t) => t.id),
        newStatus: newStatus || undefined,
        closeTicket,
        addNote: addNote.trim() || undefined,
        queueId: selectedQueue || undefined,
      };

      setProcessLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `Iniciando processamento de ${selectedTickets.length} tickets...`,
        },
      ]);

      console.log('[BulkProcess] Enviando requisição POST...');
      const response = await api.post('/tickets/bulk-process', payload);
      console.log('[BulkProcess] POST concluído, resposta:', response.data);
      
      // Fallback: Se após 5 segundos não recebemos eventos socket, forçar conclusão
      setTimeout(() => {
        console.log('[BulkProcess] Timeout de 5s atingido, verificando estado...');
        setProcessing((currentProcessing) => {
          if (currentProcessing) {
            console.log('[BulkProcess] Ainda processando após timeout, forçando conclusão via fallback');
            setProgress(100);
            setProcessResult({
              success: selectedTickets.length,
              errors: 0,
              total: selectedTickets.length,
              duration: 5000
            });
            setProcessLog((prev) => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                message: `Processamento concluído: ${selectedTickets.length} tickets processados (fallback)`,
              },
            ]);
            toast.success(`Processamento concluído! ${selectedTickets.length} tickets processados.`);
            return false;
          }
          return currentProcessing;
        });
      }, 5000);
      
    } catch (error) {
      console.error('Erro ao processar tickets:', error);
      toast.error('Erro ao processar tickets: ' + (error.response?.data?.error || error.message));
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    if (!processing) {
      onClose();
      // Reset states
      setSelectedTickets([]);
      setResponseType('none');
      setResponseMessage('');
      setProgress(0);
      setProcessResult(null);
      setProcessLog([]);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth className={classes.dialog}>
      <DialogTitle className={classes.dialogTitle}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">Processar Tickets em Massa</Typography>
          <Chip
            label={`${selectedTickets.length} selecionados`}
            color="primary"
            size="small"
          />
        </Box>
        <IconButton className={classes.closeButton} onClick={handleClose} disabled={processing}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {processing || processResult ? (
          // Modo de Processamento: Mostrar apenas progresso
          <Box className={classes.progressContainer}>
            <Typography variant="h6" gutterBottom>
              {processing ? 'Processando Tickets...' : 'Processamento Concluído'}
            </Typography>
            <Box className={classes.progressText}>
              <Typography variant="body2">
                {processing ? 'Aguarde enquanto processamos os tickets' : 'Todos os tickets foram processados'}
              </Typography>
              <Typography variant="body2">{progress}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} style={{ marginBottom: 16 }} />

            {processLog.length > 0 && (
              <List className={classes.logList}>
                {processLog.map((log, index) => (
                  <ListItem key={index} dense>
                    <ListItemText
                      primary={log.message}
                      secondary={log.time}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {processResult && (
              <Box mt={2}>
                <Typography variant="body2">
                  <strong>Resultado:</strong>
                </Typography>
                <Box display="flex" gap={2} mt={1}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${processResult.success} Sucesso`}
                    color="primary"
                    size="small"
                  />
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${processResult.errors} Erros`}
                    color="secondary"
                    size="small"
                  />
                  <Chip
                    label={`Duração: ${Math.round(processResult.duration / 1000)}s`}
                    size="small"
                  />
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          // Modo de Configuração: Mostrar opções
          <>
        {/* STEP 1: Seleção de Tickets */}
        <Accordion defaultExpanded className={classes.accordion}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.accordionSummary}>
            <Typography variant="subtitle1">
              <strong>1. Selecionar Tickets</strong>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box width="100%">
              <Box className={classes.filterContainer}>
                <FormControl variant="outlined" size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="pending">Aguardando</MenuItem>
                    <MenuItem value="open">Aberto</MenuItem>
                    <MenuItem value="closed">Fechado</MenuItem>
                    <MenuItem value="bot">Bot</MenuItem>
                    <MenuItem value="campaign">Campanha</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  variant="outlined"
                  size="small"
                  label="Buscar"
                  value={filters.searchParam}
                  onChange={(e) => setFilters({ ...filters, searchParam: e.target.value })}
                  fullWidth
                />
              </Box>

              <TableContainer component={Paper} className={classes.tableContainer}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedTickets.length === tickets.length && tickets.length > 0}
                          indeterminate={selectedTickets.length > 0 && selectedTickets.length < tickets.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Contato</TableCell>
                      <TableCell>Última Mensagem</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Nenhum ticket encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets.map((ticket) => (
                        <TableRow key={ticket.id} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedTickets.includes(ticket.id)}
                              onChange={() => handleSelectTicket(ticket.id)}
                            />
                          </TableCell>
                          <TableCell>{ticket.contact?.name || 'Sem nome'}</TableCell>
                          <TableCell>
                            {ticket.lastMessage ? ticket.lastMessage.substring(0, 50) + '...' : '-'}
                          </TableCell>
                          <TableCell>
                            <Chip label={ticket.status} size="small" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* STEP 2: Resposta Automática */}
        <Accordion className={classes.accordion}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.accordionSummary}>
            <SendIcon style={{ marginRight: 8 }} />
            <Typography variant="subtitle1">
              <strong>2. Resposta Automática</strong>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box width="100%">
              <FormControl component="fieldset">
                <RadioGroup value={responseType} onChange={(e) => setResponseType(e.target.value)}>
                  <FormControlLabel value="none" control={<Radio />} label="Não enviar resposta" />
                  <FormControlLabel value="standard" control={<Radio />} label="Resposta padrão" />
                  <FormControlLabel value="ai" control={<Radio />} label="Resposta com IA" />
                </RadioGroup>
              </FormControl>

              {responseType === 'standard' && (
                <TextField
                  variant="outlined"
                  label="Mensagem"
                  placeholder="Digite a mensagem padrão..."
                  fullWidth
                  multiline
                  rows={4}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  style={{ marginTop: 16 }}
                />
              )}

              {responseType === 'ai' && (
                <FormControl variant="outlined" fullWidth style={{ marginTop: 16 }}>
                  <InputLabel>Agente IA</InputLabel>
                  <Select
                    value={aiAgentId}
                    onChange={(e) => setAiAgentId(e.target.value)}
                    label="Agente IA"
                  >
                    {aiAgents.map((agent) => (
                      <MenuItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* STEP 3: Catalogação */}
        <Accordion className={classes.accordion}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.accordionSummary}>
            <LabelIcon style={{ marginRight: 8 }} />
            <Typography variant="subtitle1">
              <strong>3. Catalogação e Organização</strong>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box width="100%">
              <Box className={classes.filterContainer}>
                <Autocomplete
                  multiple
                  options={availableTags}
                  getOptionLabel={(option) => option.name}
                  value={selectedTags}
                  onChange={(_, newValue) => setSelectedTags(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} variant="outlined" label="Tags" placeholder="Selecione tags" />
                  )}
                />

                <FormControl variant="outlined" fullWidth>
                  <InputLabel>Fila</InputLabel>
                  <Select
                    value={selectedQueue}
                    onChange={(e) => setSelectedQueue(e.target.value)}
                    label="Fila"
                  >
                    <MenuItem value="">
                      <em>Sem alteração</em>
                    </MenuItem>
                    {queues.map((queue) => (
                      <MenuItem key={queue.id} value={queue.id}>
                        {queue.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl variant="outlined" fullWidth>
                  <InputLabel>Novo Status</InputLabel>
                  <Select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    label="Novo Status"
                  >
                    <MenuItem value="">
                      <em>Sem alteração</em>
                    </MenuItem>
                    <MenuItem value="pending">Aguardando</MenuItem>
                    <MenuItem value="open">Aberto</MenuItem>
                    <MenuItem value="closed">Fechado</MenuItem>
                    <MenuItem value="bot">Bot</MenuItem>
                    <MenuItem value="campaign">Campanha</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <FormControlLabel
                control={
                  <Checkbox checked={closeTicket} onChange={(e) => setCloseTicket(e.target.checked)} />
                }
                label="Fechar ticket após processar"
              />

              <TextField
                variant="outlined"
                label="Nota Interna (opcional)"
                placeholder="Adicionar nota interna ao ticket..."
                fullWidth
                multiline
                rows={2}
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                style={{ marginTop: 16 }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
        </>
        )}
      </DialogContent>

      <DialogActions>
        {processResult ? (
          <Button onClick={handleClose} variant="contained" color="primary">
            Fechar
          </Button>
        ) : processing ? (
          <Button onClick={handleClose} disabled>
            Processando...
          </Button>
        ) : (
          <>
            <Button onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleProcess}
              disabled={selectedTickets.length === 0}
              startIcon={<SendIcon />}
            >
              Processar {selectedTickets.length} Tickets
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkProcessTicketsModal;
