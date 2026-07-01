import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Chip, CircularProgress,
  Tooltip, Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Avatar
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Close as CloseIcon, TrendingUp as PipelineIcon,
  AttachMoney as MoneyIcon
} from "@material-ui/icons";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  root: { display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" },

  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 24px",
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: "#fff",
    flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerTitle: { fontWeight: 700, fontSize: 18, color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  totalBadge: {
    background: "rgba(255,255,255,0.15)", borderRadius: 20,
    padding: "4px 12px", fontSize: 13, fontWeight: 600, color: "#fff",
    backdropFilter: "blur(4px)"
  },

  board: { display: "flex", flex: 1, overflowX: "auto", padding: "16px 12px 20px", gap: 12 },

  lane: {
    display: "flex", flexDirection: "column",
    minWidth: 272, maxWidth: 272,
    background: theme.palette.type === "dark" ? "#1e1e1e" : "#f0f2f5",
    borderRadius: 12, flexShrink: 0,
    overflow: "hidden",
  },
  laneHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px", flexShrink: 0,
  },
  laneLeft: { display: "flex", alignItems: "center", gap: 8 },
  laneDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  laneTitle: { fontWeight: 700, fontSize: 13 },
  laneCount: {
    background: "rgba(0,0,0,0.12)", borderRadius: 10,
    padding: "1px 7px", fontSize: 11, fontWeight: 600,
  },
  laneValue: { fontSize: 11, opacity: 0.65, marginTop: 1, fontWeight: 500 },
  laneActions: { display: "flex", alignItems: "center", gap: 2 },

  cardsContainer: { flex: 1, overflowY: "auto", padding: "0 8px 8px" },
  droppingOver: { background: theme.palette.type === "dark" ? "#2a2a2a" : "#e4e8ed" },

  card: {
    background: theme.palette.type === "dark" ? "#2d2d2d" : "#fff",
    borderRadius: 8,
    padding: "12px 14px 10px",
    marginBottom: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    cursor: "grab",
    borderLeft: "3px solid transparent",
    transition: "box-shadow 0.15s, transform 0.12s",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      transform: "translateY(-1px)",
    },
    "&:active": { cursor: "grabbing" },
  },
  cardDragging: { boxShadow: "0 12px 28px rgba(0,0,0,0.22)", transform: "rotate(1.5deg) scale(1.02)" },
  cardTitle: { fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 6 },
  cardValue: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "#e8f5e9", color: "#2e7d32",
    borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700,
    marginBottom: 6,
  },
  cardValueDark: { background: "#1b3a1f", color: "#81c784" },
  cardContact: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 },
  contactAvatar: {
    width: 18, height: 18, fontSize: 9, fontWeight: 700,
    background: "var(--primaryColor, #065183)", color: "#fff",
  },
  contactName: { fontSize: 11, color: theme.palette.text.secondary, lineHeight: 1 },
  cardDate: { fontSize: 10, color: theme.palette.text.disabled, marginTop: 4 },
  cardActions: { display: "flex", gap: 2, flexShrink: 0 },

  addCardBtn: {
    margin: "4px 8px 8px",
    color: theme.palette.text.secondary,
    justifyContent: "flex-start",
    textTransform: "none",
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
  },

  addLaneBtn: {
    minWidth: 248, height: 56,
    borderRadius: 12,
    border: `2px dashed ${theme.palette.divider}`,
    color: theme.palette.text.disabled,
    textTransform: "none",
    flexShrink: 0,
    fontSize: 13,
  },

  emptyBoard: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 16,
    color: theme.palette.text.secondary,
  },
  emptyIcon: { fontSize: 64, opacity: 0.2 },
}));

const COLORS = ["#1976d2", "#388e3c", "#f57c00", "#d32f2f", "#7b1fa2", "#0288d1", "#455a64", "#c2185b"];

const emptyDeal = { title: "", contactId: "", value: "", description: "", stageId: "" };
const emptyStage = { name: "", color: COLORS[0] };

function fmtBRL(val) {
  if (!val && val !== 0) return "";
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeAgo(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function LaneSkeleton() {
  return (
    <Box style={{ minWidth: 272, maxWidth: 272, borderRadius: 12, overflow: "hidden", background: "#f0f2f5", flexShrink: 0 }}>
      <Skeleton variant="rect" height={52} />
      <Box style={{ padding: "8px 8px 8px" }}>
        {[80, 64, 96].map((h, i) => (
          <Skeleton key={i} variant="rect" height={h} style={{ borderRadius: 8, marginBottom: 8 }} />
        ))}
      </Box>
    </Box>
  );
}

export default function Deals() {
  const classes = useStyles();
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState({});
  const [loading, setLoading] = useState(false);
  const [stageDialog, setStageDialog] = useState(false);
  const [stageForm, setStageForm] = useState(emptyStage);
  const [editStageId, setEditStageId] = useState(null);
  const [dealDialog, setDealDialog] = useState(false);
  const [dealForm, setDealForm] = useState(emptyDeal);
  const [editDealId, setEditDealId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/deals/kanban");
      const stageList = data.stages || [];
      setStages(stageList);
      const map = {};
      stageList.forEach(s => { map[s.id] = s.deals || []; });
      setDeals(map);
    } catch {
      toast.error("Erro ao carregar negócios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pipelineTotal = Object.values(deals).flat().reduce((s, d) => s + (Number(d.value) || 0), 0);
  const totalDeals = Object.values(deals).flat().length;

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const srcId = source.droppableId;
    const dstId = destination.droppableId;
    const dealId = parseInt(draggableId, 10);

    const srcDeals = Array.from(deals[srcId] || []);
    const [moved] = srcDeals.splice(source.index, 1);
    const dstDeals = srcId === dstId ? srcDeals : Array.from(deals[dstId] || []);
    dstDeals.splice(destination.index, 0, { ...moved, stageId: parseInt(dstId, 10) });

    setDeals(prev => ({ ...prev, [srcId]: srcDeals, [dstId]: dstDeals }));
    try {
      await api.put(`/deals/${dealId}`, { stageId: parseInt(dstId, 10) });
    } catch {
      toast.error("Erro ao mover negócio");
      load();
    }
  };

  const openAddStage = () => { setStageForm(emptyStage); setEditStageId(null); setStageDialog(true); };
  const openEditStage = (s) => { setStageForm({ name: s.name, color: s.color }); setEditStageId(s.id); setStageDialog(true); };

  const saveStage = async () => {
    if (!stageForm.name.trim()) { toast.warning("Nome obrigatório"); return; }
    setSaving(true);
    try {
      if (editStageId) {
        await api.put(`/deal-stages/${editStageId}`, stageForm);
      } else {
        await api.post("/deal-stages", stageForm);
      }
      setStageDialog(false);
      load();
      toast.success(editStageId ? "Fase atualizada" : "Fase criada");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Erro ao salvar fase");
    } finally {
      setSaving(false);
    }
  };

  const deleteStage = async (id) => {
    if (!window.confirm("Remover esta fase? Os negócios nela serão excluídos.")) return;
    try {
      await api.delete(`/deal-stages/${id}`);
      toast.success("Fase removida");
      load();
    } catch {
      toast.error("Erro ao remover fase");
    }
  };

  const openAddDeal = (stageId) => { setDealForm({ ...emptyDeal, stageId }); setEditDealId(null); setDealDialog(true); };
  const openEditDeal = (deal) => {
    setDealForm({ title: deal.title, contactId: deal.contactId || "", value: deal.value || "", description: deal.description || "", stageId: deal.stageId });
    setEditDealId(deal.id);
    setDealDialog(true);
  };

  const saveDeal = async () => {
    if (!dealForm.title.trim()) { toast.warning("Título obrigatório"); return; }
    const payload = { ...dealForm, value: dealForm.value ? parseFloat(dealForm.value) : null };
    setSaving(true);
    try {
      if (editDealId) {
        await api.put(`/deals/${editDealId}`, payload);
      } else {
        await api.post("/deals", payload);
      }
      setDealDialog(false);
      load();
      toast.success(editDealId ? "Negócio atualizado" : "Negócio criado");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Erro ao salvar negócio");
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (id) => {
    if (!window.confirm("Remover este negócio?")) return;
    try {
      await api.delete(`/deals/${id}`);
      toast.success("Negócio removido");
      load();
    } catch {
      toast.error("Erro ao remover negócio");
    }
  };

  return (
    <Box className={classes.root}>
      {/* ── Header ── */}
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <PipelineIcon style={{ fontSize: 28, opacity: 0.9 }} />
          <Box>
            <Typography className={classes.headerTitle}>Pipeline de Negócios</Typography>
            <Typography className={classes.headerSub}>
              {totalDeals} negócio{totalDeals !== 1 ? "s" : ""} · {stages.length} fase{stages.length !== 1 ? "s" : ""}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" style={{ gap: 12 }}>
          {pipelineTotal > 0 && (
            <Box className={classes.totalBadge}>
              <MoneyIcon style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }} />
              {fmtBRL(pipelineTotal)}
            </Box>
          )}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={openAddStage}
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)", textTransform: "none" }}
          >
            Nova Fase
          </Button>
        </Box>
      </Box>

      {/* ── Board ── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Box className={classes.board}>
          {loading ? (
            [1, 2, 3].map(i => <LaneSkeleton key={i} />)
          ) : stages.length === 0 ? (
            <Box className={classes.emptyBoard} style={{ width: "100%" }}>
              <PipelineIcon className={classes.emptyIcon} />
              <Typography variant="h6" color="textSecondary">Nenhuma fase criada ainda</Typography>
              <Typography variant="body2" color="textSecondary">Crie fases para organizar seu pipeline de vendas</Typography>
              <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={openAddStage}>
                Criar primeira fase
              </Button>
            </Box>
          ) : (
            <>
              {stages.map(stage => {
                const stageDeals = deals[stage.id] || [];
                const stageTotal = stageDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
                return (
                  <Box key={stage.id} className={classes.lane}>
                    {/* Lane header */}
                    <Box className={classes.laneHeader}>
                      <Box className={classes.laneLeft}>
                        <Box className={classes.laneDot} style={{ background: stage.color }} />
                        <Box>
                          <Typography className={classes.laneTitle}>{stage.name}</Typography>
                          {stageTotal > 0 && (
                            <Typography className={classes.laneValue}>{fmtBRL(stageTotal)}</Typography>
                          )}
                        </Box>
                        <span className={classes.laneCount}>{stageDeals.length}</span>
                      </Box>
                      <Box className={classes.laneActions}>
                        <Tooltip title="Editar fase">
                          <IconButton size="small" style={{ padding: 4 }} onClick={() => openEditStage(stage)}>
                            <EditIcon style={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remover fase">
                          <IconButton size="small" style={{ padding: 4 }} onClick={() => deleteStage(stage.id)}>
                            <CloseIcon style={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Droppable droppableId={String(stage.id)}>
                      {(provided, snapshot) => (
                        <Box
                          className={`${classes.cardsContainer} ${snapshot.isDraggingOver ? classes.droppingOver : ""}`}
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                              {(prov, snap) => (
                                <Paper
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  className={`${classes.card} ${snap.isDragging ? classes.cardDragging : ""}`}
                                  style={{
                                    ...prov.draggableProps.style,
                                    borderLeftColor: stage.color,
                                  }}
                                  elevation={snap.isDragging ? 6 : 0}
                                >
                                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                    <Typography className={classes.cardTitle}>{deal.title}</Typography>
                                    <Box className={classes.cardActions}>
                                      <IconButton size="small" style={{ padding: 2 }} onClick={() => openEditDeal(deal)}>
                                        <EditIcon style={{ fontSize: 11 }} />
                                      </IconButton>
                                      <IconButton size="small" style={{ padding: 2 }} onClick={() => deleteDeal(deal.id)}>
                                        <DeleteIcon style={{ fontSize: 11 }} />
                                      </IconButton>
                                    </Box>
                                  </Box>

                                  {deal.value > 0 && (
                                    <Box className={classes.cardValue}>
                                      <MoneyIcon style={{ fontSize: 10 }} />
                                      {fmtBRL(deal.value)}
                                    </Box>
                                  )}

                                  {deal.Contact && (
                                    <Box className={classes.cardContact}>
                                      <Avatar className={classes.contactAvatar}>
                                        {deal.Contact.name?.[0]?.toUpperCase() || "?"}
                                      </Avatar>
                                      <Typography className={classes.contactName}>
                                        {deal.Contact.name}
                                      </Typography>
                                    </Box>
                                  )}

                                  <Typography className={classes.cardDate}>
                                    {timeAgo(deal.createdAt)}
                                  </Typography>
                                </Paper>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </Box>
                      )}
                    </Droppable>

                    <Button
                      className={classes.addCardBtn}
                      startIcon={<AddIcon style={{ fontSize: 14 }} />}
                      onClick={() => openAddDeal(stage.id)}
                      fullWidth
                    >
                      Adicionar negócio
                    </Button>
                  </Box>
                );
              })}

              <Button className={classes.addLaneBtn} startIcon={<AddIcon />} onClick={openAddStage}>
                Nova fase
              </Button>
            </>
          )}
        </Box>
      </DragDropContext>

      {/* ── Stage dialog ── */}
      <Dialog open={stageDialog} onClose={() => setStageDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editStageId ? "Editar Fase" : "Nova Fase"}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16, marginTop: 8 }}>
            <TextField
              label="Nome da fase" size="small" variant="outlined" fullWidth autoFocus
              value={stageForm.name} onChange={e => setStageForm(f => ({ ...f, name: e.target.value }))}
            />
            <Box>
              <Typography variant="caption" color="textSecondary">Cor da fase</Typography>
              <Box display="flex" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                {COLORS.map(c => (
                  <Box
                    key={c}
                    onClick={() => setStageForm(f => ({ ...f, color: c }))}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                      border: stageForm.color === c ? "3px solid #000" : "3px solid transparent",
                      outline: stageForm.color === c ? `2px solid ${c}` : "none",
                      outlineOffset: 2,
                      transition: "transform 0.1s",
                      transform: stageForm.color === c ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStageDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={saveStage} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}>
            {editStageId ? "Salvar" : "Criar Fase"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Deal dialog ── */}
      <Dialog open={dealDialog} onClose={() => setDealDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editDealId ? "Editar Negócio" : "Novo Negócio"}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16, marginTop: 8 }}>
            <TextField
              label="Título do negócio" size="small" variant="outlined" fullWidth autoFocus
              value={dealForm.title} onChange={e => setDealForm(f => ({ ...f, title: e.target.value }))}
            />
            <TextField
              label="Valor" size="small" variant="outlined" type="number" fullWidth
              value={dealForm.value} onChange={e => setDealForm(f => ({ ...f, value: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            />
            <TextField
              label="Descrição" size="small" variant="outlined" multiline rows={3} fullWidth
              value={dealForm.description} onChange={e => setDealForm(f => ({ ...f, description: e.target.value }))}
            />
            {stages.length > 0 && (
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>Fase</InputLabel>
                <Select value={dealForm.stageId} onChange={e => setDealForm(f => ({ ...f, stageId: e.target.value }))} label="Fase">
                  {stages.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                        <Box style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
                        {s.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDealDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={saveDeal} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}>
            {editDealId ? "Salvar" : "Criar Negócio"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
