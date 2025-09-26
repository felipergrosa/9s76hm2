import React, { useState, useEffect } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Popover,
  ClickAwayListener
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  formControl: {
    minWidth: 200,
    marginBottom: theme.spacing(1),
  },
  integrationInfo: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  configuredChip: {
    backgroundColor: '#4caf50 !important',
    color: 'white !important',
  },
  checkIcon: {
    color: '#4caf50',
    fontSize: 20,
    marginLeft: theme.spacing(1),
  },
  popoverContent: {
    padding: theme.spacing(2),
    maxWidth: 400,
  },
  selectContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
}));

const AIIntegrationSelector = ({ 
  value, 
  onChange, 
  label = "Integração IA",
  required = false,
  error = false,
  helperText = "",
  showDetails = true,
  margin = "normal"
}) => {
  const classes = useStyles();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [configAnchorEl, setConfigAnchorEl] = useState(null);

  const openConfigPopover = Boolean(configAnchorEl);
  const handleOpenConfig = (event) => setConfigAnchorEl(event.currentTarget);
  const handleCloseConfig = () => setConfigAnchorEl(null);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const { data } = await api.get("/queueIntegration", {
          params: { type: "openai,gemini" }
        });
        
        const aiIntegrations = data.queueIntegrations?.filter(
          integration => integration.type === "openai" || integration.type === "gemini"
        ) || [];
        
        setIntegrations(aiIntegrations);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar integrações IA:", error);
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, []);

  useEffect(() => {
    if (value && integrations.length > 0) {
      const integration = integrations.find(int => String(int.id) === String(value));
      setSelectedIntegration(integration || null);
    } else {
      setSelectedIntegration(null);
    }
  }, [value, integrations]);

  // Hidrata detalhes completos quando já existe um value (edição) mas faltam campos
  useEffect(() => {
    (async () => {
      if (!value) return;
      if (selectedIntegration && (selectedIntegration.model || selectedIntegration.maxTokens || selectedIntegration.apiKey)) return;
      try {
        const { data } = await api.get(`/queueIntegration/${value}`);
        let payload = (data && (data.queueIntegration || data)) || null;
        if (payload && payload.jsonContent) {
          try {
            const parsed = JSON.parse(payload.jsonContent);
            const masked = typeof parsed?.apiKey === 'string' && parsed.apiKey.endsWith('********');
            payload = {
              ...payload,
              apiKey: masked ? parsed.apiKey : (parsed.apiKey || payload.apiKey),
              model: parsed.model ?? payload.model,
              temperature: parsed.temperature ?? payload.temperature,
              maxTokens: parsed.maxTokens ?? payload.maxTokens,
              maxMessages: parsed.maxMessages ?? payload.maxMessages,
              topP: parsed.topP ?? payload.topP,
              presencePenalty: parsed.presencePenalty ?? payload.presencePenalty,
              creativity: parsed.creativityLevel ?? payload.creativity,
            };
          } catch (_) {}
        }
        if (payload) setSelectedIntegration(prev => ({ ...(prev || {}), ...payload }));
      } catch (_) {}
    })();
  }, [value, selectedIntegration]);

  const handleChange = async (event) => {
    const integrationId = event.target.value;
    let integration = integrations.find(int => String(int.id) === String(integrationId));
    try {
      // Busca detalhes completos desta integração
      const { data } = await api.get(`/queueIntegration/${integrationId}`);
      let payload = (data && (data.queueIntegration || data)) || null;
      if (payload && payload.jsonContent) {
        try {
          const parsed = JSON.parse(payload.jsonContent);
          const masked = typeof parsed?.apiKey === 'string' && parsed.apiKey.endsWith('********');
          payload = {
            ...payload,
            apiKey: masked ? parsed.apiKey : (parsed.apiKey || payload.apiKey),
            model: parsed.model ?? payload.model,
            temperature: parsed.temperature ?? payload.temperature,
            maxTokens: parsed.maxTokens ?? payload.maxTokens,
            maxMessages: parsed.maxMessages ?? payload.maxMessages,
            topP: parsed.topP ?? payload.topP,
            presencePenalty: parsed.presencePenalty ?? payload.presencePenalty,
            creativity: parsed.creativityLevel ?? payload.creativity,
          };
        } catch (_) {}
      }
      if (payload) integration = { ...integration, ...payload };
    } catch (_) {}
    setSelectedIntegration(integration || null);
    onChange(integrationId, integration || null);
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} />
        <Typography variant="body2">Carregando integrações...</Typography>
      </Box>
    );
  }

  if (integrations.length === 0) {
    return (
      <Box style={{ padding: 16, backgroundColor: "#fff3cd", border: "1px solid #ffeaa7", borderRadius: 4 }}>
        <Typography variant="body2" color="textSecondary">
          ⚠️ Nenhuma integração OpenAI/Gemini configurada. 
          Configure uma integração em <strong>Integrações → Adicionar → OpenAI/Gemini</strong>
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box className={classes.selectContainer}>
        <FormControl
          variant="outlined"
          className={classes.formControl}
          fullWidth
          error={error}
          required={required}
          margin={margin}
        >
          <InputLabel>{label}</InputLabel>
          <Select
            value={value || ""}
            onChange={handleChange}
            label={label}
          >
            <MenuItem value="">
              <em>Selecione uma integração</em>
            </MenuItem>
            {integrations.map((integration) => {
              // Verificar se é a integração selecionada para usar dados mais completos
              const currentIntegration = (selectedIntegration && String(selectedIntegration.id) === String(integration.id)) 
                ? selectedIntegration 
                : integration;
              
              const hasKey = Boolean(
                currentIntegration.apiKey || 
                currentIntegration.hasApiKey || 
                currentIntegration.apiKeyMasked || 
                currentIntegration.encryptedKey || 
                currentIntegration.keyConfigured ||
                (currentIntegration.apiKey && currentIntegration.apiKey !== '')
              );
              
              return (
                <MenuItem key={integration.id} value={integration.id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                      label={integration.type.toUpperCase()} 
                      size="small" 
                      className={hasKey ? classes.configuredChip : ''}
                      color={!hasKey ? (integration.type === "openai" ? "primary" : "secondary") : undefined}
                    />
                    {integration.name}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
          {helperText && (
            <Typography variant="caption" color={error ? "error" : "textSecondary"}>
              {helperText}
            </Typography>
          )}
        </FormControl>

        {selectedIntegration && (
          <IconButton
            onClick={handleOpenConfig}
            className={classes.checkIcon}
            size="small"
          >
            <CheckCircleIcon />
          </IconButton>
        )}
      </Box>

      {/* Popover separado */}
      <Popover
        open={openConfigPopover}
        anchorEl={configAnchorEl}
        onClose={handleCloseConfig}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableRestoreFocus
      >
        {selectedIntegration && (
          <Box className={classes.popoverContent}>
            <Typography variant="subtitle2" gutterBottom>
              📋 Configurações da Integração
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {(() => {
                const get = (obj, keys) => keys.reduce((acc, k) => acc ?? obj?.[k], undefined);
                const model = get(selectedIntegration, ["model", "defaultModel", "modelDefault", "model_name"]);
                const temperature = get(selectedIntegration, ["temperature", "temp", "temperatureDefault"]) ?? get(selectedIntegration, ["creativity"]);
                const maxTokens = get(selectedIntegration, ["maxTokens", "max_tokens", "maxTokensDefault"]);
                const hasKey = Boolean(
                  selectedIntegration.apiKey || 
                  selectedIntegration.hasApiKey || 
                  selectedIntegration.apiKeyMasked || 
                  selectedIntegration.encryptedKey || 
                  selectedIntegration.keyConfigured ||
                  (selectedIntegration.apiKey && selectedIntegration.apiKey !== '')
                );
                return (
                  <>
                    <Chip 
                      label={`Modelo: ${model || "Não definido"}`} 
                      size="small" 
                      className={classes.chip}
                    />
                    <Chip 
                      label={`Temperatura: ${temperature ?? "1"}`} 
                      size="small" 
                      className={classes.chip}
                    />
                    <Chip 
                      label={`Máx. Tokens: ${maxTokens ?? "100"}`} 
                      size="small" 
                      className={classes.chip}
                    />
                    <Chip 
                      label={`API Key: ${hasKey ? "✅ Configurada" : "❌ Não configurada"}`} 
                      size="small" 
                      className={classes.chip}
                      color={hasKey ? "primary" : "secondary"}
                    />
                  </>
                );
              })()}
            </Box>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default AIIntegrationSelector;
