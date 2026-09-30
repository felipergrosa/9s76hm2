import sequelize from "../../database/index";
import { QueryTypes } from "sequelize";

interface Return {
  data: {};
  count: number;
}

interface Request {
  initialDate: string;
  finalDate: string;
  companyId: number;
}

interface DataReturn {
  total: number;
  data?: number;
  horario?: string;
}

export const TicketsDayService = async ({ initialDate, finalDate, companyId }: Request): Promise<Return> => {

  let sql = '';
  let count = 0;

  // Segurança: companyId coagido a inteiro e datas passadas via bind (sem interpolação no SQL)
  const companyIdNum = Number(companyId);
  let replacements: (string | number)[];

  if (initialDate && initialDate.trim() === finalDate && finalDate.trim()) {
    sql = `
    SELECT
      COUNT(*) AS total,
      extract(hour from tick."createdAt") AS horario
      --to_char(DATE(tick."createdAt"), 'dd-mm-YYYY') as horario
    FROM
      "Tickets" tick
    WHERE
      tick."companyId" = ?
      and DATE(tick."createdAt") >= ?
      AND DATE(tick."createdAt") <= ?
    GROUP BY
      extract(hour from tick."createdAt")
      --to_char(DATE(tick."createdAt"), 'dd-mm-YYYY')
    ORDER BY
      horario asc;
    `
    replacements = [companyIdNum, `${initialDate} 00:00:00`, `${finalDate} 23:59:59`];
  } else {
    sql = `
    SELECT
    COUNT(*) AS total,
    to_char(DATE(tick."createdAt"), 'dd/mm/YYYY') as data
  FROM
    "Tickets" tick
  WHERE
    tick."companyId" = ?
    and DATE(tick."createdAt") >= ?
    AND DATE(tick."createdAt") <= ?
  GROUP BY
    to_char(DATE(tick."createdAt"), 'dd/mm/YYYY')
  ORDER BY
    data asc;
  `
    replacements = [companyIdNum, `${initialDate}`, `${finalDate}`];
  }

  const data: DataReturn[] = await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  });

  data.forEach((register) => {
    count += Number(register.total);
  })

  return { data, count };

}
