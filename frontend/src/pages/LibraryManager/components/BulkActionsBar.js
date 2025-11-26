import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    Chip
} from '@material-ui/core';
import {
    Close as CloseIcon,
    Delete as DeleteIcon,
    OpenWith as MoveIcon,
    FileCopy as CopyIcon,
    Star as IndexIcon
} from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    root: {
        position: 'fixed',
        bottom: 0,
        left: 240,
        right: 0,
        zIndex: 1000,
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        padding: theme.spacing(2),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: theme.shadows[8],
        animation: '$slideUp 0.3s ease-out'
    },
    '@keyframes slideUp': {
        from: {
            transform: 'translateY(100%)'
        },
        to: {
            transform: 'translateY(0)'
        }
    },
    leftSection: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(2)
    },
    actions: {
        display: 'flex',
        gap: theme.spacing(1)
    },
    actionButton: {
        color: theme.palette.primary.contrastText,
        borderColor: theme.palette.primary.contrastText,
        '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
        }
    },
    closeButton: {
        color: theme.palette.primary.contrastText
    }
}));

const BulkActionsBar = ({ selectedCount, onClearSelection, onBulkDelete, onBulkMove, onBulkCopy, onBulkIndex }) => {
    const classes = useStyles();

    if (selectedCount === 0) return null;

    return (
        <Paper className={classes.root} elevation={0}>
            <Box className={classes.leftSection}>
                <Chip
                    label={`${selectedCount} ${selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}`}
                    color="secondary"
                />
                <Box className={classes.actions}>
                    <Button
                        variant="outlined"
                        size="small"
                        className={classes.actionButton}
                        startIcon={<MoveIcon />}
                        onClick={onBulkMove}
                    >
                        Mover
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        className={classes.actionButton}
                        startIcon={<CopyIcon />}
                        onClick={onBulkCopy}
                    >
                        Copiar
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        className={classes.actionButton}
                        startIcon={<IndexIcon />}
                        onClick={onBulkIndex}
                    >
                        Indexar
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        className={classes.actionButton}
                        startIcon={<DeleteIcon />}
                        onClick={onBulkDelete}
                        color="inherit"
                    >
                        Deletar
                    </Button>
                </Box>
            </Box>

            <IconButton
                size="small"
                className={classes.closeButton}
                onClick={onClearSelection}
                title="Cancelar seleção"
            >
                <CloseIcon />
            </IconButton>
        </Paper>
    );
};

export default BulkActionsBar;
