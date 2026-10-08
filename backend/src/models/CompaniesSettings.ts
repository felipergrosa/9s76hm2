/** 
 * @TercioSantos-0 |
 * model/CompaniesSettings |
 * @descrição:modelo para tratar as configurações das empresas 
 */
import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    Default,
    DataType
  } from "sequelize-typescript";
  import Company from "./Company";
 
  
  @Table({ tableName: "CompaniesSettings" })
  class CompaniesSettings extends Model<CompaniesSettings> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Company)
    @Column
    companyId: number;
  
    @BelongsTo(() => Company)
    company: Company;
  
    @Column
    hoursCloseTicketsAuto: string;

    @Column
    chatBotType: string;

    @Column
    acceptCallWhatsapp: string;

    //inicio de opções: enabled ou disabled
    @Column
    userRandom: string; 

    @Column
    sendGreetingMessageOneQueues: string; 

    @Column
    sendSignMessage: string; 

    @Column
    sendFarewellWaitingTicket: string; 

    @Column
    userRating: string; 

    @Column
    sendGreetingAccepted: string; 

    @Column
    CheckMsgIsGroup: string; 

    @Column
    sendQueuePosition: string; 

    @Column
    scheduleType: string; 

    @Column
    acceptAudioMessageContact: string; 

    @Column
    sendMsgTransfTicket: string;

    @Column
    enableLGPD: string; 

    @Column
    requiredTag: string; 

    @Column
    lgpdDeleteMessage: string; 

    @Column
    lgpdHideNumber: string; 

    @Column
    lgpdConsent: string;

    @Column
    lgpdLink: string

    //fim de opções: enabled ou disabled 
    @Column
    lgpdMessage: string

    @CreatedAt
    createdAt: Date;
  
    @UpdatedAt
    updatedAt: Date;

    @Default(false)
    @Column
    DirectTicketsToWallets: boolean;

    @Default(false)
    @Column
    closeTicketOnTransfer: boolean;

    @Column
    transferMessage: string

    @Column
    greetingAcceptedMessage: string

    @Column
    AcceptCallWhatsappMessage: string

    @Column
    sendQueuePositionMessage: string

    @Column
    showNotificationPending: boolean;

    @Column
    openaiApiKey: string;

    @Column
    openaiModel: string;

    @Column
    autoCaptureGroupContacts: string; // "enabled" ou "disabled" - controla captura automática de contatos de grupos

    // Token compartilhado para o webhook de formulário externo (ex: bloco "Webhook" do Typebot)
    // POST /webhooks/external-form/:token — null/vazio desabilita o endpoint para a empresa
    @Column
    externalFormWebhookToken: string;

    // Cotação USD→BRL usada na conversão das tarifas Meta para exibição em R$
    @Column
    usdToBrlRate: string;

    // "Tela de fechamento": quando true, exige assunto e permite resumo
    // ao finalizar o ticket (preenche closingSubject/closingSummary)
    @Default(false)
    @Column
    enableClosingForm: boolean;

    // Config. Aniversário: envio automático de parabéns no dia do aniversário
    // do contato (Contacts.birthdate). Segue o padrão "enabled"/"disabled".
    @Default("disabled")
    @Column
    birthdayMessageEnabled: string;

    // Template da mensagem; variáveis aceitas: {name}, {firstName}, {ms} etc.
    // (resolvidas via formatBody/Mustache no envio)
    @Column(DataType.TEXT)
    birthdayMessage: string;

    // ID da conexão WhatsApp de envio (Whatsapp.id como string).
    // Vazio/null = usa a conexão padrão da empresa.
    @Column
    birthdayWhatsappId: string;

    // ── Troncal SIP (referência Fluxoo) ─────────────────────────────
    // Credenciais do troncal por empresa, consumidas pelo softphone
    // (jssip/react-softphone) no frontend.
    @Default("disabled")
    @Column
    sipEnabled: string; // "enabled" ou "disabled" — padrão dos toggles de settings

    @Column
    sipHost: string;

    @Column
    sipPort: string; // porta WebSocket do servidor SIP (ex.: 8089 no Asterisk)

    @Column
    sipDomain: string; // domínio/realm SIP (fallback: sipHost)

    @Column
    sipUser: string; // usuário de registro (fallback quando o usuário não tem ramal)

    // SENSÍVEL: mascarada nas respostas de leitura dos GETs genéricos
    // (CompanySettingsController); valor real só sai via GET /companySipTrunk.
    @Column
    sipPassword: string;

    @Default("wss")
    @Column
    sipTransport: string; // "udp" | "tcp" | "wss" — navegador resolve para ws/wss

    @Column
    sipCallerId: string; // Caller ID exibido nas chamadas (display_name)
  }
  
  export default CompaniesSettings;