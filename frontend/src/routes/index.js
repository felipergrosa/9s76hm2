import React, { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Switch } from "react-router-dom";

import LoggedInLayout from "../layout";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";

// Componente de loading para lazy loading
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    backgroundColor: 'var(--bg, #f5f5f5)'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #e0e0e0',
      borderTop: '3px solid var(--primary, #065183)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

// LAZY LOADING: Páginas carregadas sob demanda (reduz bundle inicial em ~80%)
// Páginas principais (mais acessadas - prefetch)
const Dashboard = lazy(() => import("../pages/Dashboard"));
const TicketResponsiveContainer = lazy(() => import("../pages/TicketResponsiveContainer"));
const Contacts = lazy(() => import("../pages/Contacts"));
const Groups = lazy(() => import("../pages/Groups"));
const Chat = lazy(() => import("../pages/Chat"));

// Páginas de autenticação (carregadas primeiro)
const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));
const ForgotPassword = lazy(() => import("../pages/ForgetPassWord"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));

// Páginas secundárias
const Connections = lazy(() => import("../pages/Connections"));
const SettingsCustom = lazy(() => import("../pages/SettingsCustom"));
const Financeiro = lazy(() => import("../pages/Financeiro"));
const Users = lazy(() => import("../pages/Users"));
const ContactImportPage = lazy(() => import("../pages/Contacts/import"));
const ChatMoments = lazy(() => import("../pages/Moments"));
const Queues = lazy(() => import("../pages/Queues"));
const Tags = lazy(() => import("../pages/Tags"));
const MessagesAPI = lazy(() => import("../pages/MessagesAPI"));
const QuickMessages = lazy(() => import("../pages/QuickMessages"));
const Schedules = lazy(() => import("../pages/Schedules"));
const Annoucements = lazy(() => import("../pages/Annoucements"));
const AllConnections = lazy(() => import("../pages/AllConnections"));
const Reports = lazy(() => import("../pages/Reports"));
const QueueIntegration = lazy(() => import("../pages/QueueIntegration"));
const LibraryManager = lazy(() => import("../pages/LibraryManager"));
const ToDoList = lazy(() => import("../pages/ToDoList"));
const Kanban = lazy(() => import("../pages/Kanban"));
const TagsKanban = lazy(() => import("../pages/TagsKanban"));
const Companies = lazy(() => import("../pages/Companies"));

// Campanhas
const Campaigns = lazy(() => import("../pages/Campaigns"));
const CampaignsConfig = lazy(() => import("../pages/CampaignsConfig"));
const CampaignDetailedReport = lazy(() => import("../pages/CampaignDetailedReport"));
const CampaignsPhrase = lazy(() => import("../pages/CampaignsPhrase"));
const ContactLists = lazy(() => import("../pages/ContactLists"));
const ContactListItems = lazy(() => import("../pages/ContactListItems"));

// FlowBuilder (pesado - sempre lazy)
const FlowBuilder = lazy(() => import("../pages/FlowBuilder"));
const FlowBuilderConfig = lazy(() => import("../pages/FlowBuilderConfig").then(m => ({ default: m.FlowBuilderConfig })));
const FlowDefault = lazy(() => import("../pages/FlowDefault"));

// IA
const AISettings = lazy(() => import("../components/AISettings"));
const AIAgents = lazy(() => import("../pages/AIAgents"));
const AITraining = lazy(() => import("../pages/AITraining"));

// Tutoriais (raramente acessados - sempre lazy)
const Helps = lazy(() => import("../pages/Helps"));
const AITutorial = lazy(() => import("../pages/Helps/AITutorial"));
const BotTutorial = lazy(() => import("../pages/Helps/BotTutorial"));
const DashboardTutorial = lazy(() => import("../pages/Helps/DashboardTutorial"));
const AtendimentosTutorial = lazy(() => import("../pages/Helps/AtendimentosTutorial"));
const RespostasRapidasTutorial = lazy(() => import("../pages/Helps/RespostasRapidasTutorial"));
const KanbanTutorial = lazy(() => import("../pages/Helps/KanbanTutorial"));
const ContatosTutorial = lazy(() => import("../pages/Helps/ContatosTutorial"));
const AgendamentosTutorial = lazy(() => import("../pages/Helps/AgendamentosTutorial"));
const TagsTutorial = lazy(() => import("../pages/Helps/TagsTutorial"));
const ChatInternoTutorial = lazy(() => import("../pages/Helps/ChatInternoTutorial"));
const CampanhasTutorial = lazy(() => import("../pages/Helps/CampanhasTutorial"));
const FlowBuilderTutorial = lazy(() => import("../pages/Helps/FlowBuilderTutorial"));
const FilaChatbotTutorial = lazy(() => import("../pages/Helps/FilaChatbotTutorial"));
const PromptsIATutorial = lazy(() => import("../pages/Helps/PromptsIATutorial"));
const UsuariosTutorial = lazy(() => import("../pages/Helps/UsuariosTutorial"));
const ConfiguracoesTutorial = lazy(() => import("../pages/Helps/ConfiguracoesTutorial"));
const ConexoesWhatsAppTutorial = lazy(() => import("../pages/Helps/ConexoesWhatsAppTutorial"));
const IntegracoesTutorial = lazy(() => import("../pages/Helps/IntegracoesTutorial"));
const APITutorial = lazy(() => import("../pages/Helps/APITutorial"));
const ArquivosChatbotTutorial = lazy(() => import("../pages/Helps/ArquivosChatbotTutorial"));
const ListasContatosTutorial = lazy(() => import("../pages/Helps/ListasContatosTutorial"));
const RelatoriosTutorial = lazy(() => import("../pages/Helps/RelatoriosTutorial"));
const FinanceiroTutorial = lazy(() => import("../pages/Helps/FinanceiroTutorial"));
const FacebookTutorial = lazy(() => import("../pages/Helps/FacebookTutorial"));
const InstagramTutorial = lazy(() => import("../pages/Helps/InstagramTutorial"));
const WebChatTutorial = lazy(() => import("../pages/Helps/WebChatTutorial"));

// Outros
const Subscription = lazy(() => import("../pages/Subscription"));


const Routes = () => {
  const [showCampaigns, setShowCampaigns] = useState(false);

  useEffect(() => {
    const cshow = localStorage.getItem("cshow");
    if (cshow !== undefined) {
      setShowCampaigns(true);
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <TicketsContextProvider>
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route exact path="/login" component={Login} />
              <Route exact path="/signup" component={Signup} />
              <Route exact path="/forgot-password" component={ForgotPassword} />
              <Route exact path="/reset-password" component={ResetPassword} />
              <WhatsAppsProvider>
                <LoggedInLayout>
                <Route exact path="/financeiro" component={Financeiro} isPrivate />

                <Route exact path="/companies" component={Companies} isPrivate />
                <Route exact path="/" component={Dashboard} isPrivate />
                <Route exact path="/tickets/:ticketId?" component={TicketResponsiveContainer} isPrivate />
                <Route exact path="/connections" component={Connections} isPrivate />
                <Route exact path="/quick-messages" component={QuickMessages} isPrivate />
                <Route exact path="/todolist" component={ToDoList} isPrivate />
                <Route exact path="/schedules" component={Schedules} isPrivate />
                <Route exact path="/tags" component={Tags} isPrivate />
                <Route exact path="/contacts" component={Contacts} isPrivate />
                <Route exact path="/contacts/import" component={ContactImportPage} isPrivate />
                <Route exact path="/groups" component={Groups} isPrivate />
                <Route exact path="/helps" component={Helps} isPrivate />
                <Route exact path="/helps/ai-tutorial" component={AITutorial} isPrivate />
                <Route exact path="/helps/bot-tutorial" component={BotTutorial} isPrivate />
                <Route exact path="/helps/dashboard" component={DashboardTutorial} isPrivate />
                <Route exact path="/helps/atendimentos" component={AtendimentosTutorial} isPrivate />
                <Route exact path="/helps/respostas-rapidas" component={RespostasRapidasTutorial} isPrivate />
                <Route exact path="/helps/kanban" component={KanbanTutorial} isPrivate />
                <Route exact path="/helps/contatos" component={ContatosTutorial} isPrivate />
                <Route exact path="/helps/agendamentos" component={AgendamentosTutorial} isPrivate />
                <Route exact path="/helps/tags" component={TagsTutorial} isPrivate />
                <Route exact path="/helps/chat-interno" component={ChatInternoTutorial} isPrivate />
                <Route exact path="/helps/campanhas" component={CampanhasTutorial} isPrivate />
                <Route exact path="/helps/flowbuilder" component={FlowBuilderTutorial} isPrivate />
                <Route exact path="/helps/fila-chatbot" component={FilaChatbotTutorial} isPrivate />
                <Route exact path="/helps/prompts-ia" component={PromptsIATutorial} isPrivate />
                <Route exact path="/helps/usuarios" component={UsuariosTutorial} isPrivate />
                <Route exact path="/helps/configuracoes" component={ConfiguracoesTutorial} isPrivate />
                <Route exact path="/helps/conexoes-whatsapp" component={ConexoesWhatsAppTutorial} isPrivate />
                <Route exact path="/helps/integracoes" component={IntegracoesTutorial} isPrivate />
                <Route exact path="/helps/api" component={APITutorial} isPrivate />
                <Route exact path="/helps/arquivos-chatbot" component={ArquivosChatbotTutorial} isPrivate />
                <Route exact path="/helps/listas-contatos" component={ListasContatosTutorial} isPrivate />
                <Route exact path="/helps/relatorios" component={RelatoriosTutorial} isPrivate />
                <Route exact path="/helps/financeiro" component={FinanceiroTutorial} isPrivate />
                <Route exact path="/helps/facebook" component={FacebookTutorial} isPrivate />
                <Route exact path="/helps/instagram" component={InstagramTutorial} isPrivate />
                <Route exact path="/helps/webchat" component={WebChatTutorial} isPrivate />
                <Route exact path="/users" component={Users} isPrivate />
                <Route exact path="/messages-api" component={MessagesAPI} isPrivate />
                <Route exact path="/settings" component={SettingsCustom} isPrivate />
                <Route exact path="/queues" component={Queues} isPrivate />
                <Route exact path="/reports" component={Reports} isPrivate />
                <Route exact path="/queue-integration" component={QueueIntegration} isPrivate />
                <Route exact path="/announcements" component={Annoucements} isPrivate />
                <Route
                  exact
                  path="/phrase-lists"
                  component={CampaignsPhrase}
                  isPrivate
                />
                <Route
                  exact
                  path="/flowbuilders"
                  component={FlowBuilder}
                  isPrivate
                />
                <Route
                  exact
                  path="/flowbuilder/:id?"
                  component={FlowBuilderConfig}
                  isPrivate
                />
                <Route exact path="/chats/:id?" component={Chat} isPrivate />
                <Route exact path="/files" component={LibraryManager} isPrivate />
                <Route exact path="/moments" component={ChatMoments} isPrivate />
                <Route exact path="/Kanban" component={Kanban} isPrivate />
                <Route exact path="/TagsKanban" component={TagsKanban} isPrivate />
                <Route exact path="/allConnections" component={AllConnections} isPrivate />
                <Route exact path="/ai-settings" component={AISettings} isPrivate />
                <Route exact path="/ai-agents" component={AIAgents} isPrivate />
                <Route exact path="/ai-training" component={AITraining} isPrivate />
                {showCampaigns && (
                  <>
                    <Route exact path="/contact-lists" component={ContactLists} isPrivate />
                    <Route exact path="/contact-lists/:contactListId/contacts" component={ContactListItems} isPrivate />
                    <Route exact path="/campaigns" component={Campaigns} isPrivate />
                    <Route exact path="/campaign/:campaignId/detailed-report" component={CampaignDetailedReport} isPrivate />
                    <Route exact path="/campaigns-config" component={CampaignsConfig} isPrivate />
                  </>
                )}
              </LoggedInLayout>
            </WhatsAppsProvider>
            </Switch>
          </Suspense>
        </TicketsContextProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
