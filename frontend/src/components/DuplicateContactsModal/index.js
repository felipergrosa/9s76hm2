import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  Radio,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  Chip,
  Switch,
  FormControl,
  InputLabel,
  Select,
  LinearProgress
} from "@material-ui/core";
import { RefreshCw, Trash2, GitMerge, Search, Wand2, Tag as TagIcon } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const DEFAULT_LIMIT = 10;

const DuplicateContactsModal = ({ open, onClose, onActionCompleted }) => {
  const [activeTab, setActiveTab] = useState("normalization");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [groupState, setGroupState] = useState({});
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [normalizationState, setNormalizationState] = useState({});
  const [duplicatesGroupBy, setDuplicatesGroupBy] = useState("number");
  const [duplicatesNameFilter, setDuplicatesNameFilter] = useState("");
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [customTagName, setCustomTagName] = useState("");
  const [customTagColor, setCustomTagColor] = useState("#FFB020");
  const [applyNormalization, setApplyNormalization] = useState(false);

  // ── Estado da aba Validação WhatsApp ──
  const [validationContacts, setValidationContacts] = useState([]);
  const [validationResults, setValidationResults] = useState({});
  const [validationProgress, setValidationProgress] = useState(0);
  const [validating, setValidating] = useState(false);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [whatsapps, setWhatsapps] = useState([]);
  const [validationMode, setValidationMode] = useState("nine_digit");
  const [validationSummary, setValidationSummary] = useState(null);
  const [validationPage, setValidationPage] = useState(0);

  const totalPages = useMemo(() => {
    if (activeTab === "normalization") {
      return 1;
    }
    if (!total) return 0;
    return Math.ceil(total / limit);
  }, [activeTab, total, limit]);

  const currentGroup = useMemo(() => groups[selectedGroupIndex] || null, [groups, selectedGroupIndex]);

  const currentGroupKey = currentGroup?.canonicalNumber || currentGroup?.groupKey || "";

  const totalContacts = useMemo(() => {
    return groups.reduce((acc, group) => acc + (group.contacts?.length || 0), 0);
  }, [groups]);

  const COUNTRY_METADATA = useMemo(() => ({
    55: {
      iso: "BR",
      ddi: "55",
      areaCodeLength: 2
    },
    54: {
      iso: "AR",
      ddi: "54",
      areaCodeLength: 2,
      mobileIndicatorPrefix: "9"
    },
    1: {
      iso: "US",
      ddi: "1",
      areaCodeLength: 3
    }
  }), []);

  const resolveCountry = useCallback((digits) => {
    const candidates = Object.keys(COUNTRY_METADATA)
      .map(key => ({ key, metadata: COUNTRY_METADATA[key] }))
      .sort((a, b) => b.key.length - a.key.length);

    for (const candidate of candidates) {
      if (digits.startsWith(candidate.key)) {
        return {
          metadata: candidate.metadata,
          national: digits.slice(candidate.key.length)
        };
      }
    }

    return {
      metadata: undefined,
      national: digits
    };
  }, [COUNTRY_METADATA]);

  const renderDuplicateFilters = () => {
    if (activeTab !== "duplicates") return null;

    return (
      <Box display="flex" gridGap={12} alignItems="flex-end" flexWrap="wrap" mb={2}>
        <FormControl variant="outlined" style={{ minWidth: 200 }}>
          <InputLabel>Agrupar por</InputLabel>
          <Select
            value={duplicatesGroupBy}
            onChange={(e) => {
              setDuplicatesGroupBy(e.target.value);
              setSelectedGroupIndex(0);
            }}
            label="Agrupar por"
          >
            <MenuItem value="number">Número</MenuItem>
            <MenuItem value="name">Nome</MenuItem>
          </Select>
        </FormControl>

        {duplicatesGroupBy === "name" && (
          <TextField
            variant="outlined"
            label="Nome (exato)"
            value={duplicatesNameFilter}
            onChange={(e) => setDuplicatesNameFilter(e.target.value)}
            style={{ minWidth: 320 }}
          />
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={() => fetchGroups(1, "duplicates")}
          disabled={loading}
          startIcon={<Search size={16} />}
        >
          Localizar duplicados
        </Button>
      </Box>
    );
  };

  const formatSubscriber = (subscriber) => {
    if (!subscriber) return "";
    if (subscriber.length <= 4) return subscriber;
    const splitIndex = subscriber.length - 4;
    return `${subscriber.slice(0, splitIndex)}-${subscriber.slice(splitIndex)}`;
  };

  const formatDisplayNumber = useCallback((value) => {
    if (!value) return "";
    const digits = String(value).replace(/\D/g, "");
    if (!digits) return "";

    const { metadata, national } = resolveCountry(digits);

    if (!metadata) {
      return `+${digits}`;
    }

    if (!national) {
      return `${metadata.iso} +${metadata.ddi}`;
    }

    let nationalDisplay = national;
    if (metadata.mobileIndicatorPrefix && nationalDisplay.startsWith(metadata.mobileIndicatorPrefix)) {
      nationalDisplay = nationalDisplay.slice(metadata.mobileIndicatorPrefix.length);
    }

    const areaLength = metadata.areaCodeLength ?? 0;
    let areaCode = "";
    let subscriber = nationalDisplay;

    if (areaLength > 0 && nationalDisplay.length > areaLength) {
      areaCode = nationalDisplay.slice(0, areaLength);
      subscriber = nationalDisplay.slice(areaLength);
    }

    if (!subscriber) {
      subscriber = nationalDisplay;
    }

    const formattedSubscriber = formatSubscriber(subscriber);

    if (areaCode) {
      return `${metadata.iso} (${areaCode}) ${formattedSubscriber}`;
    }

    return `${metadata.iso} ${formattedSubscriber}`;
  }, [resolveCountry]);

  const ensureGroupState = useCallback((data) => {
    setGroupState(prev => {
      const next = { ...prev };
      data.forEach(group => {
        const key = group.canonicalNumber || group.groupKey;
        if (!key) return;
        if (group.mode === "duplicates") {
          if (!next[key]) {
            const masterId = group.contacts?.[0]?.id || null;
            const duplicateIds = group.contacts?.filter(contact => contact.id !== masterId).map(contact => contact.id) || [];
            next[key] = {
              masterId,
              selectedIds: new Set(duplicateIds)
            };
          } else {
            const availableIds = new Set(group.contacts.map(contact => contact.id));
            if (!availableIds.has(next[key].masterId)) {
              const fallbackMaster = group.contacts?.[0]?.id || null;
              next[key].masterId = fallbackMaster;
            }
            const selected = Array.from(next[key].selectedIds).filter(id => availableIds.has(id) && id !== next[key].masterId);
            next[key].selectedIds = new Set(selected);
          }
        }
      });
      return next;
    });
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await api.get("/tags", { params: { limit: 1000 } });
      setTags(data.tags || []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const fetchGroups = useCallback(async (pageToLoad = 1, tab = "duplicates") => {
    try {
      setLoading(true);
      const endpoint = tab === "duplicates" ? "/contacts/duplicates" : "/contacts/pending-normalization";
      const requestLimit = tab === "normalization" ? 0 : limit;
      const duplicateParams = tab === "duplicates"
        ? {
          groupBy: duplicatesGroupBy,
          name: duplicatesGroupBy === "name" && duplicatesNameFilter.trim() ? duplicatesNameFilter.trim() : undefined
        }
        : {};
      const { data } = await api.get(endpoint, {
        params: {
          page: pageToLoad,
          limit: requestLimit,
          ...duplicateParams
        }
      });

      const groupsResponse = data?.groups || [];
      const normalizedGroups = groupsResponse.map(item => ({
        ...item,
        mode: tab,
        canonicalNumber: item.canonicalNumber || item.groupKey,
        suggestedCanonical: item.suggestedCanonical || item.canonicalNumber || null,
        contacts: (item.contacts || []).map(contact => ({
          ...contact,
          normalization: contact.normalization || {
            classification: "unknown",
            suggestedCanonical: item.suggestedCanonical || null,
            displayLabel: null,
            isValid: false
          }
        })),
        classificationSummary: item.classificationSummary || {},
        displayLabel: item.displayLabel || null
      }));

      setGroups(normalizedGroups);
      setPage(tab === "normalization" ? 1 : (data?.page || pageToLoad));
      const fallbackTotal = tab === "normalization"
        ? normalizedGroups.reduce((acc, group) => acc + (group.contacts?.length || 0), 0)
        : 0;
      setTotal(data?.total ?? fallbackTotal);
      ensureGroupState(normalizedGroups);

      if (normalizedGroups.length > 0) {
        setSelectedGroupIndex(0);
      }

      setInitialFetchDone(true);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [ensureGroupState, limit, duplicatesGroupBy, duplicatesNameFilter]);

  useEffect(() => {
    if (open) {
      setActiveTab("normalization");
      setGroups([]);
      setGroupState({});
      setNormalizationState({});
      setInitialFetchDone(false);
      setSelectedGroupIndex(0);
      setTotal(0);
      setPage(1);
      setDuplicatesGroupBy("number");
      setDuplicatesNameFilter("");
      setSelectedTagId("");
      setCustomTagName("");
      setApplyNormalization(false);
      setValidationContacts([]);
      setValidationResults({});
      setValidationProgress(0);
      setValidating(false);
      setSelectedWhatsappId("");
      setValidationMode("nine_digit");
      setValidationSummary(null);
      setValidationPage(0);
      fetchTags();
      // Buscar conexões WhatsApp ativas
      api.get("/whatsapp", { params: { session: 0 } })
        .then(({ data }) => {
          const connected = (data || []).filter(
            w => w.status === "CONNECTED" && w.channel !== "official"
          );
          setWhatsapps(connected);
          if (connected.length > 0) setSelectedWhatsappId(connected[0].id);
        })
        .catch(() => { });
    }
  }, [open, fetchTags]);

  useEffect(() => {
    if (open) {
      fetchGroups(1, activeTab);
    }
  }, [open, activeTab, fetchGroups]);

  const handleSelectGroup = (index) => {
    setSelectedGroupIndex(index);
  };

  const handleSelectMaster = (groupKey, masterId) => {
    setGroupState(prev => {
      const next = { ...prev };
      const group = next[groupKey];
      if (!group) return prev;
      const newSelected = new Set(Array.from(group.selectedIds));
      newSelected.delete(masterId);
      next[groupKey] = {
        masterId,
        selectedIds: newSelected
      };
      return next;
    });
  };

  const handleToggleDuplicate = (groupKey, contactId) => {
    setGroupState(prev => {
      const next = { ...prev };
      const group = next[groupKey];
      if (!group) return prev;
      const selectedIds = new Set(Array.from(group.selectedIds));
      if (selectedIds.has(contactId)) {
        selectedIds.delete(contactId);
      } else {
        if (contactId !== group.masterId) {
          selectedIds.add(contactId);
        }
      }
      next[groupKey] = {
        ...group,
        selectedIds
      };
      return next;
    });
  };

  const handleNormalizationChange = (groupKey, value) => {
    setNormalizationState(prev => ({
      ...prev,
      [groupKey]: value
    }));
  };

  const executeDuplicateAction = async ({ mode, operation }) => {
    if (!currentGroup) return;

    const state = groupState[currentGroupKey];
    if (!state || !state.masterId) {
      toast.warn("Selecione um contato principal para continuar.");
      return;
    }

    const payload = {
      masterId: state.masterId,
      mode,
      operation
    };

    if (duplicatesGroupBy === "name") {
      payload.normalizedName = currentGroup.canonicalNumber;
    } else {
      payload.canonicalNumber = currentGroup.canonicalNumber;
    }

    if (mode === "selected") {
      const selectedIds = Array.from(state.selectedIds).filter(id => id !== state.masterId);
      if (!selectedIds.length) {
        toast.warn("Selecione ao menos um contato duplicado.");
        return;
      }
      payload.targetIds = selectedIds;
    }

    try {
      setLoading(true);
      if (duplicatesGroupBy === "name") {
        await api.post("/contacts/duplicates/process-by-name", payload);
      } else {
        await api.post("/contacts/duplicates/process", payload);
      }
      toast.success(operation === "merge" ? "Duplicados mesclados com sucesso." : "Duplicados removidos com sucesso.");
      if (onActionCompleted) {
        onActionCompleted();
      }
      await fetchGroups(page, activeTab);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const executeNormalizationAll = async (options) => {
    const batches = groups
      .map(group => {
        const key = group.canonicalNumber || group.groupKey || "";
        const contacts = (group.contacts || []).filter(contact => !contact.isGroup);
        const contactIds = contacts.map(contact => contact.id);
        const canonicalInput = normalizationState[key]
          || group.suggestedCanonical
          || contacts[0]?.normalization?.suggestedCanonical
          || "";
        const label = group.displayLabel || formatDisplayNumber(group.suggestedCanonical) || key || "grupo";
        return {
          key,
          contactIds,
          canonicalInput,
          label
        };
      })
      .filter(batch => batch.contactIds.length > 0);

    if (!batches.length) {
      toast.warn("Nenhum contato pendente para processar.");
      return;
    }

    if (options.includeNormalization) {
      const missing = batches.find(batch => !batch.canonicalInput);
      if (missing) {
        toast.warn(`Informe um número canônico válido para o grupo ${missing.label}.`);
        return;
      }
    }

    if ((options.action === "tag" || options.action === "normalize_and_tag") && !options.tagId && !options.tagName) {
      toast.warn("Selecione uma tag existente ou informe uma nova.");
      return;
    }

    try {
      setLoading(true);
      for (const batch of batches) {
        const payload = {
          contactIds: batch.contactIds,
          action: options.action,
          canonicalNumber: options.includeNormalization ? batch.canonicalInput : undefined,
          tagId: options.tagId || undefined,
          tagName: options.tagName || undefined,
          tagColor: options.tagColor || undefined
        };

        if (payload.tagId) {
          payload.tagId = Number(payload.tagId);
        }

        await api.post("/contacts/normalization/process", payload);
      }

      toast.success("Processamento em lote concluído.");
      if (onActionCompleted) {
        onActionCompleted();
      }
      await fetchGroups(1, activeTab);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const executeNormalizationAction = async (options) => {
    if (!currentGroup) return;

    const contacts = (currentGroup.contacts || []).filter(contact => !contact.isGroup);
    const contactIds = contacts.map(c => c.id);
    if (!contactIds.length) {
      toast.warn("Nenhum contato selecionado para normalização.");
      return;
    }

    const canonicalInput = normalizationState[currentGroupKey] || currentGroup.suggestedCanonical || currentGroup.contacts?.[0]?.normalization?.suggestedCanonical || "";

    const payload = {
      contactIds,
      action: options.action,
      canonicalNumber: options.includeNormalization ? canonicalInput : undefined,
      tagId: options.tagId || undefined,
      tagName: options.tagName || undefined,
      tagColor: options.tagColor || undefined
    };

    if (options.includeNormalization && !payload.canonicalNumber) {
      toast.warn("Informe um número canônico válido.");
      return;
    }

    if ((options.action === "tag" || options.action === "normalize_and_tag") && !payload.tagId && !payload.tagName) {
      toast.warn("Selecione uma tag existente ou informe uma nova.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/contacts/normalization/process", payload);
      toast.success("Contatos atualizados com sucesso.");
      if (onActionCompleted) {
        onActionCompleted();
      }
      await fetchGroups(page, activeTab);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading || validating) return;
    onClose();
  };

  // ── Funções da aba Validação WhatsApp ──
  const fetchValidationContacts = async () => {
    if (!selectedWhatsappId) {
      toast.warn("Selecione uma conexão WhatsApp.");
      return;
    }
    try {
      setLoading(true);
      setValidationResults({});
      setValidationSummary(null);
      setValidationPage(0);

      // Buscar contatos BR pendentes via endpoint dedicado (isWhatsappValid IS NULL)
      let allContacts = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data } = await api.get("/contacts/validate-whatsapp/pending", {
          params: { mode: validationMode, page, limit: 500 }
        });
        const batch = data?.contacts || [];
        allContacts = [...allContacts, ...batch];
        hasMore = data?.hasMore || false;
        page++;
        // Limite de segurança: máximo 10000 contatos
        if (allContacts.length >= 10000) break;
      }

      setValidationContacts(allContacts);
      toast.info(`${allContacts.length} contatos BR pendentes de validação.`);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const executeValidation = async () => {
    if (!selectedWhatsappId) {
      toast.warn("Selecione uma conexão WhatsApp.");
      return;
    }
    if (validationContacts.length === 0) {
      toast.warn("Nenhum contato para validar. Busque os contatos primeiro.");
      return;
    }

    setValidating(true);
    setValidationProgress(0);
    setValidationResults({});
    setValidationSummary(null);

    const totalContacts = validationContacts.length;
    let summary = { validated: 0, corrected: 0, invalid: 0, errors: 0 };
    let processedCount = 0;

    try {
      // O backend processa batches de 50 automaticamente.
      // Cada chamada POST processa um batch e o backend filtra por isWhatsappValid IS NULL,
      // então sempre usamos offset=0 (os já validados saem da fila automaticamente).
      let hasMore = true;
      while (hasMore) {
        const { data } = await api.post("/contacts/validate-whatsapp", {
          whatsappId: Number(selectedWhatsappId),
          mode: validationMode,
          offset: 0
        });

        const batchResults = data?.results || [];
        if (batchResults.length === 0) {
          hasMore = false;
          break;
        }

        processedCount += batchResults.length;
        summary.validated += data?.validated || 0;
        summary.corrected += data?.corrected || 0;
        summary.invalid += data?.invalid || 0;
        summary.errors += data?.errors || 0;

        // Atualizar results por contactId
        const newResults = {};
        batchResults.forEach(r => { newResults[r.contactId] = r; });
        setValidationResults(prev => ({ ...prev, ...newResults }));

        const progress = Math.min(Math.round((processedCount / totalContacts) * 100), 99);
        setValidationProgress(progress);

        // Se totalPending do backend for 0, acabou
        if (!data?.totalPending || data.totalPending <= 0) {
          hasMore = false;
        }
      }

      setValidationProgress(100);
      setValidationSummary(summary);
      toast.success(
        `Validação concluída: ${summary.validated} válidos, ${summary.corrected} corrigidos, ${summary.invalid} inválidos.`
      );
    } catch (err) {
      toastError(err);
    } finally {
      setValidating(false);
    }
  };

  const renderDuplicateContacts = () => {
    if (!currentGroup) {
      return (
        <Typography variant="body2" color="textSecondary">
          Nenhum grupo selecionado.
        </Typography>
      );
    }

    const state = groupState[currentGroupKey] || { masterId: null, selectedIds: new Set() };
    const selectedIds = new Set(Array.from(state.selectedIds));

    return (
      <List dense>
        {currentGroup.contacts.map(contact => (
          <React.Fragment key={contact.id}>
            <ListItem alignItems="flex-start">
              <Box display="flex" flexDirection="column" width="100%">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <FormControlLabel
                    control={
                      <Radio
                        color="primary"
                        checked={state.masterId === contact.id}
                        onChange={() => handleSelectMaster(currentGroupKey, contact.id)}
                      />
                    }
                    label={<Typography variant="subtitle2">Principal</Typography>}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => handleToggleDuplicate(currentGroupKey, contact.id)}
                        disabled={state.masterId === contact.id}
                      />
                    }
                    label={<Typography variant="subtitle2">Duplicado</Typography>}
                  />
                </Box>
                <ListItemText
                  primary={`${contact.name || "(sem nome)"}`}
                  secondary={
                    <Box component="span" display="flex" flexDirection="column" gridGap={4}>
                      <Typography variant="body2">Número: {contact.number}</Typography>
                      <Typography variant="body2">Atualizado em: {new Date(contact.updatedAt).toLocaleString()}</Typography>
                      {contact.email ? <Typography variant="body2">Email: {contact.email}</Typography> : null}
                    </Box>
                  }
                />
              </Box>
            </ListItem>
            <Divider component="li" />
          </React.Fragment>
        ))}
      </List>
    );
  };

  const classificationLabels = {
    mobile: { label: "Móvel (WhatsApp provável)", color: "primary" },
    landline: { label: "Fixo", color: "default" },
    shortcode: { label: "Curto / Especial", color: "secondary" },
    invalid: { label: "Inválido", color: "secondary" },
    unknown: { label: "Desconhecido", color: "default" },
    international: { label: "Internacional", color: "default" }
  };

  const renderNormalizationContacts = () => {
    if (!currentGroup) {
      return (
        <Typography variant="body2" color="textSecondary">
          Nenhum grupo selecionado.
        </Typography>
      );
    }

    const canonicalSuggestion = normalizationState[currentGroupKey]
      || currentGroup.suggestedCanonical
      || currentGroup.contacts?.[0]?.normalization?.suggestedCanonical
      || "";

    const summary = currentGroup.classificationSummary || {};

    const totalSummary = Object.entries(summary)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, count }));

    const canonicalPreview = canonicalSuggestion ? formatDisplayNumber(canonicalSuggestion) : "";

    return (
      <Box display="flex" flexDirection="column" gridGap={12}>
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Número sugerido
          </Typography>
          <TextField
            fullWidth
            value={canonicalSuggestion}
            onChange={(event) => handleNormalizationChange(currentGroupKey, event.target.value)}
            label="Número canônico"
            placeholder="Digite o número no formato canônico"
            helperText={canonicalPreview ? `Pré-visualização: ${canonicalPreview}` : "Informe somente números"}
          />
          {currentGroup.issues && currentGroup.issues.length > 0 && (
            <Box mt={1} display="flex" flexWrap="wrap" gridGap={6}>
              {currentGroup.issues.map((issue, index) => (
                <Chip
                  key={`${issue.type}-${index}`}
                  label={issue.details ? `${issue.type} (${issue.details})` : issue.type}
                  color="secondary"
                  size="small"
                />
              ))}
            </Box>
          )}
          {totalSummary.length > 0 && (
            <Box mt={1.5} display="flex" flexWrap="wrap" gridGap={6}>
              {totalSummary.map(item => {
                const info = classificationLabels[item.key] || classificationLabels.unknown;
                return (
                  <Chip
                    key={item.key}
                    label={`${info.label}: ${item.count}`}
                    color={info.color}
                    size="small"
                    variant={item.key === "invalid" ? "default" : "outlined"}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        <Divider />

        <Typography variant="subtitle2" gutterBottom>
          Contatos selecionados ({currentGroup.contacts.length})
        </Typography>
        <List dense>
          {currentGroup.contacts.map(contact => (
            <React.Fragment key={contact.id}>
              <ListItem>
                <ListItemText
                  primary={contact.name || "(sem nome)"}
                  secondary={
                    <Box component="span" display="flex" flexDirection="column" gridGap={4}>
                      <Typography variant="body2">Número original: {contact.number}</Typography>
                      {contact.canonicalNumber ? (
                        <Typography variant="body2">Canonical atual: {contact.canonicalNumber}</Typography>
                      ) : (
                        <Typography variant="body2" color="error">Canonical ausente</Typography>
                      )}
                      <Box display="flex" alignItems="center" gridGap={6}>
                        <Chip
                          label={(classificationLabels[contact.normalization?.classification || "unknown"] || classificationLabels.unknown).label}
                          size="small"
                          color={(classificationLabels[contact.normalization?.classification || "unknown"] || classificationLabels.unknown).color}
                          variant="outlined"
                        />
                        {contact.normalization?.suggestedCanonical && (
                          <Typography variant="caption" color="textSecondary">
                            Sugerido: {contact.normalization.suggestedCanonical}
                          </Typography>
                        )}
                        {contact.normalization?.displayLabel && (
                          <Typography variant="caption" color="textSecondary">
                            Prévia: {contact.normalization.displayLabel}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
      </Box>
    );
  };

  const renderGroupList = () => {
    if (groups.length === 0) {
      return null;
    }

    return (
      <List dense>
        {groups.map((group, index) => (
          <React.Fragment key={group.canonicalNumber || group.groupKey || index}>
            <ListItem
              button
              selected={selectedGroupIndex === index}
              onClick={() => handleSelectGroup(index)}
            >
              <ListItemText
                primary={
                  activeTab === "normalization"
                    ? (group.displayLabel || formatDisplayNumber(group.suggestedCanonical) || group.groupKey)
                    : (duplicatesGroupBy === "name"
                      ? `Nome: ${group.canonicalNumber}`
                      : `Número: ${group.canonicalNumber}`)
                }
                secondary={
                  activeTab === "duplicates"
                    ? `Contatos duplicados: ${group.total}`
                    : `Contatos pendentes: ${group.contacts?.length || group.total}`
                }
              />
            </ListItem>
            <Divider component="li" />
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg">
      <DialogTitle>Gestão de contatos</DialogTitle>
      <DialogContent dividers style={{ minHeight: 420 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Localize contatos duplicados ou com números fora do padrão para corrigir rapidamente.
            </Typography>
            <Tabs
              value={activeTab}
              onChange={(_, tab) => setActiveTab(tab)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab value="normalization" label="Normalizar" />
              <Tab value="duplicates" label="Duplicados" />
              <Tab value="validation" label="Validar WhatsApp" />
            </Tabs>
            {renderDuplicateFilters()}
            {activeTab === "normalization" && initialFetchDone && (
              <Typography variant="caption" color="textSecondary">
                Encontrados {totalContacts} contatos pendentes de normalização.
              </Typography>
            )}
          </Box>
          <Box display="flex" alignItems="center" gridGap={8}>
            <Tooltip title={activeTab === "duplicates" ? "Localizar duplicados" : "Localizar contatos para normalizar"}>
              <span>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => fetchGroups(1, activeTab)}
                  startIcon={activeTab === "duplicates" ? <Search size={16} /> : <Wand2 size={16} />}
                  disabled={loading}
                >
                  {activeTab === "duplicates" ? "Localizar duplicados" : "Localizar pendentes"}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Atualizar lista">
              <span>
                <IconButton onClick={() => fetchGroups(page, activeTab)} disabled={loading || !initialFetchDone}>
                  <RefreshCw size={18} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {activeTab !== "validation" && loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress size={32} />
          </Box>
        )}

        {activeTab !== "validation" && !loading && initialFetchDone && groups.length === 0 && (
          <Box display="flex" flexDirection="column" alignItems="center" py={6}>
            <Typography variant="body2" color="textSecondary">
              Nenhum resultado encontrado para esta categoria.
            </Typography>
          </Box>
        )}

        {activeTab !== "validation" && !loading && groups.length > 0 && (
          <Box display="flex" gridGap={16}>
            <Box flex={1.1} maxHeight={360} overflow="auto" borderRight="1px solid rgba(0,0,0,0.08)">
              {renderGroupList()}
              {activeTab === "duplicates" && totalPages > 1 && (
                <Box display="flex" justifyContent="space-between" alignItems="center" p={1}>
                  <Button
                    size="small"
                    onClick={() => fetchGroups(Math.max(page - 1, 1), activeTab)}
                    disabled={page <= 1 || loading}
                  >
                    Anterior
                  </Button>
                  <Typography variant="caption">Página {page} de {totalPages}</Typography>
                  <Button
                    size="small"
                    onClick={() => fetchGroups(Math.min(page + 1, totalPages), activeTab)}
                    disabled={page >= totalPages || loading}
                  >
                    Próxima
                  </Button>
                </Box>
              )}
            </Box>

            <Box flex={2.4} maxHeight={360} overflow="auto">
              {activeTab === "duplicates" ? renderDuplicateContacts() : renderNormalizationContacts()}
            </Box>

            {activeTab === "normalization" && (
              <Box flex={1.5} display="flex" flexDirection="column" gridGap={12}>
                <Typography variant="subtitle2">Aplicar ações</Typography>
                <FormControl component="fieldset">
                  <Box display="flex" alignItems="center" gridGap={8}>
                    <Switch
                      checked={applyNormalization}
                      onChange={(event) => setApplyNormalization(event.target.checked)}
                      color="primary"
                    />
                    <Typography>Aplicar normalização de número</Typography>
                  </Box>
                </FormControl>

                <Divider />

                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel id="tag-selector-label">Tag existente</InputLabel>
                  <Select
                    labelId="tag-selector-label"
                    value={selectedTagId}
                    onChange={(event) => setSelectedTagId(event.target.value)}
                    label="Tag existente"
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>Nenhuma</em>
                    </MenuItem>
                    {tags.map(tag => (
                      <MenuItem key={tag.id} value={tag.id}>
                        <Box display="flex" alignItems="center" gridGap={8}>
                          <TagIcon size={16} color={tag.color || "#FFB020"} />
                          <span>{tag.name}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Criar nova tag"
                  value={customTagName}
                  onChange={(event) => setCustomTagName(event.target.value)}
                  size="small"
                  placeholder="Nome da nova tag"
                  InputProps={{
                    startAdornment: (
                      <Box component="span" display="flex" alignItems="center" mr={1}>
                        <TagIcon size={16} color={customTagColor} />
                      </Box>
                    )
                  }}
                />
                <TextField
                  label="Cor da tag"
                  value={customTagColor}
                  onChange={(event) => setCustomTagColor(event.target.value)}
                  size="small"
                  type="color"
                  InputLabelProps={{ shrink: true }}
                />

                <Box display="flex" flexDirection="column" gridGap={8} mt={1}>
                  <Typography variant="subtitle2">Grupo atual</Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => executeNormalizationAction({
                      action: applyNormalization ? "normalize_and_tag" : "tag",
                      includeNormalization: applyNormalization,
                      tagId: selectedTagId ? Number(selectedTagId) : undefined,
                      tagName: selectedTagId ? undefined : customTagName || undefined,
                      tagColor: customTagName ? customTagColor : undefined
                    })}
                    disabled={loading}
                  >
                    Aplicar {applyNormalization ? "normalização e tag" : "tag"}
                  </Button>
                  {applyNormalization && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => executeNormalizationAction({
                        action: "normalize",
                        includeNormalization: true,
                        tagId: undefined,
                        tagName: undefined
                      })}
                      disabled={loading}
                    >
                      Apenas normalizar grupo
                    </Button>
                  )}
                </Box>

                <Divider />

                <Box display="flex" flexDirection="column" gridGap={8}>
                  <Typography variant="subtitle2">Ações em lote</Typography>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => executeNormalizationAll({
                      action: applyNormalization ? "normalize_and_tag" : "tag",
                      includeNormalization: applyNormalization,
                      tagId: selectedTagId ? Number(selectedTagId) : undefined,
                      tagName: selectedTagId ? undefined : customTagName || undefined,
                      tagColor: customTagName ? customTagColor : undefined
                    })}
                    disabled={loading}
                  >
                    Aplicar em todos os grupos
                  </Button>
                  {applyNormalization && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => executeNormalizationAll({
                        action: "normalize",
                        includeNormalization: true,
                        tagId: undefined,
                        tagName: undefined
                      })}
                      disabled={loading}
                    >
                      Normalizar todos
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ─── Aba Validação WhatsApp ─── */}
        {activeTab === "validation" && (
          <Box display="flex" gridGap={16}>
            {/* Coluna esquerda: configurações e ações */}
            <Box flex={1.2} display="flex" flexDirection="column" gridGap={12}>
              <Typography variant="subtitle2">Conexão WhatsApp</Typography>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="whatsapp-selector-label">Conexão</InputLabel>
                <Select
                  labelId="whatsapp-selector-label"
                  value={selectedWhatsappId}
                  onChange={(e) => setSelectedWhatsappId(e.target.value)}
                  label="Conexão"
                >
                  {whatsapps.map(w => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name} ({w.status})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider />

              <Typography variant="subtitle2">Modo de validação</Typography>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="validation-mode-label">Modo</InputLabel>
                <Select
                  labelId="validation-mode-label"
                  value={validationMode}
                  onChange={(e) => setValidationMode(e.target.value)}
                  label="Modo"
                >
                  <MenuItem value="nine_digit">Apenas com dígito 9 (13 dígitos)</MenuItem>
                  <MenuItem value="all">Todos os contatos BR</MenuItem>
                </Select>
              </FormControl>

              <Divider />

              <Button
                variant="outlined"
                color="primary"
                onClick={fetchValidationContacts}
                disabled={loading || validating || !selectedWhatsappId}
                startIcon={<Search size={16} />}
              >
                Buscar contatos ({validationMode === "nine_digit" ? "com 9" : "todos BR"})
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={executeValidation}
                disabled={loading || validating || validationContacts.length === 0}
                startIcon={validating ? <CircularProgress size={16} /> : <Wand2 size={16} />}
              >
                {validating ? "Validando..." : `Validar ${validationContacts.length} contatos`}
              </Button>

              {validating && (
                <Box>
                  <LinearProgress variant="determinate" value={validationProgress} />
                  <Typography variant="caption" color="textSecondary">
                    Progresso: {validationProgress}%
                  </Typography>
                </Box>
              )}

              {validationSummary && (
                <Box mt={1} p={1.5} borderRadius={4} bgcolor="#f5f5f5">
                  <Typography variant="subtitle2" gutterBottom>Resumo</Typography>
                  <Typography variant="body2">
                    ✅ Válidos: {validationSummary.validated}
                  </Typography>
                  <Typography variant="body2" style={{ color: "#2e7d32" }}>
                    🔄 Corrigidos: {validationSummary.corrected}
                  </Typography>
                  <Typography variant="body2" color="error">
                    ❌ Inválidos: {validationSummary.invalid}
                  </Typography>
                  {validationSummary.errors > 0 && (
                    <Typography variant="body2" color="textSecondary">
                      ⚠️ Erros: {validationSummary.errors}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Coluna direita: lista de contatos com resultados */}
            <Box flex={2.8} maxHeight={360} overflow="auto">
              {validationContacts.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" py={6}>
                  <Typography variant="body2" color="textSecondary">
                    Clique em "Buscar contatos" para listar os contatos BR pendentes de validação.
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {validationContacts.map(contact => {
                    const result = validationResults[contact.id];
                    const statusIcon = !result ? "⏳" :
                      result.status === "valid" ? "✅" :
                        result.status === "corrected" ? "🔄" :
                          result.status === "invalid" ? "❌" : "⚠️";
                    const statusLabel = !result ? "Pendente" :
                      result.status === "valid" ? "Válido" :
                        result.status === "corrected" ? `Corrigido → ${result.newNumber}` :
                          result.status === "invalid" ? "Inválido no WhatsApp" : `Erro: ${result.errorMessage}`;
                    const statusColor = !result ? "textSecondary" :
                      result.status === "valid" ? "primary" :
                        result.status === "corrected" ? "primary" :
                          result.status === "invalid" ? "error" : "textSecondary";

                    return (
                      <React.Fragment key={contact.id}>
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gridGap={8}>
                                <span>{statusIcon}</span>
                                <Typography variant="subtitle2">{contact.name || "(sem nome)"}</Typography>
                              </Box>
                            }
                            secondary={
                              <Box component="span" display="flex" flexDirection="column" gridGap={2}>
                                <Typography variant="body2">Número: {contact.number}</Typography>
                                <Typography variant="body2" color={statusColor}>
                                  {statusLabel}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || validating}>Fechar</Button>
        {activeTab === "duplicates" && (
          <Box display="flex" alignItems="center" gridGap={8} mr={2}>
            <Tooltip title="Mesclar apenas selecionados">
              <span>
                <Button
                  color="primary"
                  variant="contained"
                  onClick={() => executeDuplicateAction({ mode: "selected", operation: "merge" })}
                  disabled={loading || !currentGroup}
                  startIcon={<GitMerge size={16} />}
                >
                  Mesclar selecionados
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Mesclar todos os duplicados do grupo atual">
              <span>
                <Button
                  color="primary"
                  variant="outlined"
                  onClick={() => executeDuplicateAction({ mode: "all", operation: "merge" })}
                  disabled={loading || !currentGroup}
                >
                  Mesclar todos
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Apagar duplicados selecionados">
              <span>
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => executeDuplicateAction({ mode: "selected", operation: "delete" })}
                  disabled={loading || !currentGroup}
                  startIcon={<Trash2 size={16} />}
                >
                  Apagar selecionados
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Apagar todos os duplicados (manter apenas o principal)">
              <span>
                <Button
                  color="secondary"
                  variant="outlined"
                  onClick={() => executeDuplicateAction({ mode: "all", operation: "delete" })}
                  disabled={loading || !currentGroup}
                >
                  Apagar todos
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DuplicateContactsModal;
