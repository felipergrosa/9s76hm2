import { useState, useEffect, useReducer, useContext } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";
import { isNill } from "lodash";

const reducer = (state, action) => {
  if (action.type === "LOAD_WHATSAPPS") {
    const whatsApps = action.payload;

    return [...whatsApps];
  }

  if (action.type === "UPDATE_WHATSAPPS") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex] = whatsApp;
      return [...state];
    } else {
      return [whatsApp, ...state];
    }
  }

  if (action.type === "UPDATE_SESSION") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex].status = whatsApp.status;
      state[whatsAppIndex].updatedAt = whatsApp.updatedAt;
      state[whatsAppIndex].qrcode = whatsApp.qrcode;
      state[whatsAppIndex].retries = whatsApp.retries;
      return [...state];
    } else {
      return [...state];
    }
  }

  if (action.type === "DELETE_WHATSAPPS") {
    const whatsAppId = action.payload;

    const whatsAppIndex = state.findIndex((s) => s.id === whatsAppId);
    if (whatsAppIndex !== -1) {
      state.splice(whatsAppIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useWhatsApps = () => {
  const [whatsApps, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);
//   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);

  const { hasPermission } = usePermissions();



  useEffect(() => {
    setLoading(true);
    const fetchSession = async () => {
      try {
        const { data } = await api.get("/whatsapp/?session=0");
        dispatch({ type: "LOAD_WHATSAPPS", payload: data });
        setLoading(false);
      } catch (_) {
        setLoading(false);
        // toastError(err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    if (user.companyId) {

      const companyId = user.companyId;
//    const socket = socketManager.GetSocket();

      console.log(`[useWhatsApps] Configurando listeners para companyId=${companyId}, socket=${socket ? 'connected' : 'null'}`);

      const onCompanyWhatsapp = (data) => {
        console.log(`[useWhatsApps] onCompanyWhatsapp received:`, data);
        if (data.action === "update") {
          console.log(`[useWhatsApps] Dispatching UPDATE_WHATSAPPS with:`, data.whatsapp);
          dispatch({ type: "UPDATE_WHATSAPPS", payload: data.whatsapp });
        }
        if (data.action === "delete") {
          console.log(`[useWhatsApps] Dispatching DELETE_WHATSAPPS with:`, data.whatsappId);
          dispatch({ type: "DELETE_WHATSAPPS", payload: data.whatsappId });
        }
      }

      const onCompanyWhatsappSession = (data) => {
        console.log(`[useWhatsApps] onCompanyWhatsappSession received:`, data);
        if (data.action === "update") {
          console.log(`[useWhatsApps] Dispatching UPDATE_SESSION with:`, data.session);
          dispatch({ type: "UPDATE_SESSION", payload: data.session });
        }
      }

      socket.on(`company-${companyId}-whatsapp`, onCompanyWhatsapp);
      socket.on(`company-${companyId}-whatsappSession`, onCompanyWhatsappSession);

      console.log(`[useWhatsApps] Listeners registrados: company-${companyId}-whatsapp, company-${companyId}-whatsappSession`);

      return () => {
        console.log(`[useWhatsApps] Removendo listeners para companyId=${companyId}`);
        socket.off(`company-${companyId}-whatsapp`, onCompanyWhatsapp);
        socket.off(`company-${companyId}-whatsappSession`, onCompanyWhatsappSession);
      };
    }
  }, [socket]);

  return { whatsApps, loading };
};

export default useWhatsApps;
