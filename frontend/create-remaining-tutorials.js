const fs = require('fs');
const path = require('path');

const helpsDir = path.join(__dirname, 'src', 'pages', 'Helps');

// Template base minimizado
const createTutorial = (name, displayName, icon, description, tips) => `import React, { useState } from "react";
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
  ${icon},
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
  tabsContainer: { borderBottom: \`1px solid \${theme.palette.divider}\`, backgroundColor: theme.palette.background.paper },
  tabContent: { flex: 1, overflow: "auto", padding: theme.spacing(3), backgroundColor: theme.palette.background.default },
  sectionCard: { marginBottom: theme.spacing(3), border: \`1px solid \${theme.palette.divider}\` },
}));

function TabPanel({ children, value, index, ...other }) {
  return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box>{children}</Box>}</div>;
}

const ${name} = () => {
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
              <strong>${displayName}</strong>
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
                    <${icon} style={{ marginRight: 8, verticalAlign: "middle" }} />
                    ${displayName}
                  </Typography>
                  <Typography variant="body1" paragraph>${description}</Typography>
                  <Alert severity="info"><strong>Dica:</strong> ${tips}</Alert>
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

export default ${name};
`;

const tutorials = [
    { name: 'KanbanTutorial', displayName: 'Kanban', icon: 'ViewModule', description: 'Visualize e gerencie atendimentos em cards organizados por etapas do funil.', tips: 'Arraste cards entre colunas para mudar status rapidamente' },
    { name: 'AgendamentosTutorial', displayName: 'Agendamentos', icon: 'Event', description: 'Agende mensagens e tarefas para envio automático em data/hora específicas.', tips: 'Use agendamentos para followups e lembretes automáticos' },
    { name: 'TagsTutorial', displayName: 'Tags', icon: 'Label', description: 'Organize contatos e atendimentos com etiquetas coloridas personalizadas.', tips: 'Crie tags por categoria, prioridade ou status do cliente' },
    { name: 'FlowBuilderTutorial', displayName: 'FlowBuilder', icon: 'AccountTree', description: 'Construa fluxos de conversa automatizados com Editor visual drag-and-drop.', tips: 'Teste o fluxo antes de ativar para garantir funcionamento correto' },
    { name: 'ArquivosChatbotTutorial', displayName: 'Arquivos Chatbot', icon: 'Folder', description: 'Gerencie arquivos (PDFs, imagens, vídeos) para envio automático pelo bot.', tips: 'Organize arquivos por categorias para facilitar localização' },
    { name: 'FilaChatbotTutorial', displayName: 'Fila Chatbot', icon: 'Queue', description: 'Configure filas de atendimento com prioridades e distribuição automática.', tips: 'Defina horários de funcionamento para cada fila' },
    { name: 'ConexoesWhatsAppTutorial', displayName: 'Conexões WhatsApp', icon: 'PhoneAndroid', description: 'Conecte e gerencie múltiplas contas de WhatsApp Business ou pessoal.', tips: 'Mantenha sempre um dispositivo conectado para evitar desconexões' },
    { name: 'IntegracoesTutorial', displayName: 'Integrações', icon: 'Extension', description: 'Integre com sistemas externos via webhooks, APIs e conectores nativos.', tips: 'Teste integrações em ambiente de homologação primeiro' },
    { name: 'APITutorial', displayName: 'API', icon: 'Code', description: 'Documentação completa da API REST para automações e integrações customizadas.', tips: 'Use tokens de acesso seguros e nunca compartilhe credenciais' },
    { name: 'PromptsIATutorial', displayName: 'Prompts IA', icon: 'Memory', description: 'Configure prompts personalizados para direcionar comportamento da IA.', tips: 'Seja específico e claro nos prompts para melhores resultados' },
    { name: 'ConfiguracoesTutorial', displayName: 'Configurações', icon: 'Settings', description: 'Ajuste preferências globais do sistema, notificações e personalizações.', tips: 'Revise configurações periodicamente para otimizar uso' },
    { name: 'UsuariosTutorial', displayName: 'Usuários', icon: 'People', description: 'Gerencie equipe, permissões, perfis de acesso e departamentos.', tips: 'Use perfis de permissão para controlar acesso por função' },
    { name: 'RelatoriosTutorial', displayName: 'Relatórios', icon: 'Assessment', description: 'Gere relatórios detalhados de desempenho, produtividade e métricas.', tips: 'Exporte relatórios em PDF ou CSV para análises externas' },
    { name: 'ListasContatosTutorial', displayName: 'Listas de Contatos', icon: 'ListAlt', description: 'Crie e gerencie listas segmentadas para campanhas e envios direcionados.', tips: 'Atualize listas regularmente para manter base limpa' },
    { name: 'FinanceiroTutorial', displayName: 'Financeiro', icon: 'AttachMoney', description: 'Controle assinaturas, pagamentos e faturamento do sistema.', tips: 'Mantenha método de pagamento atualizado para evitar interrupções' },
];

// Criar todos os arquivos
tutorials.forEach(({ name, displayName, icon, description, tips }) => {
    const content = createTutorial(name, displayName, icon, description, tips);
    const filePath = path.join(helpsDir, `${name}.js`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${name}.js criado`);
});

console.log(`\n✅ ${tutorials.length} tutoriais criados com sucesso!`);
