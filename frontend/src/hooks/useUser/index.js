import api from "../../services/api";
import toastError from "../../errors/toastError";
import openSocket from "socket.io-client";
import { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useUser = () => {
  const [users, setUsers] = useState([]);
  const [update, setUpdate] = useState(true);
  const { user: currentUser } = useContext(AuthContext);

  // Função auxiliar para verificar permissão
  const hasPermission = (permission) => {
    if (!currentUser || currentUser.loading) return false;
    if (currentUser?.super === true) return true;
    if (currentUser?.profile === "admin") return true;
    return currentUser?.permissions?.includes(permission);
  };

  useEffect(() => {
    (async () => {
      // Se user ainda não está pronto ou sem permissão, não carrega
      if (!currentUser || currentUser.loading || !hasPermission("users.view")) {
        return;
      }

      if (update) {
        try {
          const { data } = await api.get("/users");
          setUsers(data.users);
          setUpdate(false);
        } catch (err) {
          // Silencia erro 403 (sem permissão)
          if (err.response?.status !== 403 && err.response?.status !== 500) {
            toastError(err);
          } else if (err.response?.status === 500) {
            toast.error(`${i18n.t("frontEndErrors.getUsers")}`);
          }
        }
      }
    })();
  }, [update, currentUser]);

  useEffect(() => {
    const socket = openSocket(process.env.REACT_APP_BACKEND_URL);

    socket.on("users", (data) => {
      setUpdate(true);
    });

    return () => {
      console.log("OFF USERS SOCKET")
      socket.off("users");
    };
  }, [users]);

  return { users };
};

export default useUser;
