import React, { useState } from "react";
import {
    makeStyles,
    Paper,
    Typography,
    Tabs,
    Tab,
    Box,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Grid,
    Chip,
    Divider,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
    Dashboard as DashboardIcon,
    TrendingUp,
    People,
    Assessment,
    CheckCircle,
    Error as ErrorIcon,
    Info as InfoIcon,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { Link } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column",
    },
    content: {
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
    },
    tabsContainer: {
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
    },
    tabContent: {
        flex: 1,
        overflow: "auto",
        padding: theme.spacing(3),
        backgroundColor: theme.palette.background.default,
    },
    sectionCard: {
        marginBottom: theme.spacing(3),
        border: `1px solid ${theme.palette.divider}`,
    },
}));

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            {...other}
        >
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

const DashboardTutorial = () => {
    const classes = useStyles();
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    return (
        <div className={classes.root}>
            <MainContainer>
                <MainHeader>
                    <Title>
                        <span>
                            <Link to="/helps" style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}>
                                Central de Ajuda
                            </Link>
                            <span style={{ margin: "0 8px", opacity: 0.6 }}>{">"}</span>
                            <strong>Dashboard</strong>
                        </span>
                    </Title>
                    <MainHeaderButtonsWrapper />
                </MainHeader>

                <div className={classes.content}>
                    <Paper className={classes.tabsContainer}>
                        <Tabs
                            value={tabValue}
                            onChange={handleTabChange}
                            indicatorColor="primary"
                            textColor="primary"
                            variant="fullWidth"
                        >
                            <Tab label="Visão Geral" />
                            <Tab label="Como Usar" />
                            <Tab label="Recursos" />
                            <Tab label="Casos de Uso" />
                            <Tab label="Solução de Problemas" />
                        </Tabs>
                    </Paper>

                    <div className={classes.tabContent}>
                        <TabPanel value={tabValue} index={0}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h4" gutterBottom>
                                        <DashboardIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Dashboard - Visão Geral do Sistema
                                    </Typography>
                                    <Typography variant="body1" paragraph>
                                        O Dashboard é sua central de métricas e indicadores em tempo real.
                                        Acompanhe o desempenho da equipe, volume de atendimentos, satisfação
                                        dos clientes e muito mais em um só lugar.
                                    </Typography>

                                    <Alert severity="info" style={{ marginTop: 16 }}>
                                        <strong>Dica:</strong> Configure os cards do dashboard de acordo com as métricas
                                        mais importantes para seu negócio.
                                    </Alert>

                                    <Box mt={3}>
                                        <Typography variant="h6" gutterBottom>Principais Métricas</Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={6}>
                                                <Card variant="outlined">
                                                    <CardContent>
                                                        <Typography color="textSecondary" gutterBottom>
                                                            📊 Atendimentos em Tempo Real
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            Visualize quantos atendimentos estão em andamento, aguardando ou finalizados
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <Card variant="outlined">
                                                    <CardContent>
                                                        <Typography color="textSecondary" gutterBottom>
                                                            👥 Performance da Equipe
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            Acompanhe o desempenho individual e coletivo dos atendentes
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>
                                        Como Usar o Dashboard
                                    </Typography>

                                    <List>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="1. Acesse o Dashboard"
                                                secondary="Clique no menu lateral em 'Dashboard'"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="2. Visualize as Métricas"
                                                secondary="Todos os cards são atualizados em tempo real"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="3. Filtre por Período"
                                                secondary="Use os filtros de data para análises específicas"
                                            />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>
                                        Recursos Disponíveis
                                    </Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemIcon><TrendingUp color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Gráficos Interativos"
                                                secondary="Visualize tendências e padrões com gráficos dinâmicos"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><People color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Ranking de Atendentes"
                                                secondary="Compare performance e identifique top performers"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><Assessment color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Exportação de Relatórios"
                                                secondary="Exporte dados para análise externa (CSV, PDF)"
                                            />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={3}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>
                                        Casos de Uso Comuns
                                    </Typography>

                                    <Box mb={2}>
                                        <Typography variant="h6" gutterBottom>
                                            📈 Monitoramento Diário
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Comece o dia verificando o dashboard para identificar gargalos,
                                            picos de atendimento e distribuição de carga entre atendentes.
                                        </Typography>
                                    </Box>

                                    <Divider />

                                    <Box mt={2} mb={2}>
                                        <Typography variant="h6" gutterBottom>
                                            🎯 Análise de Performance
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Use os gráficos de tendência para avaliar melhorias ou quedas
                                            de performance ao longo do tempo.
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={4}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>
                                        <ErrorIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Solução de Problemas
                                    </Typography>

                                    <Alert severity="warning" style={{ marginBottom: 16 }}>
                                        <strong>Métricas não atualizam?</strong> Verifique se há conexões ativas
                                        e se o backend está rodando corretamente.
                                    </Alert>

                                    <List>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText
                                                primary="Dados incorretos"
                                                secondary="Verifique os filtros de data e período selecionados"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText
                                                primary="Gráfico não carrega"
                                                secondary="Limpe o cache do navegador (Ctrl+Shift+Del)"
                                            />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </TabPanel>
                    </div>
                </div>
            </MainContainer>
        </div>
    );
};

export default DashboardTutorial;
