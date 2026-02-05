import React, { useState, useEffect, useRef, useCallback } from 'react';
import { makeStyles, CircularProgress, IconButton } from '@material-ui/core';
import { Play, Image as ImageIcon, FileText, Download } from 'lucide-react';

const useStyles = makeStyles((theme) => ({
  container: {
    position: 'relative',
    display: 'inline-block',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: theme.mode === 'light' ? '#f0f2f5' : '#1d282f',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.mode === 'light' ? '#e9edef' : '#2a3942',
    color: theme.mode === 'light' ? '#8696a0' : '#aebac1',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: theme.mode === 'light' ? '#d1d7db' : '#3b4a54',
    },
  },
  thumbnail: {
    filter: 'blur(8px)',
    transform: 'scale(1.1)',
    transition: 'filter 0.3s ease, transform 0.3s ease',
  },
  thumbnailLoaded: {
    filter: 'blur(0)',
    transform: 'scale(1)',
  },
  fullImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  fullImageLoaded: {
    opacity: 1,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.8)',
    },
  },
  downloadOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
}));

// Gera URL de thumbnail baseado no tipo de mídia
const getThumbnailUrl = (mediaUrl, mediaType) => {
  if (!mediaUrl) return null;
  
  // Se já é uma URL de thumbnail, retorna ela mesma
  if (mediaUrl.includes('thumb_') || mediaUrl.includes('_thumb')) {
    return mediaUrl;
  }
  
  // Para imagens, usa parâmetro de qualidade se o backend suportar
  if (mediaType === 'image') {
    // Verifica se é URL do próprio backend
    if (mediaUrl.includes('/public/') || mediaUrl.includes('/media/')) {
      const separator = mediaUrl.includes('?') ? '&' : '?';
      return `${mediaUrl}${separator}thumb=1&quality=30&maxWidth=200`;
    }
  }
  
  // Para vídeos, tenta usar thumbnail se existir
  if (mediaType === 'video') {
    const ext = mediaUrl.split('.').pop()?.toLowerCase();
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
      return mediaUrl.replace(`.${ext}`, '_thumb.jpg');
    }
  }
  
  return null;
};

const LazyMedia = ({
  src,
  mediaType = 'image',
  alt = '',
  width = 200,
  height = 200,
  onClick,
  className = '',
  showDownload = false,
}) => {
  const classes = useStyles();
  const [isInView, setIsInView] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  // Intersection Observer para detectar quando elemento entra na viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Carrega 100px antes de entrar na viewport
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const thumbnailUrl = getThumbnailUrl(src, mediaType);

  // Carregar imagem completa quando thumbnail estiver carregado
  const loadFullImage = useCallback(() => {
    if (!src || fullLoaded || loading) return;
    
    setLoading(true);
    const img = new Image();
    img.onload = () => {
      setFullLoaded(true);
      setLoading(false);
    };
    img.onerror = () => {
      setError(true);
      setLoading(false);
    };
    img.src = src;
  }, [src, fullLoaded, loading]);

  // Auto-carregar imagem completa após thumbnail
  useEffect(() => {
    if (isInView && thumbnailLoaded && mediaType === 'image') {
      // Delay para dar tempo do thumbnail aparecer
      const timer = setTimeout(loadFullImage, 300);
      return () => clearTimeout(timer);
    }
  }, [isInView, thumbnailLoaded, mediaType, loadFullImage]);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  // Renderização baseada no tipo de mídia
  const renderMedia = () => {
    if (error) {
      return (
        <div
          className={classes.placeholder}
          style={{ width, height }}
          onClick={handleClick}
        >
          <FileText size={32} />
        </div>
      );
    }

    if (!isInView) {
      // Placeholder enquanto não está na viewport
      return (
        <div
          className={classes.placeholder}
          style={{ width, height }}
        >
          {mediaType === 'image' && <ImageIcon size={24} />}
          {mediaType === 'video' && <Play size={24} />}
          {mediaType === 'audio' && <Play size={24} />}
        </div>
      );
    }

    if (mediaType === 'image') {
      return (
        <>
          {/* Thumbnail com blur */}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={alt}
              style={{ width, height, objectFit: 'cover' }}
              className={`${classes.thumbnail} ${thumbnailLoaded ? classes.thumbnailLoaded : ''}`}
              onLoad={() => setThumbnailLoaded(true)}
              onError={() => {
                // Se thumbnail falhar, tenta carregar imagem completa
                setThumbnailLoaded(true);
              }}
            />
          )}
          
          {/* Imagem completa sobreposta */}
          {fullLoaded && (
            <img
              src={src}
              alt={alt}
              className={`${classes.fullImage} ${fullLoaded ? classes.fullImageLoaded : ''}`}
              onClick={handleClick}
            />
          )}
          
          {/* Loader durante carregamento */}
          {loading && (
            <div className={classes.loader}>
              <CircularProgress size={24} color="inherit" />
            </div>
          )}
          
          {/* Fallback se não tiver thumbnail */}
          {!thumbnailUrl && !fullLoaded && (
            <div
              className={classes.placeholder}
              style={{ width, height }}
              onClick={() => loadFullImage()}
            >
              <ImageIcon size={24} />
            </div>
          )}
        </>
      );
    }

    if (mediaType === 'video') {
      return (
        <>
          {/* Thumbnail do vídeo */}
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={alt}
              style={{ width, height, objectFit: 'cover' }}
              className={`${classes.thumbnail} ${thumbnailLoaded ? classes.thumbnailLoaded : ''}`}
              onLoad={() => setThumbnailLoaded(true)}
              onError={() => setThumbnailLoaded(true)}
            />
          ) : (
            <div
              className={classes.placeholder}
              style={{ width, height }}
            >
              <Play size={32} />
            </div>
          )}
          
          {/* Botão de play */}
          <IconButton
            className={classes.playButton}
            onClick={handleClick}
            size="medium"
          >
            <Play size={32} />
          </IconButton>
        </>
      );
    }

    // Fallback para outros tipos
    return (
      <div
        className={classes.placeholder}
        style={{ width, height }}
        onClick={handleClick}
      >
        <FileText size={24} />
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`${classes.container} ${className}`}
      style={{ width, height }}
      onClick={handleClick}
    >
      {renderMedia()}
      
      {showDownload && src && (
        <div className={classes.downloadOverlay}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              window.open(src, '_blank');
            }}
            style={{ color: '#fff', padding: 4 }}
          >
            <Download size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
};

export default React.memo(LazyMedia);
