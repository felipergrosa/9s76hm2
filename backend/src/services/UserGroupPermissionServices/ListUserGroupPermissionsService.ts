import UserGroupPermission from "../../models/UserGroupPermission";

/**
 * Lista os contactIds dos grupos permitidos para um usuário.
 */
const ListUserGroupPermissionsService = async (
  userId: number,
  companyId: number
): Promise<number[]> => {
  const permissions = await UserGroupPermission.findAll({
    where: { userId, companyId },
    attributes: ["contactId"],
  });

  return permissions.map(p => p.contactId);
};

export default ListUserGroupPermissionsService;
