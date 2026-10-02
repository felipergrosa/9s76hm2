import AppError from "../../errors/AppError";

/**
 * Validação prévia (lado servidor) do payload de templates da
 * WhatsApp Business API antes de chamar a Meta.
 *
 * Regras implementadas conforme documentação oficial (v23+/v25):
 * - name: /^[a-z0-9_]+$/ até 512 chars
 * - category: MARKETING | UTILITY | AUTHENTICATION
 * - BODY obrigatório (<=1024 chars); HEADER opcional (TEXT <=60 e <=1 variável,
 *   ou IMAGE | VIDEO | DOCUMENT | LOCATION | GIF); FOOTER <=60 sem variáveis
 * - BUTTONS: <=10 no total; QUICK_REPLY <=10 contíguos no array; URL <=2 com
 *   <=1 variável no fim e example obrigatório; PHONE_NUMBER <=1; COPY_CODE <=1
 * - Toda variável (posicional {{1}} ou nomeada {{nome}}) exige exemplo
 */

export const TEMPLATE_NAME_REGEX = /^[a-z0-9_]+$/;

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
const POSITIONAL_VARIABLE_REGEX = /^[1-9]\d*$/;
// Meta: parâmetros nomeados aceitam apenas letras minúsculas e underscores
const NAMED_VARIABLE_REGEX = /^[a-z_]+$/;

const VALID_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];
const VALID_PARAMETER_FORMATS = ["named", "positional"];
const VALID_COMPONENT_TYPES = ["HEADER", "BODY", "FOOTER", "BUTTONS"];
const VALID_HEADER_FORMATS = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
  "GIF"
];
// Formatos de header que exigem example.header_handle (mídia)
const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT", "GIF"];

const LIMITS = {
  TEMPLATE_NAME: 512,
  BODY_TEXT: 1024,
  HEADER_TEXT: 60,
  FOOTER_TEXT: 60,
  BUTTON_TEXT: 25,
  BUTTON_URL: 2000,
  BUTTON_PHONE: 20,
  COPY_CODE_EXAMPLE: 20,
  MAX_BUTTONS: 10,
  MAX_URL_BUTTONS: 2,
  MAX_PHONE_BUTTONS: 1,
  MAX_COPY_CODE_BUTTONS: 1,
  MAX_QUICK_REPLY_BUTTONS: 10
};

// Faixas de TTL (segundos) aceitas pela Meta por categoria de template.
// -1 equivale a "30 dias" e só é aceito em AUTHENTICATION e UTILITY.
const MESSAGE_TTL_RANGES: Record<
  string,
  { min: number; max: number; allowMinusOne: boolean; label: string }
> = {
  AUTHENTICATION: {
    min: 30,
    max: 900,
    allowMinusOne: true,
    label: "30s a 900s (15 min), ou -1 para 30 dias"
  },
  UTILITY: {
    min: 30,
    max: 43200,
    allowMinusOne: true,
    label: "30s a 43200s (12h), ou -1 para 30 dias"
  },
  MARKETING: {
    min: 43200,
    max: 2592000,
    allowMinusOne: false,
    label: "43200s a 2592000s (12h a 30 dias)"
  }
};

/**
 * Valida message_send_ttl_seconds conforme as faixas oficiais da Meta.
 * Sem categoria conhecida (ex.: update), valida apenas o mínimo geral.
 */
export const validateMessageSendTtlSeconds = (
  ttl: number,
  category?: string
): void => {
  if (!Number.isInteger(ttl)) {
    throw new AppError("TTL deve ser um inteiro em segundos", 400);
  }

  if (ttl === -1) {
    if (category === "MARKETING") {
      throw new AppError(
        "TTL -1 (30 dias) não é aceito para templates MARKETING",
        400
      );
    }
    return;
  }

  if (ttl < 30) {
    throw new AppError(
      "TTL mínimo aceito pela Meta é 30 segundos " +
        "(-1 equivale a 30 dias apenas em UTILITY/AUTHENTICATION)",
      400
    );
  }

  const range = category ? MESSAGE_TTL_RANGES[category] : undefined;
  if (range && (ttl < range.min || ttl > range.max)) {
    throw new AppError(
      `TTL fora da faixa da Meta para templates ${category}: ${range.label}`,
      400
    );
  }
};

/**
 * Extrai variáveis {{x}} de um texto. Retorna lista de nomes crus
 * ("1", "2", "nome", ...) na ordem em que aparecem.
 */
export const extractVariables = (text: string): string[] => {
  if (!text || typeof text !== "string") return [];

  const variables: string[] = [];
  const regex = new RegExp(VARIABLE_REGEX.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    variables.push(match[1].trim());
  }

  return variables;
};

const isPositional = (variable: string): boolean =>
  POSITIONAL_VARIABLE_REGEX.test(variable);

const unique = (items: string[]): string[] => Array.from(new Set(items));

/**
 * Garante que variáveis posicionais sejam sequenciais: {{1}}, {{2}}, ...
 * sem lacunas ({{1}}, {{3}} é inválido).
 */
const validateSequentialPositional = (
  variables: string[],
  label: string
): void => {
  const positional = unique(variables.filter(isPositional))
    .map(Number)
    .sort((a, b) => a - b);

  for (let i = 0; i < positional.length; i += 1) {
    if (positional[i] !== i + 1) {
      throw new AppError(
        `${label}: variáveis posicionais devem ser sequenciais a partir de {{1}} ` +
          "(ex.: {{1}}, {{2}}, {{3}})",
        400
      );
    }
  }
};

/**
 * Valida nomes de variáveis e compatibilidade com parameterFormat.
 */
const validateVariableNaming = (
  variables: string[],
  label: string,
  parameterFormat?: string
): void => {
  const hasPositional = variables.some(isPositional);
  const hasNamed = variables.some(v => !isPositional(v));

  if (hasPositional && hasNamed) {
    throw new AppError(
      `${label}: não é permitido misturar variáveis posicionais {{1}} ` +
        "e nomeadas {{nome}} no mesmo componente",
      400
    );
  }

  for (const v of unique(variables.filter(v => !isPositional(v)))) {
    if (!NAMED_VARIABLE_REGEX.test(v)) {
      throw new AppError(
        `${label}: variável nomeada {{${v}}} inválida — use apenas ` +
          "letras minúsculas, números e underscore",
        400
      );
    }
  }

  if (parameterFormat === "named" && hasPositional) {
    throw new AppError(
      `${label}: parameter_format "named" exige variáveis nomeadas ` +
        "({{nome}}), mas foram encontradas posicionais ({{1}})",
      400
    );
  }

  if (parameterFormat === "positional" && hasNamed) {
    throw new AppError(
      `${label}: parameter_format "positional" exige variáveis ` +
        "posicionais ({{1}}), mas foram encontradas nomeadas ({{nome}})",
      400
    );
  }
};

/**
 * Toda variável exige exemplo correspondente:
 * - posicional: example.body_text [[v1, v2]] / example.header_text [v]
 * - nomeada: example.body_text_named_params / header_text_named_params
 *   [{ param_name, example }]
 */
const validateExamples = (
  component: any,
  variables: string[],
  kind: "BODY" | "HEADER"
): void => {
  if (!variables.length) return;

  const example = component.example;
  const named = unique(variables.filter(v => !isPositional(v)));
  const positional = unique(variables.filter(isPositional));
  const label = kind;

  if (named.length) {
    const key =
      kind === "BODY" ? "body_text_named_params" : "header_text_named_params";
    const params: any[] = example?.[key];

    if (!Array.isArray(params) || params.length === 0) {
      throw new AppError(
        `${label}: variáveis nomeadas exigem example.${key} ` +
          "com { param_name, example } para cada variável",
        400
      );
    }

    for (const v of named) {
      const found = params.find(
        p =>
          p?.param_name === v &&
          typeof p?.example === "string" &&
          p.example.length > 0
      );
      if (!found) {
        throw new AppError(
          `${label}: variável {{${v}}} sem exemplo em example.${key}`,
          400
        );
      }
    }
  }

  if (positional.length) {
    if (kind === "BODY") {
      const bodyText = example?.body_text;
      if (!Array.isArray(bodyText) || !Array.isArray(bodyText[0])) {
        throw new AppError(
          "BODY: variáveis posicionais exigem example.body_text no formato [[v1, v2, ...]]",
          400
        );
      }
      const maxIndex = Math.max(...positional.map(Number));
      if (bodyText[0].filter(v => v !== undefined && v !== null).length < maxIndex) {
        throw new AppError(
          `BODY: example.body_text[0] deve conter ao menos ${maxIndex} exemplo(s)`,
          400
        );
      }
    } else {
      const headerText = example?.header_text;
      if (!Array.isArray(headerText) || headerText.length === 0) {
        throw new AppError(
          "HEADER: variável exige example.header_text [valor]",
          400
        );
      }
    }
  }
};

/**
 * Valida o array de botões de um componente BUTTONS.
 */
const validateButtons = (
  buttons: any[],
  parameterFormat?: string
): void => {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    throw new AppError("BUTTONS: a lista de botões não pode ser vazia", 400);
  }

  if (buttons.length > LIMITS.MAX_BUTTONS) {
    throw new AppError(
      `BUTTONS: máximo de ${LIMITS.MAX_BUTTONS} botões por template`,
      400
    );
  }

  let urlCount = 0;
  let phoneCount = 0;
  let copyCodeCount = 0;
  let quickReplyCount = 0;

  buttons.forEach((button, index) => {
    const label = `Botão #${index + 1}`;
    const type = button?.type;

    if (!type || typeof type !== "string") {
      throw new AppError(`${label}: type é obrigatório`, 400);
    }

    switch (type) {
      case "QUICK_REPLY": {
        quickReplyCount += 1;
        if (!button.text || button.text.length > LIMITS.BUTTON_TEXT) {
          throw new AppError(
            `${label} (QUICK_REPLY): text é obrigatório e deve ter até ` +
              `${LIMITS.BUTTON_TEXT} caracteres`,
            400
          );
        }
        break;
      }

      case "URL": {
        urlCount += 1;
        if (!button.text || button.text.length > LIMITS.BUTTON_TEXT) {
          throw new AppError(
            `${label} (URL): text é obrigatório e deve ter até ` +
              `${LIMITS.BUTTON_TEXT} caracteres`,
            400
          );
        }
        if (!button.url || button.url.length > LIMITS.BUTTON_URL) {
          throw new AppError(
            `${label} (URL): url é obrigatória e deve ter até ` +
              `${LIMITS.BUTTON_URL} caracteres`,
            400
          );
        }

        const urlVars = extractVariables(button.url);
        if (urlVars.length > 1) {
          throw new AppError(
            `${label} (URL): a url aceita no máximo 1 variável`,
            400
          );
        }
        if (urlVars.length === 1) {
          // A variável deve estar no final da URL
          if (!/\{\{[^}]+\}\}\s*$/.test(button.url)) {
            throw new AppError(
              `${label} (URL): a variável deve estar no final da url`,
              400
            );
          }
          validateVariableNaming(urlVars, `${label} (URL)`, parameterFormat);
          // Meta exige example com a URL de exemplo quando há variável
          if (
            !Array.isArray(button.example) ||
            button.example.length === 0 ||
            typeof button.example[0] !== "string" ||
            !button.example[0]
          ) {
            throw new AppError(
              `${label} (URL): url com variável exige example com a URL de exemplo`,
              400
            );
          }
        }
        break;
      }

      case "PHONE_NUMBER": {
        phoneCount += 1;
        if (!button.text || button.text.length > LIMITS.BUTTON_TEXT) {
          throw new AppError(
            `${label} (PHONE_NUMBER): text é obrigatório e deve ter até ` +
              `${LIMITS.BUTTON_TEXT} caracteres`,
            400
          );
        }
        if (
          !button.phone_number ||
          String(button.phone_number).length > LIMITS.BUTTON_PHONE
        ) {
          throw new AppError(
            `${label} (PHONE_NUMBER): phone_number é obrigatório e deve ter até ` +
              `${LIMITS.BUTTON_PHONE} caracteres`,
            400
          );
        }
        break;
      }

      case "COPY_CODE": {
        copyCodeCount += 1;
        if (
          typeof button.example !== "string" ||
          !button.example ||
          button.example.length > LIMITS.COPY_CODE_EXAMPLE
        ) {
          throw new AppError(
            `${label} (COPY_CODE): example é obrigatório e deve ter até ` +
              `${LIMITS.COPY_CODE_EXAMPLE} caracteres`,
            400
          );
        }
        break;
      }

      default:
        // Tipos avançados (OTP, FLOW, CATALOG etc.) não são validados
        // aqui — a Meta retorna erro específico se inválidos.
        break;
    }
  });

  if (urlCount > LIMITS.MAX_URL_BUTTONS) {
    throw new AppError(
      `BUTTONS: máximo de ${LIMITS.MAX_URL_BUTTONS} botões do tipo URL`,
      400
    );
  }
  if (phoneCount > LIMITS.MAX_PHONE_BUTTONS) {
    throw new AppError(
      `BUTTONS: máximo de ${LIMITS.MAX_PHONE_BUTTONS} botão do tipo PHONE_NUMBER`,
      400
    );
  }
  if (copyCodeCount > LIMITS.MAX_COPY_CODE_BUTTONS) {
    throw new AppError(
      `BUTTONS: máximo de ${LIMITS.MAX_COPY_CODE_BUTTONS} botão do tipo COPY_CODE`,
      400
    );
  }
  if (quickReplyCount > LIMITS.MAX_QUICK_REPLY_BUTTONS) {
    throw new AppError(
      `BUTTONS: máximo de ${LIMITS.MAX_QUICK_REPLY_BUTTONS} botões QUICK_REPLY`,
      400
    );
  }

  // Quick replies devem ficar contíguos no array — a Meta rejeita
  // botões QUICK_REPLY intercalados com outros tipos.
  const quickReplyIndexes = buttons
    .map((button, index) => (button?.type === "QUICK_REPLY" ? index : -1))
    .filter(index => index >= 0);

  if (
    quickReplyIndexes.length > 1 &&
    quickReplyIndexes[quickReplyIndexes.length - 1] -
      quickReplyIndexes[0] !==
      quickReplyIndexes.length - 1
  ) {
    throw new AppError(
      "BUTTONS: botões QUICK_REPLY devem ficar contíguos (agrupados) na lista",
      400
    );
  }
};

/**
 * Valida somente a lista de componentes (usado também em UPDATE,
 * onde apenas components pode ser enviado).
 */
export const validateTemplateComponents = (
  components: any[],
  parameterFormat?: string
): void => {
  if (!Array.isArray(components) || components.length === 0) {
    throw new AppError("components é obrigatório e não pode ser vazio", 400);
  }

  const counts: Record<string, number> = {};

  for (const component of components) {
    const type = component?.type;

    if (!type || !VALID_COMPONENT_TYPES.includes(type)) {
      throw new AppError(
        `Componente com type inválido: "${type}". ` +
          `Válidos: ${VALID_COMPONENT_TYPES.join(", ")}`,
        400
      );
    }

    counts[type] = (counts[type] || 0) + 1;
    if (counts[type] > 1) {
      throw new AppError(
        `Componente ${type} duplicado — é permitido no máximo 1 por tipo`,
        400
      );
    }

    switch (type) {
      case "HEADER": {
        const format = component.format || "TEXT";

        if (!VALID_HEADER_FORMATS.includes(format)) {
          throw new AppError(
            `HEADER: format inválido "${format}". ` +
              `Válidos: ${VALID_HEADER_FORMATS.join(", ")}`,
            400
          );
        }

        if (format === "TEXT") {
          if (!component.text || typeof component.text !== "string") {
            throw new AppError("HEADER: text é obrigatório para format TEXT", 400);
          }
          if (component.text.length > LIMITS.HEADER_TEXT) {
            throw new AppError(
              `HEADER: text deve ter até ${LIMITS.HEADER_TEXT} caracteres`,
              400
            );
          }
          const vars = extractVariables(component.text);
          if (vars.length > 1) {
            throw new AppError(
              "HEADER: text aceita no máximo 1 variável",
              400
            );
          }
          validateVariableNaming(vars, "HEADER", parameterFormat);
          validateExamples(component, vars, "HEADER");
        } else if (MEDIA_HEADER_FORMATS.includes(format)) {
          // Headers de mídia exigem example.header_handle (Resumable Upload)
          const handle = component.example?.header_handle;
          if (!Array.isArray(handle) || handle.length === 0 || !handle[0]) {
            throw new AppError(
              `HEADER ${format}: exige example.header_handle ` +
                "(handle obtido via upload de mídia)",
              400
            );
          }
        }
        // LOCATION: sem validações adicionais
        break;
      }

      case "BODY": {
        if (!component.text || typeof component.text !== "string") {
          throw new AppError("BODY: text é obrigatório", 400);
        }
        if (component.text.length > LIMITS.BODY_TEXT) {
          throw new AppError(
            `BODY: text deve ter até ${LIMITS.BODY_TEXT} caracteres`,
            400
          );
        }
        const vars = extractVariables(component.text);
        validateVariableNaming(vars, "BODY", parameterFormat);
        validateSequentialPositional(vars, "BODY");
        validateExamples(component, vars, "BODY");
        break;
      }

      case "FOOTER": {
        if (!component.text || typeof component.text !== "string") {
          throw new AppError("FOOTER: text é obrigatório", 400);
        }
        if (component.text.length > LIMITS.FOOTER_TEXT) {
          throw new AppError(
            `FOOTER: text deve ter até ${LIMITS.FOOTER_TEXT} caracteres`,
            400
          );
        }
        if (extractVariables(component.text).length > 0) {
          throw new AppError("FOOTER: não aceita variáveis", 400);
        }
        break;
      }

      case "BUTTONS": {
        validateButtons(component.buttons, parameterFormat);
        break;
      }

      default:
        break;
    }
  }

  if (!counts.BODY) {
    throw new AppError("components: o componente BODY é obrigatório", 400);
  }
};

interface ValidateTemplatePayloadInput {
  name: string;
  category: string;
  language: string;
  parameterFormat?: string;
  components: any[];
  messageSendTtlSeconds?: number;
}

/**
 * Valida o payload completo de criação de template (usado em CREATE).
 * Lança AppError(400) com mensagem pt-BR em qualquer violação.
 */
export const validateTemplatePayload = (
  input: ValidateTemplatePayloadInput
): void => {
  const {
    name,
    category,
    language,
    parameterFormat,
    components,
    messageSendTtlSeconds
  } = input;

  if (!name || typeof name !== "string") {
    throw new AppError("name do template é obrigatório", 400);
  }
  if (name.length > LIMITS.TEMPLATE_NAME) {
    throw new AppError(
      `name do template deve ter até ${LIMITS.TEMPLATE_NAME} caracteres`,
      400
    );
  }
  if (!TEMPLATE_NAME_REGEX.test(name)) {
    throw new AppError(
      'name do template inválido — use apenas letras minúsculas, números e underscore (ex.: "boas_vindas_1")',
      400
    );
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw new AppError(
      `category inválida: "${category}". ` +
        `Válidas: ${VALID_CATEGORIES.join(", ")}`,
      400
    );
  }

  if (!language || typeof language !== "string" || !language.trim()) {
    throw new AppError('language é obrigatório (ex.: "pt_BR")', 400);
  }

  if (parameterFormat && !VALID_PARAMETER_FORMATS.includes(parameterFormat)) {
    throw new AppError(
      `parameterFormat inválido: "${parameterFormat}". ` +
      `Válidos: ${VALID_PARAMETER_FORMATS.join(", ")}`,
      400
    );
  }

  if (messageSendTtlSeconds !== undefined) {
    validateMessageSendTtlSeconds(messageSendTtlSeconds, category);
  }

  validateTemplateComponents(components, parameterFormat);
};
