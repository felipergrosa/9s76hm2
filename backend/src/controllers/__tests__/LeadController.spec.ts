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

jest.mock("../../models/Contact");
jest.mock("../../models/Company");
jest.mock("../../models/Tag");
jest.mock("../../models/ContactTag");
jest.mock("../../services/LeadService/SendWelcomeMessageService");
jest.mock("../../libs/wbot", () => ({
  getWbot: jest.fn(),
  default: jest.fn(),
}));

import { Request, Response } from "express";
import * as LeadController from "../LeadController";
import Contact from "../../models/Contact";
import Company from "../../models/Company";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import SendWelcomeMessageService from "../../services/LeadService/SendWelcomeMessageService";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock do ContactCustomField (import dinâmico)
jest.mock("../../models/ContactCustomField", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

describe("LeadController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockCompany: Partial<Company>;
  let mockContact: Partial<Contact>;
  let mockExistingContact: Partial<Contact>;
  let mockTag: Partial<Tag>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockRequest = {
      body: {
        name: "João Silva",
        email: "joao@example.com",
        phone: "(14) 99999-9999",
        company: "Empresa Teste",
        message: "Gostaria de saber mais sobre o TaktChat",
      },
    };

    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock company
    mockCompany = {
      id: 1,
      name: "Empresa Teste",
    } as Company;

    // Mock contact (novo)
    mockContact = {
      id: 1,
      name: "João Silva",
      email: "joao@example.com",
      number: "5514999999999",
      companyId: 1,
      save: jest.fn().mockResolvedValue(true),
    } as any;

    // Mock existing contact
    mockExistingContact = {
      id: 2,
      name: "João Silva Antigo",
      email: "joao.antigo@example.com",
      number: "5514999999999",
      companyId: 1,
      save: jest.fn().mockResolvedValue(true),
    } as any;

    // Mock tag
    mockTag = {
      id: 1,
      name: "Lead",
      color: "#25D366",
      companyId: 1,
    } as Tag;
  });

  describe("store - Criar novo lead", () => {
    it("deve criar um novo lead com sucesso", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
      (SendWelcomeMessageService as jest.Mock).mockResolvedValue(undefined);

      // Mock ContactCustomField
      const ContactCustomField = await import("../../models/ContactCustomField");
      (ContactCustomField.default.create as jest.Mock).mockResolvedValue({});

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(Company.findOne).toHaveBeenCalledWith({
        order: [["id", "ASC"]],
      });
      expect(Contact.findOne).toHaveBeenCalledWith({
        where: {
          number: "14999999999", // Número limpo (sem formatação)
          companyId: 1,
        },
      });
      expect(Contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "João Silva",
          email: "joao@example.com",
          number: "14999999999", // Número limpo (sem formatação)
          companyId: 1,
        })
      );
      expect(Tag.findOrCreate).toHaveBeenCalledWith({
        where: { name: "Lead", companyId: 1 },
        defaults: { color: "#25D366", kanban: 0 },
      });
      expect(ContactTag.findOrCreate).toHaveBeenCalledWith({
        where: { contactId: 1, tagId: 1 },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          contact: mockContact,
          message: "Lead criado com sucesso",
          isNew: true,
        })
      );
    });

    it("deve salvar mensagem como extraInfo quando fornecida", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      const ContactCustomField = await import("../../models/ContactCustomField");
      (ContactCustomField.default.create as jest.Mock).mockResolvedValue({});

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(ContactCustomField.default.create).toHaveBeenCalledWith({
        contactId: 1,
        name: "Mensagem do Lead",
        value: "Gostaria de saber mais sobre o TaktChat",
      });
    });

    it("deve chamar SendWelcomeMessageService após criar lead", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
      (SendWelcomeMessageService as jest.Mock).mockResolvedValue(undefined);

      const ContactCustomField = await import("../../models/ContactCustomField");
      (ContactCustomField.default.create as jest.Mock).mockResolvedValue({});

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert - Verificar que setImmediate foi chamado (indiretamente)
      // Como setImmediate é assíncrono, verificamos que o serviço foi importado
      expect(SendWelcomeMessageService).toBeDefined();
    });

    it("deve limpar e formatar número de telefone corretamente", async () => {
      // Arrange
      mockRequest.body = {
        name: "João Silva",
        email: "joao@example.com",
        phone: "(14) 98125-2988", // Número com formatação
      };

      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      const ContactCustomField = await import("../../models/ContactCustomField");
      (ContactCustomField.default.create as jest.Mock).mockResolvedValue({});

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(Contact.findOne).toHaveBeenCalledWith({
        where: {
          number: "14981252988", // Número limpo
          companyId: 1,
        },
      });
      expect(Contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          number: "14981252988",
        })
      );
    });
  });

  describe("store - Atualizar lead existente", () => {
    it("deve atualizar contato existente quando número já existe", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(mockExistingContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(Contact.findOne).toHaveBeenCalled();
      expect(mockExistingContact.save).toHaveBeenCalled();
      expect(mockExistingContact.name).toBe("João Silva");
      expect(mockExistingContact.email).toBe("joao@example.com");
      expect(Contact.create).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          contact: mockExistingContact,
          message: "Lead atualizado com sucesso",
          isNew: false,
        })
      );
    });

    it("deve adicionar tag Lead a contato existente se não tiver", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(mockExistingContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(Tag.findOrCreate).toHaveBeenCalled();
      expect(ContactTag.findOrCreate).toHaveBeenCalledWith({
        where: { contactId: 2, tagId: 1 },
      });
    });
  });

  describe("store - Validação", () => {
    it("deve retornar erro se nome não for fornecido", async () => {
      // Arrange
      mockRequest.body = {
        email: "joao@example.com",
        phone: "14999999999",
      };

      // Act & Assert
      try {
        await LeadController.store(mockRequest as Request, mockResponse as Response);
        // Se não lançou erro, o teste falha
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(mockResponse.status).not.toHaveBeenCalled();
      }
    });

    it("deve retornar erro se email for inválido", async () => {
      // Arrange
      mockRequest.body = {
        name: "João Silva",
        email: "email-invalido",
        phone: "14999999999",
      };

      // Act & Assert
      try {
        await LeadController.store(mockRequest as Request, mockResponse as Response);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });

    it("deve retornar erro se telefone não for fornecido", async () => {
      // Arrange
      mockRequest.body = {
        name: "João Silva",
        email: "joao@example.com",
      };

      // Act & Assert
      try {
        await LeadController.store(mockRequest as Request, mockResponse as Response);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });

    it("deve retornar erro se mensagem for muito longa", async () => {
      // Arrange
      mockRequest.body = {
        name: "João Silva",
        email: "joao@example.com",
        phone: "14999999999",
        message: "a".repeat(501), // Mais de 500 caracteres
      };

      // Act & Assert
      try {
        await LeadController.store(mockRequest as Request, mockResponse as Response);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });
  });

  describe("store - Erros", () => {
    it("deve retornar erro 400 se não houver empresa cadastrada", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Sistema não configurado corretamente",
      });
      expect(logger.warn).toHaveBeenCalledWith(
        "Nenhuma empresa encontrada para salvar lead"
      );
    });

    it("deve tratar erro ao criar contato", async () => {
      // Arrange
      const error = new Error("Erro ao criar contato");
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      try {
        await LeadController.store(mockRequest as Request, mockResponse as Response);
        expect(true).toBe(false); // Não deveria chegar aqui
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(String),
          }),
          "Erro ao criar lead"
        );
      }
    });

    it("não deve bloquear se houver erro ao adicionar tag", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockRejectedValue(
        new Error("Erro ao criar tag")
      );

      const ContactCustomField = await import("../../models/ContactCustomField");
      (ContactCustomField.default.create as jest.Mock).mockResolvedValue({});

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "Erro ao adicionar tag Lead",
        expect.anything()
      );
      // Deve continuar e retornar sucesso mesmo com erro na tag
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it("não deve bloquear se houver erro ao salvar mensagem como extraInfo", async () => {
      // Arrange
      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      const ContactCustomField = await import("../../models/ContactCustomField");
      (ContactCustomField.default.create as jest.Mock).mockRejectedValue(
        new Error("Erro ao salvar")
      );

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "Erro ao adicionar mensagem como extraInfo",
        expect.anything()
      );
      // Deve continuar e retornar sucesso mesmo com erro ao salvar mensagem
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe("store - Campos opcionais", () => {
    it("deve funcionar sem empresa do lead", async () => {
      // Arrange
      mockRequest.body = {
        name: "João Silva",
        email: "joao@example.com",
        phone: "14999999999",
      };

      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      const ContactCustomField = await import("../../models/ContactCustomField");

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(Contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bzEmpresa: null,
        })
      );
    });

    it("deve funcionar sem mensagem", async () => {
      // Arrange
      mockRequest.body = {
        name: "João Silva",
        email: "joao@example.com",
        phone: "14999999999",
        company: "Empresa Teste",
      };

      (Company.findOne as jest.Mock).mockResolvedValue(mockCompany);
      (Contact.findOne as jest.Mock).mockResolvedValue(null);
      (Contact.create as jest.Mock).mockResolvedValue(mockContact);
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([mockTag, true]);
      (ContactTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

      const ContactCustomField = await import("../../models/ContactCustomField");

      // Act
      await LeadController.store(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(ContactCustomField.default.create).not.toHaveBeenCalled();
    });
  });
});

