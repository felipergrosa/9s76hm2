import { Chip, TextField, Checkbox } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

export function TagsContainer({ contact }) {

    const [tags, setTags] = useState([]);
    const [selecteds, setSelecteds] = useState([]);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (isMounted.current) {
            loadTags().then(() => {
                if (Array.isArray(contact.tags)) {
                    setSelecteds(contact.tags);
                } else {
                    setSelecteds([]);
                }
            });
        }
    }, [contact]);

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
            toastError(err);
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
        await syncTags({ contactId: contact.id, tags: optionsChanged });
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

    return (
        <Autocomplete
            multiple
            size="small"
            options={tags}
            value={selecteds}
            freeSolo
            fullWidth
            style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
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
                    <div style={{ display: 'flex', flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center', maxWidth: '100%', flexShrink: 1 }}>
                        {shown.map((option, index) => (
                            <Chip
                                key={`tag-${index}`}
                                variant="outlined"
                                style={{
                                    backgroundColor: option.color || '#eee',
                                    color: option.color ? '#FFF' : '#333',
                                    marginRight: 2,                                    
                                    fontWeight: 600,
                                    borderRadius: 9999,
                                    fontSize: "0.75rem",
                                    whiteSpace: "nowrap",
                                    height: 24,
                                }}
                                label={(
                                    <span style={{ display: 'block', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {typeof option === 'string' ? option : option.name}
                                    </span>
                                )}
                                {...getTagProps({ index })}
                                size="small"
                            />
                        ))}
                        {more > 0 && (
                            <Chip
                                variant="outlined"
                                size="small"
                                label="..."
                                style={{ borderRadius: 9999, height: 24, padding: '0 8px', marginTop: 0, marginBottom: 0 }}
                                tabIndex={-1}
                            />
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
                            overflow: 'hidden',
                            display: 'flex',
                            flexWrap: 'nowrap',
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box',
                        }
                    }}
                    inputProps={{
                        ...params.inputProps,
                        style: { ...(params.inputProps?.style || {}), padding: 0, minWidth: 8, flex: '0 0 8px' }
                    }}
                />
            )}
        />
    )
}