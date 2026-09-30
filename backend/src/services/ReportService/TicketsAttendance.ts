import sequelize from "../../database/index";
import { QueryTypes } from "sequelize";

interface Return {
  data: {};
}

interface Request {
  initialDate: string;
  finalDate: string;
  companyId: number;
}

interface DataReturn {
  quantidade: number;
  data?: number;
  nome?: string;
}

interface dataUser {
  name: string;
}

export const TicketsAttendance = async ({ initialDate, finalDate, companyId }: Request): Promise<Return> => { 

  // Segurança: companyId coagido a inteiro e datas passadas via bind (sem interpolação no SQL)
  const companyIdNum = Number(companyId);

  const sqlUsers = `select u.name from "Users" u where u."companyId" = ?`

  const users: dataUser[] = await sequelize.query(sqlUsers, {
    replacements: [companyIdNum],
    type: QueryTypes.SELECT
  });

  const sql = `
  select
    COUNT(*) AS quantidade,
    u.name AS nome
  from
    "Tickets" tt
    left join "Users" u on u.id = tt."userId"
  where
    tt."companyId" = ?
    and tt."userId" is not null
    and tt."createdAt" >= ?
    and tt."createdAt" <= ?
  group by
    nome
  ORDER BY
    nome asc`

  const data: DataReturn[] = await sequelize.query(sql, {
    replacements: [companyIdNum, `${initialDate} 00:00:00`, `${finalDate} 23:59:59`],
    type: QueryTypes.SELECT
  });

  users.map(user => {
    let indexCreated = data.findIndex((item) => item.nome === user.name);

    if (indexCreated === -1) {
      data.push({ quantidade: 0, nome: user.name })
    }

  })

  return { data };
}
