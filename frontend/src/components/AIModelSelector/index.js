import React, { useState, useEffect } from 'react';
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Typography,
    FormHelperText
} from '@material-ui/core';
import { getAvailableModels } from '../../services/aiModels';

const AIModelSelector = ({
    provider,
    apiKey,
    integrationId,
    value,
    onChange,
    disabled = false,
    label = "Modelo",
    name = "aiModel",
    error = false,
    helperText = ""
}) => {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;

        const fetchModels = async () => {
            if (!provider) {
                setModels([]);
                return;
            }

            setLoading(true);
            try {
                const data = await getAvailableModels(provider, apiKey, integrationId);
                if (active) {
                    setModels(data);
                }
            } catch (err) {
                console.error("Failed to load models", err);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchModels();

        return () => {
            active = false;
        };
    }, [provider, apiKey, integrationId]);

    // Se o valor atual não estiver na lista (e a lista já carregou), 
    // talvez devêssemos mostrar um aviso ou permitir o valor legado?
    // Por enquanto, vamos renderizar o MenuItem mesmo que não esteja na lista retornada pela API,
    // para não quebrar configurações antigas salvas.
    const currentModelInList = models.find(m => m.id === value);

    return (
        <FormControl
            fullWidth
            variant="outlined"
            margin="dense"
            disabled={disabled || !provider || loading}
            error={error}
        >
            <InputLabel>{label}</InputLabel>
            <Select
                label={label}
                name={name}
                value={value || ""}
                onChange={onChange}
                MenuProps={{
                    anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left"
                    },
                    transformOrigin: {
                        vertical: "top",
                        horizontal: "left"
                    },
                    getContentAnchorEl: null
                }}
            >
                {loading ? (
                    <MenuItem disabled>
                        <CircularProgress size={20} style={{ marginRight: 10 }} />
                        Carregando modelos...
                    </MenuItem>
                ) : models.length > 0 ? (
                    models.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body1">
                                    {model.name}
                                </Typography>
                                {model.contextWindow && (
                                    <Typography variant="caption" color="textSecondary">
                                        Contexto: {(model.contextWindow / 1000).toFixed(0)}k tokens
                                    </Typography>
                                )}
                            </div>
                        </MenuItem>
                    ))
                ) : (
                    <MenuItem disabled>
                        {provider ? "Nenhum modelo disponível" : "Selecione um provedor"}
                    </MenuItem>
                )}

                {/* Fallback para exibir o valor atual se ele não estiver na lista da API (Legacy support) */}
                {value && !loading && models.length > 0 && !currentModelInList && (
                    <MenuItem value={value}>
                        {value} (Legado/Custom)
                    </MenuItem>
                )}
            </Select>
            {helperText && <FormHelperText>{helperText}</FormHelperText>}
        </FormControl>
    );
};

export default AIModelSelector;
