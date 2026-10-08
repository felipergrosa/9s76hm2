import { Op, fn, col, where as sequelizeWhere, literal, QueryTypes } from "sequelize";
import removeAccents from "remove-accents";
import sequelize from "../../database";
import Contact from "../../models/Contact";
import walletExistsSql from "../../helpers/walletExistsSql";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  userId?: number | string;
  queueId?: number | string;
  limit?: string;
}

interface WalletOwnerRow {
  contactId: number;
  userId: number;
  userName: string;
  tagId: number;
  tagName: string;
  tagColor: string;
}

interface WalletQueueRow {
  contactId: number;
  queueId: number;
  queueName: string;
  queueColor: string;
}

interface WalletStats {
  totalContacts: number;
  usersWithWallet: number;
  activeQueues: number;
  contactsWithEmail: number;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
  stats: WalletStats;
  walletUsers: { id: number; name: string }[];
}

/**
 * Lista paginada de contatos que possuem carteira.
 *
 * Após a migração Wallet→Tag (ver docs/privado/MIGRACAO-WALLET-TAG-RESUMO.md),
 * "carteira" não é mais uma coluna do contato: um contato está na carteira de um
 * usuário quando ele possui a TAG PESSOAL desse usuário (Tags.name LIKE '#%',
 * exceto '##%' que é tag de grupo) e essa tag consta em User.allowedContactTags.
 *
 * Colunas derivadas retornadas em cada contato:
 *  - walletUsers: usuários donos da carteira (via tag pessoal)
 *  - walletTags: tags pessoais vinculadas ao contato
 *  - queue: fila do ticket mais recente do contato (para a coluna "Fila")
 */
const ListWalletsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  userId,
  queueId,
  limit
}: Request): Promise<Response> => {
  const cid = Number(companyId);
  // IDs chegam como string da query — normaliza para int e ignora inválidos
  const uid = userId !== undefined && userId !== null && userId !== "" ? Number(userId) : null;
  const qid = queueId !== undefined && queueId !== null && queueId !== "" ? Number(queueId) : null;

  // Condição base: contato tem ao menos uma tag pessoal (#) que pertence
  // a algum usuário da empresa (allowedContactTags).
  // companyId/userId são inteiros já validados — interpolação segura.
  // SQL compartilhado em helpers/walletExistsSql (usado também pelo
  // filtro de carteira na listagem de tickets).
  const whereCondition: any = {
    companyId: cid,
    isGroup: false,
    [Op.and]: [literal(walletExistsSql('"Contact"."id"', cid))]
  };

  // Filtro por carteira de um usuário específico
  if (uid && Number.isInteger(uid)) {
    (whereCondition[Op.and] as any[]).push(
      literal(walletExistsSql('"Contact"."id"', cid, [uid]))
    );
  }

  // Filtro por fila: contato precisa ter ticket nessa fila
  if (qid && Number.isInteger(qid)) {
    (whereCondition[Op.and] as any[]).push(
      literal(`EXISTS (
        SELECT 1 FROM "Tickets" tq
         WHERE tq."contactId" = "Contact"."id"
           AND tq."companyId" = ${cid}
           AND tq."queueId" = ${qid}
      )`)
    );
  }

  // Busca textual: nome (unaccent), número, email e CPF/CNPJ
  if (searchParam) {
    const trimmed = searchParam.trim();
    const sanitized = removeAccents(trimmed.toLowerCase());
    const isPureNumber = /^\d+$/.test(trimmed);

    whereCondition[Op.or] = isPureNumber
      ? [
          { number: { [Op.like]: `%${trimmed}%` } },
          { cpfCnpj: { [Op.like]: `%${trimmed}%` } }
        ]
      : [
          {
            name: sequelizeWhere(
              fn("LOWER", fn("unaccent", col("Contact.name"))),
              "LIKE",
              `%${sanitized}%`
            )
          },
          {
            contactName: sequelizeWhere(
              fn("LOWER", fn("unaccent", col("Contact.contactName"))),
              "LIKE",
              `%${sanitized}%`
            )
          },
          { email: { [Op.iLike]: `%${sanitized}%` } },
          { number: { [Op.like]: `%${sanitized}%` } }
        ];
  }

  const pageLimit = Number(limit) || 20;
  const offset = pageLimit * (Number(pageNumber) - 1);

  // Contagem separada dos includes para não inflar com JOINs
  const count = await Contact.count({ where: whereCondition });

  const contacts = await Contact.findAll({
    where: whereCondition,
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "urlPicture",
      "profilePicUrl",
      "companyId",
      "userId",
      "situation",
      "createdAt"
    ],
    include: [
      // Usuário "responsável" registrado no contato (Contact.userId)
      {
        association: "user",
        attributes: ["id", "name"],
        required: false
      },
      // Tags do contato (inclui as pessoais # que definem a carteira)
      {
        association: "tags",
        attributes: ["id", "name", "color"],
        required: false
      }
    ],
    limit: pageLimit,
    offset,
    order: [["name", "ASC"]]
  });

  const contactIds = contacts.map(c => c.id);

  // Mapa contato → donos da carteira (usuários cuja tag pessoal está no contato)
  const ownersRows = contactIds.length
    ? await sequelize.query(
        `SELECT ct."contactId",
                u."id"    AS "userId",
                u."name"  AS "userName",
                tg."id"   AS "tagId",
                tg."name" AS "tagName",
                tg."color" AS "tagColor"
           FROM "ContactTags" ct
           JOIN "Tags" tg
             ON tg."id" = ct."tagId"
            AND tg."companyId" = :companyId
           JOIN "Users" u
             ON u."companyId" = :companyId
            AND ct."tagId" = ANY(u."allowedContactTags")
          WHERE ct."companyId" = :companyId
            AND ct."contactId" IN (:contactIds)
            AND tg."name" LIKE '#%'
            AND tg."name" NOT LIKE '##%'`,
        {
          replacements: { companyId: cid, contactIds },
          type: QueryTypes.SELECT
        }
      )
    : [];

  // Mapa contato → fila do ticket mais recente (para a coluna "Fila")
  const queueRows = contactIds.length
    ? await sequelize.query(
        `SELECT DISTINCT ON (t."contactId")
                t."contactId",
                q."id"    AS "queueId",
                q."name"  AS "queueName",
                q."color" AS "queueColor"
           FROM "Tickets" t
           JOIN "Queues" q ON q."id" = t."queueId"
          WHERE t."companyId" = :companyId
            AND t."contactId" IN (:contactIds)
            AND t."queueId" IS NOT NULL
          ORDER BY t."contactId", t."updatedAt" DESC`,
        {
          replacements: { companyId: cid, contactIds },
          type: QueryTypes.SELECT
        }
      )
    : [];

  const ownersByContact = new Map<number, WalletOwnerRow[]>();
  (ownersRows as unknown as WalletOwnerRow[]).forEach(row => {
    const list = ownersByContact.get(Number(row.contactId)) || [];
    list.push(row);
    ownersByContact.set(Number(row.contactId), list);
  });

  const queueByContact = new Map<number, WalletQueueRow>();
  (queueRows as unknown as WalletQueueRow[]).forEach(row => {
    queueByContact.set(Number(row.contactId), row);
  });

  contacts.forEach(contact => {
    const owners = ownersByContact.get(contact.id) || [];
    // walletUsers: dedup por usuário (um usuário pode ter mais de uma tag pessoal)
    const seenUsers = new Set<number>();
    const walletUsers = owners
      .filter(o => {
        const id = Number(o.userId);
        if (seenUsers.has(id)) return false;
        seenUsers.add(id);
        return true;
      })
      .map(o => ({ id: Number(o.userId), name: o.userName }));

    const walletTags = owners.map(o => ({
      id: Number(o.tagId),
      name: o.tagName,
      color: o.tagColor
    }));

    const q = queueByContact.get(contact.id);

    contact.setDataValue("walletUsers" as any, walletUsers as any);
    contact.setDataValue("walletTags" as any, walletTags as any);
    contact.setDataValue(
      "queue" as any,
      (q
        ? { id: Number(q.queueId), name: q.queueName, color: q.queueColor }
        : null) as any
    );
  });

  // ===== Agregados da base inteira de carteiras (sem filtros de busca) =====
  const [statsRow] = (await sequelize.query(
    `SELECT
       COUNT(DISTINCT ct."contactId") AS "totalContacts",
       COUNT(DISTINCT u."id")         AS "usersWithWallet"
       FROM "ContactTags" ct
       JOIN "Tags" tg
         ON tg."id" = ct."tagId"
        AND tg."companyId" = :companyId
       JOIN "Users" u
         ON u."companyId" = :companyId
        AND ct."tagId" = ANY(u."allowedContactTags")
      WHERE ct."companyId" = :companyId
        AND tg."name" LIKE '#%'
        AND tg."name" NOT LIKE '##%'`,
    { replacements: { companyId: cid }, type: QueryTypes.SELECT }
  )) as any[];

  const [emailRow] = (await sequelize.query(
    `SELECT COUNT(*) AS "contactsWithEmail"
       FROM "Contacts" c
      WHERE c."companyId" = :companyId
        AND c."isGroup" = false
        AND c."email" IS NOT NULL
        AND c."email" <> ''
        AND ${walletExistsSql('c."id"', cid)}`,
    { replacements: { companyId: cid }, type: QueryTypes.SELECT }
  )) as any[];

  const [queuesRow] = (await sequelize.query(
    `SELECT COUNT(DISTINCT t."queueId") AS "activeQueues"
       FROM "Tickets" t
      WHERE t."companyId" = :companyId
        AND t."queueId" IS NOT NULL
        AND ${walletExistsSql('t."contactId"', cid)}`,
    { replacements: { companyId: cid }, type: QueryTypes.SELECT }
  )) as any[];

  // Usuários que possuem ao menos um contato em carteira (alimenta o filtro)
  const walletUsers = (await sequelize.query(
    `SELECT DISTINCT u."id", u."name"
       FROM "Users" u
      WHERE u."companyId" = :companyId
        AND EXISTS (
          SELECT 1
            FROM "ContactTags" ct
            JOIN "Tags" tg
              ON tg."id" = ct."tagId"
             AND tg."companyId" = :companyId
           WHERE ct."companyId" = :companyId
             AND ct."tagId" = ANY(u."allowedContactTags")
             AND tg."name" LIKE '#%'
             AND tg."name" NOT LIKE '##%'
        )
      ORDER BY u."name"`,
    { replacements: { companyId: cid }, type: QueryTypes.SELECT }
  )) as unknown as { id: number; name: string }[];

  const stats: WalletStats = {
    totalContacts: Number(statsRow?.totalContacts) || 0,
    usersWithWallet: Number(statsRow?.usersWithWallet) || 0,
    activeQueues: Number(queuesRow?.activeQueues) || 0,
    contactsWithEmail: Number(emailRow?.contactsWithEmail) || 0
  };

  const hasMore = count > offset + contacts.length;

  return { contacts, count, hasMore, stats, walletUsers };
};

export default ListWalletsService;
