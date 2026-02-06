import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Typography, CircularProgress } from '@mui/material';

// Configura worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * Componente de preview de PDF com lazy loading
 * Carregado apenas quando um PDF é selecionado
 */
const PDFPreview = ({ file, className }) => {
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = () => {
    setError(true);
    setLoading(false);
  };

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
        }}
        className={className}
      >
        <Typography variant="h6" color="textSecondary">
          Não foi possível carregar o PDF
        </Typography>
        <Typography variant="body2">{file.name}</Typography>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '400px',
          position: 'relative',
        }}
        className={className}
      >
        {loading && (
          <div style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}>
            <CircularProgress />
          </div>
        )}
        <Document
          file={URL.createObjectURL(file)}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          <Page
            pageNumber={1}
            width={200}
            height={300}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className={className}
      >
        <Typography variant="h6">{file.name}</Typography>
        {numPages && (
          <Typography variant="body2" style={{ marginLeft: 8 }}>
            ({numPages} {numPages === 1 ? 'página' : 'páginas'})
          </Typography>
        )}
      </div>
    </>
  );
};

export default PDFPreview;
