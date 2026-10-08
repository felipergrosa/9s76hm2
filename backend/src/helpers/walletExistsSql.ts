/**
 * SQL da condição "contato está na carteira" de usuário(s).
 *
 * Regra (mesma do filtro "Carteira" de /contacts e /tickets):
 * um contato está na carteira de um usuário quando possui uma ContactTag
 * cuja tag é a TAG PESSOAL do usuário (Tags.name LIKE '#%', exceto '##%'
 * que é tag de grupo) e essa tag consta em User.allowedContactTags.
 *
 * Uso: dentro de um WHERE/Op.and via sequelize `literal(...)`.
 * `contactColumnSql` é a expressão SQL da coluna de contato no contexto
 * da query externa (ex.: '"Contact"."id"' ou '"Ticket"."contactId"').
 *
 * Segurança: companyId e userIds são coeridos a inteiros antes de
 * interpolar — nunca passe valores brutos de query param sem validar.
 */
export const walletExistsSql = (
  contactColumnSql: string,
  companyId: number,
  onlyUserIds?: number[]
): string => {
  const cid = Number(companyId);

  // IDs válidos: inteiros positivos; valores inválidos são descartados
  const userIds = (onlyUserIds || [])
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0);

  const userFilter = userIds.length > 0 ? `AND u."id" IN (${userIds.join(",")})` : "";

  return `
    EXISTS (
      SELECT 1
        FROM "ContactTags" ct
        JOIN "Tags" tg
          ON tg."id" = ct."tagId"
         AND tg."companyId" = ${cid}
        JOIN "Users" u
          ON u."companyId" = ${cid}
         AND ct."tagId" = ANY(u."allowedContactTags")
       WHERE ct."contactId" = ${contactColumnSql}
         AND ct."companyId" = ${cid}
         AND tg."name" LIKE '#%'
         AND tg."name" NOT LIKE '##%'
         ${userFilter}
    )`;
};

export default walletExistsSql;
