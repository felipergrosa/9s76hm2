import { Op } from "sequelize";
import Contact from "../../models/Contact";

// Campos no formato "código - nome" (ex.: "1040 - MARIA", "61 - CONSUM. FINAL").
// O código é a chave estável; o nome é metadado volátil que pode ser renomeado
// no ERP. Sem propagação, cada renomeação cria uma variante nova gravada nos
// contatos ("1040", "1040 - VELHO", "1040 - NOVO") — o que duplica opções nos
// autocompletes e fragmenta filtros/listas.
// Quando chega um valor, todos os contatos da empresa com variantes do mesmo
// código são normalizados para o valor canônico recebido.
const CODE_NAME_FIELDS = ["representativeCode", "segment"] as const;

type CodeNameField = (typeof CODE_NAME_FIELDS)[number];

const propagateField = async (
  companyId: number,
  field: CodeNameField,
  rawValue: unknown
): Promise<void> => {
  // normaliza "1040 - " (nome vazio) para "1040"
  const value = String(rawValue ?? "").trim().replace(/\s*-\s*$/, "").trim();
  if (!value) return;

  // só valores com prefixo numérico participam do formato código-nome
  const match = value.match(/^(\d+)/);
  if (!match) return;
  const code = match[1];

  await Contact.update(
    { [field]: value },
    {
      where: {
        companyId,
        [Op.and]: [
          {
            [Op.or]: [
              { [field]: code },
              { [field]: { [Op.like]: `${code} -%` } }
            ]
          },
          { [field]: { [Op.ne]: value } }
        ]
      },
      // não bumpa updatedAt nem dispara hooks — é normalização silenciosa
      silent: true,
      hooks: false,
      fields: [field]
    }
  );
};

interface Request {
  companyId: number;
  representativeCode?: string | null;
  segment?: string | null;
}

const PropagateCodeNameVariantService = async ({
  companyId,
  representativeCode,
  segment
}: Request): Promise<void> => {
  try {
    if (representativeCode !== undefined && representativeCode !== null) {
      await propagateField(companyId, "representativeCode", representativeCode);
    }
    if (segment !== undefined && segment !== null) {
      await propagateField(companyId, "segment", segment);
    }
  } catch (err) {
    // falha na normalização não deve derrubar o save do contato
    console.warn("[PropagateCodeNameVariant] falhou:", err);
  }
};

export default PropagateCodeNameVariantService;
