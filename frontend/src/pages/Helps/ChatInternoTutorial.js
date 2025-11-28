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
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
    Forum,
    CheckCircle,
    Error as ErrorIcon,
    Info as InfoIcon,
    People,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { Link } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
    root: { display: "flex", flexDirection: "column" },
    content: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
    tabsContainer: { borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper },
    tabContent: { flex: 1, overflow: "auto", padding: theme.spacing(3), backgroundColor: theme.palette.background.default },
    sectionCard: { marginBottom: theme.spacing(3), border: `1px solid ${theme.palette.divider}` },
}));

function TabPanel({ children, value, index, ...other }) {
    return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box>{children}</Box>}</div>;
}

const ChatInternoTutorial = () => {
    const classes = useStyles();
    const [tabValue, setTabValue] = useState(0);

    return (
        <div className={classes.root}>
            <MainContainer>
                <MainHeader>
                    <Title>
                        <span>
                            <Link to="/helps" style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}>Central de Ajuda</Link>
                            <span style={{ margin: "0 8px", opacity: 0.6 }}>{">"}</span>
                            <strong>Chat Interno</strong>
                        </span>
                    </Title>
                    <MainHeaderButtonsWrapper />
                </MainHeader>

                <div className={classes.content}>
                    <Paper className={classes.tabsContainer}>
                        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} indicatorColor="primary" textColor="primary" variant="fullWidth">
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
                                        <Forum style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Chat Interno da Equipe
                                    </Typography>
                                    <Typography variant="body1" paragraph>
                                        Comunique-se com sua equipe sem sair do sistema. Envie mensagens,
                                        compartilhe informações sobre atendimentos e coordene ações em tempo real.
                                    </Typography>
                                    <Alert severity="info">
                                        <strong>Dica:</strong> Use o chat interno para pedir ajuda ou repassar informações
                                        importantes sem interromper atendimentos
                                    </Alert>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>Como Usar</Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="1. Abrir Chat" secondary="Clique no ícone de chat no menu lateral" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="2. Selecionar Usuário" secondary="Escolha o colega para conversar" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="3. Enviar Mensagem" secondary="Digite e pressione Enter para enviar" />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>Recursos</Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemIcon><People color="primary" /></ListItemIcon>
                                            <ListItemText primary="Lista de Usuários Online" secondary="Veja quem está disponível em tempo real" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><Forum color="primary" /></ListItemIcon>
                                            <ListItemText primary="Mensagens Instantâneas" secondary="Comunicação em tempo real com notificações" />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={3}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>Casos de Uso</Typography>
                                    <Box mb={2}>
                                        <Typography variant="h6">🆘 Pedindo Ajuda</Typography>
                                        <Typography variant="body2">
                                            "Preciso de ajuda com cliente técnico, alguém pode assumir?"
                                        </Typography>
                                    </Box>
                                    <Box mb={2}>
                                        <Typography variant="h6">📢 Avisos Urgentes</Typography>
                                        <Typography variant="body2">
                                            "Sistema de pagamentos está fora, orientar clientes a aguardar"
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
                                        Problemas Comuns
                                    </Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText primary="Mensagens não chegam" secondary="Verifique conexão com internet e recarregue página" />
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

export default ChatInternoTutorial;
