import React, { useEffect, useRef, useState } from "react";
import { Button, CircularProgress, Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { WhatsApp as WhatsAppIcon } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

/**
 * Botão "Cadastrar número (Meta)" — WhatsApp Embedded Signup.
 *
 * Abre o popup oficial da Meta (FB.login com config_id + response_type=code),
 * captura waba_id/phone_number_id do evento WA_EMBEDDED_SIGNUP e envia o
 * `code` ao backend (POST /whatsapp/embedded-signup), que troca pelo token
 * e cria a conexão official — o token nunca passa pelo frontend.
 *
 * Envs necessárias (build do frontend):
 *   REACT_APP_META_EMBEDDED_SIGNUP_CONFIG_ID  → Configuration ID do signup
 *   REACT_APP_FACEBOOK_APP_ID (ou REACT_APP_META_APP_ID) → App ID Meta
 */

const META_APP_ID =
  process.env.REACT_APP_META_APP_ID || process.env.REACT_APP_FACEBOOK_APP_ID;
const CONFIG_ID = process.env.REACT_APP_META_EMBEDDED_SIGNUP_CONFIG_ID;
const FB_GRAPH_VERSION = "v19.0";

// Locale do SDK segue o idioma da interface
const sdkLocale = () => {
  const lang = (i18n.language || "pt").split("-")[0].toLowerCase();
  const map = { pt: "pt_BR", es: "es_LA", tr: "tr_TR", en: "en_US" };
  return map[lang] || "pt_BR";
};

// Carrega o SDK do Facebook uma única vez (script async + fbAsyncInit)
let fbSdkPromise = null;
const loadFacebookSdk = () => {
  if (window.FB) return Promise.resolve(window.FB);
  if (fbSdkPromise) return fbSdkPromise;

  fbSdkPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("timeout carregando SDK do Facebook")),
      15000
    );

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: FB_GRAPH_VERSION
      });
      clearTimeout(timeout);
      resolve(window.FB);
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = `https://connect.facebook.net/${sdkLocale()}/sdk.js`;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("falha ao carregar SDK do Facebook"));
      };
      document.body.appendChild(script);
    }
  });

  // Se falhar, permite nova tentativa no próximo clique
  fbSdkPromise.catch(() => {
    fbSdkPromise = null;
  });

  return fbSdkPromise;
};

const useStyles = makeStyles((theme) => ({
  card: {
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.02)",
    border: "1px solid",
    borderColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,0,0,0.08)",
    textAlign: "center",
    marginBottom: theme.spacing(2)
  },
  button: {
    padding: theme.spacing(1.5, 4),
    fontSize: "1rem",
    fontWeight: 600,
    textTransform: "none",
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor: "#25D366",
    color: "#fff",
    "&:hover": { backgroundColor: "#1eb85a" }
  },
  hint: {
    marginTop: theme.spacing(1.5)
  }
}));

const EmbeddedSignupButton = ({ onConnected }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  // Dados do session_info do Embedded Signup (chegam via window.postMessage)
  const sessionInfoRef = useRef(null);

  // A Meta envia o session_info via evento "message" com
  // type === "WA_EMBEDDED_SIGNUP" durante o fluxo do popup
  useEffect(() => {
    const handleMessage = (event) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      try {
        const payload =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (payload?.type === "WA_EMBEDDED_SIGNUP") {
          // FINISH traz phone_number_id e waba_id; demais eventos (CANCEL etc.)
          // não têm dados úteis, mas guardamos o último payload recebido
          sessionInfoRef.current = payload.data || null;
        }
      } catch {
        // payload não-JSON — ignora
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleEmbeddedSignup = async () => {
    // Ambiente sem config → instrui a configurar em vez de abrir popup quebrado
    if (!CONFIG_ID) {
      toast.error(i18n.t("embeddedSignup.configMissing"));
      return;
    }
    if (!META_APP_ID) {
      toast.error(i18n.t("embeddedSignup.appIdMissing"));
      return;
    }

    setLoading(true);
    sessionInfoRef.current = null;

    try {
      await loadFacebookSdk();
    } catch (err) {
      setLoading(false);
      toast.error(i18n.t("embeddedSignup.sdkError"));
      return;
    }

    window.FB.login(
      (response) => {
        // Callback do FB.login roda fora do ciclo do React — finaliza em async
        (async () => {
          try {
            const code = response?.authResponse?.code;
            if (!code) {
              toast.info(i18n.t("embeddedSignup.cancelled"));
              return;
            }

            const wabaId = sessionInfoRef.current?.waba_id;
            const phoneNumberId = sessionInfoRef.current?.phone_number_id;
            if (!wabaId || !phoneNumberId) {
              toast.error(i18n.t("embeddedSignup.noSessionInfo"));
              return;
            }

            const { data } = await api.post("/whatsapp/embedded-signup", {
              code,
              wabaId,
              phoneNumberId
            });

            toast.success(i18n.t("embeddedSignup.success"));
            // Conexão já criada no backend — o modal pode ser fechado
            if (onConnected) onConnected(data?.whatsapp);
          } catch (err) {
            toastError(err);
          } finally {
            setLoading(false);
          }
        })();
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3"
        }
      }
    );
  };

  return (
    <Box className={classes.card}>
      <Button
        variant="contained"
        className={classes.button}
        onClick={handleEmbeddedSignup}
        disabled={loading}
        startIcon={
          loading ? <CircularProgress size={18} color="inherit" /> : <WhatsAppIcon />
        }
      >
        {loading
          ? i18n.t("embeddedSignup.loading")
          : i18n.t("embeddedSignup.button")}
      </Button>
      <Typography variant="body2" color="textSecondary" className={classes.hint}>
        {i18n.t("embeddedSignup.hint")}
      </Typography>
    </Box>
  );
};

export default EmbeddedSignupButton;
