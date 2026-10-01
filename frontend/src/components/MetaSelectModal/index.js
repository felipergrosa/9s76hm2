import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Facebook, Instagram } from "@material-ui/icons";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  loadingBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(4)
  },
  pagePrimary: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  smallChip: {
    height: 20,
    fontSize: "0.7rem"
  }
}));

/**
 * MetaSelectModal — seleção das páginas/contas descobertas pelo OAuth da Meta.
 *
 * Fluxo: após autorizar na Meta, o backend redireciona para
 * /connections?meta_select=<key>. A página de Conexões lê a chave, limpa a
 * URL e abre este modal. Aqui buscamos as páginas disponíveis
 * (GET /meta-oauth/selection/:key) e criamos as conexões marcadas
 * (POST /meta-oauth/selection/:key { selectedKeys }).
 * HTTP 410 = stash da seleção expirado no backend.
 */
const MetaSelectModal = ({ open, selectionKey, onClose, onConnected }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [channel, setChannel] = useState("facebook");
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!open || !selectionKey) return;
    let cancelled = false;

    const fetchSelection = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/meta-oauth/selection/${selectionKey}`);
        if (cancelled) return;
        const list = Array.isArray(data?.pages) ? data.pages : [];
        setChannel(data?.channel === "instagram" ? "instagram" : "facebook");
        setPages(list);
        // Pré-seleciona somente as páginas ainda não conectadas
        const preSelected = {};
        list.forEach((page) => {
          if (!page.alreadyConnected) preSelected[page.key] = true;
        });
        setSelected(preSelected);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 410) {
          toast.error(i18n.t("connections.metaSelect.expired"));
        } else {
          toastError(err);
        }
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSelection();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectionKey]);

  const isInstagram = channel === "instagram";
  const channelLabel = isInstagram ? "Instagram" : "Facebook";
  const ChannelIcon = isInstagram ? Instagram : Facebook;
  const channelColor = isInstagram ? "#e1306c" : "#3b5998";

  const selectedCount = pages.reduce(
    (acc, page) => acc + (selected[page.key] ? 1 : 0),
    0
  );

  const handleToggle = (pageKey) => () => {
    setSelected((prev) => ({ ...prev, [pageKey]: !prev[pageKey] }));
  };

  const handleSelectAll = () => {
    // Marca todas as páginas ainda não conectadas
    const all = {};
    pages.forEach((page) => {
      if (!page.alreadyConnected) all[page.key] = true;
    });
    setSelected(all);
  };

  const handleSubmit = async () => {
    const selectedKeys = pages
      .filter((page) => selected[page.key] && !page.alreadyConnected)
      .map((page) => page.key);
    if (!selectedKeys.length || submitting) return;

    setSubmitting(true);
    try {
      const { data } = await api.post(`/meta-oauth/selection/${selectionKey}`, {
        selectedKeys
      });
      // Fallback defensivo caso o backend não retorne os contadores
      const created =
        typeof data?.created === "number" ? data.created : selectedKeys.length;
      const updated =
        typeof data?.updated === "number" ? data.updated : 0;
      toast.success(
        i18n.t("connections.metaSelect.success", { created, updated })
      );
      if (onConnected) onConnected();
      onClose();
    } catch (err) {
      if (err?.response?.status === 410) {
        // Stash expirado entre abrir o modal e confirmar
        toast.error(i18n.t("connections.metaSelect.expired"));
        onClose();
        return;
      }
      toastError(err);
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <ChannelIcon style={{ color: channelColor }} />
          {i18n.t("connections.metaSelect.title")}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box className={classes.loadingBox}>
            <CircularProgress size={24} />
            <Typography color="textSecondary">
              {i18n.t("connections.metaSelect.loading")}
            </Typography>
          </Box>
        ) : pages.length === 0 ? (
          <Typography color="textSecondary">
            {i18n.t("connections.metaSelect.empty")}
          </Typography>
        ) : (
          <>
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ marginBottom: 8 }}
            >
              {i18n.t("connections.metaSelect.subtitle")}
            </Typography>
            <List dense disablePadding>
              {pages.map((page) => {
                const disabled = !!page.alreadyConnected;
                const secondaryId =
                  isInstagram && page.instagramAccountId
                    ? page.instagramAccountId
                    : page.pageId;
                return (
                  <ListItem
                    key={page.key}
                    button={!disabled}
                    disabled={disabled}
                    onClick={disabled ? undefined : handleToggle(page.key)}
                  >
                    <ListItemIcon style={{ minWidth: 36 }}>
                      <Checkbox
                        edge="start"
                        color="primary"
                        // Já conectadas aparecem marcadas, porém desabilitadas
                        checked={disabled || !!selected[page.key]}
                        disabled={disabled}
                        disableRipple
                        inputProps={{ "aria-label": page.pageName }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <span className={classes.pagePrimary}>
                          <span>{page.pageName}</span>
                          <Chip
                            size="small"
                            label={channelLabel}
                            className={classes.smallChip}
                            style={{
                              backgroundColor: channelColor,
                              color: "#fff"
                            }}
                          />
                          {disabled && (
                            <Chip
                              size="small"
                              variant="outlined"
                              color="primary"
                              label={i18n.t(
                                "connections.metaSelect.alreadyConnected"
                              )}
                              className={classes.smallChip}
                            />
                          )}
                        </span>
                      }
                      secondary={secondaryId ? `ID: ${secondaryId}` : null}
                    />
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleSelectAll}
          disabled={loading || submitting || pages.length === 0}
        >
          {i18n.t("connections.metaSelect.selectAll")}
        </Button>
        <Button onClick={onClose} disabled={submitting}>
          {i18n.t("connections.metaSelect.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={loading || submitting || selectedCount === 0}
          startIcon={
            submitting ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {submitting
            ? i18n.t("connections.metaSelect.connecting")
            : i18n.t("connections.metaSelect.connect")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MetaSelectModal;
