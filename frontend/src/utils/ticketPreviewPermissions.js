const hasPermission = (user, permission) => {
  if (!user || !permission) return false;

  if (user.super === true) return true;

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    if (user.permissions.includes(permission)) return true;

    return user.permissions.some(item => {
      if (!item || !item.endsWith(".*")) return false;
      const prefix = item.slice(0, -2);
      return permission.startsWith(`${prefix}.`);
    });
  }

  const legacyMap = {
    "tickets.view-all-users": user.allUserChat === "enabled",
    "tickets.view-all": user.allTicket === "enable",
  };

  return legacyMap[permission] === true;
};

export const canViewTicketConversation = ({ ticket, user }) => {
  if (!ticket || !user) return false;

  if (user.profile === "admin" || user.super === true) {
    return true;
  }

  const allowedConnectionIds = Array.isArray(user.allowedConnectionIds)
    ? user.allowedConnectionIds
    : [];

  if (allowedConnectionIds.length > 0 && ticket.whatsappId) {
    if (!allowedConnectionIds.includes(ticket.whatsappId)) {
      return false;
    }
  }

  const ticketUserId = Number(ticket.userId || ticket.user?.id || 0);
  const currentUserId = Number(user.id);
  const managedIds = Array.isArray(user.managedUserIds)
    ? user.managedUserIds.map(Number)
    : [];

  if (ticketUserId && managedIds.includes(ticketUserId)) {
    return true;
  }

  if (hasPermission(user, "tickets.view-all-users")) {
    return true;
  }

  const isBeingAttended =
    (ticket.status === "open" || ticket.status === "group") && ticketUserId;

  if (isBeingAttended) {
    return ticketUserId === currentUserId;
  }

  if (!ticketUserId) {
    const allowedContactTags = Array.isArray(user.allowedContactTags)
      ? user.allowedContactTags
      : [];

    if (allowedContactTags.length === 0) {
      return true;
    }

    const contactTags = Array.isArray(ticket.contact?.tags)
      ? ticket.contact.tags
      : [];

    if (contactTags.length === 0) {
      return true;
    }

    return contactTags.some(tag => allowedContactTags.includes(tag.id));
  }

  return ticketUserId === currentUserId;
};

export const canAssumeTicketConversation = ({ ticket, user }) => {
  if (!ticket || !user || ticket.isGroup) return false;
  if (!canViewTicketConversation({ ticket, user })) return false;

  const ticketUserId = Number(ticket.userId || ticket.user?.id || 0);
  const currentUserId = Number(user.id);

  if (!ticketUserId || ticketUserId === currentUserId) {
    return false;
  }

  if (user.profile === "admin" || user.super === true) {
    return true;
  }

  const managedIds = Array.isArray(user.managedUserIds)
    ? user.managedUserIds.map(Number)
    : [];

  return managedIds.includes(ticketUserId);
};
