import React, { useState, useEffect, useMemo } from "react";
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
  Chip,
  Typography,
  Popover,
  Slider,
  Box,
  IconButton,
  InputBase
} from "@material-ui/core";

import Autocomplete from "@material-ui/lab/Autocomplete";
import AllInclusiveIcon from '@material-ui/icons/AllInclusive';
import { Close } from "@material-ui/icons";

import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import useAuth from "../../hooks/useAuth.js/index.js";
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

const createEmptyValues = () => ({
  channel: [],
  representativeCode: [],
  city: [],
  region: [],
  segment: [],
  situation: [],
  foundationMonths: [],
  minCreditLimit: null,
  maxCreditLimit: null,
  minVlUltCompra: null,
  maxVlUltCompra: null,
  vlUltCompraNoMax: false,
  creditLimitNoMax: false,
  florder: '',
  dtUltCompraStart: null,
  dtUltCompraEnd: null,
  bzEmpresa: [],
  whatsappInvalid: false,
  walletIds: [], // Novo: IDs de usuários para filtro de carteira
  whatsappIds: [], // Novo: IDs de conexões WhatsApp
});

const FilterContactModal = ({ isOpen, onClose, onFiltered, initialFilter = {} }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [situations, setSituations] = useState([]);
  const [representativeCodes, setRepresentativeCodes] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadingSituations, setLoadingSituations] = useState(false);
  const [loadingRepresentatives, setLoadingRepresentatives] = useState(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [users, setUsers] = useState([]); // Novo: usuários para filtro de carteira
  const [whatsapps, setWhatsapps] = useState([]); // Novo: conexões WhatsApp
  const [loadingUsers, setLoadingUsers] = useState(false); // Novo: loading para usuários
  const [loadingWhatsapps, setLoadingWhatsapps] = useState(false); // Novo: loading para whatsapps
  const { user, getCurrentUserInfo } = useAuth();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState(null);
  const monthsPT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const initialValues = useMemo(() => {
    const base = createEmptyValues();
    const src = initialFilter || {};

    const normalizeArray = (value) => {
      if (Array.isArray(value)) {
        return value.map(v => (v == null ? '' : String(v))).map(v => v.trim()).filter(Boolean);
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
      }
      return [];
    };

    base.channel = normalizeArray(src.channel);
    base.representativeCode = normalizeArray(src.representativeCode);
    base.city = normalizeArray(src.city);
    base.region = normalizeArray(src.region);
    base.segment = normalizeArray(src.segment);
    base.situation = normalizeArray(src.situation);
    base.bzEmpresa = normalizeArray(src.bzEmpresa);
    base.walletIds = Array.isArray(src.walletIds) ? src.walletIds.map(id => Number(id)).filter(id => Number.isInteger(id)) : [];
    base.whatsappIds = Array.isArray(src.whatsappIds) ? src.whatsappIds.map(id => Number(id)).filter(id => Number.isInteger(id)) : [];

    if (Array.isArray(src.foundationMonths)) {
      base.foundationMonths = src.foundationMonths
        .map(n => monthsPT[(Number(n) || 0) - 1])
        .filter(Boolean);
    }

    if (src.minCreditLimit != null) {
      const num = Number(src.minCreditLimit);
      base.minCreditLimit = Number.isFinite(num) ? num : null;
    }
    if (src.maxCreditLimit != null) {
      const num = Number(src.maxCreditLimit);
      base.maxCreditLimit = Number.isFinite(num) ? num : null;
    }
    if (src.minVlUltCompra != null) {
      const num = Number(src.minVlUltCompra);
      base.minVlUltCompra = Number.isFinite(num) ? num : null;
    }
    if (src.maxVlUltCompra != null) {
      const num = Number(src.maxVlUltCompra);
      base.maxVlUltCompra = Number.isFinite(num) ? num : null;
    }

    base.dtUltCompraStart = src.dtUltCompraStart || null;
    base.dtUltCompraEnd = src.dtUltCompraEnd || null;

    if (typeof src.florder === 'boolean') {
      base.florder = src.florder ? 'Sim' : 'Não';
    }

    return base;
  }, [initialFilter, monthsPT]);

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
    if (isOpen) {
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
    }
  }, [isOpen]);

  // Quando abrir com initialFilter, pré-preencher selecionando as tags correspondentes
  useEffect(() => {
    if (isOpen && initialFilter && Array.isArray(initialFilter.tags) && tags.length > 0) {
      const preSelected = tags.filter(t => initialFilter.tags.includes(t.id));
      setSelectedTags(preSelected);
    }
  }, [isOpen, initialFilter, tags]);

  // Garante que segmentos do initialFilter apareçam no Autocomplete mesmo que não existam na API
  useEffect(() => {
    if (isOpen && initialFilter && Array.isArray(initialFilter.segment) && initialFilter.segment.length) {
      setSegments(prev => {
        const set = new Set(prev);
        initialFilter.segment.forEach(s => {
          const v = (s == null ? "" : String(s).trim());
          if (v) set.add(v);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
      });
    }
  }, [isOpen, initialFilter]);

  // Garante que outros campos do initialFilter apareçam mesmo antes do carregamento lazy
  useEffect(() => {
    if (!isOpen || !initialFilter) return;
    if (Array.isArray(initialFilter.channel) && initialFilter.channel.length) {
      setChannels(prev => Array.from(new Set([...(prev||[]), ...initialFilter.channel.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(initialFilter.city) && initialFilter.city.length) {
      setCities(prev => Array.from(new Set([...(prev||[]), ...initialFilter.city.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(initialFilter.region) && initialFilter.region.length) {
      setRegions(prev => Array.from(new Set([...(prev||[]), ...initialFilter.region.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(initialFilter.representativeCode) && initialFilter.representativeCode.length) {
      setRepresentativeCodes(prev => Array.from(new Set([...(prev||[]), ...initialFilter.representativeCode.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
    if (Array.isArray(initialFilter.situation) && initialFilter.situation.length) {
      setSituations(prev => Array.from(new Set([...(prev||[]), ...initialFilter.situation.map(v => String(v).trim()).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,"pt-BR")));
    }
  }, [isOpen, initialFilter]);

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

      // monta preview + garante valores do initialFilter
      const basePreview = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR")).slice(0,5);
      const setPreview = new Set(basePreview);
      if (initialFilter && Array.isArray(initialFilter.channel)) {
        initialFilter.channel.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
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

  const loadEmpresas = async () => {
    const cached = getCache("empresas");
    if (Array.isArray(cached) && cached.length) { setEmpresas(cached); return; }
    setLoadingEmpresas(true);
    try {
      let companyId = user?.companyId;
      if (!companyId) {
        const info = await getCurrentUserInfo?.();
        companyId = info?.user?.companyId || info?.companyId;
      }
      if (!companyId) return;

      const { data } = await api.get("/contacts/empresas");
      const list = Array.isArray(data) ? data : (Array.isArray(data?.empresas) ? data.empresas : []);
      const normalized = list
        .map(e => (e == null ? "" : String(e).trim()))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      setEmpresas(normalized);
      setCache("empresas", normalized);
    } catch (err) {
      toastError(err);
    }
    setLoadingEmpresas(false);
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
      if (initialFilter && Array.isArray(initialFilter.city)) {
        initialFilter.city.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
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
    } finally {
      setLoadingCities(false);
    }
  };

  const loadRegions = async () => {
    const cached = getCache("regions");
    if (Array.isArray(cached) && cached.length) { setRegions(cached); return; }
    setLoadingRegions(true);
    try {
      // Prévia rápida com primeira página
      let page = 1;
      let hasMore = true;
      const map = new Map(); // key lower -> exibido

      const firstResp = await api.get("/contacts", {
        params: { pageNumber: page, limit: 500, orderBy: "region", order: "ASC" },
      });
      const firstList = Array.isArray(firstResp?.data?.contacts) ? firstResp.data.contacts : [];
      for (const c of firstList) {
        const raw = c?.region; if (!raw) continue;
        const value = String(raw).trim(); if (!value) continue;
        const key = value.toLowerCase(); if (!map.has(key)) map.set(key, value);
      }
      hasMore = Boolean(firstResp?.data?.hasMore);
      page += 1;

      const basePreview = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR")).slice(0,5);
      const setPreview = new Set(basePreview);
      if (initialFilter && Array.isArray(initialFilter.region)) {
        initialFilter.region.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
      }
      setRegions(Array.from(setPreview).sort((a,b)=>a.localeCompare(b,"pt-BR")));

      // Continuação em background
      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: { pageNumber: page, limit: 500, orderBy: "region", order: "ASC" },
        });
        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const c of list) {
          const raw = c?.region; if (!raw) continue;
          const value = String(raw).trim(); if (!value) continue;
          const key = value.toLowerCase(); if (!map.has(key)) map.set(key, value);
        }
        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a,b)=>a.localeCompare(b,"pt-BR"));
      setRegions(all);
      setCache("regions", all);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingRegions(false);
    }
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
      if (initialFilter && Array.isArray(initialFilter.representativeCode)) {
        initialFilter.representativeCode.forEach(v => { const s = String(v||"").trim(); if (s) setPreview.add(s); });
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

  // Novo: Carregar usuários para filtro de carteira
  const loadUsers = async () => {
    const cached = getCache("users");
    if (Array.isArray(cached) && cached.length) { setUsers(cached); return; }
    setLoadingUsers(true);
    try {
      const { data } = await api.get("/users");
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.users) ? data.users : []);
      // Filtrar apenas usuários ativos
      const activeUsers = list.filter(user => user.active !== false);
      setUsers(activeUsers);
      setCache("users", activeUsers);
    } catch (err) {
      toastError(err);
    }
    setLoadingUsers(false);
  };

  // Novo: Carregar conexões WhatsApp
  const loadWhatsapps = async () => {
    const cached = getCache("whatsapps");
    if (Array.isArray(cached) && cached.length) { setWhatsapps(cached); return; }
    setLoadingWhatsapps(true);
    try {
      const { data } = await api.get("/whatsapp");
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.whatsapps) ? data.whatsapps : []);
      setWhatsapps(list);
      setCache("whatsapps", list);
    } catch (err) {
      toastError(err);
    }
    setLoadingWhatsapps(false);
  };

  const handleClose = () => {
    onClose();
    setSelectedTags([]);
  };

  const handleApplyFilters = async (values) => {
    setLoading(true);
    try {
      // Preparar os filtros para enviar ao backend
      const filters = {
        ...values,
        channel: values.channel ? values.channel : null,
        representativeCode: values.representativeCode ? values.representativeCode : null,
        city: values.city ? values.city : null,
        region: values.region ? values.region : null,
        segment: values.segment ? values.segment : null,
        situation: values.situation ? values.situation : null,
        walletIds: values.walletIds ? values.walletIds : null, // Novo: IDs de usuários para carteira
        whatsappIds: values.whatsappIds ? values.whatsappIds : null, // Novo: IDs de conexões WhatsApp
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
      const rg = sanitizeList(filters.region);
      const sg = sanitizeList(filters.segment);
      const st = sanitizeList(filters.situation);
      const bz = sanitizeList(filters.bzEmpresa);
      if (typeof ch === 'undefined') delete filters.channel; else filters.channel = ch;
      if (typeof ct === 'undefined') delete filters.city; else filters.city = ct;
      if (typeof rg === 'undefined') delete filters.region; else filters.region = rg;
      if (typeof sg === 'undefined') delete filters.segment; else filters.segment = sg;
      if (typeof st === 'undefined') delete filters.situation; else filters.situation = st;
      if (typeof bz === 'undefined') delete filters.bzEmpresa; else filters.bzEmpresa = bz;

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

      // Mapear WhatsApp Inválido
      if (typeof values.whatsappInvalid === 'boolean' && values.whatsappInvalid) {
        filters.isWhatsappValid = false;
      } else if (typeof values.whatsappInvalid === 'boolean' && !values.whatsappInvalid) {
        // Se "Todos" for selecionado, não aplicamos nenhum filtro de WhatsApp
        // O campo fica como false por padrão, mas não é enviado
        delete filters.isWhatsappValid;
      }

      // Ajustar envio de range de última compra
      if (values.dtUltCompraStart) filters.dtUltCompraStart = values.dtUltCompraStart;
      if (values.dtUltCompraEnd) filters.dtUltCompraEnd = values.dtUltCompraEnd;

      // Se marcado "Sem máximo", remove maxCreditLimit
      if (values.creditLimitNoMax) {
        delete filters.maxCreditLimit;
      }
      delete filters.creditLimitNoMax;

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

      // Se marcado "Sem máximo" para Valor da Última Compra, remove maxVlUltCompra
      if (values.vlUltCompraNoMax) {
        delete filters.maxVlUltCompra;
      }
      delete filters.vlUltCompraNoMax;

      // Remover filtros vazios
      Object.keys(filters).forEach(key => {
        if (filters[key] === "" || filters[key] === null || filters[key] === undefined ||
          (Array.isArray(filters[key]) && filters[key].length === 0)) {
          delete filters[key];
        }
      });

      // Chamar a função onFiltered passada por props com os filtros
      onFiltered(filters);
      handleClose();

    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const handleClearFilters = (resetForm) => {
    const emptyValues = createEmptyValues();
    resetForm({ values: emptyValues });
    onFiltered({});
    handleClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">{i18n.t("contacts.filterTagsModal.title")}</Typography>
          <IconButton edge="end" color="inherit" onClick={handleClose} aria-label="close">
            <Close />
          </IconButton>
        </div>
      </DialogTitle>
      <Formik
        initialValues={initialValues}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          handleApplyFilters(values);
          actions.setSubmitting(false);
        }}
      >
        {({ values, errors, touched, isSubmitting, resetForm }) => (
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
                            InputLabelProps={{
                              shrink: true,
                            }}
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
                            InputLabelProps={{
                              shrink: true,
                            }}
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
                            InputLabelProps={{ shrink: true, }}
                            InputProps={{ ...params.InputProps, endAdornment: (<> {loadingCities ? <CircularProgress color="inherit" size={20} /> : null} {params.InputProps.endAdornment} </>) }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                {/* Campo Região - Novo campo adicionado */}
                <Grid item xs={12} md={6}>
                  <Field name="region">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={regions}
                        onOpen={() => { loadRegions(); }}
                        loading={loadingRegions}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label="Região"
                            placeholder="Região"
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingRegions ? <CircularProgress color="inherit" size={20} /> : null}
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
                            InputLabelProps={{
                              shrink: true,
                            }}
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
                        onOpen={() => { }}
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
                            InputLabelProps={{
                              shrink: true,
                            }}
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

                {/* Linha 1: Data de Fundação + Encomenda */}
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
                            InputLabelProps={{
                              shrink: true,
                            }}
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth className={values.florder ? classes.activeFilter : ""}>
                    <InputLabel id="florder-select-label" shrink>Encomenda</InputLabel>
                    <Field as={Select} labelId="florder-select-label" id="florder-select" name="florder" label="Encomenda">
                      <MenuItem value=""><em>—</em></MenuItem>
                      <MenuItem value="Sim">Sim</MenuItem>
                      <MenuItem value="Não">Não</MenuItem>
                    </Field>
                  </FormControl>
                </Grid>

                {/* Linha 2: Limite de Crédito (faixa) + Valor da Última Compra (faixa) */}
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

                {/* Linha 3: WhatsApp Inválido + Range de Data da Última Compra */}
                <Grid item xs={12} md={6}>
                  <Field name="whatsappInvalid">
                    {({ field }) => (
                      <FormControl variant="outlined" margin="dense" fullWidth className={field.value ? classes.activeFilter : ""}>
                        <InputLabel id="whatsapp-invalid-label">WhatsApp Inválido</InputLabel>
                        <Field as={Select} labelId="whatsapp-invalid-label" id="whatsapp-invalid-select" name="whatsappInvalid" label="WhatsApp Inválido">
                          <MenuItem value={false}>Todos</MenuItem>
                          <MenuItem value={true}>Somente Inválidos</MenuItem>
                        </Field>
                      </FormControl>
                    )}
                  </Field>
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
                            {hasDateFilter ? `Última Compra: ${format(parseISO(start), 'dd/MM')} — ${format(parseISO(end), 'dd/MM/yy')}` : 'Filtrar Data Última Compra'}
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
                
                {/* Linha 3: Empresa e Tags */}
                <Grid item xs={12} md={6}>
                  <Field name="bzEmpresa">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={empresas}
                        onOpen={() => { loadEmpresas(); }}
                        loading={loadingEmpresas}
                        loadingText="Carregando..."
                        noOptionsText="Sem opções"
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label="Empresa"
                            placeholder="Empresa"
                            fullWidth
                            margin="dense"
                            className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingEmpresas ? <CircularProgress color="inherit" size={20} /> : null}
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
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
            />
          </Grid>

          {/* Linha 4: Carteira (responsáveis) + Conexão (WhatsApp) */}
          <Grid item xs={12} md={6}>
            <Field name="walletIds">
              {({ field, form }) => (
                <Autocomplete
                  multiple
                  options={users}
                  onOpen={() => { loadUsers(); }}
                  loading={loadingUsers}
                  loadingText="Carregando..."
                  noOptionsText="Sem opções"
                  getOptionLabel={(option) => option.name}
                  getOptionSelected={(option, value) => option.id === value}
                  value={users.filter(user => field.value?.includes(user.id)) || []}
                  onChange={(event, value) => {
                    const ids = value.map(u => u.id);
                    form.setFieldValue(field.name, ids);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      label="Carteira (Responsáveis)"
                      placeholder="Carteira (Responsáveis)"
                      fullWidth
                      margin="dense"
                      className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
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
            <Field name="whatsappIds">
              {({ field, form }) => (
                <Autocomplete
                  multiple
                  options={whatsapps}
                  onOpen={() => { loadWhatsapps(); }}
                  loading={loadingWhatsapps}
                  loadingText="Carregando..."
                  noOptionsText="Sem opções"
                  getOptionLabel={(option) => option.name}
                  getOptionSelected={(option, value) => option.id === value}
                  value={whatsapps.filter(w => field.value?.includes(w.id)) || []}
                  onChange={(event, value) => {
                    const ids = value.map(w => w.id);
                    form.setFieldValue(field.name, ids);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      label="Conexão (WhatsApp)"
                      placeholder="Conexão (WhatsApp)"
                      fullWidth
                      margin="dense"
                      className={field.value && field.value.length > 0 ? classes.activeFilter : ""}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingWhatsapps ? <CircularProgress color="inherit" size={20} /> : null}
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

        </Grid>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => handleClearFilters(resetForm)}
          color="secondary"
          disabled={loading}
        >
          Limpar filtros
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

export default FilterContactModal;
