// Allowlist de colunas da tabela CompaniesSettings permitidas via API.
// Previne SQL Injection em FindCompanySettingOneService e UpdateCompanySettingsService,
// já que o nome da coluna é dinâmico e vem do cliente.
// Mantém em sincronia com o model CompaniesSettings.
export const ALLOWED_COMPANY_SETTINGS_COLUMNS = new Set<string>([
  "hoursCloseTicketsAuto",
  "chatBotType",
  "acceptCallWhatsapp",
  "userRandom",
  "sendGreetingMessageOneQueues",
  "sendSignMessage",
  "sendFarewellWaitingTicket",
  "userRating",
  "sendGreetingAccepted",
  "CheckMsgIsGroup",
  "sendQueuePosition",
  "scheduleType",
  "acceptAudioMessageContact",
  "sendMsgTransfTicket",
  "enableLGPD",
  "requiredTag",
  "lgpdDeleteMessage",
  "lgpdHideNumber",
  "lgpdConsent",
  "lgpdLink",
  "lgpdMessage",
  "DirectTicketsToWallets",
  "closeTicketOnTransfer",
  "transferMessage",
  "greetingAcceptedMessage",
  "AcceptCallWhatsappMessage",
  "sendQueuePositionMessage",
  "showNotificationPending",
  "openaiApiKey",
  "openaiModel",
  "autoCaptureGroupContacts"
]);

export const isAllowedCompanySettingColumn = (column: string): boolean => {
  return typeof column === "string" && ALLOWED_COMPANY_SETTINGS_COLUMNS.has(column);
};
