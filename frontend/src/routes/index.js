import React, { useEffect, useState, lazy } from "react";
import { BrowserRouter, Switch, Route as RouterRoute } from "react-router-dom";

import LoggedInLayout from "../layout";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";

// Importações diretas apenas para componentes críticos de autenticação (menor bundle inicial)
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ForgotPassword from "../pages/ForgetPassWord";
import ResetPassword from "../pages/ResetPassword";
import LandingPage from "../pages/LandingPage";

// Lazy loading para todas as outras páginas (code splitting automático)
const Dashboard = lazy(() => import("../pages/Dashboard"));
const TicketResponsiveContainer = lazy(() => import("../pages/TicketResponsiveContainer"));
const Connections = lazy(() => import("../pages/Connections"));
const SettingsCustom = lazy(() => import("../pages/SettingsCustom"));
const Financeiro = lazy(() => import("../pages/Financeiro"));
const Users = lazy(() => import("../pages/Users"));
const Contacts = lazy(() => import("../pages/Contacts"));
const ContactImportPage = lazy(() => import("../pages/Contacts/import"));
const ChatMoments = lazy(() => import("../pages/Moments"));
const Queues = lazy(() => import("../pages/Queues"));
const Tags = lazy(() => import("../pages/Tags"));
const MessagesAPI = lazy(() => import("../pages/MessagesAPI"));
const Helps = lazy(() => import("../pages/Helps"));
const AITutorial = lazy(() => import("../pages/Helps/AITutorial"));
const ContactLists = lazy(() => import("../pages/ContactLists"));
const ContactListItems = lazy(() => import("../pages/ContactListItems"));
const Companies = lazy(() => import("../pages/Companies"));
const QuickMessages = lazy(() => import("../pages/QuickMessages"));
const Schedules = lazy(() => import("../pages/Schedules"));
const Campaigns = lazy(() => import("../pages/Campaigns"));
const CampaignsConfig = lazy(() => import("../pages/CampaignsConfig"));
const CampaignDetailedReport = lazy(() => import("../pages/CampaignDetailedReport"));
const Annoucements = lazy(() => import("../pages/Annoucements"));
const Chat = lazy(() => import("../pages/Chat"));
const Prompts = lazy(() => import("../pages/Prompts"));
const AllConnections = lazy(() => import("../pages/AllConnections"));
const Reports = lazy(() => import("../pages/Reports"));
const FlowBuilderConfig = lazy(() => import("../pages/FlowBuilderConfig").then(module => ({ default: module.FlowBuilderConfig })));
const FlowBuilder = lazy(() => import("../pages/FlowBuilder"));
const CampaignsPhrase = lazy(() => import("../pages/CampaignsPhrase"));
const QueueIntegration = lazy(() => import("../pages/QueueIntegration"));
const Files = lazy(() => import("../pages/Files"));
const ToDoList = lazy(() => import("../pages/ToDoList"));
const Kanban = lazy(() => import("../pages/Kanban"));
const TagsKanban = lazy(() => import("../pages/TagsKanban"));
const AISettings = lazy(() => import("../components/AISettings"));
const OnboardingDocs = lazy(() => import("../pages/OnboardingDocs"));
const AdminDocs = lazy(() => import("../pages/AdminDocs"));


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
      <Switch>
        <RouterRoute exact path="/landing" component={LandingPage} />
        <AuthProvider>
          <TicketsContextProvider>
            <Route exact path="/docs" component={OnboardingDocs} />
            <Route exact path="/docs_admin" component={AdminDocs} />
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
                <Route exact path="/files" component={Files} isPrivate />
                <Route exact path="/moments" component={ChatMoments} isPrivate />
                <Route exact path="/Kanban" component={Kanban} isPrivate />
                <Route exact path="/TagsKanban" component={TagsKanban} isPrivate />
                <Route exact path="/prompts" component={Prompts} isPrivate />
                <Route exact path="/allConnections" component={AllConnections} isPrivate />
                <Route exact path="/ai-settings" component={AISettings} isPrivate />
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
          </TicketsContextProvider>
        </AuthProvider>
      </Switch>
    </BrowserRouter>
  );
};

export default Routes;
