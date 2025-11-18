import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  messageMedia: {
    objectFit: "cover",
    marginBottom: 7,
    width: "256px !important",
    height: "256px !important",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    display: "block",
    [theme.breakpoints.down('sm')]: {
      width: "220px !important",
      height: "220px !important",
    },
  },
  stickerMedia: {
    objectFit: "cover",
    maxWidth: "120px !important", // Tamanho fixo pequeno para stickers
    maxHeight: "120px !important",
    width: "auto !important",
    height: "auto !important",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    display: "block",
    [theme.breakpoints.down('sm')]: {
      maxWidth: "100px !important",
      maxHeight: "100px !important",
    },
  },
  mediaWrapper: {
    position: "relative",
    display: "inline-block",
  },
  hdBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 10,
    padding: "2px 4px",
    borderRadius: 3,
    lineHeight: 1,
    zIndex: 2,
    border: theme.mode === 'light' ? "1px solid rgba(255,255,255,0.8)" : "1px solid rgba(255,255,255,0.5)",
    letterSpacing: 0.5,
    userSelect: "none",
    pointerEvents: "none",
  },
}));

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [fetching, setFetching] = useState(true);
	const [blobUrl, setBlobUrl] = useState("");
	const [isHd, setIsHd] = useState(false);
	const [isGif, setIsGif] = useState(false);
	const [isSticker, setIsSticker] = useState(false);

	useEffect(() => {
		if (!imageUrl) return;
		// Detecta GIF pela URL inicial
		const isGifUrl = /\.gif(\?.*)?$/i.test(imageUrl || "");
		// Detecta sticker pela URL (.webp ou .gif pequenos)
		const isStickerUrl = /\.(webp|gif)(\?.*)?$/i.test(imageUrl || "");
		
		setIsGif(isGifUrl);
		setIsSticker(isStickerUrl);
		
		const fetchImage = async () => {
			// Limpar duplicação de caminho se existir
			let cleanUrl = imageUrl;
			if (cleanUrl.includes('/public/company') && cleanUrl.match(/\/public\/company\d+\/public\/company\d+\//)) {
				// Remove a primeira ocorrência de /public/companyX/
				cleanUrl = cleanUrl.replace(/^\/public\/company\d+\//, '/');
			}
			
			const { data, headers } = await api.get(cleanUrl, {
				responseType: "blob",
			});
			const contentType = headers["content-type"] || "";
			if (contentType.includes("gif")) {
				setIsGif(true);
				setIsSticker(true); // GIFs são tratados como stickers
			}
			if (contentType.includes("webp")) {
				setIsSticker(true);
			}
			const url = window.URL.createObjectURL(
				new Blob([data], { type: contentType })
			);
			setBlobUrl(url);
			setFetching(false);
		};
		fetchImage();
	}, [imageUrl]);

	// Checa dimensões da imagem para exibir selo HD
	useEffect(() => {
		const src = blobUrl || imageUrl;
		if (!src) return;
		const img = new Image();
		img.onload = () => {
			setIsHd((img.naturalWidth || 0) >= 1280 && (img.naturalHeight || 0) >= 720);
		};
		img.src = src;
	}, [blobUrl, imageUrl]);

	return (
		<div className={classes.mediaWrapper}>
			{!isGif && isHd && <span className={classes.hdBadge}>HD</span>}
			<ModalImage
				className={isSticker ? classes.stickerMedia : classes.messageMedia}
				smallSrcSet={fetching ? imageUrl : blobUrl}
				medium={fetching ? imageUrl : blobUrl}
				large={fetching ? imageUrl : blobUrl}
				alt={isSticker ? "sticker" : "image"}
				showRotate={true}
			/>
		</div>
	);
};

export default ModalImageCors;
