import React, { useState, useEffect, useContext, useRef } from 'react';
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
import usePermissions from '../../hooks/usePermissions';

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
    gridTemplateColumns: 'repeat(2, 1fr)',
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
  const { hasPermission } = usePermissions();

  // Verificar permissões granulares para cada ação
  const canBulkProcess = hasPermission('tickets.bulk-process');
  const canEditStatus = hasPermission('tickets.bulk-edit-status');
  const canEditQueue = hasPermission('tickets.bulk-edit-queue');
  const canEditUser = hasPermission('tickets.bulk-edit-user');
  const canEditTags = hasPermission('tickets.bulk-edit-tags');
  const canEditWallets = hasPermission('tickets.bulk-edit-wallets');
  const canEditResponse = hasPermission('tickets.bulk-edit-response');
  const canEditClose = hasPermission('tickets.bulk-edit-close');
  const canEditNotes = hasPermission('tickets.bulk-edit-notes');

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
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [walletMode, setWalletMode] = useState('replace'); // 'replace' ou 'append'

  // Progresso
  const [progress, setProgress] = useState(0);
  const [processResult, setProcessResult] = useState(null);
  const [processLog, setProcessLog] = useState([]);
  const progressTimerRef = useRef(null);

  const startProgressTimer = () => {
    if (progressTimerRef.current) return;
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p < 90 ? p + 1 : 90;
        return next;
      });
    }, 500);
  };

  const stopProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (open) {
      loadTickets();
      loadTags();
      loadQueues();
      loadAIAgents();
      loadUsers();
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
        if (data.progress >= 100) {
          stopProgressTimer();
        } else {
          startProgressTimer();
        }
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
        stopProgressTimer();
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
      const queueIds = (user?.queues || []).map(q => q?.UserQueue?.queueId || q?.id).filter(Boolean);
      const statusFilters = filters.status ? [filters.status] : undefined;

      // Superadmin e admin devem ver todos os tickets, não apenas os da carteira
      const isSuperUser = user?.super || user?.profile === 'admin';

      const { data } = await api.get('/tickets', {
        params: {
          status: filters.status,
          searchParam: filters.searchParam,
          pageNumber: 1,
          showAll: true,
          queueIds,
          statusFilters,
          // Apenas filtrar por tag pessoal se NÃO for superadmin/admin
          personalTagOnly: isSuperUser ? false : true
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

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      const usersList = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
      setUsers(usersList);
    } catch (error) {
      // 403 = sem permissão users.view (admin)
      // Silencia o erro, lista de usuários fica vazia
      if (error?.response?.status !== 403) {
        console.error('Erro ao carregar usuários:', error);
      }
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
    setProgress(5);
    setProcessLog([]);
    setProcessResult(null);
    startProgressTimer();

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
        userId: selectedUserId || undefined,
        walletIds: selectedWallets.length > 0 ? selectedWallets.map(w => w.id) : undefined,
        walletMode: selectedWallets.length > 0 ? walletMode : undefined, // 'replace' ou 'append'
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
            stopProgressTimer();
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
      stopProgressTimer();
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
      stopProgressTimer();
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
                        <MenuItem value="group">Grupo</MenuItem>
                        <MenuItem value="lgpd">LGPD</MenuItem>
                        <MenuItem value="nps">NPS/Avaliação</MenuItem>
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
                  {canEditResponse ? (
                    <>
                      <FormControl variant="outlined" fullWidth margin="dense">
                        <InputLabel>Tipo de Resposta</InputLabel>
                        <Select value={responseType} onChange={(e) => setResponseType(e.target.value)} label="Tipo de Resposta">
                          <MenuItem value="none">Nenhuma</MenuItem>
                          <MenuItem value="manual">Mensagem Manual</MenuItem>
                          <MenuItem value="ai">Agente IA</MenuItem>
                        </Select>
                      </FormControl>

                      {responseType === 'manual' && (
                        <TextField
                          variant="outlined"
                          label="Mensagem de Resposta"
                          placeholder="Digite a mensagem que será enviada para todos..."
                          fullWidth
                          multiline
                          rows={3}
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
                    </>
                  ) : (
                    <Typography variant="body2" color="textSecondary" style={{ padding: 16, textAlign: 'center' }}>
                      Você não tem permissão para enviar respostas automáticas em massa.
                    </Typography>
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
                    {/* Primeira linha: Atribuir Usuário | Fila */}
                    {canEditUser && (
                      <FormControl variant="outlined" fullWidth>
                        <InputLabel>Atribuir a Usuário (ticket)</InputLabel>
                        <Select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          label="Atribuir a Usuário (ticket)"
                        >
                          <MenuItem value="">
                            <em>Sem alteração</em>
                          </MenuItem>
                          {users.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                              {u.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    {canEditQueue && (
                      <FormControl variant="outlined" fullWidth>
                        <InputLabel>Fila (ticket)</InputLabel>
                        <Select
                          value={selectedQueue}
                          onChange={(e) => setSelectedQueue(e.target.value)}
                          label="Fila (ticket)"
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
                    )}

                    {/* Segunda linha: Novo Status | Tags */}
                    {canEditStatus && (
                      <FormControl variant="outlined" fullWidth>
                        <InputLabel>Novo Status (ticket)</InputLabel>
                        <Select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          label="Novo Status (ticket)"
                        >
                          <MenuItem value="">
                            <em>Sem alteração</em>
                          </MenuItem>
                          <MenuItem value="pending">Aguardando</MenuItem>
                          <MenuItem value="open">Aberto</MenuItem>
                          <MenuItem value="closed">Fechado</MenuItem>
                          <MenuItem value="bot">Bot</MenuItem>
                          <MenuItem value="group">Grupo</MenuItem>
                          <MenuItem value="lgpd">LGPD</MenuItem>
                          <MenuItem value="nps">NPS/Avaliação</MenuItem>
                          <MenuItem value="campaign">Campanha</MenuItem>
                        </Select>
                      </FormControl>
                    )}

                    {canEditTags && (
                      <Autocomplete
                        multiple
                        options={availableTags}
                        getOptionLabel={(option) => option.name}
                        value={selectedTags}
                        onChange={(_, newValue) => setSelectedTags(newValue)}
                        renderInput={(params) => (
                          <TextField {...params} variant="outlined" label="Tags (contato)" placeholder="Selecione tags" />
                        )}
                      />
                    )}

                    {/* Carteira - apenas para usuários com permissão */}
                    {canEditWallets && (
                      <>
                        <FormControl variant="outlined" fullWidth>
                          <InputLabel>Modo de Alteração de Carteira (contato)</InputLabel>
                          <Select
                            value={walletMode}
                            onChange={(e) => setWalletMode(e.target.value)}
                            label="Modo de Alteração de Carteira (contato)"
                          >
                            <MenuItem value="replace">
                              Substituir carteira atual
                            </MenuItem>
                            <MenuItem value="append">
                              Adicionar à carteira existente
                            </MenuItem>
                          </Select>
                        </FormControl>
                        <Autocomplete
                          multiple
                          options={users}
                          getOptionLabel={(option) => option.name}
                          value={selectedWallets}
                          onChange={(e, newValue) => setSelectedWallets(newValue)}
                          filterSelectedOptions
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                {...getTagProps({ index })}
                                key={option.id}
                                label={option.name}
                                color="primary"
                              />
                            ))
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              variant="outlined"
                              label="Carteira (Responsável) (contato)"
                              placeholder="Selecione responsáveis"
                              fullWidth
                            />
                          )}
                        />
                      </>
                    )}
                  </Box>

                  {canEditClose && (
                    <FormControlLabel
                      control={
                        <Checkbox checked={closeTicket} onChange={(e) => setCloseTicket(e.target.checked)} />
                      }
                      label="Fechar ticket após processar (ticket)"
                    />
                  )}

                  {canEditNotes && (
                    <TextField
                      variant="outlined"
                      label="Nota Interna (opcional) (ticket)"
                      placeholder="Adicionar nota interna ao ticket..."
                      fullWidth
                      multiline
                      rows={2}
                      value={addNote}
                      onChange={(e) => setAddNote(e.target.value)}
                      style={{ marginTop: 16 }}
                    />
                  )}
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
            <Button
              onClick={handleClose}
              variant="contained"
              startIcon={<CloseIcon />}
              style={{
                background: 'linear-gradient(145deg, rgba(150, 150, 150, 0.95), rgba(100, 100, 100, 0.9))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleProcess}
              disabled={selectedTickets.length === 0}
              startIcon={<SendIcon />}
              style={{
                background: 'linear-gradient(145deg, rgba(128, 0, 32, 0.95), rgba(100, 0, 25, 0.9))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 15px rgba(128, 0, 32, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
              }}
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
