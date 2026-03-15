import { useEffect, useContext } from "react";
import { SocketContext } from "../context/Socket/SocketContext";
import { AuthContext } from "../context/Auth/AuthContext";
import avatarCache from "../utils/avatarCache";

const useContactUpdates = (onContactUpdate) => {
  const socketManager = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!socketManager || !user?.companyId) return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-contact`;

    const handleContactUpdate = (data) => {
      if (data.action === "update" && data.contact) {
        // Invalidar cache do avatar quando contato for atualizado
        if (data.contact.id) {
          avatarCache.invalidate(data.contact.id);
        }
        
        if (onContactUpdate) {
          onContactUpdate(data.contact);
        }
      }
    };

    socketManager.on(eventName, handleContactUpdate);

    return () => {
      socketManager.off(eventName, handleContactUpdate);
    };
  }, [socketManager, user?.companyId, onContactUpdate]);
};

export default useContactUpdates;
