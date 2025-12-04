import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TextField,
  Chip,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
  ClickAwayListener,
  CircularProgress,
  makeStyles
} from '@material-ui/core';
import { LocalOffer as TagIcon } from '@material-ui/icons';
import api from '../../services/api';
import Portal from '@material-ui/core/Portal';

const useStyles = makeStyles((theme) => ({
  container: {
    position: 'relative',
    width: '100%'
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5)
  },
  suggestionsContainer: {
    position: 'fixed',
    zIndex: 9999, // Máximo - acima de TUDO
    maxHeight: 180,
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    backgroundColor: '#fff',
    borderRadius: 4,
    border: '1px solid #ddd'
  },
  suggestionItem: {
    cursor: 'pointer',
    padding: '4px 12px', // Menos padding
    '&:hover': {
      backgroundColor: theme.palette.action.hover
    }
  },
  suggestionCount: {
    color: theme.palette.text.secondary,
    fontSize: '0.7rem'
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6
  },
  chip: {
    margin: 1,
    height: 24
  },
  newTagHint: {
    fontStyle: 'italic',
    color: theme.palette.primary.main,
    fontSize: '0.85rem'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(0.5)
  },
  label: {
    marginBottom: 4,
    fontSize: '0.85rem'
  }
}));

/**
 * Componente de autocomplete de tags
 * Busca tags existentes e permite criar novas
 */
const TagAutocomplete = ({
  value = [],
  onChange,
  placeholder = "Digite para buscar ou criar tag...",
  label = "Tags",
  disabled = false
}) => {
  const classes = useStyles();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputWrapperRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);

  // Buscar sugestões de tags
  const fetchSuggestions = useCallback(async (search) => {
    if (!search || search.length < 1) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/tags/autocomplete', {
        params: { search, limit: 10 }
      });
      setSuggestions(data || []);
    } catch (err) {
      console.error('Erro ao buscar tags:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        fetchSuggestions(inputValue.trim());
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, fetchSuggestions]);

  // Adicionar tag
  const handleAddTag = (tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (!normalizedTag) return;
    
    if (!value.includes(normalizedTag)) {
      onChange([...value, normalizedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  // Remover tag
  const handleDeleteTag = (tagToDelete) => {
    onChange(value.filter(t => t !== tagToDelete));
  };

  // Selecionar sugestão
  const handleSelectSuggestion = (suggestion) => {
    handleAddTag(suggestion.tag);
  };

  // Tecla Enter ou vírgula adiciona tag
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAddTag(inputValue);
      }
    }
  };

  // Verificar se o input é uma nova tag
  const isNewTag = inputValue.trim() && 
    !suggestions.some(s => s.tag.toLowerCase() === inputValue.toLowerCase().trim());

  const updateAnchorRect = () => {
    if (inputWrapperRef.current) {
      const rect = inputWrapperRef.current.getBoundingClientRect();
      setAnchorRect(rect);
    }
  };

  return (
    <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
      <Box className={classes.container}>
        <Typography variant="body2" className={classes.label}>
          {label}
        </Typography>
        
        {/* Wrapper do input com sugestões */}
        <Box ref={inputWrapperRef} className={classes.inputWrapper}>
          {/* Sugestões - POR CIMA do input (em Portal, acima do modal) */}
          {showSuggestions && inputValue.trim() && anchorRect && (
          <Portal>
          <Paper
            className={classes.suggestionsContainer}
            style={{
              top: anchorRect.bottom + 4,
              left: anchorRect.left,
              width: anchorRect.width
            }}
          >
            {loading ? (
              <Box className={classes.loading}>
                <CircularProgress size={16} />
              </Box>
            ) : (
              <List dense disablePadding>
                {/* Opção de criar nova tag */}
                {isNewTag && (
                  <ListItem
                    button
                    className={classes.suggestionItem}
                    onClick={() => handleAddTag(inputValue)}
                  >
                    <ListItemText
                      primary={
                        <span className={classes.newTagHint}>
                          + Criar "{inputValue.trim()}"
                        </span>
                      }
                    />
                  </ListItem>
                )}

                {/* Sugestões existentes */}
                {suggestions
                  .filter(s => !value.includes(s.tag))
                  .map((suggestion) => (
                    <ListItem
                      key={suggestion.tag}
                      button
                      className={classes.suggestionItem}
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <ListItemText
                        primary={suggestion.tag}
                        secondary={
                          <span className={classes.suggestionCount}>
                            Usado {suggestion.count}x
                          </span>
                        }
                      />
                    </ListItem>
                  ))}

                {/* Sem resultados */}
                {!isNewTag && suggestions.length === 0 && inputValue.trim() && (
                  <ListItem className={classes.suggestionItem}>
                    <ListItemText
                      primary={<span style={{ fontSize: '0.85rem' }}>Nenhuma tag encontrada</span>}
                      secondary={<span style={{ fontSize: '0.7rem' }}>Pressione Enter para criar</span>}
                    />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>
          </Portal>
        )}

          {/* Input */}
          <TextField
            size="small"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
              updateAnchorRect();
            }}
            onFocus={() => {
              setShowSuggestions(true);
              updateAnchorRect();
            }}
            onKeyDown={handleKeyDown}
            fullWidth
            disabled={disabled}
            InputProps={{
              startAdornment: <TagIcon color="action" style={{ marginRight: 8, fontSize: 18 }} />
            }}
          />
        </Box>

        {/* Tags selecionadas - ABAIXO do input */}
        {value.length > 0 && (
          <Box className={classes.tagsContainer}>
            {value.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onDelete={disabled ? undefined : () => handleDeleteTag(tag)}
                size="small"
                className={classes.chip}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Box>
    </ClickAwayListener>
  );
};

export default TagAutocomplete;
