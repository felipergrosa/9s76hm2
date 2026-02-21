import { Op, WhereOptions, fn, col, where as sequelizeWhere, literal } from "sequelize";
import Contact from "../../models/Contact";
import { parsePhoneNumber } from "libphonenumber-js";
import { formatPhoneNumber, safeNormalizePhoneNumber, isRealPhoneNumber, MAX_PHONE_DIGITS } from "../../utils/phone";

interface ListParams {
  companyId: number;
  limit?: number;
  offset?: number;
}

type PhoneClassification = "mobile" | "landline" | "shortcode" | "invalid" | "unknown" | "international" | "lid_jid";

interface NormalizationIssue {
  type: "missing_canonical" | "invalid_length" | "invalid_chars" | "missing_country_code" | "no_number" | "lid_jid_number";
  details?: string;
}

interface NormalizationContact extends Record<string, any> {
  id: number;
  name?: string;
  number?: string | null;
  canonicalNumber?: string | null;
  isGroup?: boolean;
  normalization: {
    classification: PhoneClassification;
    suggestedCanonical: string | null;
    displayLabel: string | null;
    isValid: boolean;
  };
}

interface NormalizationGroup {
  groupKey: string;
  suggestedCanonical: string | null;
  total: number;
  issues: NormalizationIssue[];
  contacts: NormalizationContact[];
  classificationSummary: Record<PhoneClassification, number>;
  displayLabel: string | null;
}

interface ListResult {
  groups: NormalizationGroup[];
  total: number;
  page: number;
  limit: number;
}

const getDigits = (value: string | null | undefined): string => String(value ?? "").replace(/\D/g, "");

const formatCanonicalDisplay = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return formatPhoneNumber(value);
};

// Detecta se o número parece ser um LID (Linked Device ID) do WhatsApp
const isLidNumber = (digits: string): boolean => {
  if (!digits) return false;
  return digits.length > 15 || (digits.length > 13 && !digits.startsWith("55"));
};

const classifyPhoneNumber = (value: string | null | undefined): PhoneClassification => {
  const digitsOnly = getDigits(value);
  if (!digitsOnly) return "invalid";
  if (isLidNumber(digitsOnly)) return "lid_jid";
  if (digitsOnly.length < 8) return "shortcode";

  try {
    const parsed = parsePhoneNumber(digitsOnly.startsWith("+") ? digitsOnly : `+${digitsOnly}`, "BR");
    if (parsed && parsed.isValid()) {
      const type = parsed.getType();
      if (type === "MOBILE") return "mobile";
      if (type === "FIXED_LINE" || type === "FIXED_LINE_OR_MOBILE") return "landline";
      return "international";
    }
  } catch (err) {
    // Fallback
  }

  return digitsOnly.length > 15 ? "invalid" : "international";
};

const isValidCanonicalLength = (digits: string): boolean => isRealPhoneNumber(digits);

const detectIssues = (contact: Contact): NormalizationIssue[] => {
  const issues: NormalizationIssue[] = [];

  if (!contact.number) {
    issues.push({ type: "no_number" });
    return issues;
  }

  const numberDigits = getDigits(contact.number);

  if (isLidNumber(numberDigits)) {
    issues.push({
      type: "lid_jid_number",
      details: `Número LID (${numberDigits.length} dígitos) - não é telefone real`
    });
    return issues;
  }

  const canonical = contact.canonicalNumber;
  if (!canonical || canonical.trim() === "") {
    issues.push({ type: "missing_canonical" });
  } else {
    const digitsOnly = canonical.replace(/\D/g, "").trim();
    if (!isValidCanonicalLength(digitsOnly)) {
      issues.push({ type: "invalid_length", details: `${digitsOnly.length} dígitos` });
    }

    if (!/^\d+$/.test(digitsOnly)) {
      issues.push({ type: "invalid_chars" });
    }

    if (digitsOnly.length < 10) {
      issues.push({ type: "missing_country_code" });
    }
  }

  const { canonical: suggestion } = safeNormalizePhoneNumber(contact.number);
  if (!suggestion) {
    issues.push({ type: "invalid_chars" });
  }

  return issues;
};

const buildGroupKey = (suggestedCanonical: string | null, contactId: number): string => {
  if (suggestedCanonical) {
    return suggestedCanonical;
  }
  return `contact-${contactId}`;
};

const buildBaseWhere = (companyId: number): WhereOptions => {
  const conditions: WhereOptions[] = [
    { canonicalNumber: null },
    { canonicalNumber: "" },
    // Números canônicos muito curtos (<8 dígitos)
    sequelizeWhere(fn("length", fn("COALESCE", col("canonicalNumber"), "")), { [Op.lt]: 8 }),
    // Números canônicos muito longos (>15 dígitos) - possíveis LIDs
    sequelizeWhere(fn("length", fn("COALESCE", col("canonicalNumber"), "")), { [Op.gt]: 20 }),
    // Incluir contatos onde number != canonicalNumber (possível desatualização)
    literal('COALESCE("number", \'\') != COALESCE("canonicalNumber", \'\')')
  ];

  const lidConditions: WhereOptions[] = [
    // Números com mais de 20 dígitos (LIDs longos/inválidos)
    sequelizeWhere(
      fn("length", fn("REGEXP_REPLACE", col("number"), literal("'[^0-9]'"), literal("''"), literal("'g'"))),
      { [Op.gt]: 20 }
    ),
    // Números com 14+ dígitos que não começam com 55 (Brasil)
    literal(`
      LENGTH(REGEXP_REPLACE("number", '[^0-9]', '', 'g')) > 13
      AND LEFT(REGEXP_REPLACE("number", '[^0-9]', '', 'g'), 2) != '55'
    `)
  ];

  return {
    companyId,
    number: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
    isGroup: false,
    [Op.or]: [...conditions, ...lidConditions]
  } as WhereOptions;
};

const ListContactsPendingNormalizationService = async ({
  companyId,
  limit = 20,
  offset = 0
}: ListParams): Promise<ListResult> => {
  const baseWhere = buildBaseWhere(companyId);
  const shouldPaginate = typeof limit === "number" && limit > 0;

  const queryOptions: any = {
    where: baseWhere,
    order: [["updatedAt", "DESC"]]
  };

  if (shouldPaginate) {
    queryOptions.limit = limit;
    queryOptions.offset = offset;
  }

  const contacts = await Contact.findAll(queryOptions);

  if (!contacts.length) {
    return {
      groups: [],
      total: 0,
      page: 1,
      limit: shouldPaginate ? limit : 0
    };
  }

  const total = shouldPaginate ? await Contact.count({ where: baseWhere }) : contacts.length;
  const groupsMap = new Map<string, NormalizationGroup>();

  contacts.forEach(contact => {
    if ((contact as any).isGroup) {
      return;
    }

    const { canonical: suggestion } = safeNormalizePhoneNumber(contact.number);
    const groupKey = buildGroupKey(suggestion, contact.id);
    const issues = detectIssues(contact);
    const classification = classifyPhoneNumber(suggestion || contact.number);
    const displayLabel = formatCanonicalDisplay(suggestion || contact.canonicalNumber || contact.number);
    const isValid = !["invalid", "shortcode"].includes(classification);

    const contactData = {
      ...(contact.toJSON() as Record<string, any>),
      normalization: {
        classification,
        suggestedCanonical: suggestion,
        displayLabel,
        isValid
      }
    } as NormalizationContact;

    const existing = groupsMap.get(groupKey);
    if (!existing) {
      groupsMap.set(groupKey, {
        groupKey,
        suggestedCanonical: suggestion,
        total: 1,
        issues: [...issues],
        contacts: [contactData],
        classificationSummary: {
          mobile: classification === "mobile" ? 1 : 0,
          landline: classification === "landline" ? 1 : 0,
          shortcode: classification === "shortcode" ? 1 : 0,
          invalid: classification === "invalid" ? 1 : 0,
          unknown: classification === "unknown" ? 1 : 0,
          international: classification === "international" ? 1 : 0,
          lid_jid: classification === "lid_jid" ? 1 : 0
        },
        displayLabel
      });
    } else {
      existing.contacts.push(contactData);
      existing.total += 1;
      existing.classificationSummary[classification] =
        (existing.classificationSummary[classification] || 0) + 1;
      if (!existing.displayLabel && displayLabel) {
        existing.displayLabel = displayLabel;
      }

      issues.forEach(issue => {
        if (!existing.issues.find(ei => ei.type === issue.type && ei.details === issue.details)) {
          existing.issues.push(issue);
        }
      });
    }
  });

  return {
    groups: Array.from(groupsMap.values()),
    total,
    page: shouldPaginate ? Math.floor(offset / limit) + 1 : 1,
    limit: shouldPaginate ? limit : contacts.length
  };
};

export default ListContactsPendingNormalizationService;
