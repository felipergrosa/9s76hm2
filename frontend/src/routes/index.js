import React, { useEffect, useState } from "react";
import { BrowserRouter, Switch } from "react-router-dom";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard";
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Signup from "../pages/Signup";
import Login from "../pages/Login";
import Connections from "../pages/Connections";
import SettingsCustom from "../pages/SettingsCustom";
import Financeiro from "../pages/Financeiro";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts";
import ContactImportPage from "../pages/Contacts/import";
import ChatMoments from "../pages/Moments"
import Queues from "../pages/Queues";
import Tags from "../pages/Tags";
import MessagesAPI from "../pages/MessagesAPI";
import Helps from "../pages/Helps";
import AITutorial from "../pages/Helps/AITutorial";
import BotTutorial from "../pages/Helps/BotTutorial";
import DashboardTutorial from "../pages/Helps/DashboardTutorial";
import AtendimentosTutorial from "../pages/Helps/AtendimentosTutorial";
import RespostasRapidasTutorial from "../pages/Helps/RespostasRapidasTutorial";
import KanbanTutorial from "../pages/Helps/KanbanTutorial";
import ContatosTutorial from "../pages/Helps/ContatosTutorial";
import AgendamentosTutorial from "../pages/Helps/AgendamentosTutorial";
import TagsTutorial from "../pages/Helps/TagsTutorial";
import ChatInternoTutorial from "../pages/Helps/ChatInternoTutorial";
import CampanhasTutorial from "../pages/Helps/CampanhasTutorial";
import FlowBuilderTutorial from "../pages/Helps/FlowBuilderTutorial";
import FilaChatbotTutorial from "../pages/Helps/FilaChatbotTutorial";
import PromptsIATutorial from "../pages/Helps/PromptsIATutorial";
import UsuariosTutorial from "../pages/Helps/UsuariosTutorial";
import ConfiguracoesTutorial from "../pages/Helps/ConfiguracoesTutorial";
import ConexoesWhatsAppTutorial from "../pages/Helps/ConexoesWhatsAppTutorial";
import IntegracoesTutorial from "../pages/Helps/IntegracoesTutorial";
import APITutorial from "../pages/Helps/APITutorial";
import ArquivosChatbotTutorial from "../pages/Helps/ArquivosChatbotTutorial";
import ListasContatosTutorial from "../pages/Helps/ListasContatosTutorial";
import RelatoriosTutorial from "../pages/Helps/RelatoriosTutorial";
import FinanceiroTutorial from "../pages/Helps/FinanceiroTutorial";
import ContactLists from "../pages/ContactLists";
import ContactListItems from "../pages/ContactListItems";
import Companies from "../pages/Companies";
import QuickMessages from "../pages/QuickMessages";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import Schedules from "../pages/Schedules";
import Campaigns from "../pages/Campaigns";
import CampaignsConfig from "../pages/CampaignsConfig";
import CampaignDetailedReport from "../pages/CampaignDetailedReport";
import Annoucements from "../pages/Annoucements";
import Chat from "../pages/Chat";
import Prompts from "../pages/Prompts";
import AllConnections from "../pages/AllConnections";
import Reports from "../pages/Reports";
import { FlowBuilderConfig } from "../pages/FlowBuilderConfig";
// import Integrations from '../pages/Integrations';
// import GoogleCalendarComponent from '../pages/Integrations/components/GoogleCalendarComponent';
import FlowBuilder from "../pages/FlowBuilder";
import FlowDefault from "../pages/FlowDefault"
import CampaignsPhrase from "../pages/CampaignsPhrase";
import Subscription from "../pages/Subscription";
import QueueIntegration from "../pages/QueueIntegration";
import LibraryManager from "../pages/LibraryManager";
import ToDoList from "../pages/ToDoList";
import Kanban from "../pages/Kanban";
import TagsKanban from "../pages/TagsKanban";
import ForgotPassword from "../pages/ForgetPassWord";
import ResetPassword from "../pages/ResetPassword";
import AISettings from "../components/AISettings";
import AIAgents from "../pages/AIAgents";


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
                <Route exact path="/prompts" component={Prompts} isPrivate />
                <Route exact path="/allConnections" component={AllConnections} isPrivate />
                <Route exact path="/ai-settings" component={AISettings} isPrivate />
                <Route exact path="/ai-agents" component={AIAgents} isPrivate />
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
        </TicketsContextProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
