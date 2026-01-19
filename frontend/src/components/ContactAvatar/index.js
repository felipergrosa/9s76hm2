import React, { useState, useEffect, memo } from "react";
import { Avatar } from "@material-ui/core";

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
const ContactAvatar = memo(({ contact, ...props }) => {
  const [imageError, setImageError] = useState(false);

  // Reset error quando contato muda
  useEffect(() => {
    setImageError(false);
  }, [contact]);

  const handleImageError = () => {
    setImageError(true);
  };

  // Se não tem contato, usa fallback
  if (!contact) {
    return (
      <Avatar {...props} style={{ backgroundColor: '#9e9e9e', ...props.style }}>
        ?
      </Avatar>
    );
  }

  // Determina a URL da imagem e dados do contato
  let imageUrl = null;
  let contactName = contact.name;
  let contactNumber = contact.number;

  // Se tem contact.contact (estrutura de ContactListItems)
  if (contact.contact) {
    imageUrl = contact.contact.urlPicture || contact.contact.profilePicUrl;
    contactName = contact.contact.name || contact.name;
    contactNumber = contact.contact.number || contact.number;
  } else {
    // Estrutura normal de contatos: prefira urlPicture
    imageUrl = contact.urlPicture || contact.profilePicUrl;
  }

  // Se houve erro ou não tem imagem, usa avatar colorido com iniciais
  if (imageError || !imageUrl) {
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
