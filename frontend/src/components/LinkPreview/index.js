import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  card: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    background: theme.mode === "light" ? "#f5f5f5" : "#1f1f1f",
    border: theme.mode === "light" ? "1px solid #e0e0e0" : "1px solid #333",
    maxWidth: 360,
    textDecoration: "none",
    color: "inherit",
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    objectFit: "cover",
    background: theme.mode === "light" ? "#fff" : "#111",
    border: theme.mode === "light" ? "1px solid #ddd" : "1px solid #222",
    flex: "none",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  domain: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  url: {
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: theme.palette.primary.main,
  },
}));

const getDomain = (url) => {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const isImageUrl = (url = "") => /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url);

const getFavicon = (url) => {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
};

const LinkPreview = ({ url }) => {
  const classes = useStyles();
  const domain = getDomain(url);
  const thumb = isImageUrl(url) ? url : getFavicon(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={classes.card}>
      <img src={thumb} alt="thumb" className={classes.thumb} />
      <div className={classes.info}>
        <span className={classes.domain}>{domain}</span>
        <span className={classes.url}>{url}</span>
      </div>
    </a>
  );
};

export default LinkPreview;
