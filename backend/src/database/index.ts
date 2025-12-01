import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import Company from "../models/Company";
import Plan from "../models/Plan";
import TicketNote from "../models/TicketNote";
import QuickMessage from "../models/QuickMessage";
import Help from "../models/Help";
import TicketTraking from "../models/TicketTraking";
import UserRating from "../models/UserRating";
import Schedule from "../models/Schedule";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Campaign from "../models/Campaign";
import CampaignSetting from "../models/CampaignSetting";
import Baileys from "../models/Baileys";
import CampaignShipping from "../models/CampaignShipping";
import Announcement from "../models/Announcement";
import Chat from "../models/Chat";
import ChatUser from "../models/ChatUser";
import ChatMessage from "../models/ChatMessage";
import Chatbot from "../models/Chatbot";
import DialogChatBots from "../models/DialogChatBots";
import QueueIntegrations from "../models/QueueIntegrations";
import Invoices from "../models/Invoices";
import Subscriptions from "../models/Subscriptions";
import ApiUsages from "../models/ApiUsages";
import Files from "../models/Files";
import FilesOptions from "../models/FilesOptions";
import ContactTag from "../models/ContactTag";
import CompaniesSettings from "../models/CompaniesSettings";
import LogTicket from "../models/LogTicket";
import Prompt from "../models/Prompt";
import Partner from "../models/Partner";
import ContactWallet from "../models/ContactWallet";
import ScheduledMessages from "../models/ScheduledMessages";
import ScheduledMessagesEnvio from "../models/ScheduledMessagesEnvio";
import Versions from "../models/Versions";
import { FlowDefaultModel } from "../models/FlowDefault";
import { FlowBuilderModel } from "../models/FlowBuilder";
import { FlowAudioModel } from "../models/FlowAudio";
import { FlowCampaignModel } from "../models/FlowCampaign";
import { FlowImgModel } from "../models/FlowImg";
import { WebhookModel } from "../models/Webhook";
import KnowledgeDocument from "../models/KnowledgeDocument";
import KnowledgeChunk from "../models/KnowledgeChunk";
import AIUsageLog from "../models/AIUsageLog";
import WhatsappLabel from "../models/WhatsappLabel";
import ContactWhatsappLabel from "../models/ContactWhatsappLabel";
import TagRule from "../models/TagRule";
import LibraryFolder from "../models/LibraryFolder";
import LibraryFile from "../models/LibraryFile";
import QueueRAGSource from "../models/QueueRAGSource";

// eslint-disable-next-line
const dbConfig = require("../config/database");
import logger from "../utils/logger";

// ========== CONFIGURAÇÃO OTIMIZADA COM CONNECTION POOL E RETRY ========== //
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  timezone: dbConfig.timezone || "-03:00",
  logging: dbConfig.logging !== undefined ? dbConfig.logging : false,

  // Connection Pool Otimizado
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || "20"),        // Máximo de conexões
    min: parseInt(process.env.DB_POOL_MIN || "5"),         // Mínimo de conexões ativas
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || "60000"),  // 60s timeout
    idle: parseInt(process.env.DB_POOL_IDLE || "10000"),   // 10s antes de liberar
    evict: parseInt(process.env.DB_POOL_EVICT || "1000")   // Verificar a cada 1s
  },

  // Retry automático em caso de erro de conexão
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /Connection terminated unexpectedly/  // Seu erro específico!
    ]
  },

  // Keep-alive e timeouts
  dialectOptions: {
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "10000"),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000"),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...(dbConfig.dialectOptions || {})
  }
});

// Reconexão automática em caso de falha
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

sequelize.authenticate()
  .then(() => {
    logger.info("✅ Database connected successfully");
    reconnectAttempts = 0;
  })
  .catch(err => {
    logger.error("❌ Database connection error:", err);

    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = Math.min(5000 * reconnectAttempts, 30000); // Max 30s

      logger.info(`🔄 Attempting to reconnect to database (${reconnectAttempts}/${maxReconnectAttempts}) in ${delay / 1000}s...`);

      setTimeout(() => {
        sequelize.authenticate()
          .then(() => {
            logger.info("✅ Database reconnected successfully");
            reconnectAttempts = 0;
          })
          .catch(e => {
            logger.error(`❌ Reconnection attempt ${reconnectAttempts} failed:`, e);
          });
      }, delay);
    }
  });

const models = [
  Company,
  User,
  Contact,
  ContactTag,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  Plan,
  TicketNote,
  QuickMessage,
  Help,
  TicketTraking,
  UserRating,
  Schedule,
  Tag,
  TicketTag,
  ContactList,
  ContactListItem,
  Campaign,
  CampaignSetting,
  Baileys,
  CampaignShipping,
  Announcement,
  Chat,
  ChatUser,
  ChatMessage,
  Chatbot,
  DialogChatBots,
  QueueIntegrations,
  Invoices,
  Subscriptions,
  ApiUsages,
  Files,
  FilesOptions,
  CompaniesSettings,
  LogTicket,
  Prompt,
  Partner,
  ContactWallet,
  ScheduledMessages,
  ScheduledMessagesEnvio,
  Versions,
  FlowDefaultModel,
  FlowBuilderModel,
  FlowAudioModel,
  FlowCampaignModel,
  FlowImgModel,
  WebhookModel,
  KnowledgeDocument,
  KnowledgeChunk,
  AIUsageLog,
  WhatsappLabel,
  ContactWhatsappLabel,
  TagRule,
  LibraryFolder,
  LibraryFile,
  QueueRAGSource
];

sequelize.addModels(models);

export default sequelize;
