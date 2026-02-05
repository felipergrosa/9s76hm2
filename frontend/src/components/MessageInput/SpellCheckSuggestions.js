import React from 'react';
import { makeStyles, Paper, Chip, Typography, IconButton } from '@material-ui/core';
import { Check, X, BookOpen } from 'lucide-react';

const useStyles = makeStyles((theme) => ({
  suggestionsWrapper: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 1300,
    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#202c33',
    borderTop: `1px solid ${theme.mode === 'light' ? '#e9edef' : '#2a3942'}`,
    boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
    padding: '8px 12px',
    maxHeight: '120px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 4,
    borderBottom: `1px solid ${theme.mode === 'light' ? '#f0f2f5' : '#1d282f'}`,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    width: 16,
    height: 16,
    color: theme.palette.primary.main,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.mode === 'light' ? '#667781' : '#8696a0',
  },
  word: {
    fontWeight: 700,
    color: theme.palette.error.main,
  },
  suggestionsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
  },
  chip: {
    fontSize: 13,
    cursor: 'pointer',
    backgroundColor: theme.mode === 'light' ? '#f0f2f5' : '#1d282f',
    color: theme.mode === 'light' ? '#3b4a54' : '#e9edef',
    '&:hover': {
      backgroundColor: theme.palette.primary.light,
      color: '#fff',
    },
  },
  noSuggestions: {
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.mode === 'light' ? '#8696a0' : '#aebac1',
    padding: '4px 0',
  },
  closeButton: {
    padding: 2,
    width: 24,
    height: 24,
    color: theme.mode === 'light' ? '#8696a0' : '#aebac1',
  },
  // Estilo para mobile
  mobileWrapper: {
    position: 'fixed',
    bottom: 72,
    left: 0,
    right: 0,
    zIndex: 1300,
  },
}));

const SpellCheckSuggestions = ({
  suggestions,
  currentWord,
  onSelect,
  onClose,
  isMobile = false,
}) => {
  const classes = useStyles();

  const handleSelect = (suggestion) => {
    onSelect(suggestion);
  };

  if (!currentWord || currentWord.length < 2) return null;

  return (
    <Paper
      elevation={0}
      className={`${classes.suggestionsWrapper} ${isMobile ? classes.mobileWrapper : ''}`}
    >
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <BookOpen className={classes.icon} />
          <Typography variant="body2" className={classes.title}>
            Sugestões para <span className={classes.word}>{currentWord}</span>:
          </Typography>
        </div>
        <IconButton
          size="small"
          onClick={onClose}
          className={classes.closeButton}
        >
          <X size={16} />
        </IconButton>
      </div>

      <div className={classes.suggestionsList}>
        {suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <Chip
              key={`${suggestion}-${index}`}
              label={suggestion}
              size="small"
              className={classes.chip}
              onClick={() => handleSelect(suggestion)}
              icon={<Check size={14} style={{ marginLeft: 4 }} />}
            />
          ))
        ) : (
          <Typography className={classes.noSuggestions}>
            Nenhuma sugestão encontrada
          </Typography>
        )}
      </div>
    </Paper>
  );
};

export default SpellCheckSuggestions;
