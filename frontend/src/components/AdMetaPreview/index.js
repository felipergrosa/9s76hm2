import React from 'react';
import { makeStyles } from "@material-ui/core/styles";
import { Typography } from "@material-ui/core";
import { Language as LinkIcon } from "@material-ui/icons";
import toastError from "../../errors/toastError";

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

const AdMetaPreview = ({ image, title, body, sourceUrl }) => {
  const classes = useStyles();

  const handleAdClick = async () => {
    try {
      if (sourceUrl) {
        window.open(sourceUrl, "_blank");
      }
    } catch (err) {
      toastError(err);
    }
  };

  const normalizedImage = typeof image === "string" ? image.trim() : image;
  const hasImage = !!normalizedImage && normalizedImage !== "no-image";
  const displayUrl = (() => {
    try {
      return sourceUrl ? new URL(sourceUrl.trim()).hostname : "";
    } catch (error) {
      return sourceUrl || "";
    }
  })();

  return (
    <div className={classes.linkPreviewContainer} onClick={handleAdClick}>
      {hasImage && (
        <img 
          src={normalizedImage} 
          alt="Link preview" 
          className={classes.linkPreviewImage}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <div className={classes.linkPreviewContent}>
        {title && (
          <Typography className={classes.linkPreviewTitle}>
            {title}
          </Typography>
        )}
        {body && (
          <Typography className={classes.linkPreviewDescription}>
            {body}
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
