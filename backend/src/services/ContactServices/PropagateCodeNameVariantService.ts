import { Op } from "sequelize";
import Contact from "../../models/Contact";

// Campos no formato "código - nome" ou "código nome" vindos do ERP
// (ex.: "1040 - MARIA", "61 - CONSUM. FINAL", "00 LUMINARIAS (25)").
// O código é a chave estável; o nome é metadado volátil que pode ser renomeado
// no ERP. Sem propagação, cada renomeação cria uma variante nova gravada nos
// contatos ("1040", "1040 - VELHO", "1040 - NOVO") — o que duplica opções nos
// autocompletes e fragmenta filtros/listas.
// Quando chega um valor, todos os contatos da empresa com variantes do mesmo
// código são normalizados para o valor canônico recebido.
const CODE_NAME_FIELDS = ["representativeCode", "segment", "bzEmpresa"] as const;

type CodeNameField = (typeof CODE_NAME_FIELDS)[number];

// Fila serial com dedup: cada (companyId, field, code) mantém só o valor mais
// recente pendente. Rajadas do sync (~150 contatos/min, todos com o mesmo
// rep/segmento) colapsam em poucos UPDATEs e executam um de cada vez —
// elimina o deadlock entre updates em lote concorrentes na tabela Contacts
// e resolve "ping-pong" de valores por last-writer-wins dentro da rajada.
interface PendingPropagate {
  companyId: number;
  field: CodeNameField;
  code: string;
  value: string;
}

const pending = new Map<string, PendingPropagate>();
let draining = false;
let drainScheduled = false;

const enqueue = (item: PendingPropagate): void => {
  pending.set(`${item.companyId}:${item.field}:${item.code}`, item);
  if (!drainScheduled) {
    drainScheduled = true;
    setImmediate(() => {
      drainScheduled = false;
      void drain();
    });
  }
};

const drain = async (): Promise<void> => {
  if (draining) return;
  draining = true;
  try {
    // esvazia o mapa; itens que chegarem durante o loop entram na mesma drenagem
    for (;;) {
      const next = pending.keys().next();
      if (next.done) break;
      const item = pending.get(next.value)!;
      pending.delete(next.value);
      try {
        await applyPropagation(item);
      } catch (err) {
        // falha na normalização não deve derrubar nada — só registra
        console.warn("[PropagateCodeNameVariant] falhou:", err);
      }
    }
  } finally {
    draining = false;
  }
};

const isDeadlock = (err: any): boolean =>
  err?.parent?.code === "40P01" || err?.original?.code === "40P01";

const applyPropagation = async ({
  companyId,
  field,
  code,
  value
}: PendingPropagate): Promise<void> => {
  // O padrão "code %" cobre "code - nome" e "code nome" (bzEmpresa usa espaço)
  // Retry único em deadlock residual (ex.: merge de contatos segurando locks)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await Contact.update(
        { [field]: value },
        {
          where: {
            companyId,
            [Op.and]: [
              {
                [Op.or]: [
                  { [field]: code },
                  { [field]: { [Op.like]: `${code} %` } }
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
      return;
    } catch (err) {
      if (isDeadlock(err) && attempt === 0) {
        await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
        continue;
      }
      throw err;
    }
  }
};

const enqueueField = (
  companyId: number,
  field: CodeNameField,
  rawValue: unknown
): void => {
  // normaliza "1040 - " (nome vazio) para "1040"
  const value = String(rawValue ?? "").trim().replace(/\s*-\s*$/, "").trim();
  if (!value) return;

  // só valores com prefixo numérico participam do formato código-nome
  const match = value.match(/^(\d+)/);
  if (!match) return;
  const code = match[1];

  // Código puro (sem nome) NUNCA propaga: sobrescreveria variantes
  // "code - nome" por "code" e apagaria o nome de toda a empresa.
  // Só valores que carregam a parte do nome viram referência canônica.
  if (value === code) return;

  enqueue({ companyId, field, code, value });
};

interface Request {
  companyId: number;
  representativeCode?: string | null;
  segment?: string | null;
  bzEmpresa?: string | null;
}

// Fire-and-forget: enfileira e retorna sem bloquear o save do contato.
// A propagação é normalização best-effort — não precisa atrasar a resposta.
const PropagateCodeNameVariantService = async ({
  companyId,
  representativeCode,
  segment,
  bzEmpresa
}: Request): Promise<void> => {
  try {
    if (representativeCode !== undefined && representativeCode !== null) {
      enqueueField(companyId, "representativeCode", representativeCode);
    }
    if (segment !== undefined && segment !== null) {
      enqueueField(companyId, "segment", segment);
    }
    if (bzEmpresa !== undefined && bzEmpresa !== null) {
      enqueueField(companyId, "bzEmpresa", bzEmpresa);
    }
  } catch (err) {
    console.warn("[PropagateCodeNameVariant] falhou:", err);
  }
};

export default PropagateCodeNameVariantService;
