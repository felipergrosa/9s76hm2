import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import api from '../../services/api';
import AdMetaPreview from '../AdMetaPreview';

const useStyles = makeStyles((theme) => ({
  previewContainer: {
    marginBottom: 8,
    maxWidth: 400,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 2,
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,1)',
    },
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
    <Box className={classes.previewContainer}>
      <IconButton
        size="small"
        className={classes.closeButton}
        onClick={handleClose}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <AdMetaPreview
        image={preview.image}
        title={preview.title}
        body={preview.description}
        sourceUrl={preview.url}
      />
    </Box>
  );
};

export default LinkPreviewInput;
