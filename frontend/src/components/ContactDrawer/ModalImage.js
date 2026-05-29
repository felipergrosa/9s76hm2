import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  messageMedia: {
    objectFit: "cover",
    margin: 15,
    width: 140,
    height: 140,
    borderRadius: 10,
  },
}));

const ModalImageContatc = ({ imageUrl }) => {
  const classes = useStyles();
  const [fetching, setFetching] = useState(true);
  const [blobUrl, setBlobUrl] = useState("");
  

  useEffect(() => {
    if (!imageUrl) return;
    const isExternalUrl = (url) => {
      if (!url) return false;
      return url.includes('whatsapp.net') || url.includes('whatsapp.com') ||
             url.includes('fbcdn.net') || url.includes('instagram.com') ||
             url.includes('pps.') || url.includes('mmg.') ||
             url.includes('amazonaws.com');
    };
    const fetchImage = async () => {
      try {
        if (isExternalUrl(imageUrl)) {
          setBlobUrl(imageUrl);
          setFetching(false);
          return;
        }
        const isAbsoluteUrl = /^https?:\/\//i.test(imageUrl);
        let data, contentType;
        if (isAbsoluteUrl) {
          const response = await fetch(imageUrl, { credentials: 'include' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.blob();
          contentType = response.headers.get('content-type') || 'image/jpeg';
        } else {
          const res = await api.get(imageUrl, { responseType: "blob" });
          data = res.data;
          contentType = res.headers["content-type"] || 'image/jpeg';
        }
        const url = window.URL.createObjectURL(
          new Blob([data], { type: contentType })
        );
        setBlobUrl(url);
        setFetching(false);
      } catch (error) {
        console.error('[ModalImageContact] Erro ao carregar imagem:', error);
        setBlobUrl(imageUrl);
        setFetching(false);
      }
    };
    fetchImage();
  }, [imageUrl]);

  return (
    <>
      {fetching ? (
        <div
          className={classes.messageMedia}
          style={{ backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{ color: '#999', fontSize: 10 }}>...</span>
        </div>
      ) : (
        <ModalImage
          className={classes.messageMedia}
          smallSrcSet={blobUrl}
          medium={blobUrl}
          large={blobUrl}
          showRotate="true"
          alt="image"
        />
      )}
    </>
  );
};


export default ModalImageContatc;