import React, { useState, useCallback, useRef } from "react";
import {
  makeStyles,
  Paper,
  InputBase,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  CircularProgress,
  Collapse,
} from "@material-ui/core";
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f0f2f5",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    padding: "4px 8px",
    gap: 4,
  },
  inputWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: "2px 8px",
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  resultCount: {
    fontSize: 12,
    color: "#667781",
    whiteSpace: "nowrap",
    marginLeft: 8,
  },
  resultsList: {
    maxHeight: 250,
    overflow: "auto",
    backgroundColor: "#fff",
    borderTop: "1px solid rgba(0,0,0,0.06)",
  },
  resultItem: {
    padding: "6px 16px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#f5f6f6",
    },
  },
  resultBody: {
    fontSize: 13,
    color: "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },
  resultMeta: {
    fontSize: 11,
    color: "#8696a0",
  },
  highlight: {
    backgroundColor: "#fef3cd",
    fontWeight: 600,
    padding: "0 1px",
    borderRadius: 2,
  },
  noResults: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: "#8696a0",
    fontSize: 13,
  },
}));

const MessageSearchBar = ({ ticketId, open, onClose, onNavigateToMessage }) => {
  const classes = useStyles();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2 || !ticketId) {
      setResults([]);
      setCount(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const { data } = await api.get(`/messages/${ticketId}/search`, {
        params: { query: searchQuery.trim() },
      });
      setResults(data.messages || []);
      setCount(data.count || 0);
      setCurrentIndex(-1);
    } catch (err) {
      console.error("[MessageSearchBar] Erro na busca:", err);
      setResults([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce de 500ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setCount(0);
    setSearched(false);
    setCurrentIndex(-1);
    onClose();
  };

  const handleNavigate = (direction) => {
    if (results.length === 0) return;
    let newIndex;
    if (direction === "up") {
      newIndex = currentIndex <= 0 ? results.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex >= results.length - 1 ? 0 : currentIndex + 1;
    }
    setCurrentIndex(newIndex);
    if (onNavigateToMessage && results[newIndex]) {
      onNavigateToMessage(results[newIndex].id);
    }
  };

  const handleResultClick = (message, index) => {
    setCurrentIndex(index);
    if (onNavigateToMessage) {
      onNavigateToMessage(message.id);
    }
  };

  // Destacar texto encontrado
  const highlightText = (text, searchTerm) => {
    if (!text || !searchTerm) return text;
    const truncated = text.length > 120 ? text.substring(0, 120) + "..." : text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = truncated.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className={classes.highlight}>{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (!open) return null;

  return (
    <div className={classes.root}>
      <div className={classes.searchBar}>
        <div className={classes.inputWrapper}>
          <SearchIcon style={{ color: "#8696a0", fontSize: 20, marginRight: 4 }} />
          <InputBase
            autoFocus
            className={classes.input}
            placeholder="Buscar mensagens..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {loading && <CircularProgress size={16} style={{ color: "#008069" }} />}
          {!loading && count > 0 && (
            <span className={classes.resultCount}>
              {currentIndex >= 0 ? `${currentIndex + 1} de ` : ""}{count}
            </span>
          )}
        </div>
        {results.length > 0 && (
          <>
            <IconButton size="small" onClick={() => handleNavigate("up")}>
              <ArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleNavigate("down")}>
              <ArrowDownIcon fontSize="small" />
            </IconButton>
          </>
        )}
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      {/* Lista de resultados */}
      {searched && (
        <div className={classes.resultsList}>
          {results.length === 0 && !loading ? (
            <div className={classes.noResults}>
              Nenhuma mensagem encontrada
            </div>
          ) : (
            <List dense disablePadding>
              {results.map((msg, index) => (
                <ListItem
                  key={msg.id}
                  className={classes.resultItem}
                  onClick={() => handleResultClick(msg, index)}
                  selected={index === currentIndex}
                  button
                >
                  <ListItemText
                    primary={
                      <span className={classes.resultBody}>
                        {highlightText(msg.body, query)}
                      </span>
                    }
                    secondary={
                      <span className={classes.resultMeta}>
                        {msg.contact?.name || (msg.fromMe ? "Você" : "Contato")}
                        {" · "}
                        {msg.createdAt && format(parseISO(msg.createdAt), "dd/MM/yyyy HH:mm")}
                      </span>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageSearchBar;
