import { Box, Chip, TextField } from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import Popper from "@material-ui/core/Popper";
import Checkbox from "@material-ui/core/Checkbox";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { makeStyles } from "@material-ui/core/styles";
import React, { useEffect, useState } from "react";
import toastError from "../../errors/toastError";
import api from "../../services/api";

export function TagsFilter({ onFiltered }) {
  const [tags, setTags] = useState([]);
  const [selecteds, setSelecteds] = useState([]);
  const [menuMinWidth, setMenuMinWidth] = useState(260);

  const useStyles = makeStyles(() => ({
    // Impede que as chips quebrem linha e adiciona scroll horizontal
    inputRoot: {
      flexWrap: 'nowrap',
      overflowX: 'hidden',
    },
    // Fundo do menu (Paper) e da lista
    paper: {
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
    },
    listbox: {
      backgroundColor: '#f3f4f6',
    },
    // Chip minimalista: só bolinha colorida + X
    tinyChip: {
      width: 22,
      height: 22,
      minWidth: 22,
      borderRadius: '50%',
      padding: 0,
      margin: 2,
    },
    tinyAvatar: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      display: 'inline-block',
    },
    tinyDeleteIcon: {
      fontSize: 14,
      color: '#6b7280',
    },
    // Círculo compacto com X central
    circleTag: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 2,
      border: '1px solid #d1d5db',
      color: '#fff',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      userSelect: 'none',
    },
    circleX: {
      lineHeight: 1,
      pointerEvents: 'none',
    }
  }));
  const classes = useStyles();

  // Popper customizado: dropdown se adapta ao maior texto (largura automática)
  const CustomPopper = (props) => (
    <Popper
      {...props}
      placement="bottom-start"
      style={{ width: "auto", minWidth: menuMinWidth, zIndex: 1300 }}
    />
  );

  useEffect(() => {
    async function fetchData() {
      await loadTags();
    }
    fetchData();
  }, []);

  const loadTags = async () => {
    try {
      const { data } = await api.get(`/tags/list`);
      setTags(data);
    } catch (err) {
      // 403 = sem permissão tags.view (admin)
      // Silencia o erro, lista de tags fica vazia
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  // Calcula a largura mínima do menu baseada no maior texto das opções
  useEffect(() => {
    if (!tags || tags.length === 0) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Fonte padrão aproximada do item de lista do MUI
      ctx.font = '16px Roboto, Helvetica, Arial, sans-serif';
      const maxText = tags.reduce((max, t) => {
        const w = ctx.measureText(String(t.name || '')).width;
        return Math.max(max, w);
      }, 0);
      // Espaço extra para checkbox + paddings/margens
      const extra = 72; // ~checkbox + paddings
      const minW = Math.ceil(Math.max(260, maxText + extra));
      setMenuMinWidth(minW);
    } catch (_) {
      setMenuMinWidth(260);
    }
  }, [tags]);

  const onChange = async (value) => {
    setSelecteds(value);
    onFiltered(value);
  };

  return (
    <Box style={{ padding: 10, width: 180 }}>
      <Autocomplete
        multiple
        disableCloseOnSelect
        fullWidth
        size="small"
        options={tags}
        value={selecteds}
        onChange={(e, v) => onChange(v)}
        getOptionLabel={(option) => option.name}
        getOptionSelected={(option, value) => option.id === value.id}
        noOptionsText="Sem resultados"
        ListboxProps={{ style: { maxHeight: 180, overflow: "auto", width: "auto", backgroundColor: "#f3f4f6" } }}
        PaperComponent={(paperProps) => (
          <Paper
            {...paperProps}
            elevation={3}
            style={{
              ...paperProps.style,
              width: "auto",
              minWidth: menuMinWidth,
              backgroundColor: "#f3f4f6",
              borderRadius: 8,
            }}
          />
        )}
        PopperComponent={CustomPopper}
        classes={{ inputRoot: classes.inputRoot, paper: classes.paper, listbox: classes.listbox }}
        renderOption={(option, { selected }) => (
          <>
            <Checkbox
              checked={selected}
              color="primary"
              size="small"
              style={{ marginRight: 8 }}
            />
            {option.name}
          </>
        )}
        renderTags={(value, getTagProps) =>
          value.slice(0, 2).map((option, index) => {
            const tagProps = getTagProps({ index });
            const onRemove = tagProps.onDelete;
            return (
              <span
                key={tagProps.key}
                className={classes.circleTag}
                style={{ backgroundColor: option.color || '#9ca3af' }}
                onClick={onRemove}
                title={`${option.name} — remover`}
              >
                <span className={classes.circleX}>×</span>
              </span>
            );
          })
        }
        limitTags={2}
        getLimitTagsText={() => ''}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            placeholder="Filtrar tags..."
          />
        )}
        style={{ width: "100%" }}
      />
    </Box>
  );
}
