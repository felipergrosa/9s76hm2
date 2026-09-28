jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { UpdateSessionWindow } from "../UpdateSessionWindowService";

const updateTicket = Ticket.update as jest.Mock;
const findWhatsapp = Whatsapp.findByPk as jest.Mock;

describe("janela de atendimento da API oficial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findWhatsapp.mockResolvedValue({ channelType: "official" });
    updateTicket.mockResolvedValue([1]);
  });

  it("calcula a janela pelo horário da mensagem recebida, mesmo com webhook atrasado", async () => {
    const receivedAt = Date.now() - 2 * 60 * 60 * 1000;
    await UpdateSessionWindow(9, 4, receivedAt);

    expect(updateTicket).toHaveBeenCalledWith(
      { sessionWindowExpiresAt: new Date(receivedAt + 24 * 60 * 60 * 1000) },
      expect.objectContaining({ where: expect.objectContaining({ id: 9 }) })
    );
  });

  it("propaga erro de persistência para que o webhook seja reprocessado", async () => {
    updateTicket.mockRejectedValue(new Error("database unavailable"));

    await expect(UpdateSessionWindow(9, 4, Date.now()))
      .rejects.toThrow("database unavailable");
  });
});
