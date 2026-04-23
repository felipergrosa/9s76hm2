import { FindOptions } from "sequelize/types";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Queue from "../../models/Queue";

import { Sequelize } from "sequelize-typescript";
import { QueryTypes } from "sequelize";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dbConfig = require("../../config/database");
const sequelize = new Sequelize(dbConfig);

interface Request {
  companyId: number;
  fromMe: boolean;
  dateStart: string;
  dateEnd: string;
}

interface Response {
  count: number;
}

const ListMessagesServiceAll = async ({
  companyId,
  fromMe,
  dateStart,
  dateEnd
}: Request): Promise<Response> => {

  // Queries parametrizadas para evitar SQL Injection via companyId/dateStart/dateEnd.
  let ticketsCounter: any;
  if (dateStart && dateEnd) {
    if (fromMe) {
      ticketsCounter = await sequelize.query(
        `select COUNT(*) from "Messages" m where "companyId" = :companyId and "fromMe" = :fromMe and "createdAt" between :dateStart and :dateEnd`,
        {
          replacements: {
            companyId,
            fromMe,
            dateStart: `${dateStart} 00:00:00`,
            dateEnd: `${dateEnd} 23:59:59`
          },
          type: QueryTypes.SELECT
        }
      );
    } else {
      ticketsCounter = await sequelize.query(
        `select COUNT(*) from "Messages" m where "companyId" = :companyId and "createdAt" between :dateStart and :dateEnd`,
        {
          replacements: {
            companyId,
            dateStart: `${dateStart} 00:00:00`,
            dateEnd: `${dateEnd} 23:59:59`
          },
          type: QueryTypes.SELECT
        }
      );
    }
  } else {
    if (fromMe) {
      ticketsCounter = await sequelize.query(
        `select COUNT(*) from "Messages" m where "companyId" = :companyId and "fromMe" = :fromMe`,
        {
          replacements: { companyId, fromMe },
          type: QueryTypes.SELECT
        }
      );
    } else {
      ticketsCounter = await sequelize.query(
        `select COUNT(*) from "Messages" m where "companyId" = :companyId`,
        {
          replacements: { companyId },
          type: QueryTypes.SELECT
        }
      );
    }
  }

  return {
    count: ticketsCounter,
  };
};

export default ListMessagesServiceAll;
