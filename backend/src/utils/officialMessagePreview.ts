type PreviewButtonType = "quick_reply" | "url" | "call";

export interface OfficialPreviewButton {
  id?: string;
  text: string;
  type?: string;
  url?: string;
  phone?: string;
}

export interface OfficialPreviewRow {
  id?: string;
  text: string;
  description?: string;
}

interface BuildOfficialPreviewDataParams {
  body?: string;
  footer?: string;
  buttons?: OfficialPreviewButton[];
  rows?: OfficialPreviewRow[];
  meta?: Record<string, unknown>;
}

const normalizeButtonType = (type?: string): PreviewButtonType => {
  const normalized = String(type || "").trim().toUpperCase();

  if (normalized === "URL") {
    return "url";
  }

  if (normalized === "PHONE_NUMBER" || normalized === "CALL") {
    return "call";
  }

  return "quick_reply";
};

export const buildOfficialPreviewData = ({
  body = "",
  footer = "",
  buttons = [],
  rows = [],
  meta
}: BuildOfficialPreviewDataParams): string | null => {
  const normalizedButtons = buttons
    .filter(button => button?.text)
    .map((button, index) => ({
      id: button.id || `official-btn-${index + 1}`,
      text: button.text,
      type: normalizeButtonType(button.type),
      url: button.url || null,
      phone: button.phone || null
    }));

  const normalizedRows = rows
    .filter(row => row?.text)
    .map((row, index) => ({
      id: row.id || `official-row-${index + 1}`,
      text: row.text,
      description: row.description || ""
    }));

  if (!normalizedButtons.length && !normalizedRows.length) {
    return null;
  }

  return JSON.stringify({
    source: "official",
    preview: {
      type: normalizedRows.length > 0 ? "list" : "buttons",
      title: body,
      footer,
      buttons: normalizedButtons,
      rows: normalizedRows
    },
    meta: meta || undefined
  });
};

