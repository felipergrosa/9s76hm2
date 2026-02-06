import React from 'react';
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
 * Componente de avatar genérico com fallback para iniciais coloridas
 * Quando não há imagem, exibe as iniciais do nome em um círculo colorido
 */
const AvatarFallback = ({ 
  src, 
  name, 
  number,
  contact,
  alt,
  className, 
  style, 
  children,
  onError,
  ...props 
}) => {
  const [hasError, setHasError] = React.useState(false);

  const handleError = (e) => {
    setHasError(true);
    if (onError) onError(e);
  };

  // Extrair dados do contato se fornecido
  let displayName = name;
  let displayNumber = number;
  let imageSrc = src;

  if (contact) {
    displayName = contact.name || contact.pushName || '';
    displayNumber = contact.number || '';
    // Busca a imagem nas propriedades do contato
    if (!imageSrc) {
      imageSrc = contact.urlPicture || contact.profilePicUrl || null;
    }
  }

  const initials = getInitials(displayName, displayNumber);
  const bgColor = getAvatarColor(displayName || displayNumber);

  // Dimensões para calcular tamanho da fonte
  const width = style?.width || 40;
  const height = style?.height || 40;
  const numWidth = typeof width === 'string' ? parseInt(width) : width;

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

  // Se não tem imagem ou houve erro, mostra fallback colorido
  if (!imageSrc || hasError) {
    return (
      <Avatar
        className={className}
        style={coloredAvatarStyle}
        alt={alt || displayName || "Avatar"}
        {...props}
      >
        {initials}
        {children}
      </Avatar>
    );
  }

  // Renderiza avatar com imagem
  return (
    <Avatar
      className={className}
      style={{ width, height, ...style }}
      src={imageSrc}
      onError={handleError}
      alt={alt || displayName || "Avatar"}
      {...props}
    >
      {initials}
      {children}
    </Avatar>
  );
};

export default AvatarFallback;
