import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  Checkbox,
  FormControlLabel,
  TextField,
  Chip,
  Divider,
  CircularProgress,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@material-ui/core';
import { Refresh, ExpandMore } from "@material-ui/icons";
import { Alert } from '@material-ui/lab';
import { makeStyles } from "@material-ui/core/styles";
import toastError from '../../errors/toastError';
import api from '../../services/api';

const useStyles = makeStyles((theme) => ({
  tagChip: {
    margin: theme.spacing(0.5),
  },
  tagChipSelected: {
    margin: theme.spacing(0.5),
    border: '2px solid ' + theme.palette.primary.main,
    fontWeight: 600,
  },
  mappingSection: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  deviceTagItem: {
    border: '1px solid #e0e0e0',
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1),
  },
  systemTagSelect: {
    minWidth: 200,
  },
  newTagInput: {
    marginTop: theme.spacing(1),
  },
  summaryPanel: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    border: '1px solid #e0e0e0',
    borderRadius: theme.spacing(1),
    background: '#fafafa'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
  }
}));

const ContactImportTagsModal = ({ isOpen, handleClose, onImport }) => {
  const classes = useStyles();

  const [deviceTags, setDeviceTags] = useState([]);
  const [systemTags, setSystemTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tagMappings, setTagMappings] = useState({});
  const [newTagNames, setNewTagNames] = useState({});
  const [selectedDeviceTags, setSelectedDeviceTags] = useState(new Set());
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [selectedDeviceContacts, setSelectedDeviceContacts] = useState(new Set());
  const [importSummary, setImportSummary] = useState(null);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsHasMore, setContactsHasMore] = useState(true);
  const [contactsLoadingPage, setContactsLoadingPage] = useState(false);
  const contactsListRef = useRef(null);

  // Escolhe automaticamente cor de texto (preto/branco) com base na cor da tag
  const getContrastColor = (hexColor) => {
    if (!hexColor || typeof hexColor !== 'string') return '#fff';
    let c = hexColor.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    // Luminosidade relativa
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000' : '#fff';
  };

  const rebuildDeviceTags = async () => {
    try {
      setLoading(true);
      const resp = await api.post(`/contacts/rebuild-device-tags?whatsappId=${selectedWhatsappId}`);
      console.log('Rebuild Tags Response:', resp.data);
      await loadData();
      setLoading(false);
      // Sem alert: feedback silencioso no console; UI já é atualizada
    } catch (error) {
      console.error('Erro ao reconstruir tags:', error);
      setLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Carregar tags do dispositivo
      const deviceResponse = await api.get(`/contacts/device-tags?whatsappId=${selectedWhatsappId}`);
      const deviceTagsData = Array.isArray(deviceResponse.data.tags) ? deviceResponse.data.tags : [];
      setDeviceTags(deviceTagsData);

      // Carregar tags do sistema (lista completa)
      const systemResponse = await api.get('/tags/list');
      const systemTagsData = Array.isArray(systemResponse.data) ? systemResponse.data : (Array.isArray(systemResponse.data?.tags) ? systemResponse.data.tags : []);
      setSystemTags(systemTagsData);

      // Reset paginação e carregar primeira página de contatos
      setDeviceContacts([]);
      setContactsPage(1);
      setContactsHasMore(true);
      await loadContactsPage(1, false);

      // Inicializar mapeamentos vazios
      const initialMappings = {};
      const initialNewTags = {};
      deviceTagsData.forEach(tag => {
        initialMappings[tag.id] = null; // null significa não mapeado
        initialNewTags[tag.id] = '';
      });
      setTagMappings(initialMappings);
      setNewTagNames(initialNewTags);

    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, [selectedWhatsappId]);

  // Carrega uma página de contatos
  const loadContactsPage = useCallback(async (page = 1, append = true) => {
    if (contactsLoadingPage) return;
    setContactsLoadingPage(true);
    try {
      const pageSize = 100;
      const resp = await api.get(`/contacts/device-contacts?whatsappId=${selectedWhatsappId}&page=${page}&pageSize=${pageSize}`);
      const { contacts = [], hasMore = false } = resp.data || {};
      setDeviceContacts(prev => append ? [...prev, ...contacts] : contacts);
      setContactsHasMore(!!hasMore);
      setContactsPage(page);
    } catch (err) {
      toastError(err);
    } finally {
      setContactsLoadingPage(false);
    }
  }, [contactsLoadingPage, selectedWhatsappId]);

  const fetchWhatsapps = useCallback(async () => {
    try {
      const { data } = await api.get("/whatsapp");
      const whatsappsData = Array.isArray(data) ? data : [];
      setWhatsapps(whatsappsData);
      // Selecionar automaticamente a primeira conexão quando nenhuma estiver selecionada
      if (!selectedWhatsappId && whatsappsData.length > 0) {
        setSelectedWhatsappId(whatsappsData[0].id);
      }
    } catch (err) {
      toastError(err);
    }
  }, [selectedWhatsappId]);

  useEffect(() => {
    fetchWhatsapps();

    if (isOpen) {
      loadData();
    }
  }, [fetchWhatsapps, isOpen, loadData]);

  // Recarrega automaticamente quando a conexão selecionada muda
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [selectedWhatsappId, isOpen, loadData]);

  // Infinite scroll: detectar final da lista e carregar próxima página
  const onContactsScroll = (e) => {
    if (!contactsHasMore || contactsLoadingPage) return;
    const el = e.target;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      loadContactsPage(contactsPage + 1, true);
    }
  };

  const handleDeviceTagToggle = (tagId) => {
    const newSelected = new Set(selectedDeviceTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedDeviceTags(newSelected);
  };

  const handleDeviceContactToggle = (jid) => {
    const next = new Set(selectedDeviceContacts);
    if (next.has(jid)) next.delete(jid); else next.add(jid);
    setSelectedDeviceContacts(next);
  };

  const handleSystemTagMapping = (deviceTagId, systemTagId) => {
    setTagMappings(prev => ({
      ...prev,
      [deviceTagId]: systemTagId
    }));
  };

  const handleNewTagNameChange = (deviceTagId, name) => {
    setNewTagNames(prev => ({
      ...prev,
      [deviceTagId]: name
    }));
  };

  const handleImport = async () => {
    // Caminho 1: Importação por tags do dispositivo (se houver seleção de tags)
    if (selectedDeviceTags.size > 0) {
      setImporting(true);
      try {
        const tagMapping = {};
        for (const deviceTagId of selectedDeviceTags) {
          const systemTagId = tagMappings[deviceTagId];
          const newTagName = newTagNames[deviceTagId]?.trim();
          if (systemTagId) {
            tagMapping[deviceTagId] = { systemTagId };
          } else if (newTagName) {
            tagMapping[deviceTagId] = { newTagName };
          }
        }
        const resp = await onImport(tagMapping, selectedWhatsappId);
        // Guardar sumário para exibir no drawer permanente
        try {
          const data = resp?.data || resp;
          setImportSummary(data || null);
          // Limpar seleções/mapeamentos após concluir e manter somente o relatório
          setSelectedDeviceTags(new Set());
          setTagMappings({});
          setNewTagNames({});
        } catch (_) {}
      } catch (error) {
        toastError(error);
      } finally {
        setImporting(false);
      }
      return;
    }

    // Caminho 2: Importação por contatos do dispositivo (fallback quando sem tags)
    if (selectedDeviceContacts.size === 0) {
      toastError('Selecione pelo menos uma tag do dispositivo ou ao menos um contato do dispositivo');
      return;
    }

    setImporting(true);
    try {
      const payload = {
        whatsappId: selectedWhatsappId,
        selectedJids: Array.from(selectedDeviceContacts),
        autoCreateTags: true
      };
      await api.post('/contacts/import-device-contacts', payload);
      handleClose();
    } catch (error) {
      toastError(error);
    } finally {
      setImporting(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedDeviceTags(new Set());
    setTagMappings({});
    setNewTagNames({});
    setImportSummary(null);
    handleClose();
  };

  const debugDeviceData = async () => {
    try {
      const response = await api.get(`/contacts/debug-device-data?whatsappId=${selectedWhatsappId}`);
      console.log('Debug Device Data:', response.data);
      alert(`Debug Info:\n${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      console.error('Erro no debug:', error);
      alert('Erro ao obter dados de debug');
    }
  };

  const forceAppStateSync = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/contacts/force-appstate-sync?whatsappId=${selectedWhatsappId}`);
      console.log('Force Sync Response:', response.data);

      // Se já retornou com labelsCount > 0, recarrega imediatamente
      const labelsCount = response?.data?.labelsCount || 0;
      if (labelsCount > 0) {
        await loadData();
        setLoading(false);
        return;
      }

      // Polling: tentar por até 10s
      const start = Date.now();
      const timeoutMs = 10000;
      const step = 1000;
      let success = false;
      while (Date.now() - start < timeoutMs) {
        try {
          const deviceResponse = await api.get(`/contacts/device-tags?whatsappId=${selectedWhatsappId}`);
          const tags = Array.isArray(deviceResponse.data.tags) ? deviceResponse.data.tags : [];
          if (tags.length > 0) {
            setDeviceTags(tags);
            success = true;
            break;
          }
        } catch (_) {}
        await new Promise(r => setTimeout(r, step));
      }
      if (!success) {
        alert('Sincronização forçada concluída, mas nenhuma etiqueta foi recebida. Tente reconectar a sessão do WhatsApp e tente novamente.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Erro ao forçar sincronização:', error);
      alert('Erro ao forçar sincronização do App State');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Dialog fullWidth maxWidth="md" open={isOpen} onClose={handleCloseModal}>
        <div className={classes.loadingContainer}>
          <CircularProgress />
          <Typography variant="body1" style={{ marginLeft: 16 }}>
            Carregando tags...
          </Typography>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog fullWidth maxWidth="md" open={isOpen} onClose={handleCloseModal}>
      <DialogTitle>
        Importar Contatos com Tags
      </DialogTitle>

      <DialogContent>
        {importing && (
          <Box mb={2}>
            <LinearProgress />
          </Box>
        )}
        {!importSummary && (
        <Box mb={2} display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="textSecondary">
            Selecione as tags do WhatsApp que deseja importar e mapeie para tags do sistema.
          </Typography>
          <Box>
            <Tooltip title="Debug - Ver Dados">
              <IconButton
                onClick={debugDeviceData}
                disabled={loading}
                style={{ marginRight: 8 }}
              >
                <span style={{ fontSize: '16px' }}>🔍</span>
              </IconButton>
            </Tooltip>
            <Tooltip title="Forçar Sincronização App State">
              <IconButton
                onClick={forceAppStateSync}
                disabled={loading}
                style={{ marginRight: 8 }}
              >
                <span style={{ fontSize: '16px' }}>🔄</span>
              </IconButton>
            </Tooltip>
            <Tooltip title="Reconstruir Tags (a partir dos chats)">
              <IconButton
                onClick={rebuildDeviceTags}
                disabled={loading}
                style={{ marginRight: 8 }}
              >
                <span style={{ fontSize: '16px' }}>🛠️</span>
              </IconButton>
            </Tooltip>
            <Tooltip title="Sincronizar Etiquetas">
              <IconButton
                onClick={loadData}
                disabled={loading}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        )}

        <FormControl fullWidth variant="outlined" margin="dense">
          <InputLabel id="whatsapp-select-label">Conexão WhatsApp</InputLabel>
          <Select
            labelId="whatsapp-select-label"
            id="whatsapp-select"
            value={selectedWhatsappId}
            onChange={(e) => setSelectedWhatsappId(e.target.value)}
            label="Conexão WhatsApp"
          >
            <MenuItem value="">
              <em>Padrão</em>
            </MenuItem>
            {Array.isArray(whatsapps) &&
              whatsapps.map((whatsapp) => (
                <MenuItem key={whatsapp.id} value={whatsapp.id}>
                  {whatsapp.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {!importSummary && (loading ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
            <Typography variant="body1" style={{ marginLeft: 16 }}>
              Carregando tags...
            </Typography>
          </Box>
        ) : !Array.isArray(deviceTags) || deviceTags.length === 0 ? (
          <div>
            <Alert severity="info" style={{ marginBottom: 8 }}>
              Nenhuma tag de WhatsApp foi encontrada para esta conexão. Você pode importar contatos do dispositivo e usar as tags exibidas ao lado de cada contato.
            </Alert>

            <Typography variant="h6" gutterBottom>
              Contatos do Dispositivo ({Array.isArray(deviceContacts) ? deviceContacts.length : 0})
            </Typography>

            <div
              ref={(contactsListRef) => {
                if (contactsListRef) {
                  contactsListRef.addEventListener('scroll', onContactsScroll);
                }
              }}
              style={{
                maxHeight: 380,
                overflowY: 'auto',
                border: '1px dashed #eee',
                borderRadius: 8,
                padding: 4,
              }}
            >
              <List>
                {Array.isArray(deviceContacts) &&
                  deviceContacts.map((c) => (
                    <div key={c.id} className={classes.deviceTagItem}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedDeviceContacts.has(c.id)}
                              onChange={() => handleDeviceContactToggle(c.id)}
                              color="primary"
                            />
                          }
                          label={(c.name || c.notify || c.pushname || c.id)}
                        />
                        <Box>
                          {Array.isArray(c.tags) &&
                            c.tags.map((t) => (
                              <Chip
                                key={`${c.id}-${t.id}`}
                                label={t.name || t.id}
                                size="small"
                                className={classes.tagChip}
                              />
                            ))}
                        </Box>
                      </Box>
                    </div>
                  ))}
                {contactsLoadingPage && (
                  <Box display="flex" justifyContent="center" p={1}>
                    <CircularProgress size={20} />
                  </Box>
                )}
                {!contactsHasMore && (
                  <Box display="flex" justifyContent="center" p={1}>
                    <Typography variant="caption" color="textSecondary">
                      Fim da lista
                    </Typography>
                  </Box>
                )}
              </List>
            </div>
          </div>
        ) : (
          <div>
            <Typography variant="h6" gutterBottom>
              Tags do Dispositivo ({Array.isArray(deviceTags) ? deviceTags.length : 0})
            </Typography>

            <List>
              {Array.isArray(deviceTags) &&
                deviceTags.map((deviceTag) => {
                  const mappedId = tagMappings[deviceTag.id];
                  const mappedTag = Array.isArray(systemTags)
                    ? systemTags.find((t) => t.id === mappedId)
                    : null;
                  const mappedLabel = mappedTag
                    ? ` → Tag: ${mappedTag.name}`
                    : '';
                  return (
                    <div key={deviceTag.id} className={classes.deviceTagItem}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedDeviceTags.has(deviceTag.id)}
                              onChange={() => handleDeviceTagToggle(deviceTag.id)}
                              color="primary"
                            />
                          }
                          label={
                            <Box display="flex" alignItems="center">
                              <Chip
                                label={`${deviceTag.name}${
                                  typeof deviceTag.count === 'number'
                                    ? ` (${deviceTag.count})`
                                    : ''
                                }`}
                                style={{
                                  backgroundColor: deviceTag.color || '#A4CCCC',
                                  color: getContrastColor(deviceTag.color || '#A4CCCC'),
                                }}
                                size="small"
                              />
                              {mappedLabel && (
                                <Typography
                                  variant="caption"
                                  style={{ marginLeft: 8, color: '#555' }}
                                >
                                  {mappedLabel}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </Box>

                      {selectedDeviceTags.has(deviceTag.id) && (
                        <Box ml={4}>
                          <Typography variant="body2" gutterBottom>
                            Mapear para:
                          </Typography>

                          {/* Seleção de tag existente */}
                          <Box mb={1}>
                            <Typography variant="caption" display="block" gutterBottom>
                              Usar tag existente:
                            </Typography>
                            {Array.isArray(systemTags) &&
                              systemTags.map((systemTag) => {
                                const selected = tagMappings[deviceTag.id] === systemTag.id;
                                return (
                                  <Chip
                                    key={systemTag.id}
                                    label={systemTag.name}
                                    clickable
                                    color={selected ? 'primary' : 'default'}
                                    onClick={() => handleSystemTagMapping(deviceTag.id, systemTag.id)}
                                    className={selected ? classes.tagChipSelected : classes.tagChip}
                                    variant={selected ? 'default' : 'outlined'}
                                    size="small"
                                  />
                                );
                              })}
                          </Box>

                          <Divider style={{ margin: '8px 0' }} />

                          {/* Criar nova tag */}
                          <Box>
                            <Typography variant="caption" display="block" gutterBottom>
                              Ou criar nova tag:
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Nome da nova tag"
                              value={newTagNames[deviceTag.id] || ''}
                              onChange={(e) => handleNewTagNameChange(deviceTag.id, e.target.value)}
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      )}
                    </div>
                  );
                })}
            </List>
          </div>
        ))}

        {/* Drawer/Sumário Permanente */}
        {importSummary && (
          <Box className={classes.summaryPanel}>
            <Typography variant="subtitle1" gutterBottom>
              Relatório de Importação
            </Typography>
            <Typography variant="body2">
              Total alvo: <b>{importSummary.total ?? 0}</b>
            </Typography>
            <Typography variant="body2">
              Criados: <b>{importSummary.created ?? 0}</b>
            </Typography>
            <Typography variant="body2">
              Atualizados: <b>{importSummary.updated ?? 0}</b>
            </Typography>
            <Typography variant="body2">
              Etiquetas aplicadas: <b>{importSummary.tagged ?? 0}</b>
            </Typography>
            {importSummary.perTagApplied && (
              <Box mt={1}>
                <Typography variant="caption" display="block">
                  Por etiqueta:
                </Typography>
                {Object.entries(importSummary.perTagApplied).map(([k, v]) => (
                  <Typography key={k} variant="caption" display="block">
                    - {k}: {v}
                  </Typography>
                ))}
              </Box>
            )}

            {/* Acordeon com lista resumida de contatos afetados */}
            {Array.isArray(importSummary.contacts) && importSummary.contacts.length > 0 && (
              <Box mt={2}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle2">
                      Contatos afetados (até 50)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box display="flex" flexDirection="column" width="100%">
                      {importSummary.contacts
                        .slice(0, 50)
                        .map((c, idx) => (
                          <Typography key={idx} variant="caption" style={{ lineHeight: 1.8 }}>
                            • {c?.name && String(c.name).trim() ? `${c.name} — ` : ''}{' '}
                            {c?.number || ''}
                          </Typography>
                        ))}
                      {importSummary.contacts.length > 50 && (
                        <Typography variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
                          ... e mais {importSummary.contacts.length - 50} contatos
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {!importSummary ? (
          <>
            <Button onClick={handleCloseModal} disabled={importing}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              color="primary"
              variant="contained"
              disabled={importing || (selectedDeviceTags.size === 0 && selectedDeviceContacts.size === 0)}
            >
              {importing ? <CircularProgress size={20} /> : 'Importar Contatos'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleCloseModal}>
              Fechar
            </Button>
            <Button
              onClick={() => { setImportSummary(null); loadData(); }}
              color="primary"
              variant="contained"
            >
              Nova Importação
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ContactImportTagsModal;
