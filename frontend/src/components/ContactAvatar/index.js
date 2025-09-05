import React, { useState, useEffect } from "react";
import { Avatar } from "@material-ui/core";

const ContactAvatar = ({ contact, ...props }) => {
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
      <Avatar {...props}>
        ?
      </Avatar>
    );
  }

  // Determina a URL da imagem baseado na estrutura de dados
  let imageUrl = null;
  let contactName = contact.name;

  // Se tem contact.contact (estrutura de ContactListItems)
  if (contact.contact) {
    // Prefira sempre urlPicture (servida pelo backend), depois profilePicUrl (externa)
    imageUrl = contact.contact.urlPicture || contact.contact.profilePicUrl;
    contactName = contact.contact.name || contact.name;
  } else {
    // Estrutura normal de contatos: prefira urlPicture
    imageUrl = contact.urlPicture || contact.profilePicUrl;
  }

  // Se houve erro ou não tem imagem, usa fallback com inicial do nome
  if (imageError || !imageUrl) {
    return (
      <Avatar {...props}>
        {contactName ? contactName.charAt(0).toUpperCase() : "?"}
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
    >
      {contactName ? contactName.charAt(0).toUpperCase() : "?"}
    </Avatar>
  );
};

export default ContactAvatar;
