import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { Avatar } from "@material-ui/core";
import api from "../../services/api";
import avatarCache from "../../utils/avatarCache";

const getContactAvatarData = (contact) => {
  const nestedContact = contact?.contact || {};
  const contactId = nestedContact.id || contact?.id;
  const urlPicture = nestedContact.urlPicture || contact?.urlPicture;
  const profilePicUrl = nestedContact.profilePicUrl || contact?.profilePicUrl;

  return {
    contactId,
    urlPicture,
    profilePicUrl,
    imageUrl: urlPicture || profilePicUrl,
    contactName: nestedContact.name || contact?.name,
    contactNumber: nestedContact.number || contact?.number
  };
};

const getContactAvatarIdentity = (contact) => {
  if (!contact) return "no-contact";

  const { contactId, imageUrl } = getContactAvatarData(contact);

  return `${contactId || "no-id"}:${imageUrl || "no-image"}`;
};

// Extrair iniciais do nome para avatar (até 2 caracteres)
const getInitials = (name, number) => {
  if (name && typeof name === 'string' && name.trim()) {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  // Fallback: últimos 2 dígitos do número
  const num = String(number || '').replace(/\D/g, '');
  return num.slice(-2) || '??';
};

// Gerar cor de fundo baseada no nome/número
const getAvatarColor = (seed) => {
  const colors = [
    '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', '#1565c0',
    '#00796b', '#c2185b', '#512da8', '#0097a7', '#689f38',
    '#e64a19', '#5d4037', '#455a64', '#f57c00', '#303f9f'
  ];
  let hash = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Componente de avatar com otimização de desempenho (memoizado)
const ContactAvatar = memo(({ contact, enableRealtimeFetch = false, ...props }) => {
  const [imageError, setImageError] = useState(false);
  const [cachedUrl, setCachedUrl] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const avatarIdentity = getContactAvatarIdentity(contact);
  const avatarData = useMemo(() => getContactAvatarData(contact), [avatarIdentity]);


  // Verificar cache ao montar ou quando contato muda
  useEffect(() => {
    setImageError(false);

    if (avatarIdentity === "no-contact") {
      setCachedUrl(null);
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    // Buscar no cache primeiro
    let cached = avatarCache.get(avatarData.contactId, avatarData.urlPicture, avatarData.profilePicUrl);
    // IMPORTANTE: URLs blob: são revogadas automaticamente pelo navegador após reload/desmontagem
    // Não devem ser reutilizadas do cache — apenas URLs externas permanentes (CDN)
    if (cached?.startsWith('blob:')) {
      cached = null;
    }
    setCachedUrl(cached);
    setBlobUrl(null);
    setLoading(Boolean(cached || avatarData.imageUrl));
  }, [avatarIdentity, avatarData]);

  // Carrega imagem como blob para evitar problemas de CORS/autenticação
  useEffect(() => {
    // Determina a URL da imagem
    let imageUrl = cachedUrl || avatarData.imageUrl;

    if (!imageUrl || avatarIdentity === "no-contact") {
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      setBlobUrl(imageUrl);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const isExternalUrl = (url) =>
      url.includes('whatsapp.net') || url.includes('whatsapp.com') ||
      url.includes('fbcdn.net') || url.includes('instagram.com') ||
      url.includes('pps.') || url.includes('mmg.') ||
      url.includes('amazonaws.com') ||
      url.includes('chatsapi.nobreluminarias.com.br');

    // Helper: verifica se URL é do mesmo domínio (não precisa de blob)
    const isSameOrigin = (url) => {
      try {
        const u = new URL(url, window.location.href);
        return u.origin === window.location.origin;
      } catch (e) {
        return false;
      }
    };

    // Fast path: URLs externas (CDN WhatsApp/Instagram) → usar direto
    if (isExternalUrl(imageUrl)) {
      setBlobUrl(imageUrl);
      setLoading(false);
      if (avatarData.contactId) {
        avatarCache.set(avatarData.contactId, avatarData.urlPicture, avatarData.profilePicUrl, imageUrl);
      }
      return;
    }

    // Fast path: URLs absolutas do próprio backend (mesmo domínio) → usar direto
    // Evita criação desnecessária de blobs que são revogados pelo navegador
    if (isSameOrigin(imageUrl)) {
      setBlobUrl(imageUrl);
      setLoading(false);
      if (avatarData.contactId) {
        avatarCache.set(avatarData.contactId, avatarData.urlPicture, avatarData.profilePicUrl, imageUrl);
      }
      return;
    }

    // Fetch blob apenas para URLs relativas ou cross-origin que precisam de auth
    const fetchBlob = async (url) => {
      if (isExternalUrl(url) || isSameOrigin(url)) {
        return { blobUrl: url, direct: true };
      }
      const isAbsoluteUrl = /^https?:\/\//i.test(url);
      let blob;
      let contentType;
      if (isAbsoluteUrl) {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        contentType = response.headers.get('content-type');
        blob = await response.blob();
      } else {
        const res = await api.get(url, { responseType: 'blob' });
        blob = res.data;
        contentType = res.headers?.['content-type'];
        if (blob instanceof ArrayBuffer) {
          blob = new Blob([blob], { type: 'image/jpeg' });
        }
      }
      if (!blob || blob.size === 0) throw new Error('Blob vazio');
      // Validação rigorosa: deve ser imagem
      const isImage = contentType?.startsWith('image/') || blob.type?.startsWith('image/');
      if (!isImage) {
        console.warn(`[ContactAvatar] URL não retornou imagem: ${url.substring(0, 50)}... | content-type: ${contentType} | blob.type: ${blob.type} | size: ${blob.size}`);
        throw new Error(`Não é imagem: ${contentType || blob.type}`);
      }
      const finalType = blob.type || contentType || 'image/jpeg';
      if (blob.type !== finalType && finalType.startsWith('image/')) {
        blob = new Blob([blob], { type: finalType });
      }
      return { blobUrl: window.URL.createObjectURL(blob), direct: false };
    };

    const loadAvatar = async () => {
      const urlsToTry = [imageUrl];
      if (avatarData.profilePicUrl && avatarData.profilePicUrl !== imageUrl) {
        urlsToTry.push(avatarData.profilePicUrl);
      }


      for (const url of urlsToTry) {
        try {
          const result = await fetchBlob(url);
          if (isMounted) {
            setBlobUrl(result.blobUrl);
            setLoading(false);
            // Cache: apenas URLs externas (CDN) ou diretas do backend — NUNCA blobs
            if (avatarData.contactId && (result.direct || result.blobUrl.startsWith('data:'))) {
              avatarCache.set(avatarData.contactId, avatarData.urlPicture, avatarData.profilePicUrl, result.blobUrl);
            }
          }
          return;
        } catch (err) {
        }
      }

      if (isMounted) {
        setImageError(true);
        setLoading(false);
      }
    };

    loadAvatar();

    return () => {
      isMounted = false;
    };
  }, [avatarIdentity, avatarData, cachedUrl]);

  // DESABILITADO: Busca em tempo real causa lag massivo
  // O backend já busca avatares automaticamente via ShowTicketService
  // e emite updates via Socket.IO quando prontos
  // 
  // enableRealtimeFetch foi removido porque causava:
  // - 20+ chamadas simultâneas ao Baileys na lista de tickets
  // - Timeout de 5s por chamada = travamento total
  // - Sobrecarga no websocket do WhatsApp
  //
  // Solução: Backend atualiza em background + Socket.IO notifica frontend

  const handleImageError = useCallback((e) => {
    // Se for URL externa (WhatsApp/Instagram) com erro, marcar como erro
    // para mostrar avatar com iniciais ao invés de imagem quebrada
    setImageError(true);
  }, [avatarData.contactId]);

  // Se não tem contato, usa fallback
  if (!contact) {
    return (
      <Avatar {...props} style={{ backgroundColor: '#9e9e9e', ...props.style }}>
        ?
      </Avatar>
    );
  }

  // Determina a URL da imagem e dados do contato
  // Prioridade: blobUrl (carregado com auth) > cachedUrl > URL original
  const imageUrl = blobUrl || cachedUrl || avatarData.imageUrl;
  const contactName = avatarData.contactName;
  const contactNumber = avatarData.contactNumber;

  const shouldShowInitials = imageError || !imageUrl || loading;

  // Se houve erro, está carregando ou não tem imagem, usa avatar colorido com iniciais
  if (shouldShowInitials) {
    const initials = getInitials(contactName, contactNumber);
    const bgColor = getAvatarColor(contactName || contactNumber);

    return (
      <Avatar
        {...props}
        style={{
          backgroundColor: bgColor,
          color: '#fff',
          fontWeight: 600,
          fontSize: props.style?.width ? Math.floor(props.style.width * 0.4) : 14,
          ...props.style
        }}
      >
        {initials}
      </Avatar>
    );
  }

  // Usa a URL da imagem
  return (
    <Avatar
      {...props}
      src={imageUrl}
      onError={handleImageError}
      alt={contactName || "Avatar"}
      loading="lazy"
    >
      {/* Fallback caso a imagem não carregue */}
      {getInitials(contactName, contactNumber)}
    </Avatar>
  );
});

// Nome de exibição para debugging
ContactAvatar.displayName = 'ContactAvatar';

export default ContactAvatar;
