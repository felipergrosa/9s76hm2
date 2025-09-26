import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Button
} from '@material-ui/core';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon
} from '@material-ui/icons';
import { validateAIConfig } from '../../utils/aiErrorHandler';

const AIConfigValidator = ({ 
  providers, 
  onOpenSettings, 
  showSuccessMessage = true,
  compact = false 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [validationResults, setValidationResults] = useState([]);

  useEffect(() => {
    const results = [];
    
    // Valida cada provedor
    Object.entries(providers || {}).forEach(([providerName, config]) => {
      if (config.enabled) {
        const errors = validateAIConfig(config);
        results.push({
          provider: providerName,
          config,
          errors,
          isValid: errors.length === 0
        });
      }
    });

    // Se nenhum provedor está habilitado
    if (results.length === 0) {
      results.push({
        provider: 'Nenhum',
        config: null,
        errors: ['Nenhum provedor de IA está habilitado'],
        isValid: false
      });
    }

    setValidationResults(results);
  }, [providers]);

  const hasErrors = validationResults.some(result => !result.isValid);
  const totalErrors = validationResults.reduce((sum, result) => sum + result.errors.length, 0);

  if (!hasErrors && !showSuccessMessage) {
    return null;
  }

  const getSeverityIcon = (isValid) => {
    if (isValid) return <CheckIcon style={{ color: '#4caf50' }} />;
    return <ErrorIcon style={{ color: '#f44336' }} />;
  };

  const getSeverityColor = () => {
    if (!hasErrors) return 'success';
    return 'error';
  };

  if (compact && !hasErrors) {
    return (
      <Box mb={1}>
        <Paper style={{ padding: 8, backgroundColor: '#e8f5e8', border: '1px solid #4caf50' }}>
          <Typography variant="body2" style={{ color: '#2e7d32' }}>
            ✅ Configurações de IA válidas
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box mb={2}>
      <Paper 
        style={{ 
          padding: 12, 
          backgroundColor: hasErrors ? '#ffebee' : '#e8f5e8', 
          border: hasErrors ? '1px solid #f44336' : '1px solid #4caf50'
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" style={{ fontWeight: 600, color: hasErrors ? '#c62828' : '#2e7d32' }}>
              {hasErrors 
                ? `⚠️ ${totalErrors} problema${totalErrors > 1 ? 's' : ''} de configuração detectado${totalErrors > 1 ? 's' : ''}`
                : '✅ Configurações de IA válidas'
              }
            </Typography>
            
            {hasErrors && (
              <Typography variant="body2" style={{ marginTop: 4, opacity: 0.8, color: '#c62828' }}>
                Clique em "Configurar" para corrigir os problemas
              </Typography>
            )}
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            {hasErrors && (
              <Button
                size="small"
                startIcon={<SettingsIcon />}
                onClick={onOpenSettings}
                variant="outlined"
                style={{ color: '#c62828', borderColor: '#c62828' }}
              >
                Configurar
              </Button>
            )}
            {!compact && (
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                style={{ color: hasErrors ? '#c62828' : '#2e7d32' }}
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
        </Box>
      </Paper>

      <Collapse in={expanded && !compact}>
        <Box mt={1} p={2} style={{ backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <Typography variant="subtitle2" gutterBottom>
            Detalhes da Validação:
          </Typography>
          
          <List dense>
            {validationResults.map((result, index) => (
              <ListItem key={index} style={{ paddingLeft: 0 }}>
                <ListItemIcon style={{ minWidth: 32 }}>
                  {getSeverityIcon(result.isValid)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                      {result.provider.toUpperCase()}
                    </Typography>
                  }
                  secondary={
                    result.isValid ? (
                      <Typography variant="caption" style={{ color: '#4caf50' }}>
                        Configuração válida
                      </Typography>
                    ) : (
                      <Box>
                        {result.errors.map((error, errorIndex) => (
                          <Typography 
                            key={errorIndex} 
                            variant="caption" 
                            style={{ color: '#f44336', display: 'block' }}
                          >
                            • {error}
                          </Typography>
                        ))}
                      </Box>
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Collapse>
    </Box>
  );
};

export default AIConfigValidator;
