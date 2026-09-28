jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({ __esModule: true, default: class Ticket {} }));
jest.mock("../../../models/Contact", () => ({ __esModule: true, default: class Contact {} }));
jest.mock("../../../models/Queue", () => ({ __esModule: true, default: class Queue {} }));
jest.mock("../../../models/Whatsapp", () => ({ __esModule: true, default: class Whatsapp {} }));
jest.mock("../../../models/User", () => ({ __esModule: true, default: class User {} }));
jest.mock("../../../models/Tag", () => ({ __esModule: true, default: class Tag {} }));
jest.mock("../../../utils/logger", () => ({ __esModule: true, default: { debug: jest.fn() } }));
jest.mock("../MessageEventBus", () => ({
  messageEventBus: { publishAckUpdated: jest.fn() }
}));
jest.mock("../MessageQueryService", () => ({ invalidateTicketCache: jest.fn() }));

import Message from "../../../models/Message";
import { messageEventBus } from "../MessageEventBus";
import { updateMessageAckByWid } from "../MessageCommandService";

const findOne = Message.findOne as jest.Mock;
const publishAckUpdated = messageEventBus.publishAckUpdated as jest.Mock;

describe("atualização de status de mensagens", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra falha de envio apenas na empresa da mensagem", async () => {
    const message = {
      id: 91,
      wid: "wamid.abc",
      companyId: 7,
      ticketId: 12,
      ticket: { uuid: "ticket-12" },
      ack: 1,
      update: jest.fn(async function (this: any, values) {
        this.ack = values.ack;
      })
    };
    findOne.mockResolvedValue(message);

    await updateMessageAckByWid("wamid.abc", 7, -1);

    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { wid: "wamid.abc", companyId: 7 }
    }));
    expect(message.update).toHaveBeenCalledWith({ ack: -1 });
    expect(publishAckUpdated).toHaveBeenCalledWith(7, 12, "ticket-12", 91, message);
  });

  it("não regride uma mensagem já entregue por webhook de falha atrasado", async () => {
    const message = {
      id: 92,
      companyId: 7,
      ticketId: 12,
      ticket: { uuid: "ticket-12" },
      ack: 2,
      update: jest.fn()
    };
    findOne.mockResolvedValue(message);

    await updateMessageAckByWid("wamid.def", 7, -1);

    expect(message.update).not.toHaveBeenCalled();
    expect(publishAckUpdated).not.toHaveBeenCalled();
  });
});
