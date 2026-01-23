import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
    Typography,
    Paper,
    Grid,
    Divider,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Card,
    CardContent,
    Box,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    List
} from '@material-ui/core';

import AccountTreeIcon from '@material-ui/icons/AccountTree';
import SupervisorAccountIcon from '@material-ui/icons/SupervisorAccount';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import VisibilityIcon from '@material-ui/icons/Visibility';
import BlockIcon from '@material-ui/icons/Block';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import VerifiedUserIcon from '@material-ui/icons/VerifiedUser';

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(2),
    },
    sectionTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        fontWeight: 'bold',
        marginBottom: theme.spacing(2),
        color: theme.palette.primary.main,
    },
    card: {
        marginBottom: theme.spacing(2),
        borderLeft: `5px solid ${theme.palette.primary.main}`,
    },
    successCard: {
        marginBottom: theme.spacing(2),
        borderLeft: `5px solid #4caf50`,
        backgroundColor: '#f1f8e9',
    },
    warningCard: {
        marginBottom: theme.spacing(2),
        borderLeft: `5px solid #ff9800`,
        backgroundColor: '#fff3e0',
    },
    stepLabel: {
        fontWeight: 'bold',
    },
    iconBox: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: theme.palette.primary.light,
        color: '#fff',
        marginRight: theme.spacing(1),
    }
}));

const HierarchyTutorial = () => {
    const classes = useStyles();

    return (
        <div className={classes.root}>

            {/* INTRODUÇÃO */}
            <Card className={classes.root} elevation={0} style={{ backgroundColor: '#e3f2fd', marginBottom: 20 }}>
                <Grid container alignItems="center">
                    <Grid item>
                        <HelpOutlineIcon style={{ fontSize: 40, color: '#1976d2', marginRight: 16 }} />
                    </Grid>
                    <Grid item xs>
                        <Typography variant="h6" style={{ color: '#1565c0', fontWeight: 'bold' }}>
                            Guia de Gestão Hierárquica e Roteamento
                        </Typography>
                        <Typography variant="body2" style={{ color: '#0d47a1' }}>
                            Entenda como configurar a hierarquia de sua equipe e como o sistema distribui os tickets automaticamente.
                        </Typography>
                    </Grid>
                </Grid>
            </Card>

            <Grid container spacing={3}>

                {/* COLUNA ESQUERDA: VISIBILIDADE */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" className={classes.sectionTitle}>
                        <VisibilityIcon /> 1. Hierarquia e Visibilidade
                    </Typography>

                    <Paper elevation={2} style={{ padding: 16, marginBottom: 16 }}>
                        <Typography variant="body2" paragraph>
                            O sistema segue uma lógica estrita de "Quem pode ver o quê". Isso garante que vendedores não vejam tickets uns dos outros, mas supervisores tenham controle total.
                        </Typography>

                        <List>
                            <ListItem>
                                <ListItemAvatar>
                                    <Avatar style={{ backgroundColor: '#2196f3' }}><VerifiedUserIcon /></Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary="Admin / Super"
                                    secondary="Vê TUDO. Pode acessar qualquer ticket de qualquer carteira."
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemAvatar>
                                    <Avatar style={{ backgroundColor: '#ff9800' }}><SupervisorAccountIcon /></Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary="Supervisor"
                                    secondary="Vê sua própria carteira + A carteira dos usuários que ele gerencia (configurado nesta tela)."
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemAvatar>
                                    <Avatar style={{ backgroundColor: '#4caf50' }}><AccountTreeIcon /></Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary="Vendedor (Padrão)"
                                    secondary="Blindado. Vê APENAS os tickets vinculados à sua carteira (ou filas públicas)."
                                />
                            </ListItem>
                        </List>
                    </Paper>

                    <Card className={classes.successCard}>
                        <CardContent>
                            <Typography variant="subtitle1" style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircleIcon style={{ color: '#4caf50' }} /> Como Configurar?
                            </Typography>
                            <Typography variant="body2">
                                1. Edite o usuário que será <b>Supervisor</b>.<br />
                                2. Na aba "Permissões" (visível apenas para Super Admin), encontre "Usuários Gerenciados".<br />
                                3. Selecione os vendedores da equipe dele.<br />
                                4. Pronto! Ele passará a ver os tickets desses vendedores automaticamente.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                {/* COLUNA DIREITA: ROTEAMENTO */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" className={classes.sectionTitle}>
                        <CallSplitIcon /> 2. Roteamento Inteligente (Smart Routing)
                    </Typography>

                    <Paper elevation={2} style={{ padding: 16 }}>
                        <Typography variant="body2" paragraph>
                            Quando um cliente entra em contato, o sistema decide o destino com base na Carteira e no Status (Online/Offline) do dono.
                        </Typography>

                        <Stepper orientation="vertical" activeStep={-1}>
                            <Step active={true}>
                                <StepLabel icon={<CheckCircleIcon color="primary" />}>Cliente Envia Mensagem</StepLabel>
                                <StepContent>
                                    <Typography variant="caption">O sistema verifica: Esse cliente tem dono na Carteira?</Typography>
                                </StepContent>
                            </Step>

                            <Step active={true}>
                                <StepLabel icon={<CallSplitIcon color="secondary" />}>Verificação de Carteira</StepLabel>
                                <StepContent>
                                    <Box p={1} bgcolor="#f5f5f5" borderRadius={4}>
                                        <Typography variant="body2" style={{ fontWeight: 'bold', color: 'green' }}>SIM: Tem dono (Ex: João)</Typography>
                                        <Typography variant="caption">O sistema verifica: João está ONLINE?</Typography>
                                    </Box>
                                </StepContent>
                            </Step>

                            <Step active={true}>
                                <StepLabel icon={<AccountTreeIcon style={{ color: '#4caf50' }} />}>Atribuição Inteligente</StepLabel>
                                <StepContent>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12}>
                                            <Card variant="outlined" style={{ borderLeft: '4px solid #4caf50' }}>
                                                <Box p={1}>
                                                    <Typography variant="subtitle2" style={{ color: '#2e7d32' }}>ONLINE 🟢</Typography>
                                                    <Typography variant="caption">Ticket abre direto para o João.</Typography>
                                                </Box>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Card variant="outlined" style={{ borderLeft: '4px solid #f44336' }}>
                                                <Box p={1}>
                                                    <Typography variant="subtitle2" style={{ color: '#c62828' }}>OFFLINE / FÉRIAS 🔴</Typography>
                                                    <Typography variant="caption">Ticket fica <b>PENDENTE</b> na fila geral. Supervisor vê e assume.</Typography>
                                                </Box>
                                            </Card>
                                        </Grid>
                                    </Grid>
                                </StepContent>
                            </Step>
                        </Stepper>
                    </Paper>

                    <Box mt={2} p={2} border="1px dashed #ccc" borderRadius={8} bgcolor="#fafafa">
                        <Typography variant="caption" color="textSecondary">
                            <BlockIcon style={{ fontSize: 14, verticalAlign: 'middle' }} /> <b>Nota:</b> Se o cliente não tiver carteira, ele cai na Fila de Triagem padrão para ser distribuído manualmente.
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
        </div>
    );
};

export default HierarchyTutorial;
