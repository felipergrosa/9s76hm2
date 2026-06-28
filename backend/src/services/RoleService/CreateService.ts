import AppError from "../../errors/AppError";
import Role from "../../models/Role";

interface Request {
  name: string;
  description?: string;
  permissions?: string[];
  companyId: number;
}

const CreateService = async ({
  name,
  description,
  permissions = [],
  companyId
}: Request): Promise<Role> => {
  if (!name || !name.trim()) {
    throw new AppError("ERR_ROLE_NAME_REQUIRED", 400);
  }

  const existing = await Role.findOne({ where: { name: name.trim(), companyId } });
  if (existing) {
    throw new AppError("ERR_ROLE_NAME_ALREADY_EXISTS", 400);
  }

  const role = await Role.create({
    name: name.trim(),
    description: description || null,
    permissions,
    companyId
  } as any);

  return role;
};

export default CreateService;
