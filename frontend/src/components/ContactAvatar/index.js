import React, { useState, useEffect, memo, useCallback } from "react";
import { Avatar } from "@material-ui/core";
import api from "../../services/api";
import avatarCache from "../../utils/avatarCache";

const getContactAvatarIdentity = (contact) => {
  if (!contact) return "no-contact";

  const nestedContact = contact.contact || {};
  const contactId = contact.id || nestedContact.id || "no-id";
  const imageUrl = nestedContact.urlPicture || nestedContact.profilePicUrl || contact.urlPicture || contact.profilePicUrl || "no-image";

  return `${contactId}:${imageUrl}`;
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

  // Verificar cache ao montar ou quando contato muda
  useEffect(() => {
    setImageError(false);
    setLoading(true);
    
    if (!contact) {
      setCachedUrl(null);
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    const contactId = contact.id || contact.contact?.id;
    const urlPicture = contact.urlPicture || contact.contact?.urlPicture;
    const profilePicUrl = contact.profilePicUrl || contact.contact?.profilePicUrl;

    // Buscar no cache primeiro
    const cached = avatarCache.get(contactId, urlPicture, profilePicUrl);
    setCachedUrl(cached);
  }, [avatarIdentity, contact]);

  // Carrega imagem como blob para evitar problemas de CORS/autenticação
  useEffect(() => {
    // Determina a URL da imagem
    let imageUrl = cachedUrl;
    
    if (contact?.contact) {
      imageUrl = imageUrl || contact.contact.urlPicture || contact.contact.profilePicUrl;
    } else {
      imageUrl = imageUrl || contact?.urlPicture || contact?.profilePicUrl;
    }

    if (!imageUrl || !contact) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    // Se for URL externa (WhatsApp, etc), usar diretamente sem carregar blob
    if (imageUrl.includes('whatsapp.net') || imageUrl.includes('fbcdn.net') || imageUrl.includes('instagram.com')) {
      setBlobUrl(imageUrl);
      setLoading(false);
      return;
    }

    // Para URLs locais, tenta carregar como blob
    let isMounted = true;
    
    const loadAvatar = async () => {
      try {
        const isAbsoluteUrl = /^https?:\/\//i.test(imageUrl);
        let data, contentType;

        if (isAbsoluteUrl) {
          const response = await fetch(imageUrl, { credentials: 'include' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.blob();
          contentType = response.headers.get('content-type') || 'image/jpeg';
        } else {
          const res = await api.get(imageUrl, { responseType: 'blob' });
          data = res.data;
          contentType = res.headers['content-type'] || 'image/jpeg';
        }

        if (isMounted) {
          const objectUrl = window.URL.createObjectURL(new Blob([data], { type: contentType }));
          setBlobUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          // Fallback: usar URL direta mesmo em caso de erro
          setBlobUrl(imageUrl);
          setLoading(false);
        }
      }
    };

    loadAvatar();

    return () => {
      isMounted = false;
    };
  }, [cachedUrl, contact]);

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
    const src = e?.target?.src || '';
    setImageError(true);
  }, []);

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
  let imageUrl = blobUrl || cachedUrl;
  let contactName = contact.name;
  let contactNumber = contact.number;

  // Se tem contact.contact (estrutura de ContactListItems)
  if (contact.contact) {
    // Priorizar urlPicture (local) sobre profilePicUrl (WhatsApp externo que expira)
    imageUrl = imageUrl || contact.contact.urlPicture || contact.contact.profilePicUrl;
    contactName = contact.contact.name || contact.name;
    contactNumber = contact.contact.number || contact.number;
  } else {
    // Priorizar urlPicture (local) sobre profilePicUrl (WhatsApp externo que expira)
    imageUrl = imageUrl || contact.urlPicture || contact.profilePicUrl;
  }
  
  // Armazenar no cache se temos uma URL válida
  if (imageUrl && contact.id) {
    const contactId = contact.id || contact.contact?.id;
    const urlPicture = contact.urlPicture || contact.contact?.urlPicture;
    const profilePicUrl = contact.profilePicUrl || contact.contact?.profilePicUrl;
    avatarCache.set(contactId, urlPicture, profilePicUrl, imageUrl);
  }

  // Se houve erro, está carregando ou não tem imagem, usa avatar colorido com iniciais
  if (imageError || !imageUrl || loading) {
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
