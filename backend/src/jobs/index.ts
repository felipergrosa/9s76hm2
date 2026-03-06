export { default as handleMessageQueue } from './handleMessageQueue';
export { default as handleMessageAckQueue } from './handleMessageAckQueue';
export { default as validateWhatsappContactsQueue } from './validateWhatsappContactsQueue';
export { default as SessionWindowRenewalJob } from './SessionWindowRenewalJob';
export { default as OrphanedSessionCheckJob } from './OrphanedSessionCheckJob';
export { default as TagRulesJob } from './TagRulesJob';
export { default as ReconcileLidJob } from './ReconcileLidJob';
export { default as InactivityTimeoutJob } from './InactivityTimeoutJob';
export { default as WhatsAppHealthCheckJob_Bull } from './WhatsAppHealthCheckJob_Bull';

// Nota: startInactivityTimeoutJob não é exportado aqui pois não é um job de fila Bull
// Importar diretamente de ./VerifyInactivityTimeoutJob quando necessário
