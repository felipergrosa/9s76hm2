// backend/src/routes/contactRoutes.ts

import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import uploadConfig from "../config/upload";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";
import * as GroupController from "../controllers/GroupController";
import * as RefreshContactAvatarController from "../controllers/RefreshContactAvatarController";

const contactRoutes = express.Router();
const upload = multer(uploadConfig);
const memoryUpload = multer({ storage: multer.memoryStorage() });

contactRoutes.post("/contacts/import", isAuth, checkPermission("contacts.import"), ImportPhoneContactsController.store);

contactRoutes.post("/contactsImport", isAuth, checkPermission("contacts.import"), ContactController.importXls);
contactRoutes.get("/contacts/import-progress", isAuth, checkPermission("contacts.import"), ContactController.importProgress);

// Rota específica para listar grupos WhatsApp com controle de permissões
contactRoutes.get("/groups", isAuth, checkPermission("contacts.view"), ContactController.groups);

contactRoutes.get("/contacts", isAuth, checkPermission("contacts.view"), ContactController.index);
contactRoutes.get("/contacts/duplicates", isAuth, checkPermission("contacts.view"), ContactController.listDuplicates);
contactRoutes.get("/contacts/pending-normalization", isAuth, checkPermission("contacts.view"), ContactController.listPendingNormalization);
contactRoutes.get("/contacts/list", isAuth, checkPermission("contacts.view"), ContactController.list);
contactRoutes.get("/contacts/unique-values", isAuth, checkPermission("contacts.view"), ContactController.uniqueValues);
contactRoutes.get("/contacts/empresas", isAuth, checkPermission("contacts.view"), ContactController.empresas);
contactRoutes.get("/contacts/profile/:number", isAuth, checkPermission("contacts.view"), ContactController.getContactProfileURL);
contactRoutes.get("/contacts/:contactId(\\d+)", isAuth, checkPermission("contacts.view"), ContactController.show);
contactRoutes.post("/contacts", isAuth, checkPermission("contacts.create"), ContactController.store);
// Rota de atualização em massa DEVE vir antes de "/contacts/:contactId"
contactRoutes.put("/contacts/batch-update", isAuth, checkPermission("contacts.bulk-edit"), ContactController.bulkUpdate);
contactRoutes.put("/contacts/:contactId(\\d+)", isAuth, checkPermission("contacts.edit-fields"), ContactController.update);
contactRoutes.post("/contacts/duplicates/process", isAuth, checkPermission("contacts.edit"), ContactController.processDuplicates);
contactRoutes.post(
  "/contacts/duplicates/process-by-name",
  isAuth,
  checkPermission("contacts.edit"),
  ContactController.processDuplicatesByName
);
contactRoutes.post("/contacts/normalization/process", isAuth, checkPermission("contacts.edit"), ContactController.processNormalization);

contactRoutes.post("/contacts/:contactId/validate-name", isAuth, checkPermission("contacts.edit"), ContactController.validateContactName);

// Mova a rota de deleção em massa ANTES da rota de deleção de ID único.
contactRoutes.delete("/contacts/batch-delete", isAuth, checkPermission("contacts.delete"), ContactController.bulkRemove); // <-- MOVA ESTA LINHA PARA CIMA

contactRoutes.delete("/contacts/:contactId(\\d+)", isAuth, checkPermission("contacts.delete"), ContactController.remove); // <-- DEIXE ESTA LINHA ABAIXO

contactRoutes.put("/contacts/toggleAcceptAudio/:contactId", isAuth, checkPermission("contacts.edit"), ContactController.toggleAcceptAudio);
contactRoutes.get("/contacts/vcard", isAuth, checkPermission("contacts.view"), ContactController.getContactVcard);


// Validação forçada de contato (ignora TTL)
contactRoutes.post("/contacts/:contactId(\\d+)/validate", isAuth, checkPermission("contacts.edit"), ContactController.forceValidate);


contactRoutes.put("/contacts/block/:contactId", isAuth, checkPermission("contacts.edit"), ContactController.blockUnblock);
contactRoutes.post("/contacts/upload", isAuth, checkPermission("contacts.import"), upload.array("file"), ContactController.upload);
contactRoutes.get("/contactTags/:contactId", isAuth, checkPermission("contacts.view"), ContactController.getContactTags);
contactRoutes.put("/contacts/toggleDisableBot/:contactId", isAuth, checkPermission("contacts.edit"), ContactController.toggleDisableBot);
contactRoutes.post("/contacts/bulk-refresh-avatars", isAuth, checkPermission("contacts.edit"), ContactController.bulkRefreshAvatars);

// ========== ROTA PARA ATUALIZAÇÃO DE AVATAR EM TEMPO REAL ==========
contactRoutes.post("/contacts/:contactId(\\d+)/refresh-avatar", isAuth, checkPermission("contacts.edit"), RefreshContactAvatarController.refreshContactAvatar);

contactRoutes.get("/contacts/device-tags", isAuth, checkPermission("contacts.view"), ContactController.getDeviceTags);
contactRoutes.get("/contacts/device-tags/refresh", isAuth, checkPermission("contacts.edit"), ContactController.refreshDeviceTags);
contactRoutes.get("/contacts/device-contacts", isAuth, checkPermission("contacts.view"), ContactController.getDeviceContacts);
contactRoutes.post("/contacts/import-device-contacts", isAuth, checkPermission("contacts.import"), ContactController.importDeviceContactsAuto);
contactRoutes.post("/contacts/rebuild-device-tags", isAuth, checkPermission("contacts.edit"), ContactController.rebuildDeviceTags);
contactRoutes.post("/contacts/import-with-tags", isAuth, checkPermission("contacts.import"), ContactController.importWithTags);
contactRoutes.get("/contacts/import-tags/preset", isAuth, checkPermission("contacts.view"), ContactController.getTagImportPreset);
contactRoutes.post("/contacts/import-tags/preset", isAuth, checkPermission("contacts.edit"), ContactController.saveTagImportPreset);
contactRoutes.get("/contacts/debug-device-data", isAuth, checkPermission("contacts.view"), ContactController.debugDeviceData);
contactRoutes.post("/contacts/force-appstate-sync", isAuth, checkPermission("connections.edit"), ContactController.forceAppStateSync);
contactRoutes.post("/contacts/test-create-label", isAuth, checkPermission("tags.create"), ContactController.testCreateLabel);
contactRoutes.post("/contacts/normalize-numbers", isAuth, checkPermission("contacts.edit"), ContactController.normalizeNumbers);
contactRoutes.post("/contacts/check-existing", isAuth, checkPermission("contacts.view"), ContactController.checkExistingNumbers);

// ========== VALIDAÇÃO DE NÚMEROS VIA WHATSAPP ==========
contactRoutes.get("/contacts/validate-whatsapp/pending", isAuth, checkPermission("contacts.view"), ContactController.getValidationPending);
contactRoutes.post("/contacts/validate-whatsapp", isAuth, checkPermission("contacts.edit"), ContactController.validateNumbers);

// ========== ROTAS DE GERENCIAMENTO DE CONTATOS LID ==========
contactRoutes.get("/contacts/lid-list", isAuth, checkPermission("contacts.view"), ContactController.listLidContacts);
contactRoutes.post("/contacts/lid-resolve/:contactId", isAuth, checkPermission("contacts.edit"), ContactController.resolveLid);
contactRoutes.post("/contacts/lid-resolve-batch", isAuth, checkPermission("contacts.edit"), ContactController.resolveLidBatch);

// ========== ROTAS DE IMPORTAÇÃO ASSÍNCRONA ==========
contactRoutes.post("/contacts/import-async", isAuth, checkPermission("contacts.import"), upload.single("file"), ContactController.importContactsAsync);
contactRoutes.get("/contacts/import-jobs/:jobId/status", isAuth, checkPermission("contacts.import"), ContactController.getImportJobStatus);
contactRoutes.post("/contacts/import-jobs/:jobId/cancel", isAuth, checkPermission("contacts.import"), ContactController.cancelImport);
contactRoutes.get("/contacts/import-logs", isAuth, checkPermission("contacts.import"), ContactController.listImportLogs);
contactRoutes.get("/contacts/import-logs/:id", isAuth, checkPermission("contacts.import"), ContactController.showImportLog);

// contactRoutes.get("/contacts/list-whatsapp", isAuth, ContactController.listWhatsapp);

// ========== ROTAS DE GERENCIAMENTO DE GRUPOS ==========
contactRoutes.get("/groups/:contactId(\\d+)/participants", isAuth, checkPermission("contacts.view"), GroupController.participants);
contactRoutes.post("/groups/:contactId(\\d+)/participants/add", isAuth, checkPermission("contacts.edit"), GroupController.addMembers);
contactRoutes.post("/groups/:contactId(\\d+)/participants/remove", isAuth, checkPermission("contacts.edit"), GroupController.removeMembers);
contactRoutes.post("/groups/:contactId(\\d+)/participants/promote", isAuth, checkPermission("contacts.edit"), GroupController.promote);
contactRoutes.post("/groups/:contactId(\\d+)/participants/demote", isAuth, checkPermission("contacts.edit"), GroupController.demote);
contactRoutes.post("/groups/:contactId(\\d+)/leave", isAuth, checkPermission("contacts.edit"), GroupController.leave);
contactRoutes.get("/groups/:contactId(\\d+)/invite-link", isAuth, checkPermission("contacts.view"), GroupController.inviteLink);
contactRoutes.put("/groups/:contactId(\\d+)/subject", isAuth, checkPermission("contacts.edit"), GroupController.updateSubject);
contactRoutes.put("/groups/:contactId(\\d+)/description", isAuth, checkPermission("contacts.edit"), GroupController.updateDescription);
contactRoutes.put("/groups/:contactId(\\d+)/picture", isAuth, checkPermission("contacts.edit"), memoryUpload.single("image"), GroupController.updatePicture);
contactRoutes.put("/groups/:contactId(\\d+)/settings", isAuth, checkPermission("contacts.edit"), GroupController.updateSettings);

export default contactRoutes;
