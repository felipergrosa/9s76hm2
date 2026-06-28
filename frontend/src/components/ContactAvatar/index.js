import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { Avatar } from "@material-ui/core";
import { getBackendUrl } from "../../config";

/**
 * ContactAvatar - Componente de avatar simplificado e confiável.
 *
 * Estratégia (inspirada no WhatsApp Web):
 * - O BACKEND baixa a imagem do CDN do WhatsApp e salva localmente.
 * - O backend retorna `urlPicture` como URL permanente do próprio servidor.
 * - O frontend apenas renderiza `<img src=urlPicture>`, sem fetch/blob/CORS.
 * - Se urlPicture falhar, tenta profilePicUrl (CDN direto) como fallback.
 * - Se tudo falhar, mostra iniciais coloridas.
 */

const PLACEHOLDER_RE = /nopicture\.png/i;

const getBackendBaseUrl = () => {
  const url = getBackendUrl();
  if (!url || url === "undefined" || url === "null") return "";
  return String(url).replace(/\/+$/, "");
};

/**
 * Normaliza uma URL de avatar para ser utilizável pelo navegador.
 * Converte caminhos relativos do banco em URLs absolutas do backend.
 */
export const normalizeAvatarUrl = (url, companyId) => {
  if (!url || typeof url !== "string") return "";

  let clean = url.trim().replace(/\\/g, "/");
  if (!clean || PLACEHOLDER_RE.test(clean)) return "";

  // Corrige protocolo mal formatado
  clean = clean
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  // Blob e data URLs: usar direto
  if (/^(blob|data):/i.test(clean)) return clean;

  // URL absoluta: usar direto
  if (/^https?:\/\//i.test(clean)) return clean;

  // Caminho relativo: construir URL absoluta do backend
  const backend = getBackendBaseUrl();
  if (!backend) return clean;

  const withoutSlash = clean.replace(/^\/+/, "");

  // public/company1/contacts/... → backend/public/company1/...
  if (withoutSlash.startsWith("public/")) {
    return `${backend}/${withoutSlash}`;
  }

  // company1/contacts/... → backend/public/company1/...
  if (/^company\d+\//i.test(withoutSlash)) {
    return `${backend}/public/${withoutSlash}`;
  }

  // contacts/uuid/avatar/avatar.jpg → backend/public/company{id}/contacts/...
  if (companyId && (withoutSlash.startsWith("contacts/") || withoutSlash.startsWith("groups/"))) {
    return `${backend}/public/company${companyId}/${withoutSlash}`;
  }

  return clean;
};

/**
 * Extrai dados relevantes do avatar a partir de um objeto de contato.
 * Suporta tanto `contact` direto quanto `ticket.contact` (nested).
 */
export const getContactAvatarData = (contact) => {
  const nested = contact?.contact || {};
  const id = nested.id || contact?.id;
  const companyId = nested.companyId || contact?.companyId;
  const urlPicture = normalizeAvatarUrl(nested.urlPicture || contact?.urlPicture, companyId);
  const profilePicUrl = normalizeAvatarUrl(nested.profilePicUrl || contact?.profilePicUrl, companyId);

  return {
    contactId: id,
    companyId,
    urlPicture,
    profilePicUrl,
    contactName: nested.name || contact?.name,
    contactNumber: nested.number || contact?.number,
  };
};

/** Gera chave de identidade para comparação de memo */
const getAvatarIdentity = (contact) => {
  if (!contact) return "no-contact";
  const { contactId, urlPicture, profilePicUrl } = getContactAvatarData(contact);
  return `${contactId || ""}:${urlPicture || ""}:${profilePicUrl || ""}`;
};

/** Retorna lista de URLs candidatas para o avatar. */
export const getContactAvatarUrls = (contact) => {
  const { urlPicture, profilePicUrl } = getContactAvatarData(contact);
  return [urlPicture, profilePicUrl].filter((u, i, a) => u && a.indexOf(u) === i);
};

/** Extrai iniciais do nome (até 2 caracteres). */
const getInitials = (name, number) => {
  if (name && typeof name === "string" && name.trim()) {
    const parts = name.trim().split(" ").filter((p) => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  const num = String(number || "").replace(/\D/g, "");
  return num.slice(-2) || "??";
};

/** Gera cor de fundo determinística baseada no nome/número. */
const getAvatarColor = (seed) => {
  const colors = [
    "#1976d2", "#388e3c", "#d32f2f", "#7b1fa2", "#1565c0",
    "#00796b", "#c2185b", "#512da8", "#0097a7", "#689f38",
    "#e64a19", "#5d4037", "#455a64", "#f57c00", "#303f9f",
  ];
  let hash = 0;
  const str = String(seed || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const ContactAvatar = memo(({ contact, onError, ...props }) => {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const identity = getAvatarIdentity(contact);
  const data = useMemo(() => getContactAvatarData(contact), [identity]);

  // URLs candidatas: prioridade para urlPicture (local/permanente), fallback para profilePicUrl (CDN)
  const urls = useMemo(
    () => [data.urlPicture, data.profilePicUrl].filter((u, i, a) => u && a.indexOf(u) === i),
    [data.urlPicture, data.profilePicUrl]
  );

  // Reset quando o contato muda
  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [identity]);

  const currentUrl = urls[urlIndex] || null;

  const handleError = useCallback(() => {
    const next = urlIndex + 1;
    if (next < urls.length) {
      setUrlIndex(next);
    } else {
      setFailed(true);
      if (typeof onError === "function") onError();
    }
  }, [urlIndex, urls.length, onError]);

  // Dados de fallback
  const initials = getInitials(data.contactName, data.contactNumber);
  const bgColor = getAvatarColor(data.contactName || data.contactNumber);

  // Sem contato
  if (!contact) {
    return (
      <Avatar {...props} style={{ backgroundColor: "#9e9e9e", ...props.style }}>
        ?
      </Avatar>
    );
  }

  // Sem URL válida ou falha em todas → iniciais coloridas
  if (failed || !currentUrl) {
    return (
      <Avatar
        {...props}
        style={{
          backgroundColor: bgColor,
          color: "#fff",
          fontWeight: 600,
          fontSize: props.style?.width ? Math.floor(props.style.width * 0.4) : 14,
          ...props.style,
        }}
      >
        {initials}
      </Avatar>
    );
  }

  // Renderiza a imagem
  return (
    <Avatar
      {...props}
      src={currentUrl}
      onError={handleError}
      alt={data.contactName || "Avatar"}
      imgProps={{
        loading: "lazy",
        // Sem crossOrigin: o avatar é apenas exibido (nunca lido via canvas).
        // Em modo CORS o CDN do WhatsApp (pps.whatsapp.net) bloqueia o load por
        // não enviar Access-Control-Allow-Origin, e o cache do prefetch (no-cors)
        // não é reaproveitado. referrerPolicy no-referrer evita 403 do CDN.
        referrerPolicy: "no-referrer",
        ...(props.imgProps || {}),
      }}
    >
      {initials}
    </Avatar>
  );
});

ContactAvatar.displayName = "ContactAvatar";

export default ContactAvatar;
