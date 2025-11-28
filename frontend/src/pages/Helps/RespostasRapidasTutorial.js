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
    Chip,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
    QuestionAnswer,
    CheckCircle,
    Error as ErrorIcon,
    Info as InfoIcon,
    Keyboard,
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

const RespostasRapidasTutorial = () => {
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
                            <strong>Respostas Rápidas</strong>
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
                                        <QuestionAnswer style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Respostas Rápidas
                                    </Typography>
                                    <Typography variant="body1" paragraph>
                                        Crie mensagens pré-definidas com atalhos para responder perguntas frequentes
                                        de forma rápida e padronizada. Aumente a produtividade da equipe!
                                    </Typography>
                                    <Alert severity="info">
                                        <strong>Dica:</strong> Use "/" seguido do atalho para ativar uma resposta rápida
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
                                            <ListItemText primary="1. Criar Resposta" secondary='Menu Respostas Rápidas → "+"' />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="2. Definir Atalho" secondary="Ex: /oi, /horario, /preco" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="3. Usar no Chat" secondary="Digite / + atalho durante atendimento" />
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
                                            <ListItemIcon><Keyboard color="primary" /></ListItemIcon>
                                            <ListItemText primary="Atalhos Personalizados" secondary="Defina qualquer atalho que faça sentido" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="Variáveis Dinâmicas" secondary="Use {nome}, {protocolo} para personalizar" />
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
                                        <Typography variant="h6">🕐 Horário de Atendimento</Typography>
                                        <Chip label="/horario" size="small" color="primary" style={{ marginRight: 8 }} />
                                        <Typography variant="body2">"Atendemos de segunda a sexta, 9h às 18h"</Typography>
                                    </Box>
                                    <Box mb={2}>
                                        <Typography variant="h6">📞 Solicitar Contato</Typography>
                                        <Chip label="/contato" size="small" color="primary" style={{ marginRight: 8 }} />
                                        <Typography variant="body2">"Qual o melhor telefone para retorno?"</Typography>
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
                                            <ListItemText primary="Atalho não funciona" secondary="Verifique se começa com / e não tem espaços" />
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

export default RespostasRapidasTutorial;
