import React, { useEffect, useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography } from "@material-ui/core";
import { Language as LinkIcon } from "@material-ui/icons";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const previewCache = new Map();

const useStyles = makeStyles((theme) => ({
  linkPreviewContainer: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: "8px",
    overflow: "hidden",
    maxWidth: "400px",
    backgroundColor: theme.palette.background.paper,
    cursor: "pointer",
    transition: "background-color 0.2s",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  linkPreviewImage: {
    width: "100%",
    height: "200px",
    objectFit: "cover",
    display: "block",
  },
  linkPreviewContent: {
    padding: "12px",
  },
  linkPreviewTitle: {
    fontWeight: 500,
    fontSize: "14px",
    marginBottom: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    color: theme.palette.text.primary,
  },
  linkPreviewDescription: {
    fontSize: "13px",
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    marginBottom: "8px",
  },
  linkPreviewUrl: {
    fontSize: "12px",
    color: theme.palette.text.disabled,
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  linkIcon: {
    fontSize: "14px",
  },
}));

const cleanText = value => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value == null) {
    return "";
  }

  return String(value).trim();
};

const isInstagramUrl = sourceUrl => {
  const normalizedUrl = cleanText(sourceUrl);

  if (!normalizedUrl) {
    return false;
  }

  try {
    const hostname = new URL(normalizedUrl).hostname.toLowerCase();
    return hostname === "instagram.com" || hostname.endsWith(".instagram.com") || hostname === "instagr.am";
  } catch (error) {
    return normalizedUrl.includes("instagram.com") || normalizedUrl.includes("instagr.am");
  }
};

const isInlineImage = image => cleanText(image).startsWith("data:image");

const hasUsableImage = image => {
  const normalizedImage = cleanText(image);
  return !!normalizedImage && normalizedImage !== "no-image";
};

const isLowQualityImage = (image, sourceUrl) => {
  const normalizedImage = cleanText(image);

  if (!normalizedImage || normalizedImage === "no-image") {
    return true;
  }

  if (!normalizedImage.startsWith("data:image")) {
    return false;
  }

  if (isInstagramUrl(sourceUrl)) {
    return true;
  }

  const [, payload = ""] = normalizedImage.split(",");
  return cleanText(payload).length < 100000;
};

const shouldUpgradePreview = ({ image, title, sourceUrl }) => {
  const normalizedUrl = cleanText(sourceUrl);
  const normalizedImage = cleanText(image);

  if (!normalizedUrl) {
    return false;
  }

  if (isLowQualityImage(image, normalizedUrl)) {
    return true;
  }

  if (normalizedImage && !isInlineImage(normalizedImage)) {
    return true;
  }

  if (isInstagramUrl(normalizedUrl)) {
    return cleanText(title).toLowerCase() === "instagram";
  }

  return false;
};

const shouldUseCachedPreview = (cachedPreview, sourceUrl) => {
  if (!cachedPreview) {
    return false;
  }

  if (!hasUsableImage(cachedPreview.image)) {
    return false;
  }

  return !shouldUpgradePreview({
    image: cachedPreview.image,
    title: cachedPreview.title,
    sourceUrl: cachedPreview.url || sourceUrl
  });
};

const AdMetaPreview = ({ image, title, body, sourceUrl }) => {
  const classes = useStyles();
  const [resolvedPreview, setResolvedPreview] = useState({
    image,
    title,
    body,
    sourceUrl
  });
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setResolvedPreview({
      image,
      title,
      body,
      sourceUrl
    });
  }, [image, title, body, sourceUrl]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [resolvedPreview.image]);

  useEffect(() => {
    const normalizedUrl = cleanText(sourceUrl);
    if (!shouldUpgradePreview({ image, title, sourceUrl: normalizedUrl })) {
      return undefined;
    }

    const cachedPreview = previewCache.get(normalizedUrl);
    if (shouldUseCachedPreview(cachedPreview, normalizedUrl)) {
      setResolvedPreview(current => ({
        image: cachedPreview.image || current.image,
        title: cachedPreview.title || current.title,
        body: cachedPreview.description || current.body,
        sourceUrl: cachedPreview.url || current.sourceUrl
      }));
      return undefined;
    }

    let active = true;

    const fetchPreview = async () => {
      try {
        const { data } = await api.post("/link-preview", {
          url: normalizedUrl,
          fallbackImage: image
        });

        if (!active || !data) {
          return;
        }

        previewCache.set(normalizedUrl, data);
        setResolvedPreview(current => ({
          image: data.image || current.image,
          title: data.title || current.title,
          body: data.description || current.body,
          sourceUrl: data.url || current.sourceUrl
        }));
      } catch (error) {
        // Preview enriquecido é opcional; não quebramos a UI por isso.
      }
    };

    fetchPreview();

    return () => {
      active = false;
    };
  }, [image, sourceUrl, title]);

  const handleAdClick = async () => {
    try {
      if (resolvedPreview.sourceUrl) {
        window.open(resolvedPreview.sourceUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toastError(err);
    }
  };

  const normalizedImage = cleanText(resolvedPreview.image);
  const hasImage = !!normalizedImage && normalizedImage !== "no-image" && !imageLoadFailed;
  const displayUrl = useMemo(() => {
    try {
      return resolvedPreview.sourceUrl ? new URL(cleanText(resolvedPreview.sourceUrl)).hostname : "";
    } catch (error) {
      return resolvedPreview.sourceUrl || "";
    }
  }, [resolvedPreview.sourceUrl]);

  return (
    <div className={classes.linkPreviewContainer} onClick={handleAdClick}>
      {hasImage && (
        <img
          src={normalizedImage}
          alt="Link preview"
          className={classes.linkPreviewImage}
          onError={() => {
            setImageLoadFailed(true);
          }}
        />
      )}
      <div className={classes.linkPreviewContent}>
        {resolvedPreview.title && (
          <Typography className={classes.linkPreviewTitle}>
            {resolvedPreview.title}
          </Typography>
        )}
        {resolvedPreview.body && (
          <Typography className={classes.linkPreviewDescription}>
            {resolvedPreview.body}
          </Typography>
        )}
        {displayUrl && (
          <div className={classes.linkPreviewUrl}>
            <LinkIcon className={classes.linkIcon} />
            <span>{displayUrl}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdMetaPreview;
