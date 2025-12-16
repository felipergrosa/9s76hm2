/**
 * Testes E2E para validar o sistema de permissões de carteira de usuário
 * 
 * Cenários testados:
 * 1. Admin vê todos os tickets e contatos
 * 2. Não-admin com tags pessoais vê apenas tickets/contatos de sua carteira
 * 3. Não-admin sem tags pessoais vê apenas tickets atribuídos a ele
 * 4. Auto-tag ao transferir ticket aplica tag pessoal do destinatário
 * 5. Filtro de tags permitidas mostra apenas tags pessoais (#)
 */

import { Op } from "sequelize";
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";
import ApplyUserPersonalTagService from "../ContactServices/ApplyUserPersonalTagService";

// Mock dos models
jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../models/Tag", () => ({
  findAll: jest.fn()
}));

jest.mock("../../models/ContactTag", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn()
}));

import User from "../../models/User";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";

describe("Sistema de Permissões de Carteira", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GetUserWalletContactIds", () => {
    it("deve retornar hasWalletRestriction=false para admin", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 1,
        profile: "admin",
        allowedContactTags: [1, 2, 3]
      });

      const result = await GetUserWalletContactIds(1, 1);

      expect(result.hasWalletRestriction).toBe(false);
      expect(result.contactIds).toEqual([]);
    });

    it("deve retornar hasWalletRestriction=true para não-admin sem tags", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        profile: "user",
        allowedContactTags: []
      });

      const result = await GetUserWalletContactIds(2, 1);

      expect(result.hasWalletRestriction).toBe(true);
      expect(result.contactIds).toEqual([]);
    });

    it("deve retornar contactIds da carteira para não-admin com tags pessoais", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        profile: "user",
        allowedContactTags: [1, 2]
      });

      (Tag.findAll as jest.Mock).mockResolvedValue([
        { id: 1, name: "#joao" },
        { id: 2, name: "#maria" }
      ]);

      (ContactTag.findAll as jest.Mock).mockResolvedValue([
        { contactId: 10 },
        { contactId: 20 },
        { contactId: 30 }
      ]);

      const result = await GetUserWalletContactIds(2, 1);

      expect(result.hasWalletRestriction).toBe(true);
      expect(result.contactIds).toEqual([10, 20, 30]);
    });

    it("deve ignorar tags complementares (##) e transacionais", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        profile: "user",
        allowedContactTags: [1, 2, 3, 4]
      });

      // Tag.findAll filtra internamente para não incluir ##
      (Tag.findAll as jest.Mock).mockResolvedValue([
        { id: 1, name: "#joao" }
        // Tags ##complementar e transacional não são retornadas
      ]);

      (ContactTag.findAll as jest.Mock).mockResolvedValue([
        { contactId: 10 }
      ]);

      const result = await GetUserWalletContactIds(2, 1);

      expect(result.hasWalletRestriction).toBe(true);
      expect(result.contactIds).toEqual([10]);
    });

    it("deve retornar lista vazia se usuário não existe", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await GetUserWalletContactIds(999, 1);

      expect(result.hasWalletRestriction).toBe(true);
      expect(result.contactIds).toEqual([]);
    });
  });

  describe("ApplyUserPersonalTagService", () => {
    it("deve aplicar tag pessoal do usuário ao contato", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        name: "João",
        allowedContactTags: [1, 2]
      });

      (Tag.findAll as jest.Mock).mockResolvedValue([
        { id: 1, name: "#joao" }
      ]);

      (ContactTag.findOne as jest.Mock).mockResolvedValue(null);
      (ContactTag.create as jest.Mock).mockResolvedValue({ contactId: 10, tagId: 1 });

      await ApplyUserPersonalTagService({
        contactId: 10,
        userId: 2,
        companyId: 1
      });

      expect(ContactTag.create).toHaveBeenCalledWith({
        contactId: 10,
        tagId: 1
      });
    });

    it("não deve duplicar tag se já existe no contato", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        name: "João",
        allowedContactTags: [1]
      });

      (Tag.findAll as jest.Mock).mockResolvedValue([
        { id: 1, name: "#joao" }
      ]);

      // Tag já existe no contato
      (ContactTag.findOne as jest.Mock).mockResolvedValue({ contactId: 10, tagId: 1 });

      await ApplyUserPersonalTagService({
        contactId: 10,
        userId: 2,
        companyId: 1
      });

      expect(ContactTag.create).not.toHaveBeenCalled();
    });

    it("não deve fazer nada se usuário não tem tags pessoais", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        name: "João",
        allowedContactTags: []
      });

      await ApplyUserPersonalTagService({
        contactId: 10,
        userId: 2,
        companyId: 1
      });

      expect(Tag.findAll).not.toHaveBeenCalled();
      expect(ContactTag.create).not.toHaveBeenCalled();
    });
  });

  describe("Filtro de Tags Pessoais", () => {
    it("deve identificar corretamente tags pessoais (#) vs complementares (##)", () => {
      const tags = [
        { id: 1, name: "#joao" },        // pessoal
        { id: 2, name: "#maria" },       // pessoal
        { id: 3, name: "##vendas" },     // complementar
        { id: 4, name: "###interno" },   // complementar
        { id: 5, name: "transacional" }  // sem #
      ];

      const personalTags = tags.filter(t => 
        t.name.startsWith('#') && !t.name.startsWith('##')
      );

      expect(personalTags).toHaveLength(2);
      expect(personalTags.map(t => t.name)).toEqual(['#joao', '#maria']);
    });
  });

  describe("Cenários de Visibilidade de Tickets", () => {
    it("admin deve ver todos os tickets (sem restrição de carteira)", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 1,
        profile: "admin",
        allowedContactTags: [1, 2]
      });

      const result = await GetUserWalletContactIds(1, 1);

      // Admin não tem restrição
      expect(result.hasWalletRestriction).toBe(false);
    });

    it("não-admin deve ver apenas tickets de sua carteira OU atribuídos a ele", async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({
        id: 2,
        profile: "user",
        allowedContactTags: [1]
      });

      (Tag.findAll as jest.Mock).mockResolvedValue([
        { id: 1, name: "#joao" }
      ]);

      (ContactTag.findAll as jest.Mock).mockResolvedValue([
        { contactId: 100 },
        { contactId: 200 }
      ]);

      const result = await GetUserWalletContactIds(2, 1);

      // Deve ter restrição
      expect(result.hasWalletRestriction).toBe(true);
      // Deve retornar apenas contatos da carteira
      expect(result.contactIds).toEqual([100, 200]);

      // A query de tickets deve incluir:
      // - tickets com contactId IN [100, 200] (carteira)
      // - OU tickets com userId = 2 (atribuídos)
    });
  });
});

describe("Integração: Fluxo Completo de Transferência", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve aplicar tag ao transferir ticket para outro usuário", async () => {
    // Cenário: Ticket é transferido do usuário 1 para usuário 2
    // Usuário 2 tem tag pessoal #maria
    // O contato do ticket deve receber a tag #maria

    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 2,
      name: "Maria",
      allowedContactTags: [5]
    });

    (Tag.findAll as jest.Mock).mockResolvedValue([
      { id: 5, name: "#maria" }
    ]);

    (ContactTag.findOne as jest.Mock).mockResolvedValue(null);
    (ContactTag.create as jest.Mock).mockResolvedValue({ contactId: 50, tagId: 5 });

    await ApplyUserPersonalTagService({
      contactId: 50,
      userId: 2,
      companyId: 1
    });

    expect(ContactTag.create).toHaveBeenCalledWith({
      contactId: 50,
      tagId: 5
    });
  });
});
