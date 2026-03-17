import { Op, fn, where, col, Filterable, Includeable, literal } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import ContactTag from "../../models/ContactTag";
import Whatsapp from "../../models/Whatsapp";
// import { BackendPerfMonitor } from "../../utils/performanceDiagnostic";

import { intersection } from "lodash";

import removeAccents from "remove-accents";

import FindCompanySettingOneService from "../CompaniesSettings/FindCompanySettingOneService";
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";
import ListUserGroupPermissionsService from "../UserGroupPermissionServices/ListUserGroupPermissionsService";
import { withCache } from "../../utils/serviceCache";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  dateStart?: string;
  dateEnd?: string;
  updatedAt?: string;
  showAll?: string;
  userId: number;
  withUnreadMessages?: string;
  queueIds: number[];
  tags: number[];
  users: number[];
  contacts?: string[];
  updatedStart?: string;
  updatedEnd?: string;
  connections?: string[];
  whatsappIds?: number[];
  statusFilters?: string[];
  queuesFilter?: string[];
  isGroup?: string;
  companyId: number;
  allTicket?: string;
  sortTickets?: string;
  searchOnMessages?: string;
  walletOnly?: string | boolean;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  tags,
  users,
  status,
  date,
  dateStart,
  dateEnd,
  updatedAt,
  showAll,
  userId,
  withUnreadMessages = "false",
  whatsappIds,
  statusFilters,
  companyId,
  sortTickets = "DESC",
  searchOnMessages = "false",
  walletOnly = false
}: Request): Promise<Response> => {
  // BackendPerfMonitor.start('ListTicketsService:Total');
  // BackendPerfMonitor.mark('ListTicketsService:Start', { searchParam, status, pageNumber });
  
  // Cache: evita queries repetidas durante carregamento inicial (5 abas simultâneas)
  const user = await withCache(
    `user:${userId}:${companyId}`,
    () => ShowUserService(userId, companyId),
    60000 // 1 minuto
  );

  const showTicketAllQueues = user.allHistoric === "enabled";
  const showTicketWithoutQueue = user.allTicket === "enable";
  const showGroups = user.allowGroup === true;
  let showNotificationPendingValue = "disabled";

  if (withUnreadMessages === "true") {
    const showPendingNotification = await FindCompanySettingOneService({
      companyId,
      column: "showNotificationPending"
    });
    showNotificationPendingValue = showPendingNotification[0]?.showNotificationPending || "disabled";
  }

  // Buscar configurações de empresa (LGPD)
  const settingsLGPD = await FindCompanySettingOneService({ companyId, column: "enableLGPD" });
  const isLGPDEnabled = settingsLGPD[0]?.enableLGPD === "enabled";

  let whereCondition: Filterable["where"];

  whereCondition = {
    [Op.or]: [{ userId }, { status: "pending" }],
    queueId: showTicketWithoutQueue ? { [Op.or]: [queueIds, null] } : { [Op.or]: [queueIds] },
    companyId
  };

  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
      include: [
        {
          model: Tag,
          as: "tags",
          attributes: ["id", "name", "color", "kanban"],
          through: { attributes: [] }
        }
      ]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name", "color", "profileImage"]
    },
    {
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color", "kanban"],
      through: { attributes: [] }
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["id", "name", "color", "expiresTicket", "groupAsTicket", "channelType"]
    },
  ];

  const userQueueIds = user.queues.map(queue => queue.id);

  if (status === "open") {
    whereCondition = {
      ...whereCondition,
      userId,
      queueId: { [Op.in]: queueIds },
      isGroup: false // Grupos nunca aparecem na aba "atendendo"
    };
  } else
    if (status === "group" && user.allowGroup) {
      // Montar lista de conexões visíveis: primária + permitidas
      const groupConnIds: number[] = [];
      if (user.whatsappId) groupConnIds.push(user.whatsappId);
      if (user.allowedConnectionIds?.length > 0) {
        groupConnIds.push(...user.allowedConnectionIds);
      }
      const uniqueConnIds = [...new Set(groupConnIds)];

      whereCondition = {
        companyId,
        isGroup: true,
      };

      // Super/admin AGORA TAMBÉM respeitam permissões granulares (mudança solicitada)
      // if (!user.super && user.profile !== "admin") { <-- REMOVIDO PARA APLICAR A TODOS

      // Filtro por conexões permitidas
      if (uniqueConnIds.length > 0) {
        whereCondition = {
          ...whereCondition,
          whatsappId: { [Op.in]: uniqueConnIds },
        };
      }

      // Filtro granular por grupos permitidos (tabela UserGroupPermissions)
      // Cache: evita query repetida para cada aba
      const allowedGroupContactIds = await withCache(
        `groupPermissions:${user.id}:${companyId}`,
        () => ListUserGroupPermissionsService(user.id, companyId),
        60000 // 1 minuto
      );

      if (allowedGroupContactIds.length > 0) {
        // Usuário tem permissões específicas — mostrar apenas esses grupos
        whereCondition = {
          ...whereCondition,
          contactId: { [Op.in]: allowedGroupContactIds },
        };
      } else {
        // Usuário tem allowGroup=true mas nenhum grupo liberado — não mostrar nenhum
        whereCondition = {
          ...whereCondition,
          contactId: { [Op.in]: [0] }, // Nenhum grupo corresponde a contactId=0
        };
      }
      // }
    }
    else
      if (status === "bot") {
        whereCondition = {
          companyId,
          isBot: true,
          queueId: { [Op.or]: [queueIds, null] }
        };
      }
      else
        if (status === "campaign") {
          whereCondition = {
            companyId,
            status: "campaign",
            queueId: showTicketWithoutQueue
              ? { [Op.or]: [queueIds, null] }
              : { [Op.or]: [queueIds] }
          };
        }
        else
          if (user.profile === "user" && status === "pending" && showTicketWithoutQueue) {

            const TicketsUserFilter: any[] | null = [];

            let ticketsIds = [];

            if (!showTicketAllQueues) {
              ticketsIds = await Ticket.findAll({
                where: {
                  companyId,
                  userId:
                    { [Op.or]: [user.id, null] },
                  status: "pending",
                  queueId: { [Op.in]: queueIds }
                },
              });
            } else {
              ticketsIds = await Ticket.findAll({
                where: {
                  companyId,
                  [Op.or]:
                    [{
                      userId:
                        { [Op.or]: [user.id, null] }
                    },
                    {
                      status: "pending"
                    }
                    ],
                  // queueId: { [Op.in] : queueIds},
                  status: "pending"
                },
              });
            }
            if (ticketsIds) {
              TicketsUserFilter.push(ticketsIds.map(t => t.id));
            }

            const ticketsIntersection: number[] = intersection(...TicketsUserFilter);

            whereCondition = {
              ...whereCondition,
              id: ticketsIntersection
            };
          }

  if (
    showAll === "true" &&
    (user.profile === "admin" || user.allUserChat === "enabled") &&
    status !== "search" &&
    status !== "campaign" &&
    status !== "group" // Grupos têm filtro próprio definido acima, não sobrescrever
  ) {

    if (user.allHistoric === "enabled" && showTicketWithoutQueue) {
      whereCondition = { companyId };
    } else if (user.allHistoric === "enabled" && !showTicketWithoutQueue) {
      whereCondition = { companyId, queueId: { [Op.ne]: null } };
    } else if (user.allHistoric === "disabled" && showTicketWithoutQueue) {
      whereCondition = { companyId, queueId: { [Op.or]: [queueIds, null] } };
    } else if (user.allHistoric === "disabled" && !showTicketWithoutQueue) {
      whereCondition = { companyId, queueId: queueIds };
    }
  }


  // Não sobrescrever o filtro específico de campanha definido acima
  if (status && status !== "search" && status !== "campaign") {
    // Para grupos, não sobrescrever o whereCondition que já tem filtros específicos (whatsappId)
    // Nas linhas 132-145 já foi definido o whereCondition para grupos com whatsappId
    if (status === "group") {
      // Preservar o whereCondition existente e apenas garantir que status seja "group"
      whereCondition = {
        ...whereCondition,
        status: "group"
      };
    } else {
      whereCondition = {
        ...whereCondition,
        status: showAll === "true" && status === "pending" && isLGPDEnabled ? { [Op.or]: [status, "lgpd"] } : status,
        // Grupos nunca aparecem nas abas "atendendo" ou "aguardando"
        ...(["open", "pending"].includes(status) ? { isGroup: false } : {})
      };
    }
  }


  if (status === "closed") {
    // Ao invés de trazer milhares de IDs para a memória do Node (o que trava o servidor),
    // aplicamos as regras diretamente no whereCondition principal.
    let whereCondition2: any = { status: "closed" };

    if (!showTicketAllQueues) {
      if (showAll === "false" && user.profile === "admin") {
        whereCondition2 = {
          ...whereCondition2,
          queueId: queueIds,
          userId
        };
      } else {
        whereCondition2 = {
          ...whereCondition2,
          queueId: showAll === "true" || showTicketWithoutQueue ? { [Op.or]: [queueIds, null] } : queueIds,
        };
      }
    } else {
      if (showAll === "false" && (user.profile === "admin" || user.allUserChat === "enabled")) {
        whereCondition2 = {
          ...whereCondition2,
          queueId: queueIds,
          userId
        };
      } else {
        whereCondition2 = {
          ...whereCondition2,
          queueId: showAll === "true" || showTicketWithoutQueue ? { [Op.or]: [queueIds, null] } : queueIds,
        };
      }
    }

    whereCondition = {
      ...whereCondition,
      ...whereCondition2
    } as any;
  }

  // Aplicar searchParam em TODOS os status (não apenas "search")
  // Isso permite busca no modal de processamento em massa
  if (searchParam) {
    const sanitizedSearchParam = removeAccents(searchParam.toLocaleLowerCase().trim());
    if (searchOnMessages === "true") {
      includeCondition = [
        ...includeCondition,
        {
          model: Message,
          as: "messages",
          attributes: ["id", "body"],
          where: {
            body: where(
              fn("LOWER", fn('unaccent', col("body"))),
              "LIKE",
              `%${sanitizedSearchParam}%`
            ),
          },
          required: false,
          duplicating: false
        }
      ];
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          {
            "$contact.name$": where(
              fn("LOWER", fn("unaccent", col("contact.name"))),
              "LIKE",
              `%${sanitizedSearchParam}%`
            )
          },
          { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
          {
            "$message.body$": where(
              fn("LOWER", fn("unaccent", col("body"))),
              "LIKE",
              `%${sanitizedSearchParam}%`
            )
          }
        ]
      };
    } else {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          {
            "$contact.name$": where(
              fn("LOWER", fn("unaccent", col("contact.name"))),
              "LIKE",
              `%${sanitizedSearchParam}%`
            )
          },
          { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } }
        ]
      };
    }
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const contactTagFilter: any[] | null = [];
    const contactTags = await ContactTag.findAll({
      where: { tagId: tags }
    });
    if (contactTags) {
      contactTagFilter.push(contactTags.map(t => t.contactId));
    }

    const contactsIntersection: number[] = intersection(...contactTagFilter);

    whereCondition = {
      ...whereCondition,
      contactId: contactsIntersection
    };
  }

  if (Array.isArray(users) && users.length > 0) {
    whereCondition = {
      ...whereCondition,
      userId: users
    };
  }

  if (Array.isArray(whatsappIds) && whatsappIds.length > 0) {
    whereCondition = {
      ...whereCondition,
      whatsappId: whatsappIds
    };
  }

  if (Array.isArray(statusFilters) && statusFilters.length > 0) {
    whereCondition = {
      ...whereCondition,
      status: { [Op.in]: statusFilters }
    };
  }

  // Manter lógica do status "search" para compatibilidade com busca global
  if (status === "search") {
    let whereCondition2: any = {
      [Op.or]: [{ userId }, { status: ["pending", "closed", "group"] }]
    };

    if (!showTicketAllQueues && user.profile === "user") {
      whereCondition2 = {
        ...whereCondition2,
        queueId: showAll === "true" || showTicketWithoutQueue ? { [Op.or]: [queueIds, null] } : queueIds,
      };
    } else {
      if (showAll === "false" && user.profile === "admin") {
        whereCondition2 = {
          ...whereCondition2,
          queueId: queueIds,
        };
      } else if (showAll === "true" && user.profile === "admin") {
        whereCondition2 = {
          ...whereCondition2,
          queueId: { [Op.or]: [queueIds, null] },
        };
      }
    }

    whereCondition = {
      ...whereCondition,
      ...whereCondition2
    } as any;
  } else
      if (withUnreadMessages === "true") {
        // Se houver um status específico, filtra apenas tickets daquele status com mensagens não lidas
        if (status && status !== "all") {
          whereCondition = {
            status,
            unreadMessages: { [Op.gt]: 0 },
            companyId,
            isGroup: showGroups ? { [Op.or]: [true, false] } : false,
            queueId: showTicketWithoutQueue ? { [Op.or]: [queueIds, null] } : { [Op.or]: [queueIds] },
          };
        } else {
          // Comportamento original quando não há status específico
          whereCondition = {
            [Op.or]: [
              {
                userId,
                status: showNotificationPendingValue ? { [Op.notIn]: ["closed", "lgpd", "nps"] } : { [Op.notIn]: ["pending", "closed", "lgpd", "nps", "group"] },
                queueId: { [Op.in]: userQueueIds },
                unreadMessages: { [Op.gt]: 0 },
                companyId,
                isGroup: showGroups ? { [Op.or]: [true, false] } : false
              },
              {
                status: showNotificationPendingValue ? { [Op.in]: ["pending", "group"] } : { [Op.in]: ["group"] },
                queueId: showTicketWithoutQueue ? { [Op.or]: [userQueueIds, null] } : { [Op.or]: [userQueueIds] },
                unreadMessages: { [Op.gt]: 0 },
                companyId,
                isGroup: showGroups ? { [Op.or]: [true, false] } : false
              }
            ]
          };
        }

        if (status === "group" && (user.allowGroup || showAll === "true")) {
          whereCondition = {
            ...whereCondition,
            queueId: { [Op.or]: [userQueueIds, null] },
          };
        }
      }

  whereCondition = {
    ...whereCondition,
    companyId
  };

  // Restrição de carteira: vê tickets de sua carteira + carteiras gerenciadas + atribuídos a ele/gerenciados
  // Cache: evita query repetida para cada aba
  const walletResult = await withCache(
    `wallet:${userId}:${companyId}`,
    () => GetUserWalletContactIds(userId, companyId),
    60000 // 1 minuto
  );

  const forceWallet = walletOnly === true || walletOnly === "true";

  // Modo EXCLUDE: admin vê tudo EXCETO tickets dos usuários excluídos
  if ((walletResult.excludedUserIds && walletResult.excludedUserIds.length > 0) || (forceWallet && walletResult.excludedUserIds?.length)) {
    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: [
            { userId: { [Op.notIn]: walletResult.excludedUserIds } },
            { userId: userId }, // Sempre vê os próprios tickets
            { userId: userId }, // Meus tickets
            { userId: null } // Tickets sem atribuição
          ]
        }
      ]
    } as any;
  } else if (walletResult.hasWalletRestriction || forceWallet) {
    const allowedContactIds = walletResult.contactIds;
    const allowedUserIds = [userId, ...(walletResult.managedUserIds || [])];
    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: [
            { contactId: { [Op.in]: allowedContactIds.length > 0 ? allowedContactIds : [0] } },
            { userId: { [Op.in]: allowedUserIds.length > 0 ? allowedUserIds : [userId] } }
          ]
        }
      ]
    } as any;
  }

  // Filtro de Conexões: Super Admin vê tudo, demais respeitam allowedConnectionIds
  if (!user.super) {
    const allowedConnectionIds = user.allowedConnectionIds || [];
    if (allowedConnectionIds.length > 0) {
      whereCondition = {
        [Op.and]: [
          whereCondition,
          { whatsappId: { [Op.in]: allowedConnectionIds } }
        ]
      } as any;
    }
  }

  // 2. Ghost Mode (Hide Private Users) - Aplicado a TODOS (Strict Mode)
  // Oculta tickets de usuários marcados como isPrivate, EXCETO se o usuário for o próprio dono.
  // Cache: evita query repetida para cada aba
  const privateUsers = await withCache(
    `privateUsers:${companyId}`,
    async () => {
      const users = await User.findAll({
        where: { companyId, isPrivate: true },
        attributes: ["id"]
      });
      return users;
    },
    60000 // 1 minuto
  );
  const privateUserIds = privateUsers.map(u => u.id);

  if (privateUserIds.length > 0) {
    whereCondition = {
      [Op.and]: [
        whereCondition,
        {
          [Op.or]: [
            { userId: { [Op.notIn]: privateUserIds } }, // Tickets de não-privados
            { userId: userId }, // Meus tickets (mesmo se eu for privado)
            { userId: null } // Tickets sem dono
          ]
        }
      ]
    } as any;
  }

  // 3. REGRA PRINCIPAL: Ticket em atendimento (open com userId) só pode ser visto pelo atendente
  // Grupos (status=group) são excluídos - visibilidade de grupos controlada por allowGroup
  // Independente de ser admin, supervisor ou estar na carteira
  whereCondition = {
    [Op.and]: [
      whereCondition,
      {
        [Op.or]: [
          { userId: userId }, // Meus tickets (sempre vejo os meus)
          { userId: null }, // Tickets sem atribuição (pendentes)
          { status: { [Op.notIn]: ["open"] } } // Tickets group/closed/outros (qualquer um pode ver se permitido)
        ]
      }
    ]
  } as any;

  // Limite/paginação: para showAll === "true", retornamos até 500 registros (otimizado para performance)
  const limit = showAll === "true" ? 500 : 40;
  const offset = showAll === "true" ? 0 : limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    attributes: ["id", "uuid", "userId", "queueId", "isGroup", "channel", "status", "contactId", "useIntegration", "lastMessage", "updatedAt", "unreadMessages", "sessionWindowExpiresAt"],
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", sortTickets]],
    subQuery: false
  });

  // Debug: verificar se ticket específico está sendo filtrado
  if (userId === 3 && status === "open") {
    console.log(`[DEBUG ListTickets] User ${userId}, status ${status}, count: ${count}`);
    console.log(`[DEBUG ListTickets] Tickets retornados: ${tickets.map(t => t.id).join(', ')}`);
    console.log(`[DEBUG ListTickets] whereCondition:`, JSON.stringify(whereCondition, null, 2));
    
    // Verificar se ticket 5349 existe
    const ticket5349 = await Ticket.findByPk(5349);
    if (ticket5349) {
      console.log(`[DEBUG ListTickets] Ticket 5349 no banco:`, {
        id: ticket5349.id,
        status: ticket5349.status,
        userId: ticket5349.userId,
        queueId: ticket5349.queueId,
        contactId: ticket5349.contactId,
        whatsappId: ticket5349.whatsappId,
        isGroup: ticket5349.isGroup
      });
    }
  }

  const hasMore = count > offset + tickets.length;

  // BackendPerfMonitor.end('ListTicketsService:Total', { 
  //   ticketCount: tickets.length, 
  //   totalCount: count,
  //   hasMore 
  // });

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
