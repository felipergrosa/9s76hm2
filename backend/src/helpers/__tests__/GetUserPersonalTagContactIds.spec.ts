jest.mock("../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../models/Tag", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../../models/ContactTag", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

import User from "../../models/User";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import GetUserPersonalTagContactIds from "../GetUserPersonalTagContactIds";

const mockedUser = User.findByPk as jest.Mock;
const mockedTag = Tag.findAll as jest.Mock;
const mockedContactTag = ContactTag.findAll as jest.Mock;

const makeUser = (overrides: any = {}) => ({
  id: 10,
  profile: "user",
  super: false,
  allowedContactTags: [],
  managedUserIds: [],
  supervisorViewMode: "include",
  ...overrides
});

describe("GetUserPersonalTagContactIds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("super admin: vê tudo, sem restrições", async () => {
    mockedUser.mockResolvedValue(makeUser({ super: true }));

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.hasWalletRestriction).toBe(false);
    expect(result.excludedUserIds).toEqual([]);
  });

  it("modo exclude: managedUserIds viram excludedUserIds (vê todos exceto eles)", async () => {
    mockedUser.mockResolvedValue(
      makeUser({ supervisorViewMode: "exclude", managedUserIds: [2, 3, 4] })
    );

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.supervisorViewMode).toBe("exclude");
    expect(result.excludedUserIds).toEqual([2, 3, 4]);
    expect(result.managedUserIds).toEqual([]);
  });

  it("modo exclude aplica-se também a admin comum (não super)", async () => {
    mockedUser.mockResolvedValue(
      makeUser({
        profile: "admin",
        supervisorViewMode: "exclude",
        managedUserIds: [5]
      })
    );

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.excludedUserIds).toEqual([5]);
  });

  it("admin comum sem exclude: vê tudo", async () => {
    mockedUser.mockResolvedValue(makeUser({ profile: "admin" }));

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.hasWalletRestriction).toBe(false);
    expect(result.excludedUserIds).toEqual([]);
  });

  it("usuário comum sem tags e sem supervisão: sem restrição de carteira", async () => {
    mockedUser.mockResolvedValue(makeUser());

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.hasWalletRestriction).toBe(false);
    expect(result.managedUserIds).toEqual([]);
  });

  it("supervisor include: managedUserIds propagados para ver as lanes gerenciadas", async () => {
    mockedUser.mockResolvedValue(
      makeUser({ supervisorViewMode: "include", managedUserIds: [7, 8] })
    );

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.managedUserIds).toEqual([7, 8]);
    expect(result.excludedUserIds).toEqual([]);
  });

  it("usuário com tags pessoais: retorna contatos permitidos", async () => {
    mockedUser.mockResolvedValue(
      makeUser({ allowedContactTags: [1, 2] })
    );
    mockedTag.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockedContactTag.mockResolvedValue([
      { contactId: 100 },
      { contactId: 200 }
    ]);

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.hasWalletRestriction).toBe(true);
    expect(result.contactIds).toEqual([100, 200]);
  });

  it("usuário não encontrado: falha fechada", async () => {
    mockedUser.mockResolvedValue(null);

    const result = await GetUserPersonalTagContactIds(10, 1);

    expect(result.hasWalletRestriction).toBe(true);
    expect(result.contactIds).toEqual([]);
  });
});
