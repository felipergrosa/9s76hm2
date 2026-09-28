import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";

interface Request {
  companyId: number;
  startDate: string;
  lastDate: string;
  limit?: number;
  cursor?: string;
}

interface Result {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

const parseDay = (value: string): Date => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("INVALID_DATE_RANGE", 400);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new AppError("INVALID_DATE_RANGE", 400);
  }
  return parsed;
};

const encodeCursor = (message: Message): string =>
  Buffer.from(JSON.stringify({ createdAt: message.createdAt, id: message.id }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decodeCursor = (value: string): { createdAt: Date; id: number } => {
  if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new AppError("INVALID_CURSOR", 400);
  }
  try {
    const parsed = JSON.parse(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    const createdAt = new Date(parsed.createdAt);
    const id = Number(parsed.id);
    if (!Number.isSafeInteger(id) || id <= 0 || Number.isNaN(createdAt.getTime())) {
      throw new Error("invalid cursor fields");
    }
    return { createdAt, id };
  } catch {
    throw new AppError("INVALID_CURSOR", 400);
  }
};

const GetMessageRangeService = async ({ companyId, startDate, lastDate, limit = 100, cursor }: Request): Promise<Result> => {
  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new AppError("INVALID_COMPANY", 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new AppError("INVALID_LIMIT", 400);
  }

  const start = parseDay(startDate);
  const end = parseDay(lastDate);
  if (end < start || (end.getTime() - start.getTime()) / 86400000 > 92) {
    throw new AppError("INVALID_DATE_RANGE", 400);
  }
  end.setUTCDate(end.getUTCDate() + 1);

  const where: any = {
    companyId,
    createdAt: { [Op.gte]: start, [Op.lt]: end }
  };
  if (cursor) {
    const position = decodeCursor(cursor);
    if (position.createdAt < start || position.createdAt >= end) {
      throw new AppError("INVALID_CURSOR", 400);
    }
    where[Op.or] = [
      { createdAt: { [Op.gt]: position.createdAt } },
      { createdAt: position.createdAt, id: { [Op.gt]: position.id } }
    ];
  }

  const rows = await Message.findAll({
    where,
    order: [["createdAt", "ASC"], ["id", "ASC"]],
    limit: limit + 1
  });
  const hasMore = rows.length > limit;
  const messages = hasMore ? rows.slice(0, limit) : rows;
  return {
    messages,
    hasMore,
    nextCursor: hasMore ? encodeCursor(messages[messages.length - 1]) : null
  };
};

export default GetMessageRangeService;
