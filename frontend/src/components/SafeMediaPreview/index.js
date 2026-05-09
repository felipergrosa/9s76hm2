import React, { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * Componente para carregar mídia de forma segura com autenticação/CORS
 * Usa blob URL para evitar problemas de CORS em imagens/vídeos protegidos
 */
const SafeMediaPreview = ({ 
  src, 
  alt = '', 
  type = 'image', // 'image', 'video', 'audio'
  className, 
  style,
  controls = false,
  autoPlay = false,
  muted = false,
  onClick,
  fallbackComponent = null
}) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setLoading(false);
      setError(true);
      return;
    }

    let isMounted = true;
    
    const loadMedia = async () => {
      setLoading(true);
      setError(false);
      
      try {
        // Se for URL externa (WhatsApp, etc), usar diretamente
        if (src.includes('whatsapp.net') || src.includes('fbcdn.net')) {
          if (isMounted) {
            setBlobUrl(src);
            setLoading(false);
          }
          return;
        }

        const isAbsoluteUrl = /^https?:\/\//i.test(src);
        let data, contentType;

        if (isAbsoluteUrl) {
          const response = await fetch(src, { credentials: 'include' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.blob();
          contentType = response.headers.get('content-type') || getDefaultContentType(type);
        } else {
          const res = await api.get(src, { responseType: 'blob' });
          data = res.data;
          contentType = res.headers['content-type'] || getDefaultContentType(type);
        }

        if (isMounted) {
          const objectUrl = window.URL.createObjectURL(new Blob([data], { type: contentType }));
          setBlobUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('[SafeMediaPreview] Erro ao carregar mídia:', err);
        if (isMounted) {
          // Fallback: tenta usar URL direta
          setBlobUrl(src);
          setError(true);
          setLoading(false);
        }
      }
    };

    loadMedia();

    return () => {
      isMounted = false;
      if (blobUrl && blobUrl !== src) {
        window.URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src, type]);

  const getDefaultContentType = (mediaType) => {
    switch (mediaType) {
      case 'video': return 'video/mp4';
      case 'audio': return 'audio/mpeg';
      case 'image':
      default: return 'image/jpeg';
    }
  };

  if (loading) {
    return fallbackComponent || (
      <div 
        className={className} 
        style={{ 
          ...style, 
          backgroundColor: '#e0e0e0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        <span style={{ color: '#999', fontSize: 12 }}>...</span>
      </div>
    );
  }

  if (!blobUrl) {
    return fallbackComponent || (
      <div 
        className={className} 
        style={{ 
          ...style, 
          backgroundColor: '#f5f5f5', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        <span style={{ color: '#999', fontSize: 12 }}>Erro</span>
      </div>
    );
  }

  switch (type) {
    case 'video':
      return (
        <video
          src={blobUrl}
          className={className}
          style={style}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          onClick={onClick}
        />
      );
    case 'audio':
      return (
        <audio
          src={blobUrl}
          className={className}
          style={style}
          controls={controls}
          autoPlay={autoPlay}
        />
      );
    case 'image':
    default:
      return (
        <img
          src={blobUrl}
          alt={alt}
          className={className}
          style={style}
          onClick={onClick}
        />
      );
  }
};

export default SafeMediaPreview;
