import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, IconButton, Tooltip, Chip, Menu, MenuItem, ListItemText } from "@material-ui/core";
import MoreHorizIcon from "@material-ui/icons/MoreHoriz";
import DragIndicatorIcon from "@material-ui/icons/DragIndicator";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 1.5, 0.5),
    backgroundColor: "#fff", // Fundo branco para o header
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
    "&:active": {
      cursor: "grabbing",
    },
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: theme.palette.primary.main,
    display: "none", // Ocultar o ponto, pois já usamos borda no topo
  },
  count: {
    marginLeft: theme.spacing(1),
    fontWeight: 600,
  }
}));

export default function KanbanLaneHeader(props) {
  const { title, label, unreadCount } = props;
  const color = props.color || props.laneColor;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);



  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleHide = () => {
    try {
      const id = props?.id;
      const key = 'kanbanHiddenLanes';
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (id && !arr.includes(id)) {
        arr.push(id);
        localStorage.setItem(key, JSON.stringify(arr));
        window.dispatchEvent(new CustomEvent('kanban:lanesHiddenChanged'));
      }
    } catch (e) { }
    handleClose();
  };
  const handleManage = () => {
    handleClose();
    try {
      window.location.assign('/tagsKanban');
    } catch (e) { }
  };
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (e) { }
    handleClose();
  };
  return (
    <div
      className={classes.header}
      onPointerDown={(e) => {
        // Se clicar no handle de drag, não faz pan (o dnd cuida)
        // Se clicar em botão, não faz pan
        // Caso contrário, faz pan
        const isInteractive = e.target.closest('button,a,input,textarea,select,[role="button"]');
        if (!isInteractive && props.onPanStart) props.onPanStart(e);
      }}
    >
      <div className={classes.left}>
        <div {...props.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <DragIndicatorIcon style={{ color: "#999", fontSize: 20 }} />
        </div>
        <Typography variant="subtitle2" style={{ fontWeight: 800, color: color || "#333", cursor: "grab" }}>{title}</Typography>
        <Chip size="small" label={label} variant="default" style={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }} />
        {typeof unreadCount === 'number' && unreadCount > 0 && (
          <Chip size="small" color="secondary" label={`${unreadCount}`} style={{ height: 20, fontSize: "0.7rem", marginLeft: 4 }} />
        )}
      </div>
      <Tooltip title={i18n.t('kanban.options')}>
        <IconButton
          size="small"
          onPointerDown={(e) => { e.stopPropagation(); }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); handleOpen(e); }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); handleHide(); }}><ListItemText primary={i18n.t('kanban.hideColumn')} /></MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); handleManage(); }}><ListItemText primary={i18n.t('kanban.manageColumns')} /></MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}><ListItemText primary={i18n.t('kanban.copyLink')} /></MenuItem>
      </Menu>
    </div>
  );
}
