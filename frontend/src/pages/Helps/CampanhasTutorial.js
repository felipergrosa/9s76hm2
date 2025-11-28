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
    SpeakerPhone,
    CheckCircle,
    Error as ErrorIcon,
    Info as InfoIcon,
    Send,
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

const CampanhasTutorial = () => {
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
                            <strong>Campanhas</strong>
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
                                        <SpeakerPhone style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Campanhas de Mensagens
                                    </Typography>
                                    <Typography variant="body1" paragraph>
                                        Envie mensagens em massa para listas de contatos segmentadas.
                                        Promova produtos, avisos importantes ou conteúdo relevante de forma automatizada.
                                    </Typography>
                                    <Alert severity="warning">
                                        <strong>Atenção:</strong> Respeite as regras do WhatsApp para evitar banimentos.
                                        Não envie SPAM!
                                    </Alert>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>Como Criar Campanha</Typography>
                                    <List>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="1. Nova Campanha" secondary='Menu Campanhas → "+"' />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="2. Definir Nome e Mensagem" secondary="Crie conteúdo relevante e personalizado" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="3. Selecionar Lista" secondary="Escolha lista de contatos ou tags" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="4. Agendar ou Enviar" secondary="Defina data/hora ou envie imediatamente" />
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
                                            <ListItemIcon><Send color="primary" /></ListItemIcon>
                                            <ListItemText primary="Envio Programado" secondary="Agende campanhas para data/hora específicas" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText primary="Personalização" secondary="Use variáveis como {nome} para personalizar" />
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
                                        <Typography variant="h6">🎉 Promoções</Typography>
                                        <Typography variant="body2">
                                            {"Olá {nome}! Aproveite 20% OFF em toda loja até domingo!"}
                                        </Typography>
                                    </Box>
                                    <Box mb={2}>
                                        <Typography variant="h6">📢 Avisos Importantes</Typography>
                                        <Typography variant="body2">
                                            {"Loja fechada amanhã para manutenção. Voltamos quinta-feira!"}
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
                                            <ListItemText primary="Campanha não enviou" secondary="Verifique se a conexão do WhatsApp está ativa" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText primary="Mensagens caindo no SPAM" secondary="Evite textos muito comerciais, use linguagem natural" />
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

export default CampanhasTutorial;
