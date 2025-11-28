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
    Contacts as ContatosIcon,
    Person,
    Label,
    CheckCircle,
    Error as ErrorIcon,
    Info as InfoIcon,
    Phone,
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

const ContatosTutorial = () => {
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
                            <strong>Contatos</strong>
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
                                        <ContatosIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Contatos - Base de Clientes
                                    </Typography>
                                    <Typography variant="body1" paragraph>
                                        Gerencie sua base de contatos de forma completa. Adicione informações
                                        personalizadas, organize com tags, visualize histórico de conversas
                                        e segmente seus clientes para campanhas direcionadas.
                                    </Typography>

                                    <Alert severity="info" style={{ marginTop: 16 }}>
                                        <strong>Dica:</strong> Use campos personalizados para armazenar informações
                                        específicas do seu negócio (CPF, código de cliente, etc.)
                                    </Alert>

                                    <Box mt={3}>
                                        <Typography variant="h6" gutterBottom>Informações Principais</Typography>
                                        <List dense>
                                            <ListItem>
                                                <ListItemText primary="Nome e telefone" secondary="Dados básicos do contato" />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText primary="Email" secondary="Para comunicações alternativas" />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText primary="Tags" secondary="Organização e segmentação" />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText primary="Campos personalizados" secondary="Informações específicas" />
                                            </ListItem>
                                        </List>
                                    </Box>
                                </CardContent>
                            </Card>
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <Card className={classes.sectionCard}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>
                                        Como Gerenciar Contatos
                                    </Typography>

                                    <List>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="1. Adicionar Contato"
                                                secondary="Clique em '+' e preencha nome e telefone"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="2. Editar Informações"
                                                secondary="Clique no contato para abrir detalhes e editar"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="3. Adicionar Tags"
                                                secondary="Use tags para categorizar (VIP, cliente novo, etc.)"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="4. Visualizar Histórico"
                                                secondary="Acesse todo histórico de conversas do contato"
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
                                            <ListItemIcon><Person color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Perfil Completo"
                                                secondary="Nome, telefone, email, foto e campos personalizados"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><Label color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Sistema de Tags"
                                                secondary="Organize e segmente contatos com tags coloridas"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><Phone color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary="Importação/Exportação"
                                                secondary="Importe de CSV ou exporte sua base completa"
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
                                            🏷️ Segmentação para Campanhas
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Organize contatos com tags (VIP, interessado em produto X)
                                            para enviar campanhas segmentadas
                                        </Typography>
                                    </Box>

                                    <Box mt={2} mb={2}>
                                        <Typography variant="h6" gutterBottom>
                                            📊 Análise de Base
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Use filtros para identificar clientes inativos, novos ou com mais interações
                                        </Typography>
                                    </Box>

                                    <Box mt={2} mb={2}>
                                        <Typography variant="h6" gutterBottom>
                                            🔄 Sincronização com CRM
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            Exporte/importe dados para integrar com outros sistemas
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
                                        <strong>Contato duplicado?</strong> O sistema permite o mesmo telefone
                                        apenas uma vez. Verifique se já existe antes de criar.
                                    </Alert>

                                    <List>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText
                                                primary="Não consigo editar contato"
                                                secondary="Verifique se você tem permissão de administrador"
                                            />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><InfoIcon /></ListItemIcon>
                                            <ListItemText
                                                primary="Importação falhou"
                                                secondary="Verifique se o CSV está no formato correto (nome,telefone,email)"
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

export default ContatosTutorial;
