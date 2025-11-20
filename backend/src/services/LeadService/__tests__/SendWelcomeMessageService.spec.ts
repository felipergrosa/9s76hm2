// Mock das dependências ANTES de importar qualquer coisa
jest.mock("@whiskeysockets/baileys", () => ({
  __esModule: true,
  default: jest.fn(),
  makeWASocket: jest.fn(),
  WAMessage: jest.fn(),
  delay: jest.fn(),
  WASocket: jest.fn(),
  proto: {},
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../../helpers/GetDefaultWhatsApp");
jest.mock("../../TicketServices/FindOrCreateTicketService");
jest.mock("../../WbotServices/SendWhatsAppMessage");
jest.mock("../../../libs/wbot", () => ({
  getWbot: jest.fn(),
  default: jest.fn(),
}));

import SendWelcomeMessageService from "../SendWelcomeMessageService";
import Contact from "../../../models/Contact";
import Whatsapp from "../../../models/Whatsapp";
import Ticket from "../../../models/Ticket";
import Queue from "../../../models/Queue";
import CompaniesSettings from "../../../models/CompaniesSettings";
import GetDefaultWhatsApp from "../../../helpers/GetDefaultWhatsApp";
import FindOrCreateTicketService from "../../TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../../WbotServices/SendWhatsAppMessage";
import logger from "../../../utils/logger";
jest.mock("../../../models/CompaniesSettings", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../models/Queue", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("SendWelcomeMessageService", () => {
  let mockContact: Partial<Contact>;
  let mockWhatsapp: Partial<Whatsapp>;
  let mockTicket: Partial<Ticket>;
  let mockQueue: Partial<Queue>;
  let mockSettings: Partial<CompaniesSettings>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock contact
    mockContact = {
      id: 1,
      name: "João Silva",
      number: "5514999999999",
      companyId: 1,
    } as Contact;

    // Mock whatsapp
    mockWhatsapp = {
      id: 1,
      status: "CONNECTED",
      channel: "whatsapp",
      companyId: 1,
    } as Whatsapp;

    // Mock ticket
    mockTicket = {
      id: 1,
      contactId: 1,
      companyId: 1,
      whatsappId: 1,
    } as Ticket;

    // Mock queue
    mockQueue = {
      id: 1,
      companyId: 1,
    } as Queue;

    // Mock settings
    mockSettings = {
      companyId: 1,
    } as CompaniesSettings;
  });

  describe("Sucesso - Envio de mensagem", () => {
    it("deve enviar mensagem de boas-vindas quando tudo está configurado corretamente", async () => {
      // Arrange
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);
      (Queue.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(mockTicket);
      (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(GetDefaultWhatsApp).toHaveBeenCalledWith(null, 1);
      expect(CompaniesSettings.findOne).toHaveBeenCalledWith({
        where: { companyId: 1 },
      });
      expect(Queue.findOne).toHaveBeenCalledWith({
        where: { companyId: 1 },
        order: [["id", "ASC"]],
      });
      expect(FindOrCreateTicketService).toHaveBeenCalledWith(
        mockContact,
        mockWhatsapp,
        0,
        1,
        1,
        null,
        null,
        "whatsapp",
        false,
        false,
        mockSettings,
        false,
        false
      );
      expect(SendWhatsAppMessage).toHaveBeenCalledWith({
        body: expect.stringContaining("Olá João Silva!"),
        ticket: mockTicket,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 1,
          ticketId: 1,
          whatsappId: 1,
          companyId: 1,
        }),
        "Mensagem de boas-vindas enviada com sucesso"
      );
    });

    it("deve usar mensagem customizada quando fornecida", async () => {
      // Arrange
      const customMessage = "Mensagem customizada de boas-vindas!";
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);
      (Queue.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(mockTicket);
      (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
        welcomeMessage: customMessage,
      });

      // Assert
      expect(SendWhatsAppMessage).toHaveBeenCalledWith({
        body: customMessage,
        ticket: mockTicket,
      });
    });

    it("deve funcionar sem fila configurada", async () => {
      // Arrange
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);
      (Queue.findOne as jest.Mock).mockResolvedValue(null);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(mockTicket);
      (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(FindOrCreateTicketService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        null, // queueId deve ser null
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("Erros e casos de borda", () => {
    it("não deve enviar mensagem se WhatsApp não for encontrado", async () => {
      // Arrange
      (GetDefaultWhatsApp as jest.Mock).mockRejectedValue(
        new Error("ERR_NO_DEF_WAPP_FOUND")
      );

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 1,
          error: expect.anything(),
        }),
        "Nenhum WhatsApp encontrado para enviar mensagem de boas-vindas"
      );
      expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it("não deve enviar mensagem se WhatsApp não estiver conectado", async () => {
      // Arrange
      const disconnectedWhatsapp = {
        ...mockWhatsapp,
        status: "DISCONNECTED",
      };
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(disconnectedWhatsapp);

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappId: 1,
          status: "DISCONNECTED",
        }),
        "WhatsApp não está conectado para enviar mensagem de boas-vindas"
      );
      expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it("não deve enviar mensagem se não conseguir criar ticket", async () => {
      // Arrange
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);
      (Queue.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(null);

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 1,
        }),
        "Não foi possível criar ticket para mensagem de boas-vindas"
      );
      expect(SendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it("não deve bloquear se houver erro ao enviar mensagem", async () => {
      // Arrange
      const error = new Error("Erro ao enviar mensagem");
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);
      (Queue.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(mockTicket);
      (SendWhatsAppMessage as jest.Mock).mockRejectedValue(error);

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Erro ao enviar mensagem",
          contactId: 1,
          companyId: 1,
        }),
        "Erro ao enviar mensagem de boas-vindas"
      );
    });

    it("deve funcionar sem configurações da empresa", async () => {
      // Arrange
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(null);
      (Queue.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(mockTicket);
      (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      expect(FindOrCreateTicketService).toHaveBeenCalled();
      expect(SendWhatsAppMessage).toHaveBeenCalled();
    });
  });

  describe("Validação de mensagem padrão", () => {
    it("deve incluir o nome do contato na mensagem padrão", async () => {
      // Arrange
      (GetDefaultWhatsApp as jest.Mock).mockResolvedValue(mockWhatsapp);
      (CompaniesSettings.findOne as jest.Mock).mockResolvedValue(mockSettings);
      (Queue.findOne as jest.Mock).mockResolvedValue(mockQueue);
      (FindOrCreateTicketService as jest.Mock).mockResolvedValue(mockTicket);
      (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});

      // Act
      await SendWelcomeMessageService({
        contact: mockContact as Contact,
        companyId: 1,
      });

      // Assert
      const callArgs = (SendWhatsAppMessage as jest.Mock).mock.calls[0][0];
      expect(callArgs.body).toContain("Olá João Silva!");
      expect(callArgs.body).toContain("TaktChat");
    });
  });
});

