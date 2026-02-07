import { Op, Filterable } from "sequelize";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import Ticket from "../../models/Ticket";
import UsersQueues from "../../models/UserQueue";
import User from "../../models/User";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";

interface Request {
  dateStart: string;
  dateEnd: string;
  status?: string[];
  userId: string;
  queuesIds?: string[];
  companyId: string | number;
  showAll?: string | boolean;
}

const TicketsQueuesService = async ({
  dateStart,
  dateEnd,
  status,
  userId,
  queuesIds,
  companyId,
  showAll
}: Request): Promise<Ticket[]> => {
  let whereCondition: Filterable["where"] = {
    // [Op.or]: [{ userId }, { status: "pending" }]
  };

  const includeCondition = [
    {
      model: User,
      as: "user",
      attributes: ["id", "name", "profile", "online", "profileImage"],
    },
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl", "companyId", "urlPicture"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      association: "whatsapp",
      attributes: ["id", "name"]
    }
  ];
  const isExistsQueues = await Queue.count({ where: { companyId } });
  // eslint-disable-next-line eqeqeq
  if (isExistsQueues) {
    const queues = await UsersQueues.findAll({
      where: {
        userId
      }
    });
    let queuesIdsUser = queues.map(q => q.queueId);

    if (queuesIds) {
      const newArray: number[] = [];
      queuesIds.forEach(i => {
        const idx = queuesIdsUser.indexOf(+i);
        if (idx) {
          newArray.push(+i);
        }
      });
      queuesIdsUser = newArray;
    }

    whereCondition = {
      ...whereCondition,
      queueId: {
        [Op.in]: queuesIdsUser
      }
    };
  }

  // eslint-disable-next-line eqeqeq
  if (showAll == "true") {
    // Mantém o filtro de filas se ele já foi definido, mas remove filtros de userId/status anteriores
    const queueFilter = whereCondition.queueId ? { queueId: whereCondition.queueId } : {};
    whereCondition = { ...queueFilter };
  }

  whereCondition = {
    ...whereCondition,
    status: { [Op.in]: ["open", "pending", "campaign"] },
    companyId
  }

  if (dateStart && dateEnd) {
    whereCondition = {
      ...whereCondition,
      createdAt: {
        [Op.between]: [
          +startOfDay(parseISO(dateStart)),
          +endOfDay(parseISO(dateEnd))
        ]
      }
    };
  }

  // Aplica restrição de carteiras (wallet) - mesmo padrão de ListTicketsService
  const walletResult = await GetUserWalletContactIds(+userId, +companyId);

  // Modo EXCLUDE: admin vê tudo EXCETO tickets dos usuários excluídos
  if (walletResult.excludedUserIds && walletResult.excludedUserIds.length > 0) {
    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: [
            { userId: { [Op.notIn]: walletResult.excludedUserIds } },
            { userId: +userId }, // Sempre vê os próprios tickets
            { userId: null } // Tickets sem atribuição
          ]
        }
      ]
    } as any;
  } else if (walletResult.hasWalletRestriction) {
    const allowedContactIds = walletResult.contactIds;
    const allowedUserIds = [+userId, ...(walletResult.managedUserIds || [])];

    const orConditions: any[] = [
      { contactId: { [Op.in]: allowedContactIds.length > 0 ? allowedContactIds : [0] } },
      { userId: { [Op.in]: allowedUserIds.length > 0 ? allowedUserIds : [+userId] } }
    ];

    if (walletResult.managedUserIds && walletResult.managedUserIds.length > 0) {
      orConditions.push({ userId: null });
    }

    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: orConditions
        }
      ]
    } as any;
  } else if (showAll !== "true") {
    // FALLBACK: Se não tem restrição de carteira e NÃO é admin (showAll!=true),
    // aplica restrição padrão de usuário: ver apenas os seus ou os sem dono (pendentes)
    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: [
            { userId: +userId },
            { userId: null }
          ]
        }
      ]
    } as any;
  }

  // REGRA PRINCIPAL: Ticket em atendimento (open/group com userId) só pode ser visto pelo atendente
  // OU por supervisores que gerenciam esse atendente (modo "include"), OU por admin/superadmin (showAll)
  // Se showAll=true (admin/superadmin), não aplica restrição de userId na regra principal
  if (showAll !== "true") {
    // Usar walletResult que já tem a lógica correta de supervisorViewMode
    const supervisorViewMode = walletResult.supervisorViewMode || "include";
    const managedUserIds = walletResult.managedUserIds || [];
    const isSupervisor = supervisorViewMode === "include" && managedUserIds.length > 0;

    let userOrConditions: any[] = [
      { userId: +userId }, // Meus tickets (sempre vejo os meus)
      { userId: null }, // Tickets sem atribuição (pendentes)
      { status: { [Op.notIn]: ["open", "group"] } } // Tickets fechados/outros (qualquer um pode ver)
    ];

    // Se for supervisor no modo "include", também vê tickets dos supervisionados
    // No modo "exclude", os usuários já estão filtrados por excludedUserIds nas linhas 111-124
    if (isSupervisor) {
      const managedIds = managedUserIds.map((id: any) => Number(id));
      userOrConditions.push({ userId: { [Op.in]: managedIds } });
    }

    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: userOrConditions
        }
      ]
    } as any;
  }

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    subQuery: false,
    order: [
      ["user", "name", "ASC"],
      ["updatedAt", "DESC"],
    ]
  });
  return tickets;
};

export default TicketsQueuesService;
