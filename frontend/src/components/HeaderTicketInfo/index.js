import React, { useEffect, useState } from "react";
import { CardHeader } from "@material-ui/core";
import ContactAvatar from "../ContactAvatar";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const HeaderTicketInfo = () => {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    const onTicketLoaded = (e) => {
      const t = e?.detail?.ticket;
      const c = e?.detail?.contact;
      if (t && c) {
        setTicket(t);
        setContact(c);
      }
    };
    window.addEventListener('ticket-loaded', onTicketLoaded);
    // Usa dados já carregados, se existirem
    try {
      const lt = window.__lastTicket;
      const lc = window.__lastContact;
      if (lt && lc) {
        setTicket(lt);
        setContact(lc);
      }
    } catch {}
    let mounted = true;
    const fetchData = async () => {
      try {
        if (!ticketId || ticketId === "undefined") return;
        const { data } = await api.get(`/tickets/u/${ticketId}`);
        if (!mounted) return;
        setTicket(data);
        setContact(data?.contact || null);
      } catch (e) {
        // silencioso
      }
    };
    fetchData();
    return () => {
      mounted = false;
      window.removeEventListener('ticket-loaded', onTicketLoaded);
    };
  }, [ticketId]);

  if (!ticket || !contact) return null;

  return (
    <CardHeader
      style={{ cursor: "pointer", flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8 }}
      onClick={() => {
        try { window.dispatchEvent(new Event('open-contact-drawer')); } catch {}
      }}
      titleTypographyProps={{ noWrap: true }}
      subheaderTypographyProps={{ noWrap: true }}
      avatar={<ContactAvatar contact={contact} alt="contact_image" />}
      title={`${contact?.name || "(sem contato)"} #${ticket.id}`}
      subheader={
        ticket?.user && `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
      }
    />
  );
};

export default HeaderTicketInfo;
