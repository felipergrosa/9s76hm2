import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Box,
  Grid,
  Typography,
  Popover
} from "@material-ui/core";
import { DateRangePicker } from 'materialui-daterange-picker';
import { format, parseISO, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export default function KanbanFiltersModal({
  open,
  onClose,
  onApply,
  onClear,
  queueOptions = [],
  userOptions = [],
  tagOptions = [],
  initial = { filterQueues: [], filterUsers: [], filterTags: [], sortBy: 'recent', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') }
}) {
  const [filterQueues, setFilterQueues] = useState(initial.filterQueues || []);
  const [filterUsers, setFilterUsers] = useState(initial.filterUsers || []);
  const [filterTags, setFilterTags] = useState(initial.filterTags || []);
  const [sortBy, setSortBy] = useState(initial.sortBy || 'recent');
  const [startDate, setStartDate] = useState(initial.startDate || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(initial.endDate || format(new Date(), 'yyyy-MM-dd'));

  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState(null);

  useEffect(() => {
    if (open) {
      setFilterQueues(initial.filterQueues || []);
      setFilterUsers(initial.filterUsers || []);
      setFilterTags(initial.filterTags || []);
      setSortBy(initial.sortBy || 'recent');
      setStartDate(initial.startDate || format(new Date(), 'yyyy-MM-dd'));
      setEndDate(initial.endDate || format(new Date(), 'yyyy-MM-dd'));
    }
  }, [open, initial]);

  const handleApply = () => {
    onApply && onApply({ filterQueues, filterUsers, filterTags, sortBy, startDate, endDate });
  };

  const handleClear = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setFilterQueues([]);
    setFilterUsers([]);
    setFilterTags([]);
    setSortBy('recent');
    setStartDate(today);
    setEndDate(today);
    onClear && onClear({ filterQueues: [], filterUsers: [], filterTags: [], sortBy: 'recent', startDate: today, endDate: today });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Filtrar e ordenar</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          {/* Linha 1: Filas + Usuários */}
          <Grid item xs={12} sm={6}>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="filter-queues-label">Filas</InputLabel>
              <Select labelId="filter-queues-label" multiple value={filterQueues} onChange={(e)=>setFilterQueues(e.target.value)} label="Filas" renderValue={(sel)=> sel.map(id=> queueOptions.find(o=>o.id===id)?.name || id).join(', ')}>
                {queueOptions.map(opt => (
                  <MenuItem key={opt.id} value={opt.id}>
                    <Checkbox checked={filterQueues.indexOf(opt.id) > -1} />
                    <ListItemText primary={opt.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="filter-users-label">Usuários</InputLabel>
              <Select labelId="filter-users-label" multiple value={filterUsers} onChange={(e)=>setFilterUsers(e.target.value)} label="Usuários" renderValue={(sel)=> sel.map(id=> userOptions.find(o=>o.id===id)?.name || id).join(', ')}>
                {userOptions.map(opt => (
                  <MenuItem key={opt.id} value={opt.id}>
                    <Checkbox checked={filterUsers.indexOf(opt.id) > -1} />
                    <ListItemText primary={opt.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Linha 2: Tags + Ordenar por */}
          <Grid item xs={12} sm={6}>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="filter-tags-label">Tags</InputLabel>
              <Select labelId="filter-tags-label" multiple value={filterTags} onChange={(e)=>setFilterTags(e.target.value)} label="Tags" renderValue={(sel)=> sel.map(id=> tagOptions.find(o=>o.id===id)?.name || id).join(', ')}>
                {tagOptions.map(opt => (
                  <MenuItem key={opt.id} value={opt.id}>
                    <Checkbox checked={filterTags.indexOf(opt.id) > -1} />
                    <ListItemText primary={opt.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="sort-by-label">Ordenar por</InputLabel>
              <Select labelId="sort-by-label" value={sortBy} onChange={(e)=>setSortBy(e.target.value)} label="Ordenar por">
                <MenuItem value="recent">Mais recentes</MenuItem>
                <MenuItem value="oldest">Mais antigos</MenuItem>
                <MenuItem value="unread">Não lidas</MenuItem>
                <MenuItem value="priority">Prioridade</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Linha 3: Período + Limpar período */}
          <Grid item xs={12} sm={6}>
            <Button fullWidth variant="outlined" size="small" onClick={(e)=>{ setRangeAnchor(e.currentTarget); setRangeOpen(true); }}>
              {`Período: ${format(parseISO(startDate), 'dd/MM')} — ${format(parseISO(endDate), 'dd/MM/yy')}`}
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button fullWidth variant="text" size="small" onClick={() => { const today = new Date(); setStartDate(format(today, 'yyyy-MM-dd')); setEndDate(format(today, 'yyyy-MM-dd')); }}>
              Limpar período
            </Button>
          </Grid>
        </Grid>

        {/* Scroll horizontal contido: o calendário duplo do picker é mais largo que 375px */}
        <Popover open={rangeOpen} anchorEl={rangeAnchor} onClose={()=> setRangeOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ style: { maxWidth: '100vw', overflowX: 'auto' } }}>
          <DateRangePicker
            open
            toggle={() => setRangeOpen(false)}
            initialDateRange={{ startDate: parseISO(startDate), endDate: parseISO(endDate) }}
            definedRanges={[
              { label: 'Hoje', startDate: new Date(), endDate: new Date() },
              { label: 'Últimos 7 dias', startDate: addDays(new Date(), -6), endDate: new Date() },
              { label: 'Últimos 30 dias', startDate: addDays(new Date(), -29), endDate: new Date() },
              { label: 'Semana atual', startDate: startOfWeek(new Date(), { weekStartsOn: 1 }), endDate: endOfWeek(new Date(), { weekStartsOn: 1 }) },
              { label: 'Mês atual', startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) },
            ]}
            onChange={(r)=>{
              if (!r?.startDate || !r?.endDate) return;
              setStartDate(format(r.startDate, 'yyyy-MM-dd'));
              setEndDate(format(r.endDate, 'yyyy-MM-dd'));
              setRangeOpen(false);
            }}
          />
        </Popover>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClear} color="default">Limpar filtros</Button>
        <Button onClick={handleApply} color="primary" variant="contained">Aplicar</Button>
      </DialogActions>
    </Dialog>
  );
}
