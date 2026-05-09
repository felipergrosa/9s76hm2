import React, { useState, useEffect } from 'react';
import { Modal, makeStyles, Backdrop, Fade, IconButton, Typography, Box } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import GetAppIcon from '@material-ui/icons/GetApp';
import api from '../../services/api';

const useStyles = makeStyles((theme) => ({
  modal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paper: {
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: 0,
    outline: 'none',
    maxWidth: '95vw',
    maxHeight: '95vh',
    overflow: 'hidden',
    borderRadius: '8px',
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.grey[50],
  },
  content: {
    padding: theme.spacing(2),
    maxHeight: 'calc(95vh - 64px)',
    overflow: 'auto',
  },
  pdfViewer: {
    width: '100%',
    height: '80vh',
    border: 'none',
  },
  media: {
    maxWidth: '100%',
    maxHeight: '80vh',
    objectFit: 'contain',
  },
}));

const MediaViewerModal = ({ open, onClose, url, mediaType, name }) => {
  const classes = useStyles();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega mídia como blob para evitar problemas de CORS/autenticação
  useEffect(() => {
    if (!url || !open) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadMedia = async () => {
      setLoading(true);
      try {
        const isAbsoluteUrl = /^https?:\/\//i.test(url);
        let data, contentType;

        if (isAbsoluteUrl) {
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.blob();
          contentType = response.headers.get('content-type') || mediaType || 'application/octet-stream';
        } else {
          const res = await api.get(url, { responseType: 'blob' });
          data = res.data;
          contentType = res.headers['content-type'] || mediaType || 'application/octet-stream';
        }

        if (isMounted) {
          const objectUrl = window.URL.createObjectURL(new Blob([data], { type: contentType }));
          setBlobUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('[MediaViewerModal] Erro ao carregar mídia:', err);
        if (isMounted) {
          // Fallback: tenta usar URL direta
          setBlobUrl(url);
          setLoading(false);
        }
      }
    };

    loadMedia();

    return () => {
      isMounted = false;
      if (blobUrl && blobUrl !== url) {
        window.URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url, open, mediaType]);

  const handleDownload = async () => {
    try {
      const isAbsoluteUrl = /^https?:\/\//i.test(url);
      let blob;

      if (isAbsoluteUrl) {
        const response = await fetch(url, { credentials: 'include' });
        blob = await response.blob();
      } else {
        const res = await api.get(url, { responseType: 'blob' });
        blob = res.data;
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = name || 'arquivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('[MediaViewerModal] Erro no download:', err);
      // Fallback: tenta download direto
      const link = document.createElement('a');
      link.href = url;
      link.download = name || 'arquivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderMedia = () => {
    if (loading) {
      return (
        <Box display="flex" alignItems="center" justifyContent="center" height="200px">
          <Typography color="textSecondary">Carregando...</Typography>
        </Box>
      );
    }

    if (!blobUrl) return null;

    if (mediaType?.startsWith('image/')) {
      return <img src={blobUrl} alt={name} className={classes.media} />;
    }
    if (mediaType?.startsWith('audio/')) {
      return <audio src={blobUrl} controls autoPlay className={classes.media} style={{ width: '100%' }} />;
    }
    if (mediaType?.startsWith('video/')) {
      return <video src={blobUrl} controls autoPlay className={classes.media} />;
    }
    if (mediaType === 'application/pdf') {
      return (
        <iframe
          src={url}
          className={classes.pdfViewer}
          title={name}
        />
      );
    }
    if (mediaType === 'text/plain') {
      return (
        <iframe
          src={url}
          className={classes.pdfViewer}
          title={name}
          style={{ backgroundColor: 'white' }}
        />
      );
    }
    // Outros tipos: mostra informações do arquivo
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Typography variant="h6" gutterBottom>{name}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Tipo: {mediaType}
        </Typography>
        <Typography variant="body2" style={{ marginTop: '20px' }}>
          Este tipo de arquivo não pode ser visualizado no navegador.
          Use o botão de download para baixar o arquivo.
        </Typography>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={classes.modal}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 500,
      }}
    >
      <Fade in={open}>
        <div className={classes.paper}>
          <div className={classes.header}>
            <Typography variant="h6" noWrap style={{ flex: 1 }}>
              {name || 'Arquivo'}
            </Typography>
            <div>
              <IconButton onClick={handleDownload} size="small" title="Baixar arquivo">
                <GetAppIcon />
              </IconButton>
              <IconButton onClick={onClose} size="small" title="Fechar">
                <CloseIcon />
              </IconButton>
            </div>
          </div>
          <div className={classes.content}>
            {renderMedia()}
          </div>
        </div>
      </Fade>
    </Modal>
  );
};

export default MediaViewerModal;
