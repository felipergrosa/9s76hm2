import { useState, useEffect, useContext, useRef } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";
import logger from "../../utils/logger";
// import { useDate } from "../../hooks/useDate";
import moment from "moment";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});
  const [socket, setSocket] = useState({});
  
  // Ref para rastrear se o componente está montado
  const isMountedRef = useRef(true);
  // Ref para evitar múltiplas tentativas simultâneas de refresh
  const isRefreshingRef = useRef(false);
  // Ref para controlar se já tentou fazer refresh inicial
  const hasTriedInitialRefreshRef = useRef(false);

  // Cleanup quando o componente desmonta
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper para atualizar estado apenas se montado
  const safeSetState = (setter, value) => {
    if (isMountedRef.current) {
      setter(value);
    }
  };

  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
        safeSetState(setIsAuth, true);
      }
      return config;
    },
    (error) => {
      Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      const status = error?.response?.status;
      const isAuthRefreshCall = originalRequest?.url?.includes("/auth/refresh_token");
      
      // Evitar loop infinito: se já está tentando refresh ou é uma chamada de refresh, não tentar novamente
      if ((status === 401 || status === 403) && !originalRequest._retry && !isAuthRefreshCall && !isRefreshingRef.current) {
        originalRequest._retry = true;
        isRefreshingRef.current = true;
        
        try {
          const { data } = await api.post("/auth/refresh_token");
          if (data?.token) {
            localStorage.setItem("token", JSON.stringify(data.token));
            api.defaults.headers.Authorization = `Bearer ${data.token}`;
            isRefreshingRef.current = false;
            return api(originalRequest);
          }
        } catch (e) {
          // Refresh falhou: limpar estado e redirecionar para login
          isRefreshingRef.current = false;
          localStorage.removeItem("token");
          api.defaults.headers.Authorization = undefined;
          safeSetState(setIsAuth, false);
          
          // Redirecionar para login apenas se não estiver já na página de login
          if (history.location.pathname !== "/login") {
            history.push("/login");
          }
        }
      }
      
      if (status === 401) {
        localStorage.removeItem("token");
        api.defaults.headers.Authorization = undefined;
        safeSetState(setIsAuth, false);
        
        // Redirecionar para login apenas se não estiver já na página de login
        if (history.location.pathname !== "/login") {
          history.push("/login");
        }
      }
      
      return Promise.reject(error);
    }
  );

  useEffect(() => {
    isMountedRef.current = true;
    
    // Evitar múltiplas tentativas de refresh inicial
    if (hasTriedInitialRefreshRef.current) {
      return;
    }
    
    hasTriedInitialRefreshRef.current = true;
    isRefreshingRef.current = true;
    
    (async () => {
      try {
        const { data } = await api.post("/auth/refresh_token");
        if (data?.token && isMountedRef.current) {
          localStorage.setItem("token", JSON.stringify(data.token));
          api.defaults.headers.Authorization = `Bearer ${data.token}`;
          safeSetState(setIsAuth, true);
          safeSetState(setUser, data.user);
        }
      } catch (err) {
        // falha de refresh inicial: garantir estado limpo
        if (isMountedRef.current) {
          localStorage.removeItem("token");
          api.defaults.headers.Authorization = undefined;
          safeSetState(setIsAuth, false);
          
          // Redirecionar para login apenas se não estiver já na página de login
          if (history.location.pathname !== "/login") {
            history.push("/login");
          }
          // não exibir toast aqui para não poluir ao simplesmente abrir o app sem sessão
        }
      } finally {
        isRefreshingRef.current = false;
        if (isMountedRef.current) {
          safeSetState(setLoading, false);
        }
      }
    })();
  }, [history]);

  useEffect(() => {
    if (Object.keys(user).length && user.id > 0) {
      // console.log("Entrou useWhatsapp com user", Object.keys(user).length, Object.keys(socket).length ,user, socket)
      let io;
      if (!socket || !socket.on || typeof socket.on !== 'function') {
        io = socketConnection({ user });
        if (io && typeof io.on === 'function') {
          setSocket(io);
        } else {
          console.error('[useAuth] socketConnection não retornou uma instância válida', io);
          return;
        }
      } else {
        io = socket;
      }
      
      if (io && typeof io.on === 'function') {
        io.on(`company-${user.companyId}-user`, (data) => {
          if (data.action === "update" && data.user.id === user.id && isMountedRef.current) {
            safeSetState(setUser, data.user);
          }
        });

        return () => {
          // console.log("desconectou o company user ", user.id)
          if (io && typeof io.off === 'function') {
            io.off(`company-${user.companyId}-user`);
          }
          // io.disconnect();
        };
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [user]);

  const handleLogin = async (userData) => {
    if (!isMountedRef.current) return;
    
    safeSetState(setLoading, true);

    try {
      const { data } = await api.post("/auth/login", userData);
      
      // Verificar se componente ainda está montado antes de continuar
      if (!isMountedRef.current) return;
      
      const {
        user: { company },
      } = data;

      if (has(company, "companieSettings") && isArray(company.companieSettings[0])) {
        const setting = company.companieSettings[0].find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null); //regra pra exibir campanhas
        }
      }

      if (has(company, "companieSettings") && isArray(company.companieSettings[0])) {
        const setting = company.companieSettings[0].find(
          (s) => s.key === "sendSignMessage"
        );

        const signEnable = setting.value === "enable";

        if (setting && setting.value === "enabled") {
          localStorage.setItem("sendSignMessage", signEnable); //regra pra exibir campanhas
        }
      }
      localStorage.setItem("profileImage", data.user.profileImage); //regra pra exibir imagem contato

      moment.locale('pt-br');
      let dueDate;
      if (data.user.company.id === 1) {
        dueDate = '2999-12-31T00:00:00.000Z'
      } else {
        dueDate = data.user.company.dueDate;
      }
      const hoje = moment(moment()).format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");

      var diff = moment(dueDate).diff(moment(moment()).format());

      var before = moment(moment().format()).isBefore(dueDate);
      var dias = moment.duration(diff).asDays();

      // Verificar novamente antes de atualizar estado
      if (!isMountedRef.current) return;

      if (before === true) {
        localStorage.setItem("token", JSON.stringify(data.token));
        // localStorage.setItem("public-token", JSON.stringify(data.user.token));
        // localStorage.setItem("companyId", companyId);
        // localStorage.setItem("userId", id);
        localStorage.setItem("companyDueDate", vencimento);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        safeSetState(setUser, data.user);
        safeSetState(setIsAuth, true);
        toast.success(i18n.t("auth.toasts.success"));
        if (Math.round(dias) < 5) {
          toast.warn(`Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} `);
        }

        // // Atraso para garantir que o cache foi limpo
        // setTimeout(() => {
        //   window.location.reload(true); // Recarregar a página
        // }, 1000);

        history.push("/tickets");
        safeSetState(setLoading, false);
      } else {
        // localStorage.setItem("companyId", companyId);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        safeSetState(setIsAuth, true);
        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
        history.push("/financeiro-aberto");
        safeSetState(setLoading, false);
      }

    } catch (err) {
      if (isMountedRef.current) {
      toastError(err);
        safeSetState(setLoading, false);
      }
    }
  };

  const handleLogout = async () => {
    if (!isMountedRef.current) return;
    
    safeSetState(setLoading, true);

    try {
      // socket.disconnect();
      await api.delete("/auth/logout");
      
      // Verificar se componente ainda está montado
      if (!isMountedRef.current) return;
      
      safeSetState(setIsAuth, false);
      safeSetState(setUser, {});
      localStorage.removeItem("token");
      localStorage.removeItem("cshow");
      // localStorage.removeItem("public-token");
      api.defaults.headers.Authorization = undefined;
      safeSetState(setLoading, false);
      history.push("/login");
    } catch (err) {
      if (isMountedRef.current) {
      toastError(err);
        safeSetState(setLoading, false);
      }
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      logger.debug(data);
      return data;
    } catch (_) {
      return null;
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
    socket
  };
};

export default useAuth;
