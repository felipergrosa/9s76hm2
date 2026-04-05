import React, { useMemo, useState } from "react";
import { Button, Divider, Typography, makeStyles } from "@material-ui/core";

import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    minWidth: 250,
    maxWidth: 320,
    overflow: "hidden",
  },
  previewButton: {
    padding: 0,
    borderRadius: 8,
    overflow: "hidden",
    width: "100%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "block",
  },
  previewImage: {
    display: "block",
    width: "100%",
    maxHeight: 180,
    objectFit: "cover",
    backgroundColor: theme.palette.action.hover,
  },
  previewFallback: {
    width: "100%",
    height: 160,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #d7efe4 0%, #c6e5d5 100%)",
    color: theme.palette.text.secondary,
    fontSize: 42,
  },
  description: {
    padding: theme.spacing(1.5, 1.5, 1),
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  actionButton: {
    borderRadius: 0,
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

const extractCoordinates = (link, description) => {
  const tryParseCoordinates = value => {
    const rawValue = cleanText(value);
    let normalized = rawValue;

    try {
      normalized = decodeURIComponent(rawValue);
    } catch (error) {
      normalized = rawValue;
    }

    if (!normalized) return null;

    try {
      const url = new URL(normalized);
      const queryCandidate = url.searchParams.get("q") || url.searchParams.get("query");
      const queryMatch = queryCandidate?.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (queryMatch) {
        return {
          latitude: queryMatch[1],
          longitude: queryMatch[2],
        };
      }
    } catch (error) {
      // Não era URL válida; seguimos para regex livre.
    }

    const rawMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!rawMatch) {
      return null;
    }

    return {
      latitude: rawMatch[1],
      longitude: rawMatch[2],
    };
  };

  return tryParseCoordinates(link) || tryParseCoordinates(description);
};

const hasUsableImage = value => {
  const normalized = cleanText(value);

  if (!normalized || normalized === "no-image") {
    return false;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return true;
  }

  if (!normalized.startsWith("data:image")) {
    return false;
  }

  const [, payload = ""] = normalized.split(",");
  return cleanText(payload).length > 16;
};

const buildStaticMapUrl = coordinates => {
  if (!coordinates?.latitude || !coordinates?.longitude) {
    return "";
  }

  const { latitude, longitude } = coordinates;
  const marker = `${latitude},${longitude},red-pushpin`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=16&size=640x320&markers=${marker}`;
};

const LocationPreview = ({ image, link, description }) => {
  const classes = useStyles();
  const [imageFailed, setImageFailed] = useState(false);

  const coordinates = useMemo(() => {
    return extractCoordinates(link, description);
  }, [link, description]);

  const locationHref = useMemo(() => {
    const normalizedLink = cleanText(link);
    if (normalizedLink) {
      return normalizedLink;
    }

    if (!coordinates?.latitude || !coordinates?.longitude) {
      return "";
    }

    return `https://maps.google.com/?q=${coordinates.latitude},${coordinates.longitude}`;
  }, [coordinates, link]);

  const previewImage = useMemo(() => {
    if (!imageFailed && hasUsableImage(image)) {
      return cleanText(image);
    }

    return buildStaticMapUrl(coordinates);
  }, [coordinates, image, imageFailed]);

  const descriptionText = useMemo(() => {
    const normalizedDescription = cleanText(description);
    if (normalizedDescription) {
      return normalizedDescription;
    }

    if (!coordinates?.latitude || !coordinates?.longitude) {
      return "";
    }

    return `${coordinates.latitude}, ${coordinates.longitude}`;
  }, [coordinates, description]);

  const handleLocation = async () => {
    try {
      if (!locationHref) return;
      window.open(locationHref, "_blank", "noopener,noreferrer");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <button
        type="button"
        className={classes.previewButton}
        onClick={handleLocation}
        disabled={!locationHref}
      >
        {previewImage ? (
          <img
            src={previewImage}
            alt="Mapa"
            className={classes.previewImage}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={classes.previewFallback}>📍</div>
        )}
      </button>

      {descriptionText && (
        <Typography variant="body2" color="textSecondary" className={classes.description}>
          {descriptionText}
        </Typography>
      )}

      <Divider />

      <Button
        fullWidth
        color="primary"
        onClick={handleLocation}
        disabled={!locationHref}
        className={classes.actionButton}
      >
        Visualizar
      </Button>
    </div>
  );
};

export default LocationPreview;
