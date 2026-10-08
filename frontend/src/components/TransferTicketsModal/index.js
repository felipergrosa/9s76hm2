import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Typography,
  Box,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { ArrowRight as ArrowIcon } from "lucide-react";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  selectsRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  select: {
    flex: 1,
  },
  arrow: {
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  countInfo: {
    marginTop: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  warningBox: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    backgroundColor: theme.palette.type === "dark" ? "#4a3410" : "#fff8e1",
    border: `1px solid ${theme.palette.type === "dark" ? "#6b4d16" : "#f0d98c"}`,
    fontSize: "0.85rem",
  },
}));

/**
 * Modal de transferência de atendimentos entre conexões.
 *
 * mode="transfer"      → uso genérico (botão "Transferir Tickets" do header)
 * mode="beforeDelete"  → fluxo de exclusão: avisa sobre tickets ativos e
 *                        permite "Transferir e Excluir" ou "Excluir sem
 *                        transferir". Precisa de onDelete e activeCount.
 */
const TransferTicketsModal = ({
  open,
  onClose,
  connections = [],
  initialSourceId = null,
  mode = "transfer",
  activeCount = 0,
  onTransferAndDelete = null,
  onDeleteOnly = null,
}) => {
  const classes = useStyles();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSourceId(initialSourceId ? String(initialSourceId) : "");
      setTargetId("");
      setCount(mode === "beforeDelete" ? activeCount : null);
      setLoading(false);
    }
  }, [open, initialSourceId, mode, activeCount]);

  useEffect(() => {
    if (!open || !sourceId || mode === "beforeDelete") return;
    let alive = true;
    api
      .get(`/whatsapp/${sourceId}/active-tickets-count`)
      .then(({ data }) => alive && setCount(data.count))
      .catch(() => alive && setCount(null));
    return () => {
      alive = false;
    };
  }, [open, sourceId, mode]);

  const targetOptions = useMemo(
    () => connections.filter((c) => String(c.id) !== String(sourceId)),
    [connections, sourceId]
  );

  const handleTransfer = async () => {
    if (!sourceId || !targetId || loading) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/whatsapp/${sourceId}/transfer-tickets`, {
        targetWhatsappId: targetId,
      });
      toast.success(
        i18n.t("connections.transferModal.transferredSuccess", {
          count: data.transferred,
        })
      );
      if (mode === "beforeDelete" && onTransferAndDelete) {
        await onTransferAndDelete();
      } else {
        onClose();
      }
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const isBeforeDelete = mode === "beforeDelete";
  const displayedCount = isBeforeDelete ? activeCount : count;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("connections.transferModal.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary">
          {isBeforeDelete
            ? i18n.t("connections.transferModal.beforeDeleteDesc", {
                count: displayedCount,
              })
            : i18n.t("connections.transferModal.description")}
        </Typography>

        <div className={classes.selectsRow}>
          <TextField
            className={classes.select}
            select
            size="small"
            variant="outlined"
            label={i18n.t("connections.transferModal.source")}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            disabled={isBeforeDelete || loading}
          >
            {connections.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.name} (#{c.id})
              </MenuItem>
            ))}
          </TextField>
          <ArrowIcon size={18} className={classes.arrow} />
          <TextField
            className={classes.select}
            select
            size="small"
            variant="outlined"
            label={i18n.t("connections.transferModal.target")}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={loading}
          >
            {targetOptions.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.name} (#{c.id})
              </MenuItem>
            ))}
          </TextField>
        </div>

        {sourceId && displayedCount !== null && displayedCount !== undefined && (
          <div className={classes.countInfo}>
            {i18n.t("connections.transferModal.activeCount", {
              count: displayedCount,
            })}
          </div>
        )}

        {isBeforeDelete && (
          <Box className={classes.warningBox}>
            {i18n.t("connections.transferModal.deleteWarning")}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {isBeforeDelete && onDeleteOnly && (
          <Button onClick={onDeleteOnly} color="secondary" disabled={loading}>
            {i18n.t("connections.transferModal.deleteWithoutTransfer")}
          </Button>
        )}
        <Button onClick={onClose} disabled={loading}>
          {i18n.t("connections.transferModal.cancel")}
        </Button>
        <Button
          onClick={handleTransfer}
          color="primary"
          variant="contained"
          disabled={!sourceId || !targetId || loading}
        >
          {loading ? (
            <CircularProgress size={20} />
          ) : isBeforeDelete ? (
            i18n.t("connections.transferModal.transferAndDelete")
          ) : (
            i18n.t("connections.transferModal.transfer")
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(TransferTicketsModal);
