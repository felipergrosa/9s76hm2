import React, { useState, useEffect, useRef } from "react";
import { Avatar } from "@material-ui/core";
import ContactAvatar from "../ContactAvatar";

/**
 * Componente de avatar com lazy loading usando Intersection Observer
 * Renderiza o avatar apenas quando está visível na tela
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
  const width = style?.width || "40px";
  const height = style?.height || "40px";
  
  const handleImageError = () => {
    setHasError(true);
  };

  // Nome para placeholder ou fallback
  const contactName = contact?.name || "?";
  const firstLetter = contactName ? contactName.charAt(0).toUpperCase() : "?";
  
  // Se não está visível, mostra placeholder com animação
  if (!isVisible) {
    return (
      <div 
        ref={avatarRef} 
        className={`animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center ${className || ''}`}
        style={{ width, height, ...style }}
      >
        <span className="text-transparent">{firstLetter}</span>
      </div>
    );
  }
  
  // Se não tem contato ou houve erro, mostra fallback
  if (!contact || hasError) {
    return (
      <Avatar 
        className={className} 
        style={{ width, height, ...style }}
        {...props}
      >
        {firstLetter}
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
  
  // Se não tem imagem, usa fallback com inicial do nome
  if (!imageUrl) {
    return (
      <Avatar 
        className={className} 
        style={{ width, height, ...style }}
        {...props}
      >
        {firstLetter}
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
      alt={contactName}
      loading="lazy"
      {...props}
    >
      {firstLetter}
    </Avatar>
  );
};

export default React.memo(LazyContactAvatar);
