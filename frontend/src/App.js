import React, { useState, useEffect, useMemo } from "react";
import api from "./services/api";
import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { ActiveMenuProvider } from "./context/ActiveMenuContext";
import Favicon from "react-favicon";
import { getBackendUrl } from "./config";
import Routes from "./routes";
import defaultLogoLight from "./assets/logo.png";
import defaultLogoDark from "./assets/logo-black.png";
import defaultLogoFavicon from "./assets/favicon.ico";
import useSettings from "./hooks/useSettings";
import ConnectionLostModal from "./components/ConnectionLostModal";

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
  const [appLogoLight, setAppLogoLight] = useState(defaultLogoLight);
  const [appLogoDark, setAppLogoDark] = useState(defaultLogoDark);
  const [appLogoFavicon, setAppLogoFavicon] = useState(defaultLogoFavicon);
  const [appName, setAppName] = useState(appNameLocalStorage);
  const { getPublicSetting } = useSettings();
  // Estado para controlar o prompt de instalação do PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  // Modal de desconexão do WhatsApp
  const [waConnLost, setWaConnLost] = useState({ open: false, data: null });
  const [viewMode, setViewMode] = useState("classic");

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
      setViewMode,
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      mode,
      viewMode,
    }),
    [appLogoLight, appLogoDark, appLogoFavicon, appName, mode, viewMode]
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
          // Overrides globais para modernizar todos os modais Material-UI
          overrides: {
            MuiDialog: {
              paper: {
                borderRadius: 16,
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                // Esconde scrollbar no paper do Dialog
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                "&::-webkit-scrollbar": {
                  display: "none",
                  width: 0,
                  height: 0,
                },
              },
              scrollPaper: {
                // Esconde scrollbar no container de scroll
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                "&::-webkit-scrollbar": {
                  display: "none",
                  width: 0,
                  height: 0,
                },
              },
              container: {
                // Esconde scrollbar no container externo
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                "&::-webkit-scrollbar": {
                  display: "none",
                  width: 0,
                  height: 0,
                },
              },
            },
            MuiDialogTitle: {
              root: {
                backgroundColor: mode === "light" ? primaryColorLight : primaryColorDark,
                color: "#fff",
                padding: "16px 24px",
                "& .MuiTypography-root": {
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  color: "#fff",
                },
                // Tabs dentro do DialogTitle devem ter texto branco
                "& .MuiTabs-root": {
                  "& .MuiTab-root": {
                    color: "rgba(255, 255, 255, 0.7)",
                    "&.Mui-selected": {
                      color: "#fff",
                    },
                    "&:hover": {
                      color: "#fff",
                    },
                  },
                  "& .MuiTabs-indicator": {
                    backgroundColor: "#fff",
                  },
                },
                // Qualquer texto dentro deve ser branco
                "& .MuiTab-wrapper": {
                  color: "inherit",
                },
              },
            },
            MuiDialogContent: {
              root: {
                padding: "20px 24px",
                // Esconde scrollbar mas mantém funcionalidade de scroll
                scrollbarWidth: "none", // Firefox
                msOverflowStyle: "none", // IE/Edge
                "&::-webkit-scrollbar": {
                  display: "none", // Chrome/Safari/Opera
                  width: 0,
                  height: 0,
                },
              },
              dividers: {
                borderTop: "none",
                borderBottom: mode === "light" ? "1px solid #eee" : "1px solid #444",
              },
            },
            MuiDialogActions: {
              root: {
                padding: "12px 24px 20px",
                gap: 8,
              },
            },
            MuiButton: {
              root: {
                borderRadius: 8,
                textTransform: "none",
                fontWeight: 500,
                padding: "8px 16px",
              },
              containedPrimary: {
                boxShadow: "none",
                "&:hover": {
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                },
              },
            },
            // Fix para tabs em modais - garante contraste de cor
            MuiTabs: {
              root: {
                minHeight: 40,
              },
              indicator: {
                backgroundColor: mode === "light" ? primaryColorLight : primaryColorDark,
                height: 3,
                borderRadius: 2,
              },
            },
            MuiTab: {
              root: {
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.9rem",
                minHeight: 40,
                padding: "8px 16px",
                color: mode === "light" ? "#333" : "#ddd",
                "&$selected": {
                  color: mode === "light" ? primaryColorLight : primaryColorDark,
                  fontWeight: 600,
                },
                "&:hover": {
                  color: mode === "light" ? primaryColorLight : primaryColorDark,
                  opacity: 1,
                },
              },
              textColorPrimary: {
                color: mode === "light" ? "#555" : "#ccc",
                "&$selected": {
                  color: mode === "light" ? primaryColorLight : primaryColorDark,
                },
              },
              textColorInherit: {
                color: mode === "light" ? "#333" : "#eee",
                opacity: 0.8,
                "&$selected": {
                  opacity: 1,
                },
              },
            },
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
      // Previne o comportamento padrão do navegador
      e.preventDefault();
      // Armazena o evento para uso posterior
      setDeferredPrompt(e);

      // Mostra o prompt de instalação imediatamente
      setTimeout(() => {
        showInstallPrompt();
      }, 2000); // Pequeno delay para garantir que a página já carregou
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Função para mostrar o prompt de instalação
  const showInstallPrompt = () => {
    if (deferredPrompt) {
      // Verifica se o PWA já está instalado
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        // Mostra o prompt de instalação
        deferredPrompt.prompt();

        // Espera pela resposta do usuário
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('Usuário aceitou instalar o app');
          } else {
            console.log('Usuário recusou instalar o app');
          }
          // Limpa o prompt armazenado, só pode ser usado uma vez
          setDeferredPrompt(null);
        });
      }
    }
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

  useEffect(() => {
    console.log("|=========== handleSaveSetting ==========|")
    console.log("APP START")
    console.log("|========================================|")


    getPublicSetting("primaryColorLight")
      .then((color) => {
        setPrimaryColorLight(color || "#0000FF");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("primaryColorDark")
      .then((color) => {
        setPrimaryColorDark(color || "#39ACE7");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoLight")
      .then((file) => {
        setAppLogoLight(file ? getBackendUrl() + "/public/" + file : defaultLogoLight);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoDark")
      .then((file) => {
        setAppLogoDark(file ? getBackendUrl() + "/public/" + file : defaultLogoDark);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoFavicon")
      .then((file) => {
        setAppLogoFavicon(file ? getBackendUrl() + "/public/" + file : defaultLogoFavicon);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appName")
      .then((name) => {
        setAppName(name || "Whaticket_Flow");
      })
      .catch((error) => {
        console.log("!==== Erro ao carregar temas: ====!", error);
        setAppName("Whaticket_Flow");
      });

    getPublicSetting("viewMode")
      .then((view) => {
        setViewMode(view || "classic");
      })
      .catch((error) => {
        console.log("Error reading setting viewMode", error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = mode === "light" ? primaryColorLight : primaryColorDark;
    root.style.setProperty("--primaryColor", primaryColor);

    if (viewMode === "modern") {
      root.classList.add("modern-ui");
      // Injeta variáveis CSS para o tema moderno
      root.style.setProperty("--primary-color", primaryColor);

      // Calcula um glow suave baseado na cor escolhida
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
      };

      const rgb = hexToRgb(primaryColor);
      if (rgb) {
        root.style.setProperty("--primary-glow", `rgba(${rgb}, 0.15)`);
        root.style.setProperty("--primary-bg-fade", `rgba(${rgb}, 0.05)`);
        root.style.setProperty("--primary-color-rgb", rgb);
      }
    } else {
      root.classList.remove("modern-ui");
    }
  }, [primaryColorLight, primaryColorDark, mode, viewMode]);

  useEffect(() => {
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
  }, []);

  // Listener global para desconexão do WhatsApp (evento emitido pelo SocketWorker)
  useEffect(() => {
    const handler = (evt) => {
      const detail = evt?.detail || {};
      setWaConnLost({ open: true, data: detail });
    };
    window.addEventListener("wa-conn-lost", handler);
    return () => window.removeEventListener("wa-conn-lost", handler);
  }, []);

  const handleCloseWaModal = () => setWaConnLost({ open: false, data: null });

  return (
    <>
      <Favicon url={appLogoFavicon ? getBackendUrl() + "/public/" + appLogoFavicon : defaultLogoFavicon} />
      <ColorModeContext.Provider value={{ colorMode }}>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <ActiveMenuProvider>
              <div style={{ position: "relative", overflow: "visible", zIndex: 0, minHeight: "100vh" }}>
                <Routes />
                <ConnectionLostModal open={waConnLost.open} data={waConnLost.data} onClose={handleCloseWaModal} />
              </div>
            </ActiveMenuProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
};

export default App;
