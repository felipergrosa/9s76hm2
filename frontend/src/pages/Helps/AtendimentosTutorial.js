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
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
    Assignment as AtendimentoIcon,
    Forum,
    CheckCircle,
    Error as ErrorIcon,
    Info as InfoIcon,
    Person,
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
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

const AtendimentosTutorial = () => {
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
                            <strong>Atendimentos</strong>
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
                                        <AtendimentoIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Atendimentos - Gestão de Tickets
                                    </Typography>
                                    <Typography variant="body1" paragraph>
                                        O módulo de Atendimentos é o coração do sistema. Aqui você gerencia
                                        todas as conversas com clientes, atribui tickets, acompanha status
                                        e mantém o histórico completo de interações.
                                    </Typography>

                                    <Alert severity="info" style={{ marginTop: 16 }}>
                                        <strong>Dica:</strong> Use filtros e tags para organizar seus atendimentos
                                        e encontrar conversas rapidamente.
                                    </Alert>

                                    <Box mt={3}>
                                        <Typography variant="h6" gutterBottom>Tipos de Atendimento</Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={4}>
                                                <Chip label="Abertos" color="primary" style={{ width: "100%" }} />
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Chip label="Em Andamento" color="default" style={{ width: "100%" }} />
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Chip label="Finalizados" color="secondary" style={{ width: "100%" }} />
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
                                        Como Usar Atendimentos
                                    </Typography>

                                    <List>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="1. Aceite um Atendimento"
                                                secondary="Clique em 'Aceitar' para assumir um ticket da fila"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="2. Converse com o Cliente"
                                                secondary="Use o chat para responder mensagens em tempo real"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="3. Adicione Tags e Notas"
                                                secondary="Organize e documente informações importantes"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="4. Finalize ou Transfira"
                                                secondary="Resolva o atendimento ou transfira para outro setor"
                                            />
                                        </ListItem>
                                    </List>

                                    <Alert severity="success" style={{ marginTop: 16 }}>
                                        <strong>Atalho:</strong> Pressione Ctrl+Enter para enviar mensagens rapidamente
                                    </Alert>
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
                                            <ListItemIcon><Forum color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Chat em Tempo Real"
                                                secondary="Mensagens instantâneas com notificações sonoras"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><Person color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Perfil do Cliente"
                                                secondary="Histórico completo, tags e informações personalizadas"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Respostas Rápidas"
                                                secondary="Use atalhos para enviar mensagens pr é-definidas"
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
                                            💬 Atendimento Padrão
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Cliente envia mensagem → Atendente aceita → Conversa → Resolve → Finaliza
                                        </Typography>
                                    </Box>

                                    <Box mt={2} mb={2}>
                                        <Typography variant="h6" gutterBottom>
                                            🔄 Transferência entre Setores
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Quando um atendente não pode resolver, transfere para setor especializado
                                        </Typography>
                                    </Box>

                                    <Box mt={2} mb={2}>
                                        <Typography variant="h6" gutterBottom>
                                            📝 Atendimento com Followup
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Adicione notas e agende retorno para acompanhamento futuro
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
                                        <strong>Mensagens não chegam?</strong> Verifique a conexão com o WhatsApp
                                        em Conexões → WhatsApp
                                    </Alert>

                                    <List>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText
                                                primary="Ticket desapareceu"
                                                secondary="Verifique os filtros ativos ou se foi transferido/finalizado"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText
                                                primary="Não consigo aceitar atendimento"
                                                secondary="Você pode ter atingido o limite de atendimentos simultâneos"
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

export default AtendimentosTutorial;
