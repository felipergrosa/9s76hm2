import UserGroupPermission from "../../models/UserGroupPermission";
import { Op } from "sequelize";
import { serviceCache } from "../../utils/serviceCache";

/**
 * Atualiza as permissões de grupo de um usuário.
 * Faz upsert: remove as que não estão mais na lista e adiciona as novas.
 */
const UpdateUserGroupPermissionsService = async (
  userId: number,
  companyId: number,
  contactIds: number[]
): Promise<number[]> => {
  // Buscar permissões atuais
  const currentPermissions = await UserGroupPermission.findAll({
    where: { userId, companyId },
    attributes: ["id", "contactId"],
  });

  const currentContactIds = currentPermissions.map(p => p.contactId);

  // Calcular diferenças
  const toAdd = contactIds.filter(id => !currentContactIds.includes(id));
  const toRemove = currentContactIds.filter(id => !contactIds.includes(id));

  // Remover permissões desmarcadas
  if (toRemove.length > 0) {
    await UserGroupPermission.destroy({
      where: {
        userId,
        companyId,
        contactId: { [Op.in]: toRemove },
      },
    });
  }

  // Adicionar novas permissões
  if (toAdd.length > 0) {
    const newPermissions = toAdd.map(contactId => ({
      userId,
      companyId,
      contactId,
    }));

    await UserGroupPermission.bulkCreate(newPermissions, {
      ignoreDuplicates: true,
    });
  }

  // A listagem de tickets cacheia os contactIds permitidos por grupo sob
  // `groupPermissions:{userId}:{companyId}` (TTL 60s) — invalidar para a
  // mudança valer já na próxima query.
  serviceCache.invalidate(`groupPermissions:${userId}:${companyId}`);

  return contactIds;
};

export default UpdateUserGroupPermissionsService;
