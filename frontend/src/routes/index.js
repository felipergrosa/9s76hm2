import React, { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Switch, Redirect } from "react-router-dom";

import LoggedInLayout from "../layout";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import PrivateRoute from "./PrivateRoute";

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

// CommandPalette (kbar) carregado de forma lazy - não vai para o bundle inicial
const CommandPaletteActions = lazy(() => import("../components/CommandPalette"));

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
const CampaignsNew = lazy(() => import("../pages/CampaignsNew"));
const CampaignsConfig = lazy(() => import("../pages/CampaignsConfig"));
const CampaignDetailedReport = lazy(() => import("../pages/CampaignDetailedReport"));
const CampaignsPhrase = lazy(() => import("../pages/CampaignsPhrase"));
const ContactLists = lazy(() => import("../pages/ContactLists"));
const ContactListItems = lazy(() => import("../pages/ContactListItems"));
const EmailCampaigns = lazy(() => import("../pages/EmailCampaigns"));
const LeadScraper = lazy(() => import("../pages/LeadScraper"));
const KnowledgeBase = lazy(() => import("../pages/KnowledgeBase"));
const AdminCustomFields = lazy(() => import("../pages/AdminCustomFields"));
const MetaTemplates = lazy(() => import("../pages/MetaTemplates"));
const FollowUps = lazy(() => import("../pages/FollowUps"));
const FollowUpForm = lazy(() => import("../pages/FollowUps/FollowUpForm"));

// FlowBuilder (pesado - sempre lazy)
const FlowBuilder = lazy(() => import("../pages/FlowBuilder"));
const FlowBuilderConfig = lazy(() => import("../pages/FlowBuilderConfig").then(m => ({ default: m.FlowBuilderConfig })));

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
                {/* CommandPalette renderizado como irmão: KBarProvider só é
                    necessário para o portal do kbar (nenhum filho usa useKBar),
                    assim a árvore privada não espera o chunk do kbar */}
                <Suspense fallback={null}>
                  <CommandPaletteActions />
                </Suspense>
                <LoggedInLayout>
                <PrivateRoute exact path="/financeiro" component={Financeiro} permission="financeiro.view" />

                <PrivateRoute exact path="/companies" component={Companies} permission="companies.view" />
                <Route exact path="/" component={Dashboard} isPrivate />
                <Route exact path="/tickets/:ticketId?" component={TicketResponsiveContainer} isPrivate />
                <PrivateRoute exact path="/connections" component={Connections} permission="connections.view" />
                <PrivateRoute exact path="/quick-messages" component={QuickMessages} permission="quick-messages.view" />
                <Route exact path="/todolist" component={ToDoList} isPrivate />
                <PrivateRoute exact path="/schedules" component={Schedules} permission="schedules.view" />
                <PrivateRoute exact path="/tags" component={Tags} permission="tags.view" />
                <PrivateRoute exact path="/contacts" component={Contacts} permission="contacts.view" />
                <PrivateRoute exact path="/contacts/import" component={ContactImportPage} permission="contacts.import" />
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
                {/* /users unifica usuários + perfis (abas) — entra com qualquer uma */}
                <PrivateRoute exact path="/users" component={Users} permissions={["users.view", "roles.view"]} />
                {/* /roles virou aba dentro de /users — redirect para bookmarks antigos */}
                <Route exact path="/roles" render={() => <Redirect to="/users" />} isPrivate />
                <PrivateRoute exact path="/meta-templates" component={MetaTemplates} permission="meta-templates.view" />
                <PrivateRoute exact path="/lead-scraper" component={LeadScraper} permission="contacts.import" />
                <PrivateRoute exact path="/knowledge-base" component={KnowledgeBase} permission="helps.view" />
                <PrivateRoute exact path="/admin-custom-fields" component={AdminCustomFields} permission="contacts.edit" />

                <PrivateRoute exact path="/messages-api" component={MessagesAPI} permission="external-api.view" />
                <PrivateRoute exact path="/settings" component={SettingsCustom} permission="settings.view" />
                <PrivateRoute exact path="/queues" component={Queues} permission="queues.view" />
                <PrivateRoute exact path="/reports" component={Reports} permission="reports.view" />
                <PrivateRoute exact path="/queue-integration" component={QueueIntegration} permission="integrations.view" />
                <PrivateRoute exact path="/announcements" component={Annoucements} permission="announcements.view" />
                <PrivateRoute
                  exact
                  path="/phrase-lists"
                  component={CampaignsPhrase}
                  permission="phrase-campaigns.view"
                />
                <PrivateRoute
                  exact
                  path="/flowbuilders"
                  component={FlowBuilder}
                  permission="flowbuilder.view"
                />
                <PrivateRoute
                  exact
                  path="/flowbuilder/:id?"
                  component={FlowBuilderConfig}
                  permission="flowbuilder.view"
                />
                <PrivateRoute exact path="/chats/:id?" component={Chat} permission="internal-chat.view" />
                <PrivateRoute exact path="/files" component={LibraryManager} permission="files.view" />
                <PrivateRoute exact path="/moments" component={ChatMoments} permission="realtime.view" />
                <PrivateRoute exact path="/Kanban" component={Kanban} permission="kanban.view" />
                <PrivateRoute exact path="/TagsKanban" component={TagsKanban} permission="kanban.view" />
                <PrivateRoute exact path="/allConnections" component={AllConnections} permission="all-connections.view" />
                <PrivateRoute exact path="/ai-settings" component={AISettings} permission="ai-settings.view" />
                <PrivateRoute exact path="/ai-agents" component={AIAgents} permission="ai-agents.view" />
                <PrivateRoute exact path="/ai-training" component={AITraining} permission="ai-training.view" />
                {showCampaigns && (
                  <>
                    <PrivateRoute exact path="/contact-lists" component={ContactLists} permission="contact-lists.view" />
                    <PrivateRoute exact path="/contact-lists/:contactListId/contacts" component={ContactListItems} permission="contact-lists.view" />
                    <PrivateRoute exact path="/campaigns" component={Campaigns} permission="campaigns.view" />
                    <PrivateRoute exact path="/campaigns/new" component={CampaignsNew} permission="campaigns.create" />
                    <PrivateRoute exact path="/campaignsNew/:campaignId" component={CampaignsNew} permission="campaigns.edit" />
                    <PrivateRoute exact path="/campaign/:campaignId/detailed-report" component={CampaignDetailedReport} permission="campaigns.view" />
                    <PrivateRoute exact path="/campaigns-config" component={CampaignsConfig} permission="campaigns-config.view" />
                    <PrivateRoute exact path="/follow-ups" component={FollowUps} permission="drip-sequences.view" />
                    <PrivateRoute exact path="/follow-ups/new" component={FollowUpForm} permission="drip-sequences.create" />
                    {/* (\\d+) restringe a IDs numéricos — sem isso "/follow-ups/new"
                        casa aqui também e renderiza o form duplicado (rotas dentro
                        do LoggedInLayout não passam por Switch) */}
                    <PrivateRoute exact path="/follow-ups/:followUpId(\d+)" component={FollowUpForm} permission="drip-sequences.edit" />
                    <PrivateRoute exact path="/email-campaigns" component={EmailCampaigns} permission="email-campaigns.view" />
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
