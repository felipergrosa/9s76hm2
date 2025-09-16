import React, { useEffect, useState } from "react";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";

// Header completo (Voltar + Avatar/infos + Ações) para ser exibido no topo da página TicketsAdvanced
const ExternalTicketHeader = () => {
  const { ticketId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [ticket, setTicket] = useState(null);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const setFrom = (t, c) => {
      if (!mounted) return;
      if (t && c) {
        setTicket(t);
        setContact(c);
        setLoading(false);
      }
    };

    const onTicketLoaded = (e) => {
      const t = e?.detail?.ticket;
      const c = e?.detail?.contact;
      setFrom(t, c);
    };

    // Usa dados já carregados imediatamente, se existirem
    try {
      const lt = window.__lastTicket;
      const lc = window.__lastContact;
      if (lt && lc) setFrom(lt, lc);
    } catch {}

    window.addEventListener("ticket-loaded", onTicketLoaded);

    // Fallback: busca por UUID se ainda não tem dados
    const fetchData = async () => {
      try {
        if (!ticketId || ticketId === "undefined") {
          setLoading(false);
          return;
        }
        const { data } = await api.get(`/tickets/u/${ticketId}`);
        setFrom(data, data?.contact || null);
      } catch {
        setLoading(false);
      }
    };

    if (!ticket || !contact) fetchData();

    return () => {
      mounted = false;
      window.removeEventListener("ticket-loaded", onTicketLoaded);
    };
  }, [ticketId]);

  // Ativa/desativa o header externo conforme dados disponíveis
  useEffect(() => {
    const active = !!(ticket && contact);
    try {
      window.__externalHeaderActive = active;
      window.dispatchEvent(new CustomEvent("external-header-toggle", { detail: { active } }));
    } catch {}
  }, [ticket, contact]);

  if (!ticket || !contact) return null;

  return (
    <TicketHeader loading={loading}>
      {/* Wrapper das partes 2 (título) e 3 (ações) em GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          width: '100%',
          minWidth: 0,
          gap: 0,
        }}
      >
        {/* Parte 2: título truncável ocupando o espaço restante */}
        <div
          id="TicketHeader"
          style={{ minWidth: 0, overflow: 'hidden', width: '100%' }}
        >
          <TicketInfo
            contact={contact}
            ticket={ticket}
            onClick={() => {
              try { window.dispatchEvent(new Event('open-contact-drawer')); } catch {}
            }}
          />
        </div>
        {/* Parte 3: ações fixas encostadas à direita */}
        <div style={{ minWidth: 80, display: 'flex', justifyContent: 'flex-end' }}>
          <TicketActionButtons ticket={ticket} />
        </div>
      </div>
    </TicketHeader>
  );
};

export default ExternalTicketHeader;
