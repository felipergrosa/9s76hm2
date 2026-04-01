import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Paper, Typography, IconButton, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import api from '../../services/api';

const useStyles = makeStyles((theme) => ({
  previewContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    maxWidth: 400,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    objectFit: 'cover',
    backgroundColor: '#f1f5f9',
  },
  previewContent: {
    padding: 12,
  },
  previewTitle: {
    fontWeight: 600,
    fontSize: '0.95rem',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 1.3,
    display: '-webkit-box',
    '-webkit-line-clamp': 2,
    '-webkit-box-orient': 'vertical',
    overflow: 'hidden',
  },
  previewDescription: {
    fontSize: '0.85rem',
    color: '#64748b',
    lineHeight: 1.4,
    display: '-webkit-box',
    '-webkit-line-clamp': 2,
    '-webkit-box-orient': 'vertical',
    overflow: 'hidden',
    marginBottom: 4,
  },
  previewUrl: {
    fontSize: '0.75rem',
    color: '#005c53',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,1)',
    },
  },
  noImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '0.85rem',
  },
}));

// Regex para detectar URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

const LinkPreviewInput = ({ text, onPreview, onClear }) => {
  const classes = useStyles();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastProcessedUrl = useRef(null);
  
  const debouncedText = useDebounce(text, 800);
  
  const extractUrl = useCallback((text) => {
    if (!text) return null;
    const matches = text.match(URL_REGEX);
    return matches ? matches[0] : null;
  }, []);
  
  useEffect(() => {
    const url = extractUrl(debouncedText);
    
    // Se não há URL, limpa preview
    if (!url) {
      setPreview(null);
      if (onClear) onClear();
      return;
    }
    
    // Evita processar a mesma URL novamente
    if (url === lastProcessedUrl.current && preview) {
      return;
    }
    
    const fetchPreview = async () => {
      setLoading(true);
      
      try {
        const { data } = await api.post('/link-preview', { url });
        
        if (data) {
          const previewData = {
            title: data.title || url,
            description: data.description || '',
            image: data.image || null,
            url: data.url || url,
          };
          
          setPreview(previewData);
          lastProcessedUrl.current = url;
          
          if (onPreview) {
            onPreview(previewData);
          }
        }
      } catch (err) {
        console.log('[LinkPreviewInput] Erro ao buscar preview:', err);
        // Silencioso - não mostra erro ao usuário
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreview();
  }, [debouncedText, extractUrl, onPreview, onClear, preview]);
  
  const handleClose = () => {
    setPreview(null);
    lastProcessedUrl.current = null;
    if (onClear) onClear();
  };
  
  if (!preview && !loading) return null;
  
  if (loading) {
    return (
      <Box className={classes.previewContainer} style={{ padding: 20, textAlign: 'center' }}>
        <CircularProgress size={24} style={{ color: '#005c53' }} />
        <Typography variant="caption" style={{ display: 'block', marginTop: 8, color: '#64748b' }}>
          Carregando preview...
        </Typography>
      </Box>
    );
  }
  
  if (!preview) return null;
  
  return (
    <Paper className={classes.previewContainer} elevation={0}>
      <Box position="relative">
        <IconButton 
          size="small" 
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        
        {preview.image ? (
          <img 
            src={preview.image} 
            alt={preview.title}
            className={classes.previewImage}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <Box className={classes.noImagePlaceholder}>
            <Typography variant="body2">Sem imagem</Typography>
          </Box>
        )}
      </Box>
      
      <Box className={classes.previewContent}>
        <Typography className={classes.previewTitle}>
          {preview.title}
        </Typography>
        
        {preview.description && (
          <Typography className={classes.previewDescription}>
            {preview.description}
          </Typography>
        )}
        
        <Typography className={classes.previewUrl}>
          {new URL(preview.url).hostname}
        </Typography>
      </Box>
    </Paper>
  );
};

export default LinkPreviewInput;
