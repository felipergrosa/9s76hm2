import { Chip, TextField, Checkbox, Popover } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

export function TagsContainer({ contact, pendingTags = [], onPendingChange }) {

    const [tags, setTags] = useState([]);
    const [selecteds, setSelecteds] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (!isMounted.current) return;
        loadTags().then(() => {
            if (contact && contact.id && Array.isArray(contact.tags)) {
                setSelecteds(contact.tags);
            } else if (!contact?.id && Array.isArray(pendingTags)) {
                setSelecteds(pendingTags);
            } else {
                setSelecteds([]);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contact?.id]);

    const createTag = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const loadTags = async () => {
        try {
            const { data } = await api.get(`/tags/list`, 
            {params: { kanban: 0}
        });
            setTags(data);
        } catch (err) {
            // 403 = sem permissão tags.view (admin)
            // Silencia o erro, lista de tags fica vazia
            if (err?.response?.status !== 403) {
                toastError(err);
            }
        }
    }

    const syncTags = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags/sync`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const onChange = async (value, reason) => {
        let optionsChanged = []
        if (reason === 'create-option') {
            if (isArray(value)) {
                for (let item of value) {
                    if (item.length < 3) {
                        toastError("Tag muito curta!");
                        return;
                    }
                    if (isString(item)) {
                        const newTag = await createTag({ name: item, kanban: 0, color: getRandomHexColor() })
                        optionsChanged.push(newTag);
                    } else {
                        optionsChanged.push(item);
                    }
                }
            }
            await loadTags();
        } else {
            optionsChanged = value;
        }
        setSelecteds(optionsChanged);
        if (contact && contact.id) {
            await syncTags({ contactId: contact.id, tags: optionsChanged });
        } else if (typeof onPendingChange === 'function') {
            onPendingChange(optionsChanged);
        }
    }

    function getRandomHexColor() {
        // Gerar valores aleatórios para os componentes de cor
        const red = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const green = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const blue = Math.floor(Math.random() * 256); // Valor entre 0 e 255
      
        // Converter os componentes de cor em uma cor hexadecimal
        const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
      
        return hexColor;
    }

    const openPopover = Boolean(anchorEl);

    const handleOpenAll = (e) => setAnchorEl(e.currentTarget);
    const handleCloseAll = () => setAnchorEl(null);

    return (
        <Autocomplete
            multiple
            size="small"
            options={tags}
            value={selecteds}
            freeSolo
            fullWidth
            style={{ overflow: 'hidden' }}
            disableCloseOnSelect
            onChange={(e, v, r) => onChange(v, r)}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
            getOptionSelected={(option, value) => {
                const optLabel = typeof option === 'string' ? option : option?.name;
                const valLabel = typeof value === 'string' ? value : value?.name;
                if (option?.id && value?.id) return option.id === value.id;
                return optLabel === valLabel;
            }}
            renderOption={(option, { selected }) => (
                <>
                    <Checkbox
                        color="primary"
                        checked={selected}
                        style={{ marginRight: 8 }}
                    />
                    {typeof option === 'string' ? option : option.name}
                </>
            )}
            renderTags={(value, getTagProps) => {
                const shown = value.slice(0, 2);
                const more = value.length - shown.length;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {shown.map((option, index) => (
                            <Chip
                                key={`tag-${index}`}
                                variant="outlined"
                                style={{
                                    backgroundColor: option.color || '#eee',
                                    color: option.color ? '#FFF' : '#333',
                                    fontWeight: 500,
                                    borderRadius: 9999,
                                    fontSize: "0.75rem",
                                    height: 20,
                                }}
                                label={(
                                    <span style={{ display: 'block', maxWidth: 55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {typeof option === 'string' ? option : option.name}
                                    </span>
                                )}
                                {...getTagProps({ index })}
                                size="small"
                            />
                        ))}
                        {more > 0 && (
                            <>
                                <Chip
                                    variant="outlined"
                                    size="small"
                                    label={`+${more}`}
                                    onClick={handleOpenAll}
                                    style={{ borderRadius: 9999, height: 20, padding: '1px 3px', marginTop: 0, marginBottom: 0, cursor: 'pointer' }}
                                />
                                <Popover
                                    open={openPopover}
                                    anchorEl={anchorEl}
                                    onClose={handleCloseAll}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                    PaperProps={{ style: { maxWidth: 360, padding: 5 } }}
                                >
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 340 }}>
                                        {value.map((option, idx) => (
                                            <Chip
                                                key={`all-tag-${idx}`}
                                                variant="outlined"
                                                size="small"
                                                style={{ backgroundColor: option.color || '#eee', color: option.color ? '#FFF' : '#333', fontWeight: 600, borderRadius: 9999 }}
                                                label={typeof option === 'string' ? option : option.name}
                                            />
                                        ))}
                                    </div>
                                </Popover>
                            </>
                        )}
                    </div>
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    variant="outlined"
                    label="Tags"
                    InputLabelProps={{ shrink: true }}
                    margin="dense"
                    fullWidth
                    InputProps={{
                        ...params.InputProps,
                        style: {
                            ...(params.InputProps?.style || {}),
                            height: 40,
                            paddingTop: 4,
                            paddingBottom: 4,
                            alignItems: 'center',
                            boxSizing: 'border-box',
                        }
                    }}
                    inputProps={{
                        ...params.inputProps,
                        style: { ...(params.inputProps?.style || {}), padding: 0, minWidth: 40, flex: '0 0 40px' }
                    }}
                />
            )}
        />
    )
}