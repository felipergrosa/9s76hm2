// backend/src/routes/contactRoutes.ts

import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();
const upload = multer(uploadConfig);

contactRoutes.post("/contacts/import", isAuth, ImportPhoneContactsController.store);

contactRoutes.post("/contactsImport", isAuth, ContactController.importXls);
contactRoutes.get("/contacts", isAuth, ContactController.index);
contactRoutes.get("/contacts/list", isAuth, ContactController.list);
contactRoutes.get("/contacts/segments", isAuth, ContactController.segments);
contactRoutes.get("/contacts/profile/:number", isAuth, ContactController.getContactProfileURL);
contactRoutes.get("/contacts/:contactId(\\d+)", isAuth, ContactController.show);
contactRoutes.post("/contacts", isAuth, ContactController.store);
contactRoutes.put("/contacts/:contactId(\\d+)", isAuth, ContactController.update);

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
// contactRoutes.get("/contacts/list-whatsapp", isAuth, ContactController.listWhatsapp);

export default contactRoutes;
