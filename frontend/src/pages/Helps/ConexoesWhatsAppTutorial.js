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
  PhoneAndroid,
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
  root: { display: "flex", flexDirection: "column" },
  content: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  tabsContainer: { borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper },
  tabContent: { flex: 1, overflow: "auto", padding: theme.spacing(3), backgroundColor: theme.palette.background.default },
  sectionCard: { marginBottom: theme.spacing(3), border: `1px solid ${theme.palette.divider}` },
}));

function TabPanel({ children, value, index, ...other }) {
  return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box>{children}</Box>}</div>;
}

const ConexoesWhatsAppTutorial = () => {
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
              <strong>Conexões WhatsApp</strong>
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
                    <PhoneAndroid style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Conexões WhatsApp
                  </Typography>
                  <Typography variant="body1" paragraph>Conecte e gerencie múltiplas contas de WhatsApp Business ou pessoal.</Typography>
                  <Alert severity="info"><strong>Dica:</strong> Mantenha sempre um dispositivo conectado para evitar desconexões</Alert>
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
                      <ListItemText primary="Passo 1" secondary="Acesse o módulo pelo menu lateral" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText primary="Passo 2" secondary="Configure as opções desejadas" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Recursos Principais</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText primary="Recurso 1" secondary="Descrição do recurso" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>Casos de Uso</Typography>
                  <Typography variant="body2">Exemplos práticos de utilização do módulo.</Typography>
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
                  <List>
                    <ListItem>
                      <ListItemIcon><InfoIcon /></ListItemIcon>
                      <ListItemText primary="Problema comum" secondary="Solução: verifique as configurações" />
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

export default ConexoesWhatsAppTutorial;
