import { Op, fn, col } from "sequelize";
import Contact from "../../models/Contact";

interface Request {
  companyId: number;
  field: string;
}

interface Response {
  values: string[];
}

const GetFieldValuesService = async ({
  companyId,
  field
}: Request): Promise<Response> => {
  // Campos permitidos para buscar valores (devem existir em Contact.ts)
  const allowedFields = [
    "representativeCode",
    "city",
    "region",
    "segment",
    "situation"
  ];

  if (!allowedFields.includes(field)) {
    return { values: [] };
  }

  if (field === "situation") {
    return {
      values: [
        "Ativo",
        "Baixado",
        "Ex-Cliente",
        "Excluido",
        "Futuro",
        "Inativo"
      ]
    };
  }

  // Busca valores únicos do campo, não nulos e não vazios
  const contacts = await Contact.findAll({
    where: {
      companyId,
      [Op.and]: [
        { [field]: { [Op.ne]: null } },
        { [field]: { [Op.ne]: '' } }
      ]
    },
    attributes: [[fn('DISTINCT', col(field)), field]],
    raw: true,
    limit: 500 // Limite para não sobrecarregar
  });

  // Extrai apenas os valores
  const values = contacts
    .map((c: any) => c[field])
    .map((v: any) => (v === null || v === undefined ? '' : String(v)))
    .map(v => v.trim())
    .filter(v => v !== '');

  values.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

  return { values };
};

export default GetFieldValuesService;
