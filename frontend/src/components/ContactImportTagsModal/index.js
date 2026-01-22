import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
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
  AccordionDetails,
  Switch
} from '@material-ui/core';
import { Refresh, ExpandMore, Search, Close as CloseIcon } from "@material-ui/icons";
import { Alert } from '@material-ui/lab';
import { makeStyles } from "@material-ui/core/styles";
import { toast } from 'react-toastify';
import toastError from '../../errors/toastError';
import api from '../../services/api';
import { custom as swalCustom, success as swalSuccess } from '../../helpers/swalHelper';


import { AuthContext } from '../../context/Auth/AuthContext';

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
    [theme.breakpoints.down('sm')]: {
      minWidth: '100%',
    },
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
  },
  // --- Estilos modernos do dialog ---
  dialogPaper: {
    borderRadius: 16,
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(1),
      maxHeight: 'calc(100% - 16px)',
    },
  },
  dialogTitle: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    borderRadius: '16px 16px 0 0',
    '& h2': {
      fontWeight: 600,
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.1rem',
      },
    },
  },
  actionButton: {
    borderRadius: 8,
    textTransform: 'none',
    fontWeight: 500,
  },
  // --- Estilos modernos para contatos ---
  contactCard: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: 12,
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #f0f0f0',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    [theme.breakpoints.down('sm')]: {
      flexWrap: 'wrap',
      padding: theme.spacing(1),
    },
    '&:hover': {
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
      borderColor: '#e0e0e0',
    },
  },
  contactCardSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: 'rgba(25, 118, 210, 0.04)',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 16,
    color: '#fff',
    marginRight: theme.spacing(1.5),
    flexShrink: 0,
    [theme.breakpoints.down('sm')]: {
      width: 36,
      height: 36,
      fontSize: 14,
    },
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  contactName: {
    fontWeight: 500,
    fontSize: 14,
    color: '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  contactNumber: {
    fontSize: 12,
    color: '#888',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  existsBadge: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 12,
    marginLeft: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      marginLeft: 'auto',
      marginBottom: theme.spacing(0.5),
    },
  },
  newBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 12,
    marginLeft: theme.spacing(1),
  },
  searchBar: {
    marginBottom: theme.spacing(2),
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    '& .MuiOutlinedInput-root': {
      borderRadius: 8,
    },
  },
  contactsList: {
    maxHeight: 400,
    overflowY: 'auto',
    padding: theme.spacing(1),
    backgroundColor: '#fafafa',
    borderRadius: 8,
    [theme.breakpoints.down('sm')]: {
      maxHeight: 300,
    },
  },
  headerControls: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      width: '100%',
    },
  },
  responsiveFlexHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
    },
  },
  selectionOptions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      width: '100%',
      '& > *': {
        width: '100%',
      },
    },
  },
  tagsContainer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: 200,
    [theme.breakpoints.down('sm')]: {
      maxWidth: '100%',
      width: '100%',
      marginTop: theme.spacing(1),
      marginLeft: theme.spacing(5), // Alinhar com o início do texto após checkbox+avatar
    },
  },
}));

// ============ FUNÇÕES UTILITÁRIAS ============

// Formatar número de telefone para exibição amigável
const formatPhoneNumber = (jid) => {
  if (!jid) return '';
  const number = String(jid).split('@')[0];
  if (!number || number.length < 8) return number;

  // Detectar código de país (Brasil = 55)
  if (number.startsWith('55') && number.length >= 12) {
    const ddd = number.slice(2, 4);
    const rest = number.slice(4);
    if (rest.length === 9) {
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }

  // Fallback: formatar genérico
  if (number.length > 6) {
    return `+${number.slice(0, 2)} ${number.slice(2, -4)} ${number.slice(-4)}`;
  }
  return number;
};

// Extrair iniciais do nome para avatar
const getInitials = (name, jid) => {
  if (name && typeof name === 'string' && name.trim()) {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  // Fallback: últimos 2 dígitos do número
  const num = String(jid || '').split('@')[0];
  return num.slice(-2);
};

// Gerar cor de fundo baseada no nome/número
const getAvatarColor = (seed) => {
  const colors = [
    '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', '#1565c0',
    '#00796b', '#c2185b', '#512da8', '#0097a7', '#689f38',
    '#e64a19', '#5d4037', '#455a64', '#f57c00', '#303f9f'
  ];
  let hash = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Verificar se é contato especial a ser filtrado
const isSpecialContact = (jid) => {
  if (!jid) return true;
  const lower = String(jid).toLowerCase();
  return lower.includes('status@broadcast') ||
    lower.includes('@g.us') ||
    lower.includes('lid:') ||
    lower === 'undefined' ||
    !lower.includes('@');
};

const ContactImportTagsModal = ({ isOpen, handleClose, onImport }) => {
  const classes = useStyles();
  const { user, socket: authSocket } = useContext(AuthContext);
  const companyId = user?.companyId;

  const [compatibilityMode, setCompatibilityMode] = useState(false);

  const [deviceTags, setDeviceTags] = useState([]);
  const [systemTags, setSystemTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, processed: 0, created: 0, updated: 0, tagged: 0 });
  const importPollRef = useRef(null);
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
  const [targetSystemTag, setTargetSystemTag] = useState(null); // Tag do sistema para aplicar em massa
  const [selectAll, setSelectAll] = useState(false);
  const [totalContactsCount, setTotalContactsCount] = useState(0); // Total vindo do backend
  const [searchQuery, setSearchQuery] = useState(''); // Filtro de busca
  const [existingNumbers, setExistingNumbers] = useState(new Set()); // Números já cadastrados
  const [importMode, setImportMode] = useState('manual'); // 'all' | 'newOnly' | 'manual'
  const [generateDetailedReport, setGenerateDetailedReport] = useState(false); // Toggle de relatório detalhado

  const contactsLoadingRef = useRef(false);
  const contactsListRef = useRef(null);
  // Estado do QR Code (WhatsApp-Web.js)
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrStatus, setQrStatus] = useState("idle"); // idle | initializing | qr_generated | authenticated | connected | disconnected
  const [qrUpdatedAt, setQrUpdatedAt] = useState(0);
  const [qrNote, setQrNote] = useState("");
  const QR_REFRESH_MS = 55000; // auto refresh ~55s
  const qrPollRef = useRef(null);
  // Progresso de carregamento de labels (WhatsApp-Web.js)
  const [labelsProgress, setLabelsProgress] = useState({ percent: 0, phase: 'idle' });
  const progressPollRef = useRef(null);
  const phaseLabel = useCallback((phase) => {
    const map = {
      iniciando: 'Iniciando',
      labels_recebidas: 'Recebendo etiquetas',
      contagem_por_label: 'Contando por etiqueta',
      lendo_contatos_salvos: 'Lendo contatos salvos',
      mapeando_rotulados: 'Mapeando contatos rotulados',
      concluido: 'Concluído',
      idle: 'Aguardando'
    };
    return map[String(phase)] || String(phase);
  }, []);

  const startProgressPolling = useCallback(() => {
    if (progressPollRef.current) return;
    progressPollRef.current = setInterval(async () => {
      try {
        if (!selectedWhatsappId) return;
        const { data } = await api.get(`/whatsapp-web/labels/progress?whatsappId=${selectedWhatsappId}`);
        const percent = Number(data?.percent || 0);
        const phase = String(data?.phase || 'idle');
        setLabelsProgress({ percent, phase });
        if (percent >= 100) {
          clearInterval(progressPollRef.current);
          progressPollRef.current = null;
        }
      } catch (_) { /* ignore */ }
    }, 600);
  }, [selectedWhatsappId]);

  const stopProgressPolling = useCallback(() => {
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }
  }, []);

  const handleCancelLabels = useCallback(async () => {
    try {
      if (!selectedWhatsappId) return;
      await api.get(`/whatsapp-web/labels/cancel?whatsappId=${selectedWhatsappId}`);
    } catch (_) { }
    stopProgressPolling();
    setLoading(false);
    setLabelsProgress({ percent: 0, phase: 'idle' });
  }, [selectedWhatsappId, stopProgressPolling]);

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

  // Removidos: funções legadas baseadas em Baileys

  // Carrega uma página de contatos
  const loadContactsPage = useCallback(async (page = 1, append = true) => {
    if (contactsLoadingRef.current) return;
    contactsLoadingRef.current = true;
    setContactsLoadingPage(true);
    try {
      const pageSize = 100;
      const resp = await api.get(`/contacts/device-contacts?whatsappId=${selectedWhatsappId}&page=${page}&pageSize=${pageSize}`);
      const { contacts = [], hasMore = false, total = 0 } = resp.data || {};
      setDeviceContacts(prev => append ? [...prev, ...contacts] : contacts);
      setContactsHasMore(!!hasMore);
      setTotalContactsCount(total);
      setContactsPage(page);

      // Verificar quais contatos já existem (delayed para não bloquear render)
      setTimeout(() => checkExistingContacts(contacts), 100);

      // Se "Selecionar Todos" estiver ativo, adiciona os novos contatos carregados à seleção
      if (selectAll) {
        setSelectedDeviceContacts(prev => {
          const next = new Set(prev);
          contacts.forEach(c => next.add(c.id));
          return next;
        });
      }
    } catch (err) {
      toastError(err);
    } finally {
      setContactsLoadingPage(false);
      contactsLoadingRef.current = false;
    }
  }, [selectedWhatsappId]);

  // Verificar quais contatos já existem no sistema
  const checkExistingContacts = useCallback(async (contacts) => {
    if (!contacts || contacts.length === 0) return;
    try {
      const numbers = contacts.map(c => c.id).filter(Boolean);
      const { data } = await api.post('/contacts/check-existing', { numbers });
      if (Array.isArray(data?.existing)) {
        setExistingNumbers(prev => {
          const next = new Set(prev);
          data.existing.forEach(n => next.add(n));
          return next;
        });
      }
    } catch (err) {
      console.warn('[checkExistingContacts] Falha ao verificar:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (compatibilityMode) {
      setLabelsProgress({ percent: 1, phase: 'iniciando' });
      startProgressPolling();
    }
    try {
      // Limpa dados anteriores para evitar piscar conteúdo durante o loading
      setDeviceTags([]);

      // Carregar tags do dispositivo
      let deviceTagsData = [];
      if (compatibilityMode) {
        // WhatsApp-Web.js (modo compatibilidade)
        const deviceResponse = await api.get(`/whatsapp-web/labels?whatsappId=${selectedWhatsappId}`);
        deviceTagsData = Array.isArray(deviceResponse.data?.labels) ? deviceResponse.data.labels : [];
      } else {
        // Baileys (modo padrão)
        const deviceResponse = await api.get(`/contacts/device-tags`, { params: { whatsappId: selectedWhatsappId } });
        deviceTagsData = Array.isArray(deviceResponse.data?.labels)
          ? deviceResponse.data.labels
          : (Array.isArray(deviceResponse.data) ? deviceResponse.data : []);
      }
      setDeviceTags(deviceTagsData);

      // Carregar tags do sistema (lista completa)
      const systemResponse = await api.get('/tags/list');
      const systemTagsData = Array.isArray(systemResponse.data) ? systemResponse.data : (Array.isArray(systemResponse.data?.tags) ? systemResponse.data.tags : []);
      setSystemTags(systemTagsData);

      // Não carregar contatos via endpoint legado automaticamente
      setDeviceContacts([]);
      setContactsPage(1);
      setContactsHasMore(false);
      setTotalContactsCount(0);
      setSelectAll(false);
      setSelectedDeviceContacts(new Set());
      setTargetSystemTag(null);

      // Se não houver tags, carrega contatos automaticamente para permitir importação manual
      if (deviceTagsData.length === 0) {
        loadContactsPage(1, false);
      }

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
      if (compatibilityMode) {
        // Força 100% ao terminar o ciclo
        setLabelsProgress(p => ({ percent: 100, phase: 'concluido' }));
        // Aguarda um pequeno tempo para o usuário ver 100% e encerra polling
        setTimeout(() => {
          stopProgressPolling();
          setLabelsProgress({ percent: 0, phase: 'idle' });
        }, 700);
      } else {
        stopProgressPolling();
        setLabelsProgress({ percent: 0, phase: 'idle' });
      }
    }
  }, [selectedWhatsappId, compatibilityMode, startProgressPolling, stopProgressPolling, loadContactsPage]);

  const handleRefreshTags = useCallback(async () => {
    if (!selectedWhatsappId) {
      toast.warning("Selecione uma conexão primeiro");
      return;
    }

    setRefreshing(true);
    try {
      const { data } = await api.get("/contacts/device-tags/refresh", {
        params: { whatsappId: selectedWhatsappId }
      });

      toast.success(`✅ ${data.count} tags atualizadas!`);

      // Recarregar dados
      loadData();
    } catch (err) {
      toastError(err);
    } finally {
      setRefreshing(false);
    }
  }, [selectedWhatsappId, loadData]);



  const fetchWhatsapps = useCallback(async () => {
    try {
      const { data } = await api.get("/whatsapp");
      const whatsappsData = Array.isArray(data) ? data : [];
      setWhatsapps(whatsappsData);
    } catch (err) {
      toastError(err);
    }
  }, [selectedWhatsappId]);

  useEffect(() => {
    fetchWhatsapps();
    // Não carregar automaticamente ao abrir
  }, [fetchWhatsapps, isOpen, loadData]);

  // Recarrega automaticamente quando a conexão selecionada muda
  useEffect(() => {
    if (isOpen && selectedWhatsappId) {
      loadData();
    }
  }, [selectedWhatsappId, isOpen, loadData]);

  // Recarregar ao alternar modo de compatibilidade
  useEffect(() => {
    if (isOpen && selectedWhatsappId) {
      loadData();
    }
  }, [compatibilityMode, isOpen, selectedWhatsappId, loadData]);

  // NOVO: Escutar eventos de progresso de importação via Socket.IO
  useEffect(() => {
    if (!companyId || !authSocket || typeof authSocket.on !== 'function') return;

    const handleImportProgress = (data) => {
      if (data?.action === "progress") {
        setImportProgress({
          total: data.total || 0,
          processed: data.processed || 0,
          created: data.created || 0,
          updated: data.updated || 0,
          tagged: data.tagged || 0
        });
      }
    };

    authSocket.on(`importContacts-${companyId}`, handleImportProgress);

    return () => {
      authSocket.off(`importContacts-${companyId}`, handleImportProgress);
    };
  }, [companyId, authSocket]);

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

    // Se desmarcar um, remove o "Select All" visualmente (mas mantém a lógica funcional)
    if (next.has(jid) === false) {
      setSelectAll(false);
    }
  };

  const handleSelectAllToggle = () => {
    if (selectAll) {
      // Desmarcar todos
      setSelectAll(false);
      setSelectedDeviceContacts(new Set());
    } else {
      // Marcar todos (os carregados)
      setSelectAll(true);
      const allLoaded = new Set(deviceContacts.map(c => c.id));
      setSelectedDeviceContacts(allLoaded);
    }
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
      // Inicia progresso de importação (progressId dedicado)
      const progressId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setImportProgress({ total: 0, processed: 0, created: 0, updated: 0, tagged: 0 });
      // Polling de progresso
      if (importPollRef.current) clearInterval(importPollRef.current);
      importPollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/contacts/import-progress`, { params: { progressId } });
          const p = data?.progress || {};
          if (typeof p.total === 'number') setImportProgress(p);
        } catch (_) { /* ignore */ }
      }, 600);
      try {
        const tagMapping = {};
        for (const deviceTagId of selectedDeviceTags) {
          const systemTagId = tagMappings[deviceTagId];
          const newTagName = newTagNames[deviceTagId]?.trim();
          if (systemTagId) {
            tagMapping[deviceTagId] = { systemTagId };
          } else if (newTagName) {
            tagMapping[deviceTagId] = { newTagName };
          } else {
            // Envia seleção mesmo sem mapeamento (ex.: __all__ ou apenas importar sem etiquetar)
            tagMapping[deviceTagId] = {};
          }
        }
        // Opções avançadas + progressId
        tagMapping.__options = { ...(tagMapping.__options || {}), progressId };
        const resp = await api.post('/contacts/import-with-tags', {
          tagMapping,
          whatsappId: selectedWhatsappId,
          progressId
        });

        // Extrair dados do resultado
        const data = resp?.data || resp;
        const { created = 0, updated = 0, tagged = 0, failed = 0, total = 0 } = data || {};
        const hasIssues = failed > 0;

        // Construir HTML para swal
        let html = '<div style="text-align: center; font-size: 14px;">';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">';

        if (created > 0) {
          html += `<div style="background: #d4edda; padding: 10px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #155724;">✅ ${created}</div>
            <div style="color: #155724; font-size: 12px;">Criados</div>
          </div>`;
        }

        if (failed > 0) {
          html += `<div style="background: #f8d7da; padding: 10px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #721c24;">⚠️ ${failed}</div>
            <div style="color: #721c24; font-size: 12px;">Falhas</div>
          </div>`;
        }

        html += '</div>';

        if (hasIssues) {
          html += '<div style="border-top: 1px solid #ddd; padding-top: 12px; margin-top: 8px; text-align: left;">';
          html += '<div style="font-weight: 600; margin-bottom: 8px;">ℹ️ Entenda os números:</div>';
          html += '<div style="font-size: 12px; color: #666;">';
          html += '<strong>Falhas:</strong> Erros de validação (número inválido, formato incorreto) ou conflitos de dados duplicados.';
          html += '</div></div>';
        }

        html += '</div>';

        // IMPORTANTE: Fechar modal principal ANTES de mostrar swal para evitar sobreposição
        setImporting(false);
        if (importPollRef.current) {
          clearInterval(importPollRef.current);
          importPollRef.current = null;
        }
        setSelectedDeviceTags(new Set());
        setTagMappings({});
        setNewTagNames({});
        setImportSummary(null);
        handleCloseModal();

        // Mostrar modal swal com resultado
        await swalCustom({
          title: hasIssues ? 'Importação Concluída com Avisos' : 'Importação Concluída!',
          html,
          icon: hasIssues ? 'warning' : 'success',
          confirmButtonText: 'Fechar',
          confirmButtonColor: hasIssues ? '#f0ad4e' : '#28a745',
          width: 450,
        });

      } catch (error) {
        toastError(error);
        setImporting(false);
        if (importPollRef.current) {
          clearInterval(importPollRef.current);
          importPollRef.current = null;
        }
      }
      return;
    }

    // Caminho 2: Importação por contatos do dispositivo (quando sem tags selecionadas)
    // Verifica se está em modo manual sem seleção
    if (importMode === 'manual' && selectedDeviceContacts.size === 0) {
      toastError('Selecione pelo menos uma tag do dispositivo ou ao menos um contato do dispositivo');
      return;
    }

    setImporting(true);
    setImportProgress({ total: 0, processed: 0, created: 0, updated: 0, tagged: 0, skipped: 0 });

    try {
      const payload = {
        whatsappId: selectedWhatsappId,
        // Se modo 'all' ou 'newOnly', envia lista vazia para backend processar todos
        selectedJids: importMode === 'manual' ? Array.from(selectedDeviceContacts) : [],
        autoCreateTags: true,
        targetTagId: targetSystemTag,
        importMode: importMode, // 'all' | 'newOnly' | 'manual'
        generateDetailedReport: generateDetailedReport // Toggle de relatório detalhado
      };
      const { data } = await api.post('/contacts/import-device-contacts', payload);

      const { created = 0, updated = 0, tagged = 0, failed = 0, skipped = 0, duplicated = 0, reportUrl } = data;
      const total = created + updated + failed + skipped + duplicated;
      const hasIssues = failed > 0 || skipped > 0 || duplicated > 0;

      // Construir HTML detalhado para SweetAlert2
      const buildResultHtml = () => {
        let html = '<div style="text-align: left; font-size: 14px;">';

        // Estatísticas principais
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">';

        if (created > 0) {
          html += `<div style="background: #d4edda; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #155724;">✅ ${created}</div>
            <div style="color: #155724; font-size: 12px;">Criados</div>
          </div>`;
        }

        if (updated > 0) {
          html += `<div style="background: #cce5ff; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #004085;">🔄 ${updated}</div>
            <div style="color: #004085; font-size: 12px;">Atualizados</div>
          </div>`;
        }

        if (duplicated > 0) {
          html += `<div style="background: #fff3cd; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #856404;">📋 ${duplicated}</div>
            <div style="color: #856404; font-size: 12px;">Já existiam</div>
          </div>`;
        }

        if (skipped > 0) {
          html += `<div style="background: #e2e3e5; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #383d41;">⏭️ ${skipped}</div>
            <div style="color: #383d41; font-size: 12px;">Ignorados</div>
          </div>`;
        }

        if (failed > 0) {
          html += `<div style="background: #f8d7da; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #721c24;">⚠️ ${failed}</div>
            <div style="color: #721c24; font-size: 12px;">Falhas</div>
          </div>`;
        }

        html += '</div>';

        // Botão de download do relatório se disponível
        if (reportUrl) {
          html += `<div style="background: #e7f3ff; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #2196f3;">
            <div style="font-weight: 600; color: #1976d2; margin-bottom: 8px;">📊 Relatório Detalhado Disponível</div>
            <a href="${reportUrl}" download style="display: inline-block; background: #2196f3; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-size: 13px;">
              📥 Baixar Relatório CSV
            </a>
            <div style="margin-top: 8px; font-size: 11px; color: #666;">
              O arquivo contém detalhes de cada contato processado
            </div>
          </div>`;
        }

        // Explicações das falhas/ignorados
        if (hasIssues) {
          html += '<div style="border-top: 1px solid #ddd; padding-top: 12px; margin-top: 8px;">';
          html += '<div style="font-weight: 600; margin-bottom: 8px;">ℹ️ Entenda os números:</div>';
          html += '<ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #666;">';

          if (duplicated > 0) {
            html += '<li style="margin-bottom: 4px;"><strong>Já existiam:</strong> Contatos que já estão cadastrados no sistema com o mesmo número.</li>';
          }

          if (skipped > 0) {
            html += '<li style="margin-bottom: 4px;"><strong>Ignorados:</strong> Contatos sem número válido ou grupos que não podem ser importados.</li>';
          }

          if (failed > 0) {
            html += '<li style="margin-bottom: 4px;"><strong>Falhas:</strong> Erros de validação (número inválido, formato incorreto) ou conflitos de dados duplicados.</li>';
          }

          html += '</ul>';
          html += '</div>';
        }

        html += '</div>';
        return html;
      };

      // Mostrar modal SweetAlert2 com resultado detalhado
      // IMPORTANTE: Fechar modal principal ANTES de mostrar swal para evitar sobreposição
      setImporting(false);
      handleCloseModal();

      await swalCustom({
        title: failed > 0 ? 'Importação Concluída com Avisos' : 'Importação Concluída!',
        html: buildResultHtml(),
        icon: failed > 0 ? 'warning' : 'success',
        confirmButtonText: 'Fechar',
        confirmButtonColor: failed > 0 ? '#f0ad4e' : '#28a745',
        width: 450,
      });

    } catch (error) {
      toastError(error);
      setImporting(false);
    }

  };

  const handleCloseModal = () => {
    setSelectedDeviceTags(new Set());
    setTagMappings({});
    setNewTagNames({});
    setImportSummary(null);
    // Encerrar polling do QR caso esteja ativo
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
    setQrOpen(false);
    setQrCode("");
    setQrStatus("idle");
    handleClose();
  };


  // Removido forceLabelsSync legado

  // Removido rebuildCacheFromBaileys legado

  const initializeWhatsAppWeb = async () => {
    // Mantemos a função para compatibilidade, mas agora abrimos o modal dedicado
    await openQrModal();
  };

  // Abre modal e inicia polling de status/QR
  const openQrModal = async () => {
    try {
      setQrStatus("initializing");
      setQrOpen(true);
      setQrCode("");

      // Dispara inicialização no backend
      await api.post(`/whatsapp-web/initialize?whatsappId=${selectedWhatsappId}`);

      // Inicia polling a cada 2s
      if (qrPollRef.current) clearInterval(qrPollRef.current);
      qrPollRef.current = setInterval(async () => {
        try {
          const statusResponse = await api.get(`/whatsapp-web/status?whatsappId=${selectedWhatsappId}`);
          const { hasQR, qrCode: code, status, connected } = statusResponse.data || {};
          setQrStatus(status || (connected ? 'connected' : 'initializing'));
          if (hasQR && code) {
            try {
              // Tenta obter imagem do QR como DataURL do backend
              const imgResp = await api.get(`/whatsapp-web/qr-image?whatsappId=${selectedWhatsappId}`);
              const dataUrl = imgResp?.data?.dataUrl;
              if (dataUrl && typeof dataUrl === 'string') {
                setQrCode(dataUrl);
                setQrUpdatedAt(Date.now());
                setQrNote('O QR expira em ~1 minuto. Atualizaremos automaticamente se necessário.');
              } else {
                // Fallback: usa serviço externo se backend não retornou DataURL
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code)}`;
                setQrCode(url);
                setQrUpdatedAt(Date.now());
                setQrNote('O QR expira em ~1 minuto. Atualizaremos automaticamente se necessário.');
              }
            } catch (_) {
              // Fallback: usa serviço externo se falhar
              const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code)}`;
              setQrCode(url);
              setQrUpdatedAt(Date.now());
              setQrNote('O QR expira em ~1 minuto. Atualizaremos automaticamente se necessário.');
            }
          }
          // Auto-refresh: se estamos exibindo QR há muito tempo, peça um novo
          if (status === 'qr_generated' && qrUpdatedAt && (Date.now() - qrUpdatedAt > QR_REFRESH_MS)) {
            try {
              setQrNote('QR expirado. Gerando um novo...');
              setQrCode('');
              setQrUpdatedAt(Date.now());
              await api.post(`/whatsapp-web/initialize?whatsappId=${selectedWhatsappId}`);
            } catch (_) {
              // mantém tentativa no próximo ciclo
            }
          }
          if (connected) {
            // Conectado: para polling, fecha modal após pequena pausa
            if (qrPollRef.current) {
              clearInterval(qrPollRef.current);
              qrPollRef.current = null;
            }
            setTimeout(() => {
              setQrOpen(false);
              setQrCode("");
              setQrNote('');
            }, 1200);
          }
        } catch (e) {
          // mantém polling, mostra status mínimo
          // console.error('Polling status error', e);
        }
      }, 2000);
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp-Web.js:', error);
      alert('Erro ao inicializar WhatsApp-Web.js');
      setQrOpen(false);
      if (qrPollRef.current) {
        clearInterval(qrPollRef.current);
        qrPollRef.current = null;
      }
    }
  };

  const testWhatsAppWebLabels = async () => {
    try {
      setLoading(true);
      setLabelsProgress({ percent: 1, phase: 'iniciando' });
      startProgressPolling();

      // Buscar as labels diretamente
      const response = await api.get(`/whatsapp-web/labels?whatsappId=${selectedWhatsappId}`);
      console.log('WhatsApp-Web.js Labels Response:', response.data);

      if (response.data?.success) {
        const labels = response.data.labels || [];
        // Atualizar estado com as labels do WhatsApp-Web.js (sem alert)
        setDeviceTags(labels);
      } else {
        alert(`❌ Erro no WhatsApp-Web.js:\n\n${response.data?.error || 'Erro desconhecido'}\n\nVerifique os logs do backend para mais detalhes.`);
      }
      setLoading(false);
      setLabelsProgress(p => ({ percent: 100, phase: 'concluido' }));
      setTimeout(() => {
        stopProgressPolling();
        setLabelsProgress({ percent: 0, phase: 'idle' });
      }, 700);
    } catch (error) {
      console.error('Erro ao testar WhatsApp-Web.js:', error);

      let errorMessage = '❌ Erro ao conectar com WhatsApp-Web.js:\n\n';

      if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Erro desconhecido';
      }

      errorMessage += '\n\nVerifique:\n';
      errorMessage += '• Se o backend está rodando\n';
      errorMessage += '• Os logs do backend para mais detalhes\n';
      errorMessage += '• Se precisa escanear o QR Code';

      alert(errorMessage);
      setLoading(false);
      stopProgressPolling();
    }
  };

  // Removido retorno antecipado em loading para sempre mostrar o modal com a barra de progresso

  return (
    <>
      <Dialog fullWidth maxWidth="md" open={isOpen} onClose={handleCloseModal} PaperProps={{ className: classes.dialogPaper }}>
        <DialogTitle className={classes.dialogTitle}>
          📥 Importar Contatos com Tags
        </DialogTitle>

        <DialogContent>
          {loading ? (
            <Box>
              <Box mb={2}>
                <LinearProgress variant={labelsProgress.percent > 0 ? 'determinate' : 'indeterminate'} value={Math.max(1, Math.min(100, labelsProgress.percent || 0))} />
              </Box>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" color="textSecondary">
                    Buscando etiquetas do WhatsApp...
                  </Typography>
                  <Box display="flex" alignItems="center" ml={2} minWidth={180}>
                    <Typography variant="caption" color="textSecondary">
                      {Math.max(1, Math.min(100, labelsProgress.percent))}% — {phaseLabel(labelsProgress.phase)}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  onClick={handleCancelLabels}
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
              </Box>
            </Box>
          ) : importing ? (() => {
            const total = importProgress?.total || 0;
            const processed = importProgress?.processed || 0;
            const percent = total > 0 ? Math.min(100, Math.max(1, Math.floor((processed / total) * 100))) : 0;
            const hasRealProgress = total > 0;

            return (
              <Box>
                <Box mb={1}>
                  <LinearProgress
                    variant={hasRealProgress ? 'determinate' : 'indeterminate'}
                    value={percent}
                  />
                </Box>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    {hasRealProgress
                      ? `Importando contatos... ${processed}/${total} (${percent}%)`
                      : 'Importando contatos... aguarde concluir.'}
                  </Typography>
                  {hasRealProgress && (
                    <Typography variant="caption" color="textSecondary" style={{ marginLeft: 16 }}>
                      Criados: {importProgress?.created || 0} | Falhas: {importProgress?.failed || 0}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })() : (
            !importSummary && (
              <Box mb={2} display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" color="textSecondary">
                    Selecione as tags do WhatsApp que deseja importar e mapeie para tags do sistema.
                  </Typography>
                  {labelsProgress.percent > 0 && (
                    <Box display="flex" alignItems="center" ml={2} minWidth={180}>
                      <LinearProgress variant="determinate" value={Math.max(1, Math.min(100, labelsProgress.percent))} style={{ width: 120, marginRight: 8 }} />
                      <Typography variant="caption" color="textSecondary">
                        {Math.max(1, Math.min(100, labelsProgress.percent))}% — {phaseLabel(labelsProgress.phase)}
                      </Typography>
                      <Button
                        size="small"
                        style={{ marginLeft: 8 }}
                        onClick={handleCancelLabels}
                        disabled={!loading}
                        variant="contained"
                        startIcon={<CloseIcon />}
                        sx={{
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
                    </Box>
                  )}
                </Box>
                <Box>
                  {compatibilityMode && (
                    <>
                      <Tooltip title="Inicializar WhatsApp-Web.js (gerar QR Code)">
                        <IconButton
                          onClick={openQrModal}
                          disabled={loading}
                          style={{ marginRight: 8 }}
                        >
                          <span style={{ fontSize: '16px' }}>📱</span>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Buscar etiquetas via WhatsApp-Web.js">
                        <IconButton
                          onClick={testWhatsAppWebLabels}
                          disabled={loading}
                          style={{ marginRight: 8 }}
                        >
                          <span style={{ fontSize: '16px' }}>🌐</span>
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
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
            ))}

          {!loading && !importing && !importSummary && (
            <Box className={classes.headerControls}>
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

              <Box display="flex" alignItems="center" width={{ xs: '100%', sm: 'auto' }} justifyContent="space-between">
                <FormControlLabel
                  style={{ whiteSpace: 'nowrap', margin: 0 }}
                  control={
                    <Checkbox
                      checked={compatibilityMode}
                      onChange={(e) => setCompatibilityMode(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Modo compatibilidade"
                />

                <Tooltip title="Atualizar tags do aparelho">
                  <span>
                    <IconButton
                      onClick={handleRefreshTags}
                      disabled={!selectedWhatsappId || refreshing || loading}
                      color="primary"
                    >
                      {refreshing ? <CircularProgress size={24} /> : <Refresh />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          )}

          {!loading && !importing && !importSummary && (!Array.isArray(deviceTags) || deviceTags.length === 0) ? (
            <div>
              <Alert severity="info" style={{ marginBottom: 8 }}>
                Nenhuma tag de WhatsApp foi encontrada para esta conexão. Você pode importar contatos do dispositivo e usar as tags exibidas ao lado de cada contato.
              </Alert>

              <Box className={classes.responsiveFlexHeader} mb={1}>
                <Box>
                  <Typography variant="h6">
                    Contatos do Dispositivo
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Total: {totalContactsCount} | Carregados: {deviceContacts.length} | Selecionados: {selectedDeviceContacts.size}
                  </Typography>
                </Box>

                <Box className={classes.selectionOptions}>
                  <FormControl variant="outlined" size="small" className={classes.systemTagSelect}>
                    <InputLabel id="target-tag-label">Aplicar Tag (Sistema)</InputLabel>
                    <Select
                      labelId="target-tag-label"
                      value={targetSystemTag || ''}
                      onChange={(e) => setTargetSystemTag(e.target.value)}
                      label="Aplicar Tag (Sistema)"
                    >
                      <MenuItem value="">
                        <em>Nenhuma</em>
                      </MenuItem>
                      {systemTags.map((tag) => (
                        <MenuItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl variant="outlined" size="small" className={classes.systemTagSelect}>
                    <InputLabel id="import-mode-label">Modo de Seleção</InputLabel>
                    <Select
                      labelId="import-mode-label"
                      value={importMode}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setImportMode(mode);
                        if (mode === 'all' || mode === 'newOnly') {
                          setSelectAll(true);
                        } else {
                          setSelectAll(false);
                          setSelectedDeviceContacts(new Set());
                        }
                      }}
                      label="Modo de Seleção"
                    >
                      <MenuItem value="manual">Seleção manual</MenuItem>
                      <MenuItem value="all">Todos os contatos ({totalContactsCount})</MenuItem>
                      <MenuItem value="newOnly">Somente novos</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Alerta informativo sobre modo selecionado */}
              {importMode !== 'manual' && (
                <Box mb={2} p={2} style={{ backgroundColor: importMode === 'all' ? '#e3f2fd' : '#fff3e0', borderRadius: 8 }}>
                  <Typography variant="body2" style={{ color: importMode === 'all' ? '#1565c0' : '#e65100' }}>
                    {importMode === 'all'
                      ? `✅ Modo "Todos": Ao clicar em importar, TODOS os ${totalContactsCount} contatos serão processados automaticamente.`
                      : `🆕 Modo "Somente novos": Ao clicar em importar, apenas contatos que NÃO existem no sistema serão importados.`}
                  </Typography>
                </Box>
              )}

              {/* Barra de Busca */}
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Buscar por nome ou número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={classes.searchBar}
                InputProps={{
                  startAdornment: <Search style={{ color: '#999', marginRight: 8 }} />,
                }}
              />

              {/* Lista de Contatos Modernizada */}
              <div
                ref={(ref) => {
                  if (ref) {
                    ref.addEventListener('scroll', onContactsScroll);
                  }
                }}
                className={classes.contactsList}
              >
                {(() => {
                  // Filtrar contatos especiais e aplicar busca
                  const filteredContacts = (deviceContacts || [])
                    .filter(c => !isSpecialContact(c.id))
                    .filter(c => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      const name = (c.name || c.notify || c.pushname || '').toLowerCase();
                      const number = String(c.id || '').split('@')[0];
                      return name.includes(q) || number.includes(q);
                    });

                  if (filteredContacts.length === 0) {
                    return (
                      <Box textAlign="center" py={4}>
                        <Typography color="textSecondary">
                          {searchQuery ? 'Nenhum contato encontrado para esta busca.' : 'Nenhum contato disponível.'}
                        </Typography>
                      </Box>
                    );
                  }

                  return filteredContacts.map((c) => {
                    const displayName = c.name || c.notify || c.pushname || '';
                    const formattedNumber = formatPhoneNumber(c.id);
                    const initials = getInitials(displayName, c.id);
                    const avatarColor = getAvatarColor(c.id);
                    const isSelected = selectedDeviceContacts.has(c.id);
                    const cleanNumber = String(c.id || '').split('@')[0];
                    const isExisting = existingNumbers.has(cleanNumber);

                    return (
                      <div
                        key={c.id}
                        className={`${classes.contactCard} ${isSelected ? classes.contactCardSelected : ''}`}
                        onClick={() => handleDeviceContactToggle(c.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          color="primary"
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleDeviceContactToggle(c.id)}
                          style={{ padding: 4, marginRight: 8 }}
                        />

                        {/* Avatar */}
                        <div
                          className={classes.contactAvatar}
                          style={{ backgroundColor: avatarColor }}
                        >
                          {initials}
                        </div>

                        {/* Info */}
                        <div className={classes.contactInfo}>
                          <div className={classes.contactName}>
                            {displayName || formattedNumber}
                          </div>
                          <div className={classes.contactNumber}>
                            {displayName ? formattedNumber : ''}
                          </div>
                        </div>

                        {/* Badge "Já existe" */}
                        {isExisting && (
                          <span className={classes.existsBadge}>
                            Já existe
                          </span>
                        )}

                        {/* Tags */}
                        <Box className={classes.tagsContainer}>
                          {Array.isArray(c.tags) && c.tags.slice(0, 3).map((t) => (
                            <Chip
                              key={`${c.id}-${t.id}`}
                              label={t.name || t.id}
                              size="small"
                              style={{ margin: 2, fontSize: 10 }}
                            />
                          ))}
                          {Array.isArray(c.tags) && c.tags.length > 3 && (
                            <Chip
                              label={`+${c.tags.length - 3}`}
                              size="small"
                              style={{ margin: 2, fontSize: 10, backgroundColor: '#e0e0e0' }}
                            />
                          )}
                        </Box>
                      </div>
                    );
                  });
                })()}

                {contactsLoadingPage && (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress size={24} />
                  </Box>
                )}
                {!contactsHasMore && !searchQuery && (
                  <Box display="flex" justifyContent="center" p={1}>
                    <Typography variant="caption" color="textSecondary">
                      ✓ Todos os contatos carregados
                    </Typography>
                  </Box>
                )}
              </div>
            </div>
          ) : (!loading && !importing && !importSummary && (
            <div>
              <Typography variant="h6" gutterBottom>
                Tags do Dispositivo ({Array.isArray(deviceTags) ? deviceTags.length : 0})
              </Typography>

              <List>
                {Array.isArray(deviceTags) &&
                  deviceTags
                    .sort((a, b) => {
                      // "Sem etiqueta" sempre no topo
                      if (a.id === "__unlabeled__") return -1;
                      if (b.id === "__unlabeled__") return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((deviceTag) => {
                      const mappedId = tagMappings[deviceTag.id];
                      const mappedTag = Array.isArray(systemTags)
                        ? systemTags.find((t) => t.id === mappedId)
                        : null;
                      const mappedLabel = mappedTag
                        ? ` → Tag: ${mappedTag.name}`
                        : '';
                      const isUnlabeled = deviceTag.id === "__unlabeled__";
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
                                <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 4 }}>
                                  <Chip
                                    label={`${deviceTag.name}${typeof deviceTag.count === 'number'
                                      ? ` (${deviceTag.count})`
                                      : ''
                                      }`}
                                    style={{
                                      backgroundColor: isUnlabeled ? '#8D99AE' : (deviceTag.color || '#A4CCCC'),
                                      color: getContrastColor(isUnlabeled ? '#8D99AE' : (deviceTag.color || '#A4CCCC')),
                                      fontWeight: isUnlabeled ? 'bold' : 'normal'
                                    }}
                                    size="small"
                                    icon={isUnlabeled ? <span>📝</span> : undefined}
                                  />
                                  {mappedLabel && (
                                    <Typography
                                      variant="caption"
                                      style={{ color: '#555' }}
                                    >
                                      {mappedLabel}
                                    </Typography>
                                  )}
                                  {isUnlabeled && (
                                    <Typography
                                      variant="caption"
                                      style={{ color: '#666', fontStyle: 'italic' }}
                                    >
                                      Contatos sem etiquetas no WhatsApp
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </Box>

                          {selectedDeviceTags.has(deviceTag.id) && (
                            <Box ml={4}>
                              <Typography variant="body2" gutterBottom>
                                Mapear para: {mappedTag ? (
                                  <span style={{ fontStyle: 'italic', color: '#555' }}>
                                    → Tag: {mappedTag.name}
                                  </span>
                                ) : null}
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
              {/* Toggle para gerar relatório detalhado */}
              <Box display="flex" alignItems="center" marginRight="auto">
                <FormControlLabel
                  control={
                    <Switch
                      checked={generateDetailedReport}
                      onChange={(e) => setGenerateDetailedReport(e.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Tooltip title="Gera um arquivo CSV detalhado com o status de cada contato processado">
                      <Typography variant="body2" style={{ cursor: 'help' }}>
                        📊 Gerar Relatório Detalhado
                      </Typography>
                    </Tooltip>
                  }
                />
              </Box>

              <Button
                onClick={handleCloseModal}
                disabled={importing}
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
                onClick={handleImport}
                color="primary"
                variant="contained"
                disabled={importing || (selectedDeviceTags.size === 0 && selectedDeviceContacts.size === 0 && importMode === 'manual')}
              >
                {importing ? <CircularProgress size={20} /> : (importMode === 'all' ? `Importar Todos (${totalContactsCount})` : importMode === 'newOnly' ? 'Importar Somente Novos' : 'Importar Contatos')}
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

      {/* Modal de QR Code do WhatsApp-Web.js */}
      <Dialog fullWidth maxWidth="xs" open={qrOpen} onClose={() => setQrOpen(false)}>
        <DialogTitle>Conectar WhatsApp-Web.js</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={1}>
            <Typography variant="body2" gutterBottom>
              Status: {qrStatus === 'qr_generated' ? 'QR Code gerado' : qrStatus}
            </Typography>
            {!qrCode && (
              <Box display="flex" alignItems="center" justifyContent="center" p={2}>
                <CircularProgress />
                <Typography variant="caption" style={{ marginLeft: 8 }}>
                  Aguardando QR Code...
                </Typography>
              </Box>
            )}
            {qrCode && (
              <img
                alt="QR Code WhatsApp"
                width={300}
                height={300}
                style={{ borderRadius: 8, border: '1px solid #eee' }}
                src={qrCode}
              />
            )}
            <Typography variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
              Abra o aplicativo WhatsApp no celular → Dispositivos conectados → Conectar um dispositivo → aponte a câmera para o QR.
            </Typography>
            {qrNote && (
              <Typography variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                {qrNote}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrOpen(false)} color="primary">Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ContactImportTagsModal;
