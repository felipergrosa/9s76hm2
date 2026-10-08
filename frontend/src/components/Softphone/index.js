/**
 * Softphone — Troncal SIP (referência Fluxoo)
 *
 * Lê a configuração do troncal da empresa via GET /companySipTrunk
 * (backend/src/controllers/CompanySettingsController.ts → showSipTrunk) e
 * monta a config do jssip/react-softphone em runtime — sem credenciais
 * hardcoded.
 *
 * Comportamento:
 * - SIP desabilitado (sipEnabled != "enabled") → ícone "SIP desconectado"
 *   (status visível como no Fluxoo) e NÃO inicializa o jssip.
 * - Habilitado mas sem host/usuário → aviso "Configuração SIP incompleta".
 * - Habilitado e completo → renderiza o widget do softphone.
 *
 * Usuário SIP: usa o ramal do usuário logado (Users.ramal); fallback para
 * sipUser do troncal. Senha: sipPassword do troncal (entregue apenas pelo
 * endpoint autenticado dedicado).
 */
import React, { useEffect, useMemo, useState } from "react";
import ReactSoftPhone from "react-softphone";
import { WebSocketInterface } from "jssip";
import Tooltip from "@material-ui/core/Tooltip";
import PhoneDisabledIcon from "@material-ui/icons/PhoneDisabled";
import { orange } from "@material-ui/core/colors";

import useCompanySettings from "../../hooks/useSettings/companySettings";
import { i18n } from "../../translate/i18n";

// Callbacks de persistência do react-softphone → localStorage
const persistLocal = (key) => (newValue) => {
  try {
    localStorage.setItem(`softphone-${key}`, String(newValue));
  } catch (e) {
    // localStorage indisponível (modo privado etc.) — ignora silenciosamente
  }
  return true;
};

const setConnectOnStartToLocalStorage = persistLocal("connectOnStart");
const setNotifications = persistLocal("notifications");
const setCallVolume = persistLocal("callVolume");
const setRingVolume = persistLocal("ringVolume");

function Softphone() {
  const { getSipTrunk } = useCompanySettings();
  const [sipTrunk, setSipTrunk] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getSipTrunk();
      if (mounted) {
        setSipTrunk(data);
        setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Config jssip montada a partir das settings da empresa.
  const config = useMemo(() => {
    if (!sipTrunk || !sipTrunk.enabled || !sipTrunk.host) return null;

    const domain = sipTrunk.domain || sipTrunk.host;
    // Navegador só suporta SIP sobre WebSocket: "wss" → TLS;
    // udp/tcp do troncal resolvem para ws:// (referência/parity com o Fluxoo).
    const wsScheme = sipTrunk.transport === "wss" ? "wss" : "ws";
    const wsPort = sipTrunk.port || (wsScheme === "wss" ? "8089" : "8088");
    const wsUrl = `${wsScheme}://${sipTrunk.host}:${wsPort}/ws`;
    // Ramal interno do usuário logado tem prioridade sobre o usuário do troncal.
    const username = sipTrunk.ramal || sipTrunk.user;

    if (!username) return null;

    return {
      domain,
      uri: `sip:${username}@${domain}`,
      password: sipTrunk.password,
      ws_servers: wsUrl,
      sockets: [new WebSocketInterface(wsUrl)],
      display_name: sipTrunk.callerId || username,
      session_timers: false,
      register_expires: 600,
      debug: false // nunca habilitar: o debug do jssip vaza credenciais no console
    };
  }, [sipTrunk]);

  // Enquanto carrega ou SIP desabilitado → status "SIP desconectado"
  // (o softphone NÃO é inicializado — sem tentativa de REGISTER).
  if (!loaded || !sipTrunk || !sipTrunk.enabled) {
    if (!loaded) return null;
    return (
      <Tooltip title={i18n.t("settings.settings.sip.statusDisconnected")}>
        <PhoneDisabledIcon fontSize="small" style={{ opacity: 0.6, margin: "0 8px" }} />
      </Tooltip>
    );
  }

  // Habilitado mas configuração incompleta → aviso (não inicializa o jssip).
  if (!config) {
    return (
      <Tooltip title={i18n.t("settings.settings.sip.statusIncomplete")}>
        <PhoneDisabledIcon fontSize="small" style={{ color: orange[700], margin: "0 8px" }} />
      </Tooltip>
    );
  }

  return (
    <div className="SoftPhone">
      <header className="SoftPhone-header">
        <ReactSoftPhone
          callVolume={33} // Volume padrão de chamada
          ringVolume={44} // Volume padrão do ring
          connectOnStart={false} // Conecta ao SIP apenas sob ação do usuário
          notifications={false} // Notificação do navegador em chamada recebida
          config={config} // Config VoIP (montada das settings da empresa)
          setConnectOnStartToLocalStorage={setConnectOnStartToLocalStorage}
          setNotifications={setNotifications}
          setCallVolume={setCallVolume}
          setRingVolume={setRingVolume}
          timelocale={"UTC-3"} // Fuso do histórico de chamadas
        />
      </header>
    </div>
  );
}

export default Softphone;
