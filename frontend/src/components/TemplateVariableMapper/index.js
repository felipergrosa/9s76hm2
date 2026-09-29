import React, { useState, useEffect } from "react";
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Typography,
    Grid,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip,
} from "@material-ui/core";
import InfoIcon from "@material-ui/icons/Info";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import moment from "moment";

const TemplateVariableMapper = ({
    whatsappId,
    templateName,
    languageCode = "pt_BR",
    value = {},
    onChange,
    disabled = false,
}) => {
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (templateName && whatsappId) {
            fetchTemplateDefinition();
        } else {
            setTemplate(null);
        }
    }, [templateName, whatsappId, languageCode]);

    const fetchTemplateDefinition = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get(`/templates/${whatsappId}/${templateName}`, {
                params: { language: languageCode },
            });
            console.log("📦 Template Definition recebido:", data); // LOG PARA DEBUG
            setTemplate(data);
        } catch (err) {
            console.error("Erro ao buscar definição do template:", err);
            setError("Não foi possível carregar o template. Verifique se ele está aprovado.");
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    // Inicializa configuração padrão para todas as variáveis do template
    // Mesmo que o usuário não mexa manualmente no campo, garantimos que
    // metaTemplateVariables tenha uma entrada para cada índice ({{1}}, {{2}}, ...).
    useEffect(() => {
        if (!template || !template.parameters || template.parameters.length === 0) return;

        const currentValue = value || {};
        let changed = false;
        const newValue = { ...currentValue };

        template.parameters.forEach((param) => {
            if (!newValue[param.index]) {
                newValue[param.index] = { type: "crm_field", source: "name" };
                changed = true;
            }
        });

        if (changed) {
            console.log("[TemplateVariableMapper] Inicializando configuração padrão:", newValue);
            onChange(newValue);
        }
    }, [template, value, onChange]);

    const handleTypeChange = (paramIndex, type) => {
        const currentValue = value || {};
        const newValue = {
            ...currentValue,
            [paramIndex]: {
                type,
                source: getDefaultSource(type),
            },
        };
        console.log('[TemplateVariableMapper] handleTypeChange:', paramIndex, type, newValue);
        onChange(newValue);
    };

    const handleSourceChange = (paramIndex, source) => {
        const currentValue = value || {};
        // Se não existir no estado ainda, usa o padrão para preservar o 'type'
        const currentParamConfig = currentValue[paramIndex] || { type: "crm_field", source: "name" };

        const newValue = {
            ...currentValue,
            [paramIndex]: {
                ...currentParamConfig,
                source,
            },
        };
        console.log('[TemplateVariableMapper] handleSourceChange:', paramIndex, source, newValue);
        onChange(newValue);
    };

    const getDefaultSource = (type) => {
        switch (type) {
            case "crm_field":
                return "name";
            case "special":
                return "saudacao";
            case "fixed":
                return "";
            default:
                return "";
        }
    };

    // Contato de exemplo para pré-visualização
    const exampleContact = {
        id: 123,
        name: "João Silva",
        number: "5511999999999",
        email: "cliente@exemplo.com",
        cpfCnpj: "123.456.789-00",
        city: "São Paulo",
        fantasyName: "Empresa Exemplo",
        bzEmpresa: "Empresa Exemplo",
    };

    const resolvePreviewVariable = (config) => {
        if (!config) return "";

        if (config.type === "crm_field") {
            const v = exampleContact[config.source];
            return v != null ? String(v) : "";
        }

        if (config.type === "special") {
            if (config.source === "saudacao") {
                const hour = moment().hour();
                if (hour < 12) return "Bom dia";
                if (hour < 18) return "Boa tarde";
                return "Boa noite";
            }
            if (config.source === "data_atual") {
                return moment().format("DD/MM/YYYY");
            }
            if (config.source === "hora_atual") {
                return moment().format("HH:mm");
            }
            return "";
        }

        if (config.type === "fixed") {
            return config.source || "";
        }

        return "";
    };

    const buildPreviewBody = () => {
        if (!template || !template.body) return "";
        if (!template.parameters || template.parameters.length === 0) {
            return template.body;
        }

        let body = template.body;
        const currentValue = value || {};

        template.parameters.forEach((param) => {
            const config = currentValue[param.index] || { type: "crm_field", source: "name" };
            const resolved = resolvePreviewVariable(config) || param.example || "";
            const placeholder = new RegExp(`\\{\\{${param.index}\\}\\}`, "g");
            body = body.replace(placeholder, resolved);
        });

        return body;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={24} />
                <Typography variant="body2" style={{ marginLeft: 8 }}>
                    Carregando template...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={2}>
                <Typography variant="body2" color="error">
                    {error}
                </Typography>
            </Box>
        );
    }

    if (!template) {
        return null;
    }

    // Bloco de pré-visualização — header (texto ou mídia), corpo com variáveis
    // resolvidas e footer. Exibido sempre que o template carrega, mesmo sem
    // parâmetros (o usuário precisa ver exatamente o que será enviado).
    const previewBlock = (
        <Box mb={3} p={2} bgcolor="#e3f2fd" borderRadius={4} border="1px solid #90caf9">
            <Typography variant="caption" color="primary" style={{ fontWeight: "bold", display: "block", marginBottom: 4 }}>
                PRÉ-VISUALIZAÇÃO
            </Typography>

            {template.headerFormat && ["DOCUMENT", "IMAGE", "VIDEO"].includes(template.headerFormat) ? (
                <Typography
                    variant="caption"
                    style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 600,
                        color: "#1565c0"
                    }}
                >
                    {template.headerFormat === "IMAGE" && "🖼️ Imagem no cabeçalho"}
                    {template.headerFormat === "VIDEO" && "🎬 Vídeo no cabeçalho"}
                    {template.headerFormat === "DOCUMENT" && "📄 Documento no cabeçalho"}
                </Typography>
            ) : null}

            {template.header && (
                <Typography variant="subtitle2" style={{ fontWeight: "bold", marginBottom: 8 }}>
                    {template.header}
                </Typography>
            )}

            <Typography variant="body1" style={{ whiteSpace: "pre-wrap" }}>
                {buildPreviewBody()}
            </Typography>

            {template.footer && (
                <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 8 }}>
                    {template.footer}
                </Typography>
            )}

            {template.hasButtons && (template.buttons || []).map((b, i) => (
                <Box
                    key={i}
                    mt={1}
                    p={1}
                    style={{
                        border: "1px solid #90caf9",
                        borderRadius: 4,
                        textAlign: "center",
                        background: "#fff"
                    }}
                >
                    <Typography variant="body2" color="primary">
                        {b.type === "URL" && "🔗 "}
                        {b.type === "PHONE_NUMBER" && "📞 "}
                        {b.type === "QUICK_REPLY" && "💬 "}
                        {b.text}
                    </Typography>
                </Box>
            ))}
        </Box>
    );

    if (!template.parameters || template.parameters.length === 0) {
        return (
            <Box>
                {previewBlock}
                <Typography variant="body2" color="textSecondary">
                    ✓ Template não possui variáveis parametrizadas
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600, marginBottom: 12 }}>
                📋 Variáveis do Template "{template.name}"
            </Typography>

            {previewBlock}

            {template.parameters.map((param) => {
                const config = (value && value[param.index]) || { type: "crm_field", source: "name" };

                return (
                    <Box key={param.index} mb={2}>
                        <Grid container spacing={2} alignItems="center">
                            {/* Indicador de variável */}
                            <Grid item xs={12} sm={2}>
                                <Chip
                                    label={`{{${param.index}}}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            </Grid>

                            {/* Tipo de variável */}
                            <Grid item xs={12} sm={4}>
                                <FormControl fullWidth size="small" variant="outlined" disabled={disabled}>
                                    <InputLabel>Tipo</InputLabel>
                                    <Select
                                        value={config.type}
                                        onChange={(e) => handleTypeChange(param.index, e.target.value)}
                                        label="Tipo"
                                    >
                                        <MenuItem value="crm_field">Campo do CRM</MenuItem>
                                        <MenuItem value="special">Campo Especial</MenuItem>
                                        <MenuItem value="fixed">Texto Fixo</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Fonte da variável */}
                            <Grid item xs={12} sm={5}>
                                {config.type === "crm_field" && (
                                    <FormControl fullWidth size="small" variant="outlined" disabled={disabled}>
                                        <InputLabel>Campo</InputLabel>
                                        <Select
                                            value={config.source}
                                            onChange={(e) => handleSourceChange(param.index, e.target.value)}
                                            label="Campo"
                                        >
                                            <MenuItem value="name">Nome</MenuItem>
                                            <MenuItem value="email">E-mail</MenuItem>
                                            <MenuItem value="number">Telefone/WhatsApp</MenuItem>
                                            <MenuItem value="id">ID do Contato</MenuItem>
                                            <MenuItem value="cpfCnpj">CPF/CNPJ</MenuItem>
                                            <MenuItem value="representativeCode">Código do Representante</MenuItem>
                                            <MenuItem value="city">Cidade</MenuItem>
                                            <MenuItem value="instagram">Instagram</MenuItem>
                                            <MenuItem value="contactName">Nome do Contato</MenuItem>
                                            <MenuItem value="segment">Segmento de Mercado</MenuItem>
                                            <MenuItem value="situation">Situação</MenuItem>
                                            <MenuItem value="fantasyName">Nome Fantasia</MenuItem>
                                            <MenuItem value="foundationDate">Data de Fundação</MenuItem>
                                            <MenuItem value="creditLimit">Limite de Crédito</MenuItem>
                                            <MenuItem value="dtUltCompra">Data da Última Compra</MenuItem>
                                            <MenuItem value="vlUltCompra">Valor da Última Compra</MenuItem>
                                            <MenuItem value="bzEmpresa">Empresa</MenuItem>
                                            <MenuItem value="region">Região</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}

                                {config.type === "special" && (
                                    <FormControl fullWidth size="small" variant="outlined" disabled={disabled}>
                                        <InputLabel>Campo Especial</InputLabel>
                                        <Select
                                            value={config.source}
                                            onChange={(e) => handleSourceChange(param.index, e.target.value)}
                                            label="Campo Especial"
                                        >
                                            <MenuItem value="saudacao">Saudação (Bom dia/tarde/noite)</MenuItem>
                                            <MenuItem value="data_atual">Data Atual (DD/MM/YYYY)</MenuItem>
                                            <MenuItem value="hora_atual">Hora Atual (HH:mm)</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}

                                {config.type === "fixed" && (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        variant="outlined"
                                        label="Texto Fixo"
                                        value={config.source}
                                        onChange={(e) => handleSourceChange(param.index, e.target.value)}
                                        placeholder="Digite o texto fixo"
                                        disabled={disabled}
                                    />
                                )}
                            </Grid>

                            {/* Info sobre exemplo */}
                            <Grid item xs={12} sm={1}>
                                {param.example && (
                                    <Tooltip title={`Exemplo da Meta: "${param.example}"`} arrow>
                                        <IconButton size="small">
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Grid>
                        </Grid>
                    </Box>
                );
            })}

            {template.hasButtons && (
                <Box mt={2} p={1.5} bgcolor="#f5f5f5" borderRadius={1}>
                    <Typography variant="caption" color="textSecondary">
                        ℹ️ Este template possui {template.buttons.length} botão(ões) interativo(s) que serão
                        incluídos automaticamente pela Meta.
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default TemplateVariableMapper;
