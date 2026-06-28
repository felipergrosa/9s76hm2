import React, { useState, useEffect, useReducer } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Typography,
  Chip,
  Button,
  CircularProgress
} from "@material-ui/core";
import { format } from "date-fns";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: {
    marginTop: 8
  },
  entry: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 0",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  date: {
    fontSize: 11,
    color: theme.palette.text.secondary
  },
  user: {
    fontSize: 12,
    fontWeight: 600
  },
  details: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
    wordBreak: "break-word"
  },
  empty: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    fontStyle: "italic",
    padding: "8px 0"
  }
}));

const reducer = (state, action) => {
  if (action.type === "LOAD") {
    return action.reset ? action.payload : [...state, ...action.payload];
  }
  return state;
};

// Componente read-only de histórico de eventos (item 7 do plano), reaproveitando
// o mesmo endpoint/serviço que já alimenta a página de Logs de Auditoria, apenas
// filtrado por entity+entityId. Quem não tem permissão (settings.view) simplesmente
// não vê esta seção, sem gerar erro visível.
const EntityTimeline = ({ entity, entityId, title = "Histórico" }) => {
  const classes = useStyles();
  const [logs, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    dispatch({ type: "LOAD", payload: [], reset: true });
    setPageNumber(1);
    setForbidden(false);
  }, [entity, entityId]);

  useEffect(() => {
    if (!entity || !entityId) return;
    if (forbidden) return;

    let isMounted = true;
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/audit-logs", {
          params: { entity, entityId, pageNumber }
        });
        if (!isMounted) return;
        dispatch({ type: "LOAD", payload: data.logs, reset: pageNumber === 1 });
        setHasMore(data.hasMore);
      } catch (err) {
        if (err?.response?.status === 403) {
          setForbidden(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchLogs();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entityId, pageNumber, forbidden]);

  if (forbidden) return null;

  return (
    <div className={classes.root}>
      <Typography variant="subtitle1">{title}</Typography>

      {logs.length === 0 && !loading && (
        <Typography className={classes.empty}>
          Nenhum evento registrado ainda.
        </Typography>
      )}

      {logs.map(log => (
        <div key={log.id} className={classes.entry}>
          <div className={classes.entryHeader}>
            <span className={classes.date}>
              {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
            </span>
            <Chip label={log.action} size="small" />
            <span className={classes.user}>{log.userName}</span>
          </div>
          {log.details && (
            <Typography className={classes.details}>
              {log.details.length > 200
                ? `${log.details.substring(0, 200)}...`
                : log.details}
            </Typography>
          )}
        </div>
      ))}

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
          <CircularProgress size={20} />
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
          <Button size="small" onClick={() => setPageNumber(prev => prev + 1)}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
};

export default EntityTimeline;
