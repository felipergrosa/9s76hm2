import { Router } from "express";
import isAuth from "../middleware/isAuth";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import companyRoutes from "./companyRoutes";
import planRoutes from "./planRoutes";
import ticketNoteRoutes from "./ticketNoteRoutes";
import quickMessageRoutes from "./quickMessageRoutes";
import helpRoutes from "./helpRoutes";
import dashboardRoutes from "./dashboardRoutes";
import scheduleRoutes from "./scheduleRoutes";
import tagRoutes from "./tagRoutes";
import contactListRoutes from "./contactListRoutes";
import contactListItemRoutes from "./contactListItemRoutes";
import campaignRoutes from "./campaignRoutes";
import campaignSettingRoutes from "./campaignSettingRoutes";
import announcementRoutes from "./announcementRoutes";
import chatRoutes from "./chatRoutes";
import queueIntegrationRoutes from "./queueIntegrationRoutes";
import chatBotRoutes from "./chatBotRoutes";
import webHookRoutes from "./webHookRoutes";
import subScriptionRoutes from "./subScriptionRoutes";
import invoiceRoutes from "./invoicesRoutes";
import apiRoutes from "./apiRoutes";
import versionRouter from "./versionRoutes";
import filesRoutes from "./filesRoutes";
import queueOptionRoutes from "./queueOptionRoutes";
import ticketTagRoutes from "./ticketTagRoutes";
import apiCompanyRoutes from "./api/apiCompanyRoutes";
import apiContactRoutes from "./api/apiContactRoutes";
import apiMessageRoutes from "./api/apiMessageRoutes";
import companySettingsRoutes from "./companySettingsRoutes";

import promptRoutes from "./promptRouter";
import statisticsRoutes from "./statisticsRoutes";
import scheduleMessageRoutes from "./ScheduledMessagesRoutes";
import flowDefaultRoutes from "./flowDefaultRoutes";
import webHook from "./webHookRoutes";
import flowBuilder from "./flowBuilderRoutes";
import flowCampaignRoutes from "./flowCampaignRoutes";
import aiRoutes from "./aiRoutes";
import maintenanceRoutes from "./maintenanceRoutes";
import ragRoutes from "./ragRoutes";
import presetRoutes from "./presetRoutes";
import ContactFieldsController from "../controllers/ContactFieldsController";
import labelsRoutes from "./labelsRoutes";
import wbotLabelsRoutes from "./wbotLabelsRoutes";
import whatsappWebLabelsRoutes from "./whatsappWebLabelsRoutes";
import tagRuleRoutes from "./tagRuleRoutes";
import permissionRoutes from "./permissionRoutes";
import auditLogRoutes from "./auditLogRoutes";
import whatsappWebhookRoutes from "./whatsappWebhookRoutes";
import libraryFolderRoutes from "./libraryFolderRoutes";
import libraryFileRoutes from "./libraryFileRoutes";
import queueRAGSourceRoutes from "./queueRAGSourceRoutes";
import templateRoutes from "./templateRoutes";  // NOVO


const routes = Router();

// Healthcheck endpoint for Docker Swarm
routes.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

routes.use(userRoutes);
routes.use("/auth", authRoutes);
routes.use("/api/messages", apiRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(companyRoutes);
routes.use(planRoutes);
routes.use(ticketNoteRoutes);
routes.use(quickMessageRoutes);
routes.use(helpRoutes);
routes.use(dashboardRoutes);
routes.use(scheduleRoutes);
routes.use(tagRoutes);
routes.use(contactListRoutes);
routes.use(contactListItemRoutes);
routes.use(campaignRoutes);
routes.use(campaignSettingRoutes);
routes.use(announcementRoutes);
routes.use(chatRoutes);
routes.use(chatBotRoutes);
routes.use("/webhook", webHookRoutes);
routes.use(subScriptionRoutes);
routes.use(invoiceRoutes);
routes.use(versionRouter);
routes.use(filesRoutes);
routes.use(queueOptionRoutes);
routes.use(queueIntegrationRoutes);
routes.use(ticketTagRoutes);
routes.use("/api", apiCompanyRoutes);
routes.use("/api", apiContactRoutes);
routes.use("/api", apiMessageRoutes);

routes.use(flowDefaultRoutes);
routes.use(webHook)
routes.use(flowBuilder)
routes.use(flowCampaignRoutes)


routes.use(promptRoutes);
routes.use(statisticsRoutes);
routes.use(companySettingsRoutes);
routes.use(scheduleMessageRoutes);
routes.use(aiRoutes);
routes.use(maintenanceRoutes);
routes.use(ragRoutes);
routes.use(presetRoutes);
routes.get("/contacts/fields", isAuth, ContactFieldsController.getContactFields);
routes.use("/labels", labelsRoutes);
routes.use(wbotLabelsRoutes);
routes.use(whatsappWebLabelsRoutes);
routes.use(tagRuleRoutes);
routes.use(permissionRoutes);
routes.use(auditLogRoutes);
routes.use(whatsappWebhookRoutes);
routes.use(libraryFolderRoutes);
routes.use(libraryFileRoutes);
routes.use(queueRAGSourceRoutes);
routes.use(templateRoutes);  // NOVO

export default routes;
