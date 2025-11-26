import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Box,
    Typography,
    CircularProgress
} from '@material-ui/core';
import {
    Close as CloseIcon,
    GetApp as DownloadIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    Error as ErrorIcon
} from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';
import { Document, Page, pdfjs } from 'react-pdf';

// Configurar worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const useStyles = makeStyles((theme) => ({
    dialog: {
        '& .MuiDialog-paper': {
            maxWidth: '70vw',
            width: '70vw',
            maxHeight: '85vh'
        }
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}`
    },
    content: {
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        minHeight: 500,
        overflow: 'auto'
    },
    pdfContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: theme.spacing(2)
    },
    pdfPage: {
        marginBottom: theme.spacing(2),
        boxShadow: theme.shadows[2]
    },
    iframe: {
        width: '100%',
        height: '70vh',
        border: 'none'
    },
    image: {
        maxWidth: '100%',
        maxHeight: '70vh',
        objectFit: 'contain'
    },
    video: {
        maxWidth: '100%',
        maxHeight: '70vh'
    },
    audio: {
        width: '100%',
        maxWidth: 600
    },
    unsupported: {
        textAlign: 'center',
        padding: theme.spacing(4)
    },
    navigation: {
        display: 'flex',
        gap: theme.spacing(1),
        alignItems: 'center'
    },
    pdfControls: {
        display: 'flex',
        gap: theme.spacing(2),
        alignItems: 'center',
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'sticky',
        top: 0,
        zIndex: 1
    },
    errorBox: {
        padding: theme.spacing(4),
        textAlign: 'center'
    }
}));

const FileViewerModal = ({ open, onClose, file, files = [], onNavigate }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);

    if (!file) return null;

    const currentIndex = files.findIndex(f => f.id === file.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < files.length - 1;

    const handlePrev = () => {
        if (hasPrev && onNavigate) {
            setError(null);
            setLoading(true);
            setPageNumber(1);
            onNavigate(files[currentIndex - 1]);
        }
    };

    const handleNext = () => {
        if (hasNext && onNavigate) {
            setError(null);
            setLoading(true);
            setPageNumber(1);
            onNavigate(files[currentIndex + 1]);
        }
    };

    const handleDownload = async () => {
        const url = file.fileOption?.url;
        if (!url) return;

        try {
            const response = await fetch(url, { credentials: 'include' });
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.title || file.fileOption?.name || 'arquivo';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Erro ao baixar arquivo da biblioteca:', err);
        }
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setLoading(false);
    };

    const onDocumentLoadError = (error) => {
        console.error('Error loading PDF:', error);
        setError('Erro ao carregar PDF');
        setLoading(false);
    };

    const renderContent = () => {
        const fileUrl = file.fileOption?.url;
        const mediaType = file.fileOption?.mediaType?.toLowerCase() || '';
        const fileName = file.title?.toLowerCase() || '';

        if (!fileUrl) {
            return (
                <Box className={classes.unsupported}>
                    <ErrorIcon style={{ fontSize: 64, color: '#ccc', marginBottom: 16 }} />
                    <Typography variant="h6" gutterBottom>Arquivo não disponível</Typography>
                    <Typography color="textSecondary">URL do arquivo não encontrada</Typography>
                </Box>
            );
        }

        // PDF com react-pdf
        if (mediaType.includes('pdf') || fileName.endsWith('.pdf')) {
            if (error) {
                return (
                    <Box className={classes.errorBox}>
                        <ErrorIcon style={{ fontSize: 64, color: '#f44336', marginBottom: 16 }} />
                        <Typography variant="h6" gutterBottom color="error">
                            {error}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownload}
                            style={{ marginTop: 16 }}
                        >
                            Baixar PDF
                        </Button>
                    </Box>
                );
            }

            return (
                <>
                    <Box className={classes.pdfControls}>
                        <Button
                            size="small"
                            disabled={pageNumber <= 1}
                            onClick={() => setPageNumber(pageNumber - 1)}
                        >
                            Anterior
                        </Button>
                        <Typography variant="body2">
                            Página {pageNumber} de {numPages || '...'}
                        </Typography>
                        <Button
                            size="small"
                            disabled={pageNumber >= numPages}
                            onClick={() => setPageNumber(pageNumber + 1)}
                        >
                            Próxima
                        </Button>
                    </Box>
                    <Box className={classes.pdfContainer}>
                        {loading && <CircularProgress />}
                        <Document
                            file={fileUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={<CircularProgress />}
                        >
                            <Page
                                pageNumber={pageNumber}
                                className={classes.pdfPage}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                            />
                        </Document>
                    </Box>
                </>
            );
        }

        // Imagem
        if (mediaType.includes('image')) {
            return (
                <img
                    src={fileUrl}
                    alt={file.title}
                    className={classes.image}
                    onLoad={() => setLoading(false)}
                    onError={() => setError('Erro ao carregar imagem')}
                />
            );
        }

        // Vídeo
        if (mediaType.includes('video')) {
            return (
                <video
                    controls
                    className={classes.video}
                    onLoadedMetadata={() => setLoading(false)}
                    onError={() => setError('Erro ao carregar vídeo')}
                >
                    <source src={fileUrl} type={mediaType} />
                    Seu navegador não suporta reprodução de vídeo.
                </video>
            );
        }

        // Áudio
        if (mediaType.includes('audio')) {
            return (
                <Box className={classes.audio}>
                    <Typography variant="h6" gutterBottom align="center">
                        {file.title}
                    </Typography>
                    <audio
                        controls
                        style={{ width: '100%' }}
                        onLoadedMetadata={() => setLoading(false)}
                        onError={() => setError('Erro ao carregar áudio')}
                    >
                        <source src={fileUrl} type={mediaType} />
                        Seu navegador não suporta reprodução de áudio.
                    </audio>
                </Box>
            );
        }

        // Documentos do Office via Google Docs Viewer
        if (mediaType.includes('word') || mediaType.includes('document') ||
            mediaType.includes('excel') || mediaType.includes('sheet') ||
            mediaType.includes('powerpoint') || mediaType.includes('presentation') ||
            fileName.endsWith('.doc') || fileName.endsWith('.docx') ||
            fileName.endsWith('.xls') || fileName.endsWith('.xlsx') ||
            fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
            const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
            return (
                <iframe
                    src={viewerUrl}
                    className={classes.iframe}
                    title={file.title}
                    onLoad={() => setLoading(false)}
                />
            );
        }

        // Texto puro
        if (mediaType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
            return (
                <iframe
                    src={fileUrl}
                    className={classes.iframe}
                    title={file.title}
                    onLoad={() => setLoading(false)}
                />
            );
        }

        // Formato não suportado
        return (
            <Box className={classes.unsupported}>
                <ErrorIcon style={{ fontSize: 64, color: '#ccc', marginBottom: 16 }} />
                <Typography variant="h6" gutterBottom>Visualização não disponível</Typography>
                <Typography color="textSecondary" paragraph>
                    Este tipo de arquivo ({mediaType || 'desconhecido'}) não pode ser visualizado no navegador.
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                >
                    Baixar Arquivo
                </Button>
            </Box>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={false}
            className={classes.dialog}
        >
            <DialogTitle className={classes.header}>
                <Typography variant="h6" noWrap style={{ maxWidth: '60%' }}>
                    {file.title}
                </Typography>
                <Box className={classes.navigation}>
                    {files.length > 1 && (
                        <>
                            <IconButton size="small" onClick={handlePrev} disabled={!hasPrev}>
                                <PrevIcon />
                            </IconButton>
                            <Typography variant="body2" color="textSecondary">
                                {currentIndex + 1} de {files.length}
                            </Typography>
                            <IconButton size="small" onClick={handleNext} disabled={!hasNext}>
                                <NextIcon />
                            </IconButton>
                        </>
                    )}
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent className={classes.content}>
                {loading && !error && (
                    <CircularProgress style={{ position: 'absolute', top: '50%', left: '50%' }} />
                )}
                {renderContent()}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleDownload} startIcon={<DownloadIcon />}>
                    Download
                </Button>
                <Button onClick={onClose}>Fechar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default FileViewerModal;
