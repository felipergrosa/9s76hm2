// backend/src/routes/contactRoutes.ts

import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import uploadConfig from "../config/upload";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();
const upload = multer(uploadConfig);

contactRoutes.post("/contacts/import", isAuth, ImportPhoneContactsController.store);

contactRoutes.post("/contactsImport", isAuth, ContactController.importXls);
contactRoutes.get("/contacts/import-progress", isAuth, ContactController.importProgress);

// Rota específica para listar grupos WhatsApp com controle de permissões
contactRoutes.get("/groups", isAuth, ContactController.groups);

contactRoutes.get("/contacts", isAuth, ContactController.index);
contactRoutes.get("/contacts/duplicates", isAuth, ContactController.listDuplicates);
contactRoutes.get("/contacts/pending-normalization", isAuth, ContactController.listPendingNormalization);
contactRoutes.get("/contacts/list", isAuth, ContactController.list);
contactRoutes.get("/contacts/segments", isAuth, ContactController.segments);
contactRoutes.get("/contacts/empresas", isAuth, ContactController.empresas);
contactRoutes.get("/contacts/profile/:number", isAuth, ContactController.getContactProfileURL);
contactRoutes.get("/contacts/:contactId(\\d+)", isAuth, ContactController.show);
contactRoutes.post("/contacts", isAuth, ContactController.store);
// Rota de atualização em massa DEVE vir antes de "/contacts/:contactId"
contactRoutes.put("/contacts/batch-update", isAuth, checkPermission("contacts.bulk-edit"), ContactController.bulkUpdate);
contactRoutes.put("/contacts/:contactId(\\d+)", isAuth, checkPermission("contacts.edit-fields"), ContactController.update);
contactRoutes.post("/contacts/duplicates/process", isAuth, ContactController.processDuplicates);
contactRoutes.post(
  "/contacts/duplicates/process-by-name",
  isAuth,
  ContactController.processDuplicatesByName
);
contactRoutes.post("/contacts/normalization/process", isAuth, ContactController.processNormalization);
contactRoutes.post(
  "/contacts/backfill-wallets-tags",
  isAuth,
  checkPermission("settings.view"),
  ContactController.backfillWalletsAndPersonalTags
);

// Mova a rota de deleção em massa ANTES da rota de deleção de ID único.
contactRoutes.delete("/contacts/batch-delete", isAuth, ContactController.bulkRemove); // <-- MOVA ESTA LINHA PARA CIMA

contactRoutes.delete("/contacts/:contactId(\\d+)", isAuth, ContactController.remove); // <-- DEIXE ESTA LINHA ABAIXO

contactRoutes.put("/contacts/toggleAcceptAudio/:contactId", isAuth, ContactController.toggleAcceptAudio);
contactRoutes.get("/contacts/vcard", isAuth, ContactController.getContactVcard);


// Validação forçada de contato (ignora TTL)
contactRoutes.post("/contacts/:contactId(\\d+)/validate", isAuth, ContactController.forceValidate);


contactRoutes.put("/contacts/block/:contactId", isAuth, ContactController.blockUnblock);
contactRoutes.post("/contacts/upload", isAuth, upload.array("file"), ContactController.upload);
contactRoutes.get("/contactTags/:contactId", isAuth, ContactController.getContactTags);
contactRoutes.put("/contacts/toggleDisableBot/:contactId", isAuth, ContactController.toggleDisableBot);
contactRoutes.put("/contact-wallet/:contactId", isAuth, ContactController.updateContactWallet);
contactRoutes.post("/contacts/bulk-refresh-avatars", isAuth, ContactController.bulkRefreshAvatars);
contactRoutes.get("/contacts/device-tags", isAuth, ContactController.getDeviceTags);
contactRoutes.get("/contacts/device-tags/refresh", isAuth, ContactController.refreshDeviceTags);
contactRoutes.get("/contacts/device-contacts", isAuth, ContactController.getDeviceContacts);
contactRoutes.post("/contacts/import-device-contacts", isAuth, ContactController.importDeviceContactsAuto);
contactRoutes.post("/contacts/rebuild-device-tags", isAuth, ContactController.rebuildDeviceTags);
contactRoutes.post("/contacts/import-with-tags", isAuth, ContactController.importWithTags);
contactRoutes.get("/contacts/import-tags/preset", isAuth, ContactController.getTagImportPreset);
contactRoutes.post("/contacts/import-tags/preset", isAuth, ContactController.saveTagImportPreset);
contactRoutes.get("/contacts/debug-device-data", isAuth, ContactController.debugDeviceData);
contactRoutes.post("/contacts/force-appstate-sync", isAuth, ContactController.forceAppStateSync);
contactRoutes.post("/contacts/test-create-label", isAuth, ContactController.testCreateLabel);
contactRoutes.post("/contacts/normalize-numbers", isAuth, ContactController.normalizeNumbers);
contactRoutes.post("/contacts/check-existing", isAuth, ContactController.checkExistingNumbers);

// ========== ROTAS DE GERENCIAMENTO DE CONTATOS LID ==========
contactRoutes.get("/contacts/lid-list", isAuth, ContactController.listLidContacts);
contactRoutes.post("/contacts/lid-resolve/:contactId", isAuth, ContactController.resolveLid);
contactRoutes.post("/contacts/lid-resolve-batch", isAuth, ContactController.resolveLidBatch);

// ========== ROTAS DE IMPORTAÇÃO ASSÍNCRONA ==========
contactRoutes.post("/contacts/import-async", isAuth, upload.single("file"), ContactController.importContactsAsync);
contactRoutes.get("/contacts/import-jobs/:jobId/status", isAuth, ContactController.getImportJobStatus);
contactRoutes.post("/contacts/import-jobs/:jobId/cancel", isAuth, ContactController.cancelImport);
contactRoutes.get("/contacts/import-logs", isAuth, ContactController.listImportLogs);
contactRoutes.get("/contacts/import-logs/:id", isAuth, ContactController.showImportLog);

// contactRoutes.get("/contacts/list-whatsapp", isAuth, ContactController.listWhatsapp);

export default contactRoutes;
