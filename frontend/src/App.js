import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "./services/api";
import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import {
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import ColorModeContext from "./layout/themeContext";
import { ActiveMenuProvider } from "./context/ActiveMenuContext";
import Favicon from "react-favicon";
import { getBackendUrl } from "./config";
import Routes from "./routes";
import defaultLogoLight from "./assets/logo.png";
import defaultLogoDark from "./assets/logo-black.png";
import defaultLogoFavicon from "./assets/favicon.ico";
import useSettings from "./hooks/useSettings";

const queryClient = new QueryClient();

const App = () => {
  const [locale, setLocale] = useState();
  const appColorLocalStorage = localStorage.getItem("primaryColorLight") || localStorage.getItem("primaryColorDark") || "#065183";
  const appNameLocalStorage = localStorage.getItem("appName") || "";
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const preferredTheme = window.localStorage.getItem("preferredTheme");
  const [mode, setMode] = useState(preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light");
  const [primaryColorLight, setPrimaryColorLight] = useState(appColorLocalStorage);
  const [primaryColorDark, setPrimaryColorDark] = useState(appColorLocalStorage);
  const backendUrl = useMemo(() => {
    const url = getBackendUrl() || "http://localhost:8080";
    if (!url) return "";
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }, []);
  const [appLogoLight, setAppLogoLight] = useState(defaultLogoLight);
  const [appLogoDark, setAppLogoDark] = useState(defaultLogoDark);
  const [appLogoFavicon, setAppLogoFavicon] = useState(defaultLogoFavicon);
  const [appName, setAppName] = useState(appNameLocalStorage);
  const [apiStatus, setApiStatus] = useState("checking");
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  const [showApiStatusDialog, setShowApiStatusDialog] = useState(false);
  const { getPublicSetting } = useSettings();
  // Estado para controlar o prompt de instalação do PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  const SESSION_DISMISS_KEY = "taktchat:pwaPromptDismissedSession";
  const DAILY_SNOOZE_KEY = "taktchat:pwaPromptSnoozeUntil";

  const clearExpiredSnooze = useCallback(() => {
    const snoozeUntil = localStorage.getItem(DAILY_SNOOZE_KEY);
    if (snoozeUntil && Number(snoozeUntil) < Date.now()) {
      localStorage.removeItem(DAILY_SNOOZE_KEY);
    }
  }, [DAILY_SNOOZE_KEY]);

  useEffect(() => {
    clearExpiredSnooze();
  }, [clearExpiredSnooze]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem(SESSION_DISMISS_KEY);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const shouldSkipInstallPrompt = useCallback(() => {
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "true") {
      return true;
    }
    const snoozeUntil = localStorage.getItem(DAILY_SNOOZE_KEY);
    if (snoozeUntil && Number(snoozeUntil) > Date.now()) {
      return true;
    }
    return false;
  }, [DAILY_SNOOZE_KEY, SESSION_DISMISS_KEY]);

  const snoozeUntilMidnight = useCallback(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(23, 59, 59, 999);
    localStorage.setItem(DAILY_SNOOZE_KEY, midnight.getTime().toString());
  }, [DAILY_SNOOZE_KEY]);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === "light" ? "dark" : "light";
          window.localStorage.setItem("preferredTheme", newMode); // Persistindo o tema no localStorage
          return newMode;
        });
      },
      setPrimaryColorLight,
      setPrimaryColorDark,
      setAppLogoLight,
      setAppLogoDark,
      setAppLogoFavicon,
      setAppName,
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      mode,
    }),
    [appLogoLight, appLogoDark, appLogoFavicon, appName, mode]
  );

  const theme = useMemo(
    () =>
      createTheme(
        {
          scrollbarStyles: {
            "&::-webkit-scrollbar": {
              width: "8px",
              height: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
              backgroundColor: mode === "light" ? primaryColorLight : primaryColorDark,
            },
          },
          scrollbarStylesSoft: {
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: mode === "light" ? "#F3F3F3" : "#333333",
            },
          },
          palette: {
            type: mode,
            primary: { main: mode === "light" ? primaryColorLight : primaryColorDark },
            textPrimary: mode === "light" ? primaryColorLight : primaryColorDark,
            borderPrimary: mode === "light" ? primaryColorLight : primaryColorDark,
            dark: { main: mode === "light" ? "#333333" : "#F3F3F3" },
            light: { main: mode === "light" ? "#F3F3F3" : "#333333" },
            fontColor: mode === "light" ? primaryColorLight : primaryColorDark,
            tabHeaderBackground: mode === "light" ? "#EEE" : "#666",
            optionsBackground: mode === "light" ? "#fafafa" : "#333",
            fancyBackground: mode === "light" ? "#fafafa" : "#333",
            total: mode === "light" ? "#fff" : "#222",
            messageIcons: mode === "light" ? "grey" : "#F3F3F3",
            inputBackground: mode === "light" ? "#FFFFFF" : "#333",
            barraSuperior: mode === "light" ? primaryColorLight : "#666",
          },
          mode,
          appLogoLight,
          appLogoDark,
          appLogoFavicon,
          appName,
          calculatedLogoDark: () => {
            if (appLogoDark === defaultLogoDark && appLogoLight !== defaultLogoLight) {
              return appLogoLight;
            }
            return appLogoDark;
          },
          calculatedLogoLight: () => {
            if (appLogoDark !== defaultLogoDark && appLogoLight === defaultLogoLight) {
              return appLogoDark;
            }
            return appLogoLight;
          },
        },
        locale
      ),
    [appLogoLight, appLogoDark, appLogoFavicon, appName, locale, mode, primaryColorDark, primaryColorLight]
  );

  // Detecta quando o navegador está pronto para mostrar o prompt de instalação do PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      if (shouldSkipInstallPrompt()) {
        return;
      }

      // Previne o comportamento padrão do navegador
      e.preventDefault();
      // Armazena o evento para uso posterior
      setDeferredPrompt(e);
      setShowInstallDialog(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [shouldSkipInstallPrompt]);

  // Função para mostrar o prompt de instalação
  const showInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      // Evita solicitar instalação se o app já estiver em modo standalone
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setDeferredPrompt(null);
        setShowInstallDialog(false);
        return;
      }

      deferredPrompt.prompt();

      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        console.log('Usuário aceitou instalar o app');
      } else {
        console.log('Usuário recusou instalar o app');
      }
    } catch (err) {
      console.warn('Falha ao exibir o prompt de instalação do PWA', err);
    } finally {
      // O evento só pode ser usado uma vez
      setDeferredPrompt(null);
      setShowInstallDialog(false);
    }
  }, [deferredPrompt]);

  const handleRemindLaterThisSession = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "true");
    setShowInstallDialog(false);
    setDeferredPrompt(null);
  };

  const handleRemindTomorrow = () => {
    snoozeUntilMidnight();
    setShowInstallDialog(false);
    setDeferredPrompt(null);
  };

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const browserLocale = i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("preferredTheme", mode);
  }, [mode]);

  const runHealthCheck = useCallback(async () => {
    if (!backendUrl) {
      setApiStatus("offline");
      setApiErrorMessage("Variável REACT_APP_BACKEND_URL não configurada.");
      return;
    }

    setApiStatus("checking");
    setApiErrorMessage("");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`${backendUrl}/health`, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      window.clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let payload = null;
      if (contentType.includes("application/json")) {
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
      }

      const hasDatabaseError = payload?.database?.status === "error";

      if (!response.ok) {
        if (response.status === 503 && hasDatabaseError) {
          setApiStatus("degraded");
          setApiErrorMessage(payload?.database?.error || "Falha ao conectar no banco de dados.");
          return;
        }
        throw new Error(`Healthcheck retornou status ${response.status}`);
      }

      if (hasDatabaseError) {
        setApiStatus("degraded");
        setApiErrorMessage(payload?.database?.error || "Falha ao conectar no banco de dados.");
        return;
      }

      setApiStatus("online");
      setApiErrorMessage("");
    } catch (error) {
      window.clearTimeout(timeoutId);
      const message =
        error?.name === "AbortError"
          ? "Tempo limite ao verificar o backend (4s)."
          : error?.message || "Falha ao contactar o backend.";
      setApiErrorMessage(message);
      setApiStatus("offline");
    }
  }, [backendUrl]);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    setShowApiStatusDialog(apiStatus !== "online");
  }, [apiStatus]);

  useEffect(() => {
    if (apiStatus !== "online") {
      return;
    }

    console.log("|=========== handleSaveSetting ==========|");
    console.log("APP START");
    console.log("|========================================|");

    getPublicSetting("primaryColorLight")
      .then((color) => {
        setPrimaryColorLight(color || "#2563EB");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("primaryColorDark")
      .then((color) => {
        setPrimaryColorDark(color || "#1E3A8A");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoLight")
      .then((file) => {
        setAppLogoLight(file ? backendUrl + "/public/" + file : defaultLogoLight);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoDark")
      .then((file) => {
        setAppLogoDark(file ? backendUrl + "/public/" + file : defaultLogoDark);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoFavicon")
      .then((file) => {
        setAppLogoFavicon(file ? backendUrl + "/public/" + file : defaultLogoFavicon);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appName")
      .then((name) => {
        setAppName(name || "Taktchat_Flow");
      })
      .catch((error) => {
        console.log("!==== Erro ao carregar temas: ====!", error);
        setAppName("Taktchat_Flow");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiStatus]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primaryColor", mode === "light" ? primaryColorLight : primaryColorDark);
  }, [primaryColorLight, primaryColorDark, mode]);

  useEffect(() => {
    if (apiStatus !== "online") {
      return;
    }
    async function fetchVersionData() {
      try {
        const response = await api.get("/version");
        const { data } = response;
        window.localStorage.setItem("frontendVersion", data.version);
      } catch (error) {
        console.log("Error fetching data", error);
      }
    }
    fetchVersionData();
  }, [apiStatus]);

  return (
    <>
      <Favicon url={appLogoFavicon ? backendUrl + "/public/" + appLogoFavicon : defaultLogoFavicon} />
      <ColorModeContext.Provider value={{ colorMode }}>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <ActiveMenuProvider>
              <div style={{ position: "relative", overflow: "visible", zIndex: 0, minHeight: "100vh" }}>
                {apiStatus === "online" && <Routes />}

                <Dialog
                  open={showApiStatusDialog}
                  aria-labelledby="api-offline-dialog-title"
                  onClose={(_, reason) => {
                    if (reason === "backdropClick") {
                      return;
                    }
                    setShowApiStatusDialog(false);
                  }}
                >
                  <DialogTitle id="api-offline-dialog-title">
                    {apiStatus === "degraded" ? "Banco de Dados indisponível" : "Servidor de API indisponível"}
                  </DialogTitle>
                  <DialogContent>
                    <DialogContentText component="div">
                      {apiStatus === "degraded" ? (
                        <>
                          <Typography gutterBottom>
                            1. Servidor de API acessível em <strong>{backendUrl}</strong> ✅
                          </Typography>
                          <Typography gutterBottom>
                            2. Não foi possível conectar ao servidor de Banco de Dados. Revise as variáveis `DB_HOST`,
                            `DB_PORT`, `DB_USER`, `DB_PASS` e confirme se o Postgres está rodando
                            (<code>docker compose up postgres</code>).
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Após ajustar o banco, clique em “Tentar novamente” para revalidar a conexão.
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography gutterBottom>
                            1. Não foi possível acessar o Servidor de API em <strong>{backendUrl}</strong>. Verifique se o backend está
                            rodando (`npm run dev` ou `docker compose up backend`).
                          </Typography>
                          <Typography gutterBottom>
                            2. Enquanto o servidor não responde, o login e demais recursos permanecem indisponíveis.
                            Inicie o backend e clique em “Tentar novamente”.
                          </Typography>
                        </>
                      )}
                    </DialogContentText>
                    {apiErrorMessage && (
                      <Box mt={2}>
                        <Alert severity="warning">{apiErrorMessage}</Alert>
                      </Box>
                    )}
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={runHealthCheck} color="default" disabled={apiStatus === "checking"}>
                      {apiStatus === "checking" ? (
                        <>
                          <CircularProgress size={18} style={{ marginRight: 8 }} /> Verificando…
                        </>
                      ) : (
                        "Tentar novamente"
                      )}
                    </Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={showInstallDialog && apiStatus === "online"}
                  onClose={(event, reason) => {
                    if (reason === "backdropClick") {
                      return;
                    }
                    handleRemindLaterThisSession();
                  }}
                  aria-labelledby="install-dialog-title"
                >
                  <DialogTitle id="install-dialog-title">Instalar o TaktChat?</DialogTitle>
                  <DialogContent>
                    <DialogContentText component="div">
                      <Typography gutterBottom>
                        Instale o aplicativo para ter uma experiência mais rápida e estável:
                      </Typography>
                      <Box component="ul" pl={3} mb={0}>
                        <li>Atalho direto na área de trabalho/dispositivo;</li>
                        <li>Tela cheia, sem barra do navegador;</li>
                        <li>Notificações mais confiáveis e discretas.</li>
                      </Box>
                      <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
                        Você pode instalar agora ou pedir para lembrar mais tarde. Esse lembrete expira às 00h se você adiar.
                      </Typography>
                    </DialogContentText>
                  </DialogContent>
                  <DialogActions style={{ padding: "0 24px 16px" }}>
                    <Button onClick={handleRemindLaterThisSession} color="default">
                      Perguntar depois
                    </Button>
                    <Button onClick={handleRemindTomorrow} color="secondary">
                      Só amanhã
                    </Button>
                    <Button onClick={showInstallPrompt} color="primary" variant="contained">
                      Instalar agora
                    </Button>
                  </DialogActions>
                </Dialog>
              </div>
            </ActiveMenuProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
};

export default App;
