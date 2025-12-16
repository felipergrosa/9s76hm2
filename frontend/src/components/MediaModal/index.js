import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@material-ui/core";
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  GetApp as DownloadIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Reply as ReplyIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  SentimentSatisfiedAlt as EmojiIcon,
  OpenInNew as OpenInNewIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from "@material-ui/icons";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  modal: {
    "& .MuiDialog-paper": {
      backgroundColor: "#0b141a",
      margin: 0,
      maxWidth: "100%",
      maxHeight: "100%",
      width: "100%",
      height: "100%",
      borderRadius: 0,
    },
    "& .MuiBackdrop-root": {
      backgroundColor: "rgba(0, 0, 0, 0.95)",
    },
  },
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    backgroundColor: "#0b141a",
  },
  // Header com info do contato e botões
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    backgroundColor: "#202c33",
    borderBottom: "1px solid #2a3942",
    minHeight: 56,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "#6b7c85",
  },
  contactInfo: {
    display: "flex",
    flexDirection: "column",
  },
  contactName: {
    color: "#e9edef",
    fontSize: 16,
    fontWeight: 500,
  },
  mediaDate: {
    color: "#8696a0",
    fontSize: 13,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  headerIcon: {
    color: "#aebac1",
    padding: 8,
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
  },
  // Área principal da imagem
  mainContent: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0b141a",
  },
  mediaContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "calc(100% - 120px)",
    maxHeight: "calc(100% - 40px)",
    position: "relative",
  },
  mediaImage: {
    maxWidth: "100%",
    maxHeight: "calc(100vh - 200px)",
    objectFit: "contain",
    transition: "transform 0.2s ease",
    userSelect: "none",
  },
  mediaVideo: {
    maxWidth: "100%",
    maxHeight: "calc(100vh - 200px)",
    objectFit: "contain",
  },
  // Setas de navegação
  navButton: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#fff",
    width: 50,
    height: 50,
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    zIndex: 10,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  // Carrossel de miniaturas
  thumbnailsContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 16px",
    backgroundColor: "#111b21",
    borderTop: "1px solid #2a3942",
    gap: 8,
    overflowX: "auto",
    "&::-webkit-scrollbar": {
      height: 6,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "#374045",
      borderRadius: 3,
    },
  },
  thumbnailWrapper: {
    position: "relative",
    flexShrink: 0,
  },
  thumbnail: {
    width: 56,
    height: 56,
    objectFit: "cover",
    borderRadius: 4,
    cursor: "pointer",
    opacity: 0.6,
    transition: "all 0.2s ease",
    border: "2px solid transparent",
    "&:hover": {
      opacity: 0.9,
    },
  },
  thumbnailActive: {
    opacity: 1,
    border: "2px solid #00a884",
  },
  thumbnailVideo: {
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 0,
      height: 0,
      borderLeft: "10px solid #fff",
      borderTop: "6px solid transparent",
      borderBottom: "6px solid transparent",
    },
  },
  videoDuration: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "#fff",
    fontSize: 10,
    padding: "1px 4px",
    borderRadius: 2,
  },
  // Loading
  loading: {
    color: "#00a884",
  },
  // Zoom controls
  zoomControls: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: "4px 12px",
    borderRadius: 20,
  },
  zoomLevel: {
    color: "#fff",
    fontSize: 14,
    minWidth: 50,
    textAlign: "center",
  },
}));

const MediaModal = ({ 
  open, 
  onClose, 
  mediaUrl, 
  mediaType = "image",
  message,
  allMedia = [],
  contactName = "",
  contactAvatar = "",
  mediaDate = "",
}) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const imageRef = useRef(null);
  
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const { setShowSelectMessageCheckbox, setSelectedMessages, setForwardMessageModalOpen } = useContext(ForwardMessageContext);

  // Encontrar índice atual na lista de mídias
  useEffect(() => {
    if (allMedia.length > 0 && mediaUrl) {
      const index = allMedia.findIndex(m => m.mediaUrl === mediaUrl);
      if (index >= 0) {
        setCurrentIndex(index);
      }
    }
  }, [allMedia, mediaUrl]);

  // Carregar mídia atual
  useEffect(() => {
    if (!open) return;
    
    const currentMedia = allMedia[currentIndex] || { mediaUrl };
    const url = currentMedia.mediaUrl;
    
    if (!url) return;
    
    setLoading(true);
    setZoom(1);
    
    const fetchMedia = async () => {
      try {
        const isAbsoluteUrl = /^https?:\/\//i.test(url);
        let data, contentType;
        
        if (isAbsoluteUrl) {
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.blob();
          contentType = response.headers.get("content-type") || "image/jpeg";
        } else {
          const res = await api.get(url, { responseType: "blob" });
          data = res.data;
          contentType = res.headers["content-type"] || "image/jpeg";
        }
        
        const blobUrl = window.URL.createObjectURL(new Blob([data], { type: contentType }));
        setBlobUrl(blobUrl);
        setLoading(false);
      } catch (error) {
        console.error('[MediaModal] Erro ao carregar mídia:', error);
        setBlobUrl(url);
        setLoading(false);
      }
    };
    
    fetchMedia();
    
    return () => {
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl);
      }
    };
  }, [open, currentIndex, allMedia, mediaUrl]);

  // Navegação por teclado
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, allMedia.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < allMedia.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, allMedia.length]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = () => {
    const currentMedia = allMedia[currentIndex] || { mediaUrl };
    const url = blobUrl || currentMedia.mediaUrl;
    const link = document.createElement('a');
    link.href = url;
    link.download = `media_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReply = () => {
    const currentMedia = allMedia[currentIndex];
    if (currentMedia && setReplyingMessage) {
      setReplyingMessage(currentMedia);
      onClose();
    }
  };

  const handleForward = () => {
    const currentMedia = allMedia[currentIndex];
    if (currentMedia) {
      setSelectedMessages([currentMedia]);
      setShowSelectMessageCheckbox(true);
      setForwardMessageModalOpen(true);
      onClose();
    }
  };

  const handleOpenInNew = () => {
    const url = blobUrl || mediaUrl;
    window.open(url, '_blank');
  };

  const handleThumbnailClick = (index) => {
    setCurrentIndex(index);
  };

  const currentMedia = allMedia[currentIndex] || { mediaUrl, mediaType };
  const isVideo = currentMedia.mediaType === "video";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      className={classes.modal}
    >
      <div className={classes.container}>
        {/* Header */}
        <div className={classes.header}>
          <div className={classes.headerLeft}>
            {contactAvatar && (
              <img src={contactAvatar} alt="" className={classes.contactAvatar} />
            )}
            <div className={classes.contactInfo}>
              <span className={classes.contactName}>{contactName || "Mídia"}</span>
              <span className={classes.mediaDate}>{mediaDate}</span>
            </div>
          </div>
          
          <div className={classes.headerRight}>
            <Tooltip title="Pesquisar">
              <IconButton className={classes.headerIcon} size="small">
                <SearchIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Zoom +">
              <IconButton className={classes.headerIcon} size="small" onClick={handleZoomIn}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Ir para a mensagem">
              <IconButton className={classes.headerIcon} size="small">
                <ArrowForwardIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Responder">
              <IconButton className={classes.headerIcon} size="small" onClick={handleReply}>
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Favoritar">
              <IconButton className={classes.headerIcon} size="small" onClick={() => setIsFavorite(!isFavorite)}>
                {isFavorite ? <StarIcon style={{ color: "#f5c518" }} /> : <StarBorderIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Fixar">
              <IconButton className={classes.headerIcon} size="small">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                </svg>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Reagir">
              <IconButton className={classes.headerIcon} size="small">
                <EmojiIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Encaminhar">
              <IconButton className={classes.headerIcon} size="small" onClick={handleForward}>
                <ReplyIcon style={{ transform: "scaleX(-1)" }} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Salvar como...">
              <IconButton className={classes.headerIcon} size="small" onClick={handleDownload}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Abrir em nova janela">
              <IconButton className={classes.headerIcon} size="small" onClick={handleOpenInNew}>
                <OpenInNewIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Mais opções">
              <IconButton className={classes.headerIcon} size="small">
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Fechar">
              <IconButton className={classes.headerIcon} size="small" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Área principal */}
        <div className={classes.mainContent}>
          {/* Seta esquerda */}
          {allMedia.length > 1 && currentIndex > 0 && (
            <IconButton
              className={`${classes.navButton} ${classes.navButtonLeft}`}
              onClick={handlePrev}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
          )}

          {/* Mídia */}
          <div className={classes.mediaContainer}>
            {loading ? (
              <CircularProgress className={classes.loading} size={60} />
            ) : isVideo ? (
              <video
                src={blobUrl}
                className={classes.mediaVideo}
                controls
                autoPlay
              />
            ) : (
              <img
                ref={imageRef}
                src={blobUrl}
                alt=""
                className={classes.mediaImage}
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
              />
            )}
          </div>

          {/* Seta direita */}
          {allMedia.length > 1 && currentIndex < allMedia.length - 1 && (
            <IconButton
              className={`${classes.navButton} ${classes.navButtonRight}`}
              onClick={handleNext}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
          )}

          {/* Controles de zoom */}
          {!isVideo && zoom !== 1 && (
            <div className={classes.zoomControls}>
              <IconButton size="small" onClick={handleZoomOut} style={{ color: "#fff" }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
              <span className={classes.zoomLevel}>{Math.round(zoom * 100)}%</span>
              <IconButton size="small" onClick={handleZoomIn} style={{ color: "#fff" }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </div>
          )}
        </div>

        {/* Carrossel de miniaturas */}
        {allMedia.length > 1 && (
          <div className={classes.thumbnailsContainer}>
            {allMedia.map((media, index) => (
              <div key={media.id || index} className={classes.thumbnailWrapper}>
                {media.mediaType === "video" ? (
                  <>
                    <video
                      src={media.mediaUrl}
                      className={`${classes.thumbnail} ${index === currentIndex ? classes.thumbnailActive : ""}`}
                      onClick={() => handleThumbnailClick(index)}
                      muted
                    />
                    <span className={classes.videoDuration}>
                      {media.duration || "0:00"}
                    </span>
                  </>
                ) : (
                  <img
                    src={media.mediaUrl}
                    alt=""
                    className={`${classes.thumbnail} ${index === currentIndex ? classes.thumbnailActive : ""}`}
                    onClick={() => handleThumbnailClick(index)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default MediaModal;
