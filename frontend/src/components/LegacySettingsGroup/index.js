import React from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip,
  FormGroup
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

const useStyles = makeStyles((theme) => ({
  categoryTitle: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& svg': {
      fontSize: '1.1rem',
    },
  },
  settingGroup: {
    paddingLeft: theme.spacing(1),
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing(0.5),
    rowGap: theme.spacing(0.25),
  },
  settingLabel: {
    margin: 0,
    marginLeft: theme.spacing(1),
    '& .MuiTypography-root': {
      fontSize: '0.813rem',
      lineHeight: 1.3,
    },
    '& .MuiCheckbox-root': {
      padding: theme.spacing(0.5),
    },
  },
  selectAllButton: {
    padding: 4,
    marginLeft: theme.spacing(0.5),
  },
}));

/**
 * Componente para agrupar configurações legadas com checkboxes
 */
const LegacySettingsGroup = ({ title, icon, settings, values, onChange, disabled = false }) => {
  const classes = useStyles();

  const handleToggle = (settingKey) => {
    const currentValue = values[settingKey];
    const newValue = currentValue === 'enabled' || currentValue === true 
      ? (typeof currentValue === 'boolean' ? false : 'disabled')
      : (typeof currentValue === 'boolean' ? true : 'enabled');
    
    onChange(settingKey, newValue);
  };

  const handleSelectAll = () => {
    settings.forEach(setting => {
      const newValue = typeof values[setting.key] === 'boolean' ? true : 'enabled';
      onChange(setting.key, newValue);
    });
  };

  const isChecked = (settingKey) => {
    const value = values[settingKey];
    return value === 'enabled' || value === 'enable' || value === true;
  };

  return (
    <Box style={{ marginBottom: 16 }}>
      <Typography className={classes.categoryTitle}>
        {icon}
        {title} ({settings.length})
        <Tooltip title="Selecionar todos">
          <IconButton 
            size="small" 
            onClick={handleSelectAll}
            disabled={disabled}
            className={classes.selectAllButton}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Typography>
      <FormGroup className={classes.settingGroup}>
        {settings.map((setting) => (
          <FormControlLabel
            key={setting.key}
            className={classes.settingLabel}
            control={
              <Checkbox
                checked={isChecked(setting.key)}
                onChange={() => handleToggle(setting.key)}
                disabled={disabled}
                size="small"
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">{setting.label}</Typography>
                {setting.description && (
                  <Typography variant="caption" color="textSecondary">
                    {setting.description}
                  </Typography>
                )}
              </Box>
            }
          />
        ))}
      </FormGroup>
    </Box>
  );
};

export default LegacySettingsGroup;
