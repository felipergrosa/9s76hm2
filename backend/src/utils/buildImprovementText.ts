/**
 * Compõe o texto padrão de uma melhoria de treinamento a partir dos campos
 * do feedback. Formato único usado tanto na criação automática
 * (feedback -> improvement) quanto no enriquecimento de improvements manuais.
 */
export const buildImprovementText = (params: {
  customerText?: string | null;
  correctedText?: string | null;
  explanation?: string | null;
}): string => {
  const customerText = params.customerText ? String(params.customerText).trim() : "";
  const correctedText = params.correctedText ? String(params.correctedText).trim() : "";
  const explanation = params.explanation ? String(params.explanation).trim() : "";

  let text = "";
  if (customerText) {
    text += `Quando o cliente disser algo como: "${customerText}"`;
  }
  if (correctedText) {
    text += `${text ? " — " : ""}responda: "${correctedText}".`;
  }
  if (explanation) {
    text += `${text ? " " : ""}Motivo: ${explanation}`;
  }

  return text;
};

export default buildImprovementText;
