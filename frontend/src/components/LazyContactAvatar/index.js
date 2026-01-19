import React, { useState, useEffect, useRef } from "react";
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

/**
 * Componente de avatar com lazy loading usando Intersection Observer
 * Renderiza o avatar apenas quando está visível na tela
 * Exibe iniciais coloridas quando não há foto
 */
const LazyContactAvatar = ({ contact, className, style, ...props }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const avatarRef = useRef(null);

  // Reset visibilidade quando contato muda
  useEffect(() => {
    setHasError(false);
  }, [contact]);

  useEffect(() => {
    // Pula observer se não há suporte
    if (!window.IntersectionObserver) {
      setIsVisible(true);
      return;
    }

    // Cria um novo observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Quando o elemento entra na viewport, marca como visível
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Desconecta o observer após tornar visível
          if (avatarRef.current) observer.unobserve(avatarRef.current);
        }
      },
      {
        rootMargin: "200px", // Pré-carrega quando está a 200px da viewport
        threshold: 0.1 // Dispara quando pelo menos 10% do elemento está visível
      }
    );

    // Observa o elemento
    if (avatarRef.current) {
      observer.observe(avatarRef.current);
    }

    // Limpa o observer ao desmontar
    return () => {
      if (avatarRef.current) {
        observer.unobserve(avatarRef.current);
      }
    };
  }, []);

  // Determina propriedades do avatar
  const width = style?.width || 40;
  const height = style?.height || 40;
  const numWidth = typeof width === 'string' ? parseInt(width) : width;

  const handleImageError = () => {
    setHasError(true);
  };

  // Dados do contato
  let contactName = contact?.name || "";
  let contactNumber = contact?.number || "";

  // Se tem contact.contact (estrutura de ContactListItems)
  if (contact?.contact) {
    contactName = contact.contact.name || contact.name || "";
    contactNumber = contact.contact.number || contact.number || "";
  }

  const initials = getInitials(contactName, contactNumber);
  const bgColor = getAvatarColor(contactName || contactNumber);

  // Estilo para avatar colorido
  const coloredAvatarStyle = {
    width,
    height,
    backgroundColor: bgColor,
    color: '#fff',
    fontWeight: 600,
    fontSize: Math.floor(numWidth * 0.4),
    ...style
  };

  // Se não está visível, mostra placeholder com cor
  if (!isVisible) {
    return (
      <div
        ref={avatarRef}
        className={className || ''}
        style={{
          width,
          height,
          borderRadius: '50%',
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 600,
          fontSize: Math.floor(numWidth * 0.4),
          ...style
        }}
      >
        {initials}
      </div>
    );
  }

  // Se não tem contato ou houve erro, mostra fallback colorido
  if (!contact || hasError) {
    return (
      <Avatar
        className={className}
        style={coloredAvatarStyle}
        {...props}
      >
        {initials}
      </Avatar>
    );
  }

  // Determina a URL da imagem baseado na estrutura de dados
  let imageUrl = null;

  // Se tem contact.contact (estrutura de ContactListItems)
  if (contact.contact) {
    // Prefira sempre urlPicture (servida pelo backend), depois profilePicUrl (externa)
    imageUrl = contact.contact.urlPicture || contact.contact.profilePicUrl;
  } else {
    // Estrutura normal de contatos: prefira urlPicture
    imageUrl = contact.urlPicture || contact.profilePicUrl;
  }

  // Se não tem imagem, usa fallback colorido com iniciais
  if (!imageUrl) {
    return (
      <Avatar
        className={className}
        style={coloredAvatarStyle}
        {...props}
      >
        {initials}
      </Avatar>
    );
  }

  // Usa a URL da imagem com lazy loading
  return (
    <Avatar
      className={className}
      style={{ width, height, ...style }}
      src={imageUrl}
      onError={handleImageError}
      alt={contactName || "Avatar"}
      loading="lazy"
      {...props}
    >
      {initials}
    </Avatar>
  );
};

export default React.memo(LazyContactAvatar);
