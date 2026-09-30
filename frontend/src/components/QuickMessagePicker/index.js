import React, { useEffect, useState, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemText,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
  makeStyles,
} from "@material-ui/core";
import { Search, Close } from "@material-ui/icons";
import { AuthContext } from "../../context/Auth/AuthContext";
import useQuickMessages from "../../hooks/useQuickMessages";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  dialogContent: {
    padding: theme.spacing(0, 2, 2),
    minWidth: 380,
    [theme.breakpoints.down("xs")]: { minWidth: 0 },
  },
  searchField: {
    margin: theme.spacing(1, 0, 1.5),
  },
  list: {
    maxHeight: 380,
    overflowY: "auto",
  },
  item: {
    borderRadius: 8,
    marginBottom: 4,
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  shortcode: {
    color: theme.palette.primary.main,
    fontWeight: 700,
  },
  empty: {
    padding: theme.spacing(4, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

// Seletor de respostas rápidas: lista as quick messages da empresa e
// devolve o texto da mensagem escolhida via onSelect (sem enviar nada).
const QuickMessagePicker = ({ open, onClose, onSelect }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { list } = useQuickMessages();

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    list({ companyId: user.companyId, userId: user.id })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(toastError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = items.filter(m => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(m.shortcode || "").toLowerCase().includes(q) ||
      String(m.message || "").toLowerCase().includes(q)
    );
  });

  const handlePick = m => {
    onSelect(m.message || "");
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
            Respostas rápidas
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <TextField
          className={classes.searchField}
          placeholder="Buscar por atalho ou conteúdo..."
          variant="outlined"
          size="small"
          fullWidth
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" style={{ opacity: 0.5 }} />
              </InputAdornment>
            ),
          }}
        />
        {loading ? (
          <div className={classes.empty}>
            <CircularProgress size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className={classes.empty}>
            <Typography variant="body2">
              {items.length === 0
                ? "Nenhuma resposta rápida cadastrada."
                : "Nenhuma resposta encontrada para a busca."}
            </Typography>
          </div>
        ) : (
          <List className={classes.list} disablePadding>
            {filtered.map(m => (
              <ListItem
                key={m.id}
                button
                className={classes.item}
                onClick={() => handlePick(m)}
              >
                <ListItemText
                  primary={<span className={classes.shortcode}>/{m.shortcode}</span>}
                  secondary={
                    String(m.message || "").length > 120
                      ? `${String(m.message).slice(0, 120)}…`
                      : m.message || "(somente mídia — sem texto)"
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuickMessagePicker;
