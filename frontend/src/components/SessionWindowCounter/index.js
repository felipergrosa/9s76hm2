import React, { useState, useEffect, useCallback } from "react";
import { makeStyles, Tooltip, Typography } from "@material-ui/core";
import { Clock as ClockIcon, AlertTriangle as AlertIcon } from "lucide-react";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  container: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: "0.75rem",
    fontWeight: 500,
    fontFamily: "monospace",
  },
  // Cores baseadas no tempo restante
  green: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    color: "#16a34a",
    border: "1px solid rgba(34, 197, 94, 0.3)",
  },
  yellow: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    color: "#ca8a04",
    border: "1px solid rgba(234, 179, 8, 0.3)",
  },
  red: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#dc2626",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    animation: "$pulse 1.5s ease-in-out infinite",
  },
  expired: {
    backgroundColor: "rgba(107, 114, 128, 0.15)",
    color: "#6b7280",
    border: "1px solid rgba(107, 114, 128, 0.3)",
  },
  icon: {
    width: 12,
    height: 12,
  },
  "@keyframes pulse": {
    "0%, 100%": {
      opacity: 1,
    },
    "50%": {
      opacity: 0.6,
    },
  },
}));

/**
 * Componente que exibe o contador de janela de sessão 24h para API Oficial
 * 
 * @param {Object} props
 * @param {number} props.ticketId - ID do ticket
 * @param {string} props.channelType - Tipo de canal (whatsapp, etc)
 * @param {boolean} props.isOfficial - Se a conexão é API Oficial
 * @param {Date|string} props.sessionWindowExpiresAt - Data de expiração da janela (opcional, evita chamada de API)
 * @param {string} props.size - Tamanho do contador: 'small' (lista) ou 'normal' (chat)
 * @param {boolean} props.showTooltip - Mostrar tooltip explicativo
 */
const SessionWindowCounter = ({
  ticketId,
  channelType,
  isOfficial,
  sessionWindowExpiresAt: propExpiresAt,
  size = "small",
  showTooltip = true,
}) => {
  const classes = useStyles();
  const [sessionStatus, setSessionStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Determinar se deve mostrar o contador
  // Só aparece para conexões API Oficial (channelType === "whatsapp" e isOfficial === true)
  const shouldShow = channelType === "whatsapp" && isOfficial === true;

  // Calcular tempo restante baseado na data de expiração
  const calculateRemaining = useCallback((expiresAt) => {
    if (!expiresAt) return null;

    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const remainingMs = Math.max(0, expires - now);

    if (remainingMs <= 0) {
      return {
        expired: true,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalMs: 0,
      };
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      expired: false,
      hours,
      minutes,
      seconds,
      totalMs: remainingMs,
    };
  }, []);

  // Buscar status da janela da API (apenas se não tiver propExpiresAt)
  const fetchSessionStatus = useCallback(async () => {
    if (!ticketId || !shouldShow) return;
    if (propExpiresAt) return; // Se temos a data via prop, não buscar

    setLoading(true);
    try {
      const { data } = await api.get(`/tickets/${ticketId}/session-window`);
      setSessionStatus(data);
    } catch (err) {
      console.error("[SessionWindowCounter] Erro ao buscar status:", err);
      // Não mostrar toast de erro para não poluir a interface
    } finally {
      setLoading(false);
    }
  }, [ticketId, shouldShow, propExpiresAt]);

  // Efeito para buscar dados iniciais
  useEffect(() => {
    if (propExpiresAt) {
      // Se temos a data via prop, usar ela
      const remaining = calculateRemaining(propExpiresAt);
      if (remaining) {
        setSessionStatus({
          hasOpenSession: !remaining.expired,
          sessionWindowExpiresAt: propExpiresAt,
          formatted: remaining.expired
            ? "EXPIRADO"
            : `${String(remaining.hours).padStart(2, "0")}:${String(remaining.minutes).padStart(2, "0")}:${String(remaining.seconds).padStart(2, "0")}`,
          isOfficial: true,
        });
      }
    } else {
      fetchSessionStatus();
    }
  }, [ticketId, propExpiresAt, fetchSessionStatus, calculateRemaining]);

  // Efeito para atualizar o contador a cada segundo
  useEffect(() => {
    if (!sessionStatus?.sessionWindowExpiresAt) return;

    const interval = setInterval(() => {
      const remaining = calculateRemaining(sessionStatus.sessionWindowExpiresAt);
      if (remaining) {
        setSessionStatus((prev) => ({
          ...prev,
          hasOpenSession: !remaining.expired,
          formatted: remaining.expired
            ? "EXPIRADO"
            : `${String(remaining.hours).padStart(2, "0")}:${String(remaining.minutes).padStart(2, "0")}:${String(remaining.seconds).padStart(2, "0")}`,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStatus?.sessionWindowExpiresAt, calculateRemaining]);

  // Não renderizar se não for API Oficial
  if (!shouldShow) return null;

  // Não renderizar se não tiver dados
  if (!sessionStatus) return null;

  // Determinar classe de cor baseada no tempo restante
  const getColorClass = () => {
    if (!sessionStatus.hasOpenSession) return classes.expired;

    const remaining = calculateRemaining(sessionStatus.sessionWindowExpiresAt);
    if (!remaining || remaining.expired) return classes.expired;

    const hours = remaining.hours + remaining.minutes / 60;

    if (hours >= 12) return classes.green; // > 12h: verde
    if (hours >= 4) return classes.yellow; // 4-12h: amarelo
    return classes.red; // < 4h: vermelho (pulsante)
  };

  // Determinar ícone
  const getIcon = () => {
    const remaining = calculateRemaining(sessionStatus.sessionWindowExpiresAt);
    if (!remaining || remaining.expired || remaining.hours < 4) {
      return <AlertIcon className={classes.icon} />;
    }
    return <ClockIcon className={classes.icon} />;
  };

  // Tooltip explicativo
  const getTooltipText = () => {
    if (!sessionStatus.hasOpenSession) {
      return "Janela de 24h expirada. Use template para enviar mensagens.";
    }

    const remaining = calculateRemaining(sessionStatus.sessionWindowExpiresAt);
    if (!remaining) return "";

    const hours = remaining.hours;
    const minutes = remaining.minutes;

    if (hours >= 12) {
      return `Janela de 24h aberta. Restam ${hours}h ${minutes}min para responder gratuitamente.`;
    }
    if (hours >= 4) {
      return `Atenção: Restam apenas ${hours}h ${minutes}min na janela de 24h.`;
    }
    return `URGENTE: Janela fecha em ${hours}h ${minutes}min! Após isso, só é possível enviar templates.`;
  };

  const content = (
    <div className={`${classes.container} ${getColorClass()}`}>
      {getIcon()}
      <span>{sessionStatus.formatted}</span>
    </div>
  );

  if (showTooltip) {
    return (
      <Tooltip title={getTooltipText()} placement="top" arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default SessionWindowCounter;
