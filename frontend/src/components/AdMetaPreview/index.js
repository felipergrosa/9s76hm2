import React, { useEffect } from 'react';
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Link as MuiLink } from "@material-ui/core";
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

const AdMetaPreview = ({ image, title, body, sourceUrl, messageUser }) => {
  const classes = useStyles();
  
  useEffect(() => {}, [image, title, body, sourceUrl, messageUser]);

  const handleAdClick = async () => {
    try {
      if (sourceUrl) {
        window.open(sourceUrl, "_blank");
      }
    } catch (err) {
      toastError(err);
    }
  };

  const hasImage = image && image !== "no-image";
  const displayUrl = sourceUrl ? new URL(sourceUrl).hostname : "";

  return (
    <div className={classes.linkPreviewContainer} onClick={handleAdClick}>
      {hasImage && (
        <img 
          src={image} 
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
