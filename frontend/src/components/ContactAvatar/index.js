import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { Avatar } from "@material-ui/core";
import { getBackendUrl } from "../../config";
import avatarCache from "../../utils/avatarCache";

const PLACEHOLDER_AVATAR_RE = /nopicture\.png/i;

const getBackendBaseUrl = () => {
  const backendUrl = getBackendUrl();

  if (!backendUrl || backendUrl === "undefined" || backendUrl === "null") {
    return "";
  }

  return String(backendUrl).replace(/\/+$/, "");
};

const isPlaceholderAvatar = (url) => PLACEHOLDER_AVATAR_RE.test(String(url || ""));

export const normalizeAvatarUrl = (url, companyId) => {
  if (!url || typeof url !== "string") return "";

  let cleanUrl = url.trim().replace(/\\/g, "/");
  if (!cleanUrl || isPlaceholderAvatar(cleanUrl)) return "";

  cleanUrl = cleanUrl
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  if (/^(blob|data):/i.test(cleanUrl)) return cleanUrl;

  const backendBaseUrl = getBackendBaseUrl();
  const withoutLeadingSlash = cleanUrl.replace(/^\/+/, "");

  if (backendBaseUrl) {
    if (cleanUrl.startsWith("/public/") || cleanUrl.startsWith("public/")) {
      return `${backendBaseUrl}/${withoutLeadingSlash}`;
    }

    if (/^company\d+\//i.test(withoutLeadingSlash)) {
      return `${backendBaseUrl}/public/${withoutLeadingSlash}`;
    }

    if (companyId && withoutLeadingSlash.startsWith("contacts/")) {
      return `${backendBaseUrl}/public/company${companyId}/${withoutLeadingSlash}`;
    }
  }

  if (cleanUrl.startsWith("//") && typeof window !== "undefined") {
    return `${window.location.protocol}${cleanUrl}`;
  }

  if (/^https?:\/\//i.test(cleanUrl)) {
    if (backendBaseUrl) {
      try {
        const parsedUrl = new URL(cleanUrl);
        const backendUrl = new URL(backendBaseUrl);

        if (parsedUrl.pathname.startsWith("/public/") && parsedUrl.origin !== backendUrl.origin) {
          return `${backendBaseUrl}${parsedUrl.pathname}${parsedUrl.search}`;
        }
      } catch (err) {
        return cleanUrl;
      }
    }

    return cleanUrl;
  }

  return cleanUrl;
};

export const getContactAvatarData = (contact) => {
  const nestedContact = contact?.contact || {};
  const contactId = nestedContact.id || contact?.id;
  const companyId = nestedContact.companyId || contact?.companyId;
  const urlPicture = normalizeAvatarUrl(nestedContact.urlPicture || contact?.urlPicture, companyId);
  const profilePicUrl = normalizeAvatarUrl(nestedContact.profilePicUrl || contact?.profilePicUrl, companyId);

  return {
    contactId,
    companyId,
    urlPicture,
    profilePicUrl,
    contactName: nestedContact.name || contact?.name,
    contactNumber: nestedContact.number || contact?.number
  };
};

const getContactAvatarIdentity = (contact) => {
  if (!contact) return "no-contact";

  const { contactId, urlPicture, profilePicUrl } = getContactAvatarData(contact);

  return `${contactId || "no-id"}:${urlPicture || "no-url-picture"}:${profilePicUrl || "no-profile-pic"}`;
};

export const getContactAvatarUrls = (contact) => {
  const { urlPicture, profilePicUrl } = getContactAvatarData(contact);
  return uniqueUrls([profilePicUrl, urlPicture]);
};

const getInitials = (name, number) => {
  if (name && typeof name === "string" && name.trim()) {
    const parts = name.trim().split(" ").filter(part => part.length > 0);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }

  const num = String(number || "").replace(/\D/g, "");
  return num.slice(-2) || "??";
};

const getAvatarColor = (seed) => {
  const colors = [
    "#1976d2", "#388e3c", "#d32f2f", "#7b1fa2", "#1565c0",
    "#00796b", "#c2185b", "#512da8", "#0097a7", "#689f38",
    "#e64a19", "#5d4037", "#455a64", "#f57c00", "#303f9f"
  ];
  let hash = 0;
  const str = String(seed || "");

  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const uniqueUrls = (urls) => {
  const seen = new Set();

  return urls.filter(url => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

const ContactAvatar = memo(({ contact, enableRealtimeFetch = false, onError, ...props }) => {
  const [imageError, setImageError] = useState(false);
  const [cachedUrl, setCachedUrl] = useState(null);
  const [activeUrlIndex, setActiveUrlIndex] = useState(0);
  const avatarIdentity = getContactAvatarIdentity(contact);
  const avatarData = useMemo(() => getContactAvatarData(contact), [avatarIdentity]);

  useEffect(() => {
    setImageError(false);
    setActiveUrlIndex(0);

    if (avatarIdentity === "no-contact") {
      setCachedUrl(null);
      return;
    }

    const cached = avatarCache.get(
      avatarData.contactId,
      avatarData.urlPicture,
      avatarData.profilePicUrl
    );

    setCachedUrl(cached && !cached.startsWith("blob:") ? cached : null);
  }, [avatarIdentity, avatarData]);

  const avatarUrls = useMemo(() => uniqueUrls([
    avatarData.profilePicUrl,
    avatarData.urlPicture,
    cachedUrl
  ]), [cachedUrl, avatarData]);

  const imageUrl = avatarUrls[activeUrlIndex] || null;

  const handleImageLoad = useCallback(() => {
    if (!avatarData.contactId || !imageUrl) return;

    avatarCache.set(
      avatarData.contactId,
      avatarData.urlPicture,
      avatarData.profilePicUrl,
      imageUrl
    );
  }, [avatarData, imageUrl]);

  const handleImageError = useCallback((event) => {
    const nextUrlIndex = activeUrlIndex + 1;

    if (nextUrlIndex < avatarUrls.length) {
      setActiveUrlIndex(nextUrlIndex);
      return;
    }

    setImageError(true);

    if (typeof onError === "function") {
      onError(event);
    }
  }, [activeUrlIndex, avatarUrls.length, onError]);

  if (!contact) {
    return (
      <Avatar {...props} style={{ backgroundColor: "#9e9e9e", ...props.style }}>
        ?
      </Avatar>
    );
  }

  const contactName = avatarData.contactName;
  const contactNumber = avatarData.contactNumber;
  const initials = getInitials(contactName, contactNumber);
  const shouldShowInitials = imageError || !imageUrl;

  if (shouldShowInitials) {
    const bgColor = getAvatarColor(contactName || contactNumber);

    return (
      <Avatar
        {...props}
        style={{
          backgroundColor: bgColor,
          color: "#fff",
          fontWeight: 600,
          fontSize: props.style?.width ? Math.floor(props.style.width * 0.4) : 14,
          ...props.style
        }}
      >
        {initials}
      </Avatar>
    );
  }

  return (
    <Avatar
      {...props}
      src={imageUrl}
      onLoad={handleImageLoad}
      onError={handleImageError}
      alt={contactName || "Avatar"}
      imgProps={{ loading: "lazy", referrerPolicy: "no-referrer", ...(props.imgProps || {}) }}
    >
      {initials}
    </Avatar>
  );
});

ContactAvatar.displayName = "ContactAvatar";

export default ContactAvatar;
