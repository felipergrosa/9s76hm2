import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Typography,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Popover,
  Slider,
  Box,
  IconButton,
  InputBase
} from "@material-ui/core";

import Autocomplete from "@material-ui/lab/Autocomplete";
import AllInclusiveIcon from '@material-ui/icons/AllInclusive';

import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import useAuth from "../../hooks/useAuth.js";
import { DateRangePicker } from 'materialui-daterange-picker';
import { format, parseISO, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: "100%",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
  },
  activeFilter: {
    "& .MuiOutlinedInput-root": {
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: green[500],
        borderWidth: '2px',
      },
    },
  },
  activeFilterBox: {
    border: `2px solid ${green[500]}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
    height: '100%',
  }
}));

const AddFilteredContactsModal = ({ open, onClose, contactListId, reload, savedFilter }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [cities, setCities] = useState([]);
  const [segments, setSegments] = useState([]);
  const [situations, setSituations] = useState([]);
  const [representativeCodes, setRepresentativeCodes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadingSituations, setLoadingSituations] = useState(false);
  const [loadingRepresentatives, setLoadingRepresentatives] = useState(false);
  const [saveFilterFlag, setSaveFilterFlag] = useState(false);
  const [cronTime, setCronTime] = useState("02:00"); // HH:mm
  const [cronTz, setCronTz] = useState("America/Sao_Paulo");
  const { user, getCurrentUserInfo } = useAuth();
  const timezones = [
    "America/Sao_Paulo",
    "America/Bahia",
    "America/Belem",
    "America/Recife",
    "America/Fortaleza",
    "America/Manaus",
    "America/Cuiaba",
    "America/Argentina/Buenos_Aires",
    "America/New_York",
    "UTC",
    "Europe/London"
  ];
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState(null);
  const monthsPT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  // Helpers de formato/parsing BRL e edição inline
  const formatBRL0 = (n) => `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const parseCurrency = (s, max) => {
    if (s == null) return 0;
    const num = parseFloat(String(s).replace(/R\$?\s*/gi, '').replace(/\./g, '').replace(/,/g, '.'));
    if (isNaN(num)) return 0;
    if (typeof max === 'number') return Math.max(0, Math.min(num, max));
    return Math.max(0, num);
  };

  const [editMinCredit, setEditMinCredit] = useState(false);
  const [editMaxCredit, setEditMaxCredit] = useState(false);
  const [editMinVl, setEditMinVl] = useState(false);
  const [editMaxVl, setEditMaxVl] = useState(false);

  // Cache simples em sessionStorage para evitar recarregar os mesmos dados
  const getCache = (key) => {
    try {
      const raw = sessionStorage.getItem(`afc_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };
  const setCache = (key, value) => {
    try {
      sessionStorage.setItem(`afc_${key}`, JSON.stringify(value));
    } catch (_) {}
  };

  // Situações padrão que devem sempre aparecer no filtro,
  // mesmo que ainda não existam contatos com esses valores no banco
  const defaultSituations = [
    "Ativo",
    "Baixado",
    "Ex-Cliente",
    "Excluido",
    "Futuro",
    "Inativo"
  ];

  useEffect(() => {
    if (open) {
      // Inicializa rapidamente as situações e itens leves; os pesados serão lazy (onOpen)
      const cachedSituations = getCache("situations");
      if (Array.isArray(cachedSituations) && cachedSituations.length) {
        setSituations(cachedSituations);
      } else {
        const base = [...defaultSituations].sort((a, b) => a.localeCompare(b, "pt-BR"));
        setSituations(base);
        setCache("situations", base);
      }
      loadTags();
      loadCronConfig();
    }
  }, [open]);

  // Quando abrir com savedFilter, pré-preencher selecionando as tags correspondentes
  useEffect(() => {
    if (open && savedFilter && Array.isArray(savedFilter.tags) && tags.length > 0) {
      const preSelected = tags.filter(t => savedFilter.tags.includes(t.id));
      setSelectedTags(preSelected);
    }
    if (open && savedFilter) {
      setSaveFilterFlag(true);
    } else {
      setSaveFilterFlag(false);
    }
  }, [open, savedFilter, tags]);

  // Garante que segmentos do savedFilter apareçam no Autocomplete mesmo que não existam na API
  useEffect(() => {
    if (open && savedFilter && Array.isArray(savedFilter.segment) && savedFilter.segment.length) {
      setSegments(prev => {
        const set = new Set(prev);
        savedFilter.segment.forEach(s => {
          const v = (s == null ? "" : String(s).trim());
          if (v) set.add(v);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
      });
    }
  }, [open, savedFilter]);

  // Garante que outros campos do savedFilter apareçam mesmo antes do carregamento lazy
  useEffect(() => {
    if (!open || !savedFilter) return;
    if (Array.isArray(savedFilter.channel) && savedFilter.channel.length) {
      setChannels(prev => Array.from(new Set([...(prev||[]), ...savedFilter.channel.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(savedFilter.city) && savedFilter.city.length) {
      setCities(prev => Array.from(new Set([...(prev||[]), ...savedFilter.city.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(savedFilter.representativeCode) && savedFilter.representativeCode.length) {
      setRepresentativeCodes(prev => Array.from(new Set([...(prev||[]), ...savedFilter.representativeCode.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(savedFilter.situation) && savedFilter.situation.length) {
      setSituations(prev => Array.from(new Set([...(prev||[]), ...savedFilter.situation.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
  }, [open, savedFilter]);

  const loadChannels = async () => {
    const cached = getCache("channels");
    if (Array.isArray(cached) && cached.length) { setChannels(cached); return; }
    setLoadingChannels(true);
    try {
      // Prévia rápida com primeira página
      let page = 1;
      let hasMore = true;
      const map = new Map();

      const firstResp = await api.get("/contacts", {
        params: { pageNumber: page, limit: 500, orderBy: "channel", order: "ASC" },
      });
      const firstList = Array.isArray(firstResp?.data?.contacts) ? firstResp.data.contacts : [];
      for (const c of firstList) {
        const raw = c?.channel; if (!raw) continue;
        const value = String(raw).trim(); if (!value) continue;
        const key = value.toLowerCase(); if (!map.has(key)) map.set(key, value);
      }
      hasMore = Boolean(firstResp?.data?.hasMore);
      page += 1;

      // monta preview + garante valores do savedFilter
      const basePreview = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR")).slice(0,5);
      const setPreview = new Set(basePreview);
      if (savedFilter && Array.isArray(savedFilter.channel)) {
        savedFilter.channel.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
      }
      setChannels(Array.from(setPreview).sort((a,b)=>a.localeCompare(b,"pt-BR")));

      // Continuação em background
      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: { pageNumber: page, limit: 500, orderBy: "channel", order: "ASC" },
        });
        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const c of list) {
          const raw = c?.channel; if (!raw) continue;
          const value = String(raw).trim(); if (!value) continue;
          const key = value.toLowerCase(); if (!map.has(key)) map.set(key, value);
        }
        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR"));
      setChannels(all);
      setCache("channels", all);
    } catch (err) {
      toastError(err);
    }
    setLoadingChannels(false);
  };

  const loadSegments = async () => {
    const cached = getCache("segments");
    if (Array.isArray(cached) && cached.length) { setSegments(cached); return; }
    setLoadingSegments(true);
    try {
      let companyId = user?.companyId;
      if (!companyId) {
        const info = await getCurrentUserInfo?.();
        companyId = info?.user?.companyId || info?.companyId;
      }
      if (!companyId) return;

      const { data } = await api.get("/contacts/segments");
      const list = Array.isArray(data) ? data : (Array.isArray(data?.segments) ? data.segments : []);
      const normalized = list
        .map(s => (s == null ? "" : String(s).trim()))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      setSegments(normalized);
      setCache("segments", normalized);
    } catch (err) {
      toastError(err);
    }
    setLoadingSegments(false);
  };

  const loadCities = async () => {
    const cached = getCache("cities");
    if (Array.isArray(cached) && cached.length) { setCities(cached); return; }
    setLoadingCities(true);
    try {
      // Prévia rápida com primeira página
      let page = 1;
      let hasMore = true;
      const map = new Map(); // key lower -> exibido

      const firstResp = await api.get("/contacts", {
        params: { pageNumber: page, limit: 500, orderBy: "city", order: "ASC" },
      });
      const firstList = Array.isArray(firstResp?.data?.contacts) ? firstResp.data.contacts : [];
      for (const c of firstList) {
        const raw = c?.city; if (!raw) continue;
        const value = String(raw).trim(); if (!value) continue;
        const key = value.toLowerCase(); if (!map.has(key)) map.set(key, value);
      }
      hasMore = Boolean(firstResp?.data?.hasMore);
      page += 1;

      const basePreview = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR")).slice(0,5);
      const setPreview = new Set(basePreview);
      if (savedFilter && Array.isArray(savedFilter.city)) {
        savedFilter.city.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
      }
      setCities(Array.from(setPreview).sort((a,b)=>a.localeCompare(b,"pt-BR")));

      // Continuação em background
      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: { pageNumber: page, limit: 500, orderBy: "city", order: "ASC" },
        });
        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const c of list) {
          const raw = c?.city; if (!raw) continue;
          const value = String(raw).trim(); if (!value) continue;
          const key = value.toLowerCase(); if (!map.has(key)) map.set(key, value);
        }
        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR"));
      setCities(all);
      setCache("cities", all);
    } catch (err) {
      toastError(err);
    }
    setLoadingCities(false);
  };

  const loadSituations = async () => {
    const cached = getCache("situations");
    if (Array.isArray(cached) && cached.length) { setSituations(cached); return; }
    setLoadingSituations(true);
    try {
      const base = [...defaultSituations].sort((a, b) => a.localeCompare(b, "pt-BR"));
      setSituations(base);
      setCache("situations", base);
    } catch (err) {
      setSituations([...defaultSituations].sort((a, b) => a.localeCompare(b, "pt-BR")));
      toastError(err);
    }
    setLoadingSituations(false);
  };

  const loadRepresentativeCodes = async () => {
    const cached = getCache("representativeCodes");
    if (Array.isArray(cached) && cached.length) { setRepresentativeCodes(cached); return; }
    setLoadingRepresentatives(true);
    try {
      // Paginação com pré-visualização rápida (primeira página)
      let page = 1;
      let hasMore = true;
      const map = new Map(); // chave normalizada -> valor exibido

      // Busca primeira página rapidamente e mostra os 5 primeiros
      const firstResp = await api.get("/contacts", {
        params: {
          pageNumber: page,
          limit: 500,
          orderBy: "representativeCode",
          order: "ASC",
        },
      });
      const firstList = Array.isArray(firstResp?.data?.contacts) ? firstResp.data.contacts : [];
      for (const contact of firstList) {
        const raw = contact?.representativeCode;
        if (!raw) continue;
        const value = String(raw).trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (!map.has(key)) map.set(key, value);
      }
      hasMore = Boolean(firstResp?.data?.hasMore);
      page += 1;

      const basePreview = Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, 5);
      const setPreview = new Set(basePreview);
      if (savedFilter && Array.isArray(savedFilter.representativeCode)) {
        savedFilter.representativeCode.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
      }
      const preview = Array.from(setPreview).sort((a,b)=>a.localeCompare(b,"pt-BR"));
      if (preview.length) setRepresentativeCodes(preview);

      // Continua carregando o restante em background
      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: {
            pageNumber: page,
            limit: 500,
            orderBy: "representativeCode",
            order: "ASC",
          },
        });

        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const contact of list) {
          const raw = contact?.representativeCode;
          if (!raw) continue;
          const value = String(raw).trim();
          if (!value) continue;
          const key = value.toLowerCase();
          if (!map.has(key)) map.set(key, value);
        }

        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setRepresentativeCodes(all);
      setCache("representativeCodes", all);
    } catch (err) {
      toastError(err);
    }
    setLoadingRepresentatives(false);
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get("/tags");
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.tags) ? data.tags : []);
      const sorted = [...list].sort((a, b) => {
        const an = (a?.name || "").toString();
        const bn = (b?.name || "").toString();
        return an.localeCompare(bn, "pt-BR");
      });
      setTags(sorted);
    } catch (err) {
      toastError(err);
    }
  };

  const loadCronConfig = async () => {
    try {
      const { data } = await api.get("/settings/saved-filter-cron");
      if (data) {
        if (data.tz) setCronTz(data.tz);
        if (typeof data.expr === "string") {
          const parts = data.expr.trim().split(/\s+/);
          if (parts.length >= 2) {
            const min = parseInt(parts[0], 10);
            const hour = parseInt(parts[1], 10);
            if (!isNaN(min) && !isNaN(hour)) {
              const hh = String(hour).padStart(2, '0');
              const mm = String(min).padStart(2, '0');
              setCronTime(`${hh}:${mm}`);
            }
          }
        }
      }
    } catch (err) {
      // Silencia erro para não travar o modal
      console.warn("Falha ao carregar configuração do cron:", err);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedTags([]);
  };

  const handleAddFilteredContacts = async (values) => {
    setLoading(true);
    try {
      // Se usuário optar por salvar filtro e atualizar automaticamente, atualiza o cron antes
      if (saveFilterFlag) {
        try {
          const [hhStr, mmStr] = (cronTime || "02:00").split(":");
          const hNum = parseInt(hhStr, 10);
          const mNum = parseInt(mmStr, 10);
          if (!isNaN(hNum) && !isNaN(mNum)) {
            const expr = `${mNum} ${hNum} * * *`;
            await api.put("/settings/saved-filter-cron", { expr, tz: cronTz || "America/Sao_Paulo" });
          }
        } catch (e) {
          console.warn("Erro ao atualizar configuração do cron:", e);
          toast.warning("Não foi possível atualizar o horário de sincronização agora.");
        }
      }

      // Preparar os filtros para enviar ao backend
      const filters = {
        ...values,
        channel: values.channel ? values.channel : null,
        representativeCode: values.representativeCode ? values.representativeCode : null,
        city: values.city ? values.city : null,
        segment: values.segment ? values.segment : null,
        situation: values.situation ? values.situation : null,
        tags: selectedTags.map(tag => tag.id)
      };

      // Normalizar representativeCode: remover vazios e '00000'
      if (Array.isArray(filters.representativeCode)) {
        filters.representativeCode = filters.representativeCode
          .map(v => String(v ?? '').trim())
          .filter(v => v !== '' && v !== '00000');
        if (filters.representativeCode.length === 0) delete filters.representativeCode;
      } else if (typeof filters.representativeCode === 'string') {
        const v = String(filters.representativeCode ?? '').trim();
        if (v === '' || v === '00000') delete filters.representativeCode;
      }

      // Normalizar channel, city, segment, situation removendo placeholders
      const invalidSet = new Set(['', '0', '000', '00000']);
      const sanitizeList = (val) => {
        if (!val) return undefined;
        if (Array.isArray(val)) {
          const list = val.map(v => String(v ?? '').trim()).filter(v => !invalidSet.has(v));
          return list.length ? list : undefined;
        }
        const s = String(val ?? '').trim();
        return (!s || invalidSet.has(s)) ? undefined : s;
      };
      const ch = sanitizeList(filters.channel);
      const ct = sanitizeList(filters.city);
      const sg = sanitizeList(filters.segment);
      const st = sanitizeList(filters.situation);
      if (typeof ch === 'undefined') delete filters.channel; else filters.channel = ch;
      if (typeof ct === 'undefined') delete filters.city; else filters.city = ct;
      if (typeof sg === 'undefined') delete filters.segment; else filters.segment = sg;
      if (typeof st === 'undefined') delete filters.situation; else filters.situation = st;

      // Mapear meses selecionados (strings) para números (1-12)
      if (Array.isArray(values.foundationMonths) && values.foundationMonths.length > 0) {
        filters.foundationMonths = values.foundationMonths
          .map(m => monthsPT.indexOf(m) + 1)
          .filter(n => n > 0);
      }
      // Remover monthYear antigo, se existir
      delete filters.monthYear;

      // Mapear Encomenda (florder) para booleano
      if (typeof values.florder !== 'undefined') {
        if (values.florder === 'Sim') filters.florder = true;
        else if (values.florder === 'Não') filters.florder = false;
        else delete filters.florder; // vazio
      }

      // Ajustar envio de range de última compra
      if (values.dtUltCompraStart) filters.dtUltCompraStart = values.dtUltCompraStart;
      if (values.dtUltCompraEnd) filters.dtUltCompraEnd = values.dtUltCompraEnd;

      // Se marcado "Sem máximo", remove maxCreditLimit
      if (values.creditLimitNoMax) {
        delete filters.maxCreditLimit;
      }

      // Tratar min/max para garantir formatos corretos
      if (filters.minCreditLimit) {
        filters.minCreditLimit = String(filters.minCreditLimit).replace(/R\$?\s?/gi, '').replace(/\./g, '').replace(/,/g, '.');
      }
      if (filters.maxCreditLimit) {
        filters.maxCreditLimit = String(filters.maxCreditLimit).replace(/R\$?\s?/gi, '').replace(/\./g, '').replace(/,/g, '.');
      }

      // Incluir range de valor da última compra
      // Somente incluir se realmente definido (evita Number(null) -> 0)
      if (values.minVlUltCompra !== null && values.minVlUltCompra !== "") {
        filters.minVlUltCompra = Number(values.minVlUltCompra);
      }
      if (values.maxVlUltCompra !== null && values.maxVlUltCompra !== "") {
        filters.maxVlUltCompra = Number(values.maxVlUltCompra);
      }

      // Remover filtros vazios
      Object.keys(filters).forEach(key => {
        if (filters[key] === "" || filters[key] === null || filters[key] === undefined ||
          (Array.isArray(filters[key]) && filters[key].length === 0)) {
          delete filters[key];
        }
      });

      try {
        const { data } = await api.post(
          `/contact-list-items/${contactListId}/add-filtered-contacts`,
          { filters, saveFilter: saveFilterFlag }
        );

        toast.success(
          i18n.t("contactListItems.toasts.addedSuccess", {
            count: data.added,
          })
        );

        if (data.duplicated > 0) {
          toast.warning(
            i18n.t("contactListItems.toasts.duplicated", {
              count: data.duplicated,
            })
          );
        }

        if (data.errors > 0) {
          toast.error(
            i18n.t("contactListItems.toasts.addedError", {
              count: data.errors,
            })
          );
        }

        handleClose();
        reload();
      } catch (err) {
        console.error("Erro ao adicionar contatos filtrados:", err);
        
        // Mensagens de erro mais específicas
        if (err.response && err.response.data && err.response.data.error) {
          const errorMsg = err.response.data.error;
          
          if (errorMsg.includes("limite de crédito")) {
            toast.error(i18n.t("contactListItems.toasts.creditLimitError"));
          } else if (errorMsg.includes("mês/ano")) {
            toast.error(i18n.t("contactListItems.toasts.monthYearError"));
          } else if (errorMsg.includes("tags")) {
            toast.error(i18n.t("contactListItems.toasts.tagsError"));
          } else {
            toastError(err);
          }
        } else {
          toastError(err);
        }
      }
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle>
        {i18n.t("contactListItems.dialog.filter")}
      </DialogTitle>
      <Formik
        initialValues={{
          channel: (savedFilter && savedFilter.channel) ? savedFilter.channel : [],
          representativeCode: (savedFilter && savedFilter.representativeCode) ? savedFilter.representativeCode : [],
          city: (savedFilter && savedFilter.city) ? savedFilter.city : [],
          segment: (savedFilter && savedFilter.segment) ? savedFilter.segment : [],
          situation: (savedFilter && savedFilter.situation) ? savedFilter.situation : [],
          foundationMonths: (savedFilter && Array.isArray(savedFilter.foundationMonths))
            ? savedFilter.foundationMonths.map(n => monthsPT[n - 1]).filter(Boolean)
            : [],
          minCreditLimit: (savedFilter && savedFilter.minCreditLimit) ? savedFilter.minCreditLimit : null,
          maxCreditLimit: (savedFilter && savedFilter.maxCreditLimit) ? savedFilter.maxCreditLimit : null,
          minVlUltCompra: (savedFilter && savedFilter.minVlUltCompra) ? Number(savedFilter.minVlUltCompra) : null,
          maxVlUltCompra: (savedFilter && savedFilter.maxVlUltCompra) ? Number(savedFilter.maxVlUltCompra) : null,
          vlUltCompraNoMax: false,
          creditLimitNoMax: false,
          // Novos filtros
          florder: (savedFilter && (typeof savedFilter.florder !== 'undefined'))
            ? (savedFilter.florder === true ? 'Sim' : savedFilter.florder === false ? 'Não' : '')
            : '',
          dtUltCompraStart: (savedFilter && savedFilter.dtUltCompraStart) ? savedFilter.dtUltCompraStart : null,
          dtUltCompraEnd: (savedFilter && savedFilter.dtUltCompraEnd) ? savedFilter.dtUltCompraEnd : null,
        }}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          handleAddFilteredContacts(values);
          actions.setSubmitting(false);
        }}
      >
        {({ values, errors, touched, isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>

                <Grid item xs={12} md={6}>
                  <Field name="channel">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={channels}
                        onOpen={() => { loadChannels(); }}
                        loading={loadingChannels}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.channel")}
                            placeholder={i18n.t("contactListItems.filterDialog.channel")}
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingChannels ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              )
                            }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="representativeCode">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={representativeCodes}
                        onOpen={() => { loadRepresentativeCodes(); }}
                        loading={loadingRepresentatives}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.representativeCode")}
                            placeholder={i18n.t("contactListItems.filterDialog.representativeCode")}
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingRepresentatives ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              )
                            }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="city">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={cities}
                        onOpen={() => { loadCities(); }}
                        loading={loadingCities}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.city")}
                            placeholder={i18n.t("contactListItems.filterDialog.city")}
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingCities ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              )
                            }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="segment">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={segments}
                        onOpen={() => { loadSegments(); }}
                        loading={loadingSegments}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label="Segmento de Mercado"
                            placeholder="Segmento de Mercado"
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingSegments ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              )
                            }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="situation">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={situations}
                        onOpen={() => { if (!situations.length) loadSituations(); }}
                        loading={loadingSituations}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.situation")}
                            placeholder={i18n.t("contactListItems.filterDialog.situation")}
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingSituations ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              )
                            }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="foundationMonths">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={monthsPT}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.monthYear")}
                            placeholder={i18n.t("contactListItems.filterDialog.monthYear")}
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                {/* Linha 1: Limite de Crédito (faixa) + Valor da Última Compra (faixa) */}
                <Grid item xs={12} md={6}>
                  <Box className={((values.minCreditLimit && Number(values.minCreditLimit) > 0) || (values.maxCreditLimit && Number(values.maxCreditLimit) < 100000) || values.creditLimitNoMax) ? classes.activeFilterBox : ""}>
                    <Typography variant="subtitle2">Limite de Crédito (faixa)</Typography>
                    <Box px={1} display="flex" flexDirection="column">
                      <Field name="minCreditLimit">
                      {({ form }) => (
                        <Slider
                          value={[Number(values.minCreditLimit || 0), values.creditLimitNoMax ? 100000 : Number(values.maxCreditLimit || 100000)]}
                          onChange={(_, newValue) => {
                            const [min, max] = newValue;
                            form.setFieldValue('minCreditLimit', min);
                            form.setFieldValue('maxCreditLimit', max);
                          }}
                          valueLabelDisplay="auto"
                          min={0}
                          max={100000}
                          step={100}
                          // Removemos labels dos marks para evitar sobreposição; usamos legenda personalizada abaixo
                          marks={false}
                          getAriaValueText={(v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                          valueLabelFormat={(v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                        />
                      )}
                    </Field>
                    <Field name="minCreditLimit">
                      {({ form }) => (
                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={-1}>
                          <Typography variant="caption" color="textSecondary">
                            {editMinCredit ? (
                              <InputBase
                                autoFocus
                                defaultValue={values.minCreditLimit !== null ? Number(values.minCreditLimit) : ""}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  const maxAllowed = form.values.creditLimitNoMax ? 100000 : Number(form.values.maxCreditLimit || 100000);
                                  let v = val === "" ? null : parseCurrency(val, maxAllowed);
                                  if (v !== null && v > maxAllowed) v = maxAllowed;
                                  form.setFieldValue('minCreditLimit', v);
                                  setEditMinCredit(false);
                                }}
                                onKeyDown={(e)=>{ if(e.key==='Enter'){ e.currentTarget.blur(); } if(e.key==='Escape'){ setEditMinCredit(false);} }}
                                style={{ width: 90 }}
                              />
                            ) : (
                              <span style={{ cursor: 'pointer' }} onClick={() => setEditMinCredit(true)}>
                                {values.minCreditLimit !== null ? formatBRL0(values.minCreditLimit) : "Não definido"}
                              </span>
                            )}
                            {' — '}
                            {values.creditLimitNoMax ? (
                              '∞'
                            ) : editMaxCredit ? (
                              <InputBase
                                autoFocus
                                defaultValue={values.maxCreditLimit !== null ? Number(values.maxCreditLimit) : ""}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  let v = val === "" ? null : parseCurrency(val, 100000);
                                  if (v !== null && v < Number(form.values.minCreditLimit || 0)) v = Number(form.values.minCreditLimit || 0);
                                  form.setFieldValue('maxCreditLimit', v);
                                  setEditMaxCredit(false);
                                }}
                                onKeyDown={(e)=>{ if(e.key==='Enter'){ e.currentTarget.blur(); } if(e.key==='Escape'){ setEditMaxCredit(false);} }}
                                style={{ width: 90 }}
                              />
                            ) : (
                              <span style={{ cursor: 'pointer' }} onClick={() => setEditMaxCredit(true)}>
                                {values.maxCreditLimit !== null ? formatBRL0(values.maxCreditLimit) : "Não definido"}
                              </span>
                            )}
                          </Typography>
                          <Field name="creditLimitNoMax">
                            {({ form: f2 }) => {
                              const active = !!f2.values.creditLimitNoMax;
                              return (
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    const nv = !active;
                                    f2.setFieldValue('creditLimitNoMax', nv);
                                    if (nv) {
                                      f2.setFieldValue('maxCreditLimit', 100000);
                                    }
                                  }}
                                  aria-label={active ? 'Máximo infinito ativo' : 'Ativar máximo infinito'}
                                >
                                  <AllInclusiveIcon style={{ color: active ? '#16a34a' : '#c4c4c4' }} />
                                </IconButton>
                              );
                            }}
                          </Field>
                        </Box>
                      )}
                    </Field>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box className={((values.minVlUltCompra && Number(values.minVlUltCompra) > 0) || (values.maxVlUltCompra && Number(values.maxVlUltCompra) < 30000) || values.vlUltCompraNoMax) ? classes.activeFilterBox : ""}>
                    <Typography variant="subtitle2">Valor da Última Compra (faixa)</Typography>
                    <Box px={1} display="flex" flexDirection="column">
                      <Field name="minVlUltCompra">
                      {({ form }) => (
                        <Slider
                          value={[Number(values.minVlUltCompra || 0), values.vlUltCompraNoMax ? 30000 : Number(values.maxVlUltCompra || 30000)]}
                          onChange={(_, newValue) => {
                            const [min, max] = newValue;
                            form.setFieldValue('minVlUltCompra', min);
                            form.setFieldValue('maxVlUltCompra', max);
                          }}
                          valueLabelDisplay="auto"
                          min={0}
                          max={30000}
                          step={50}
                          marks={false}
                          getAriaValueText={(v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                          valueLabelFormat={(v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                        />
                      )}
                    </Field>
                    <Field name="minVlUltCompra">
                      {({ form }) => (
                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={-1}>
                          <Typography variant="caption" color="textSecondary">
                            {editMinVl ? (
                              <InputBase
                                autoFocus
                                defaultValue={values.minVlUltCompra !== null ? Number(values.minVlUltCompra) : ""}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  const maxAllowed = form.values.vlUltCompraNoMax ? 30000 : Number(form.values.maxVlUltCompra || 30000);
                                  let v = val === "" ? null : parseCurrency(val, maxAllowed);
                                  if (v !== null && v > maxAllowed) v = maxAllowed;
                                  form.setFieldValue('minVlUltCompra', v);
                                  setEditMinVl(false);
                                }}
                                onKeyDown={(e)=>{ if(e.key==='Enter'){ e.currentTarget.blur(); } if(e.key==='Escape'){ setEditMinVl(false);} }}
                                style={{ width: 90 }}
                              />
                            ) : (
                              <span style={{ cursor: 'pointer' }} onClick={() => setEditMinVl(true)}>
                                {values.minVlUltCompra !== null ? formatBRL0(values.minVlUltCompra) : "Não definido"}
                              </span>
                            )}
                            {' — '}
                            {values.vlUltCompraNoMax ? (
                              '∞'
                            ) : editMaxVl ? (
                              <InputBase
                                autoFocus
                                defaultValue={values.maxVlUltCompra !== null ? Number(values.maxVlUltCompra) : ""}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  let v = val === "" ? null : parseCurrency(val, 30000);
                                  if (v !== null && v < Number(form.values.minVlUltCompra || 0)) v = Number(form.values.minVlUltCompra || 0);
                                  form.setFieldValue('maxVlUltCompra', v);
                                  setEditMaxVl(false);
                                }}
                                onKeyDown={(e)=>{ if(e.key==='Enter'){ e.currentTarget.blur(); } if(e.key==='Escape'){ setEditMaxVl(false);} }}
                                style={{ width: 90 }}
                              />
                            ) : (
                              <span style={{ cursor: 'pointer' }} onClick={() => setEditMaxVl(true)}>
                                {values.maxVlUltCompra !== null ? formatBRL0(values.maxVlUltCompra) : "Não definido"}
                              </span>
                            )}
                          </Typography>
                          <Field name="vlUltCompraNoMax">
                            {({ form: f2 }) => {
                              const active = !!f2.values.vlUltCompraNoMax;
                              return (
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    const nv = !active;
                                    f2.setFieldValue('vlUltCompraNoMax', nv);
                                    if (nv) {
                                      f2.setFieldValue('maxVlUltCompra', 30000);
                                    }
                                  }}
                                  aria-label={active ? 'Máximo infinito ativo' : 'Ativar máximo infinito'}
                                >
                                  <AllInclusiveIcon style={{ color: active ? '#16a34a' : '#c4c4c4' }} />
                                </IconButton>
                              );
                            }}
                          </Field>
                        </Box>
                      )}
                    </Field>
                    </Box>
                  </Box>
                </Grid>

                {/* Linha 2: Encomenda + Range de Data da Última Compra */}
                <Grid item xs={12} md={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth className={values.florder ? classes.activeFilter : ""}>
                    <InputLabel id="florder-select-label">Encomenda</InputLabel>
                    <Field as={Select} labelId="florder-select-label" id="florder-select" name="florder" label="Encomenda">
                      <MenuItem value=""><em>—</em></MenuItem>
                      <MenuItem value="Sim">Sim</MenuItem>
                      <MenuItem value="Não">Não</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field name="dtUltCompraStart">
                    {({ form }) => {
                      const start = form.values.dtUltCompraStart;
                      const end = form.values.dtUltCompraEnd;
                      const hasDateFilter = start && end;
                      return (
                        <>
                          <Button fullWidth variant="outlined" size="small" style={{ height: 43, ...(hasDateFilter && { borderColor: green[500], borderWidth: '2px' }) }} onClick={(e)=>{ setRangeAnchor(e.currentTarget); setRangeOpen(true); }}>
                            {hasDateFilter ? `Última Compra: ${format(parseISO(start), 'dd/MM')} — ${format(parseISO(end), 'dd/MM/yy')}` : 'Filtrar por Data da Última Compra'}
                          </Button>
                          <Popover open={rangeOpen} anchorEl={rangeAnchor} onClose={()=> setRangeOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}>
                            <DateRangePicker
                              open
                              toggle={() => setRangeOpen(false)}
                              initialDateRange={{ startDate: hasDateFilter ? parseISO(start) : new Date(), endDate: hasDateFilter ? parseISO(end) : new Date() }}
                              definedRanges={[
                                { label: 'Hoje', startDate: new Date(), endDate: new Date() },
                                { label: 'Últimos 7 dias', startDate: addDays(new Date(), -6), endDate: new Date() },
                                { label: 'Últimos 30 dias', startDate: addDays(new Date(), -29), endDate: new Date() },
                                { label: 'Semana atual', startDate: startOfWeek(new Date(), { weekStartsOn: 1 }), endDate: endOfWeek(new Date(), { weekStartsOn: 1 }) },
                                { label: 'Mês atual', startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) },
                              ]}
                              onChange={(r)=>{
                                if (!r?.startDate || !r?.endDate) return;
                                form.setFieldValue('dtUltCompraStart', format(r.startDate, 'yyyy-MM-dd'));
                                form.setFieldValue('dtUltCompraEnd', format(r.endDate, 'yyyy-MM-dd'));
                                setRangeOpen(false);
                              }}
                            />
                          </Popover>
                        </>
                      );
                    }}
                  </Field>
                </Grid>
                
                {/* Linha 3: Tags em uma única linha */}
                <Grid item xs={12} md={12}>
                  <Autocomplete
                    multiple
                    id="tags"
                    options={tags}
                    getOptionLabel={(option) => option.name}
                    value={selectedTags}
                    onChange={(e, newValue) => {
                      setSelectedTags(newValue);
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option.name}
                          {...getTagProps({ index })}
                          style={{ backgroundColor: option.color, color: "#fff" }}
                          className={classes.chip}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        label={i18n.t("contactListItems.filterDialog.tags")}
                        placeholder={i18n.t("contactListItems.filterDialog.tags")}
                        fullWidth
                        margin="dense"
                        className={selectedTags && selectedTags.length > 0 ? classes.activeFilter : ""}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        checked={saveFilterFlag}
                        onChange={(e) => setSaveFilterFlag(e.target.checked)}
                      />
                    }
                    label="Salvar este filtro e atualizar automaticamente (diariamente)"
                  />
                </Grid>

                {saveFilterFlag && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Horário diário da sincronização"
                        type="time"
                        value={cronTime}
                        onChange={(e) => setCronTime(e.target.value)}
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ step: 300 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        freeSolo
                        options={timezones}
                        getOptionLabel={(option) => option}
                        value={cronTz}
                        onChange={(e, newValue) => setCronTz(newValue || "")}
                        onInputChange={(e, newInputValue) => setCronTz(newInputValue || "")}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label="Timezone (IANA)"
                            placeholder="Ex.: America/Sao_Paulo"
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    </Grid>
                  </>
                )}

              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleClose}
                color="secondary"
                disabled={loading}
                variant="outlined"
              >
                {i18n.t("contactListItems.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={loading}
                variant="contained"
                className={classes.btnWrapper}
              >
                {i18n.t("contactListItems.buttons.filter")}
                {loading && (
                  <CircularProgress
                    size={24}
                    className={classes.buttonProgress}
                  />
                )}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default AddFilteredContactsModal;
