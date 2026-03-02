import React, { useEffect, useState, useContext, useRef } from "react";
import { i18n } from "../../translate/i18n";
import { CardHeader } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Tooltip from "@material-ui/core/Tooltip";
import ContactAvatar from "../ContactAvatar";
import SessionWindowCounter from "../SessionWindowCounter";
import api from "../../services/api";
import ConnectionIcon from "../ConnectionIcon";
import { AuthContext } from "../../context/Auth/AuthContext";

const TicketInfo = ({ contact, ticket, onClick }) => {
	const [amount, setAmount] = useState("");
	const { user, socket } = useContext(AuthContext);
	const [presenceStatus, setPresenceStatus] = useState(null); // "composing" | "recording" | null
	const presenceTimerRef = useRef(null);

    const useStyles = makeStyles(() => ({
        avatarContainer: {
            position: 'relative',
            display: 'inline-block',
        },
        channelBadge: {
            position: 'absolute',
            right: -2,
            bottom: -2,
            background: '#fff',
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0,0,0,0.15)'
        },
        channelIconAdjust: {
            position: 'relative',
            top: -1,
        },
        headerContent: {
            minWidth: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
        },
        title: {
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            display: 'block',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.2',
        },
        subheaderRoot: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
        },
        subheaderText: {
            minWidth: 0,
            width: '100%',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.2',
        },
        tagsRow: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 2,
            minHeight: 10,
            flex: 'none',
        },
        tagDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.15)'
        }
    }));

    const classes = useStyles();
    const [tags, setTags] = useState([]);

    const normalizeTags = (raw) => {
        try {
            const arr = Array.isArray(raw) ? raw :
                (Array.isArray(raw?.tags) ? raw.tags :
                    (Array.isArray(raw?.tags?.rows) ? raw.tags.rows :
                        (Array.isArray(raw?.rows) ? raw.rows : [])));
            return arr.map((t, idx) => {
                const obj = t || {};
                const nested = obj.tag || obj.Tag || obj.Tags || {};
                const name = obj.name || nested.name || obj.label || `tag-${idx}`;
                const color = obj.color || nested.color || obj.hex || '#999';
                const id = obj.id || nested.id || idx;
                return { id, name, color };
            });
        } catch {
            return [];
        }
    };

    // Escutar eventos de presença (digitando/gravando) via socket
    useEffect(() => {
        if (!socket || !user?.companyId || !contact?.number) return;

        const handlePresence = (data) => {
            // Verificar se o evento é para este contato/grupo
            const contactJid = contact.isGroup
                ? (contact.number?.includes("@g.us") ? contact.number : `${contact.number}@g.us`)
                : (contact.number?.includes("@") ? contact.number : `${contact.number}@s.whatsapp.net`);

            if (data.chatJid !== contactJid) return;

            if (data.presence === "composing") {
                setPresenceStatus("composing");
            } else if (data.presence === "recording") {
                setPresenceStatus("recording");
            } else {
                setPresenceStatus(null);
            }

            // Auto-limpar após 15s (caso o evento "paused" não chegue)
            if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
            if (data.presence === "composing" || data.presence === "recording") {
                presenceTimerRef.current = setTimeout(() => setPresenceStatus(null), 15000);
            }
        };

        socket.on(`company-${user.companyId}-presence`, handlePresence);
        return () => {
            socket.off(`company-${user.companyId}-presence`, handlePresence);
            if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
        };
    }, [socket, user?.companyId, contact?.number, contact?.isGroup]);

    useEffect(() => {
        let mounted = true;
        const fetchTags = async () => {
            try {
                if (!contact?.id) return;
                const { data } = await api.get(`/contactTags/${contact.id}`);
                if (!mounted) return;
                setTags(normalizeTags(data));
            } catch {}
        };
        // Se já vierem tags no contato, usa-as primeiro
        if (Array.isArray(contact?.tags)) {
            setTags(normalizeTags(contact.tags));
        } else if (Array.isArray(contact?.contactTags)) {
            setTags(normalizeTags(contact.contactTags));
        } else {
            fetchTags();
        }
        return () => { mounted = false };
    }, [contact?.id]);

	const renderCardReader = () => {
		return (
			<CardHeader
				onClick={onClick}
				style={{ cursor: "pointer", flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8, paddingLeft: 4, paddingRight: 4 }}
				classes={{ content: classes.headerContent }}
				titleTypographyProps={{ classes: { root: classes.title } }}
				subheaderTypographyProps={{ component: 'div', classes: { root: classes.subheaderRoot } }}
				avatar={(
                    <div className={classes.avatarContainer}>
                        <ContactAvatar contact={contact} alt="contact_image" />
                        {ticket?.channel && (
                            <div className={classes.channelBadge}>
                                <span className={classes.channelIconAdjust}>
                                    <ConnectionIcon width="12" height="12" connectionType={ticket.channel} />
                                </span>
                            </div>
                        )}
                    </div>
                )}
				title={`${contact?.name || '(sem contato)'} #${ticket.id}`}
				subheader={(
					<div className={classes.subheaderRoot}>
						{presenceStatus ? (
							<span style={{ color: "#25d366", fontSize: 13, fontWeight: 500 }}>
								{presenceStatus === "recording" ? "gravando áudio..." : "digitando..."}
							</span>
						) : (
							<span className={classes.subheaderText}>
								{ticket.user && `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`}
							</span>
						)}
						<div className={classes.tagsRow}>
							{(Array.isArray(tags) ? tags.slice(0, 8) : []).map((tag) => (
								<Tooltip key={tag.id || tag.name} title={tag.name} placement="top">
									<span className={classes.tagDot} style={{ backgroundColor: tag.color || '#999' }} />
								</Tooltip>
							))}
							{/* Contador de janela 24h para API Oficial */}
							{!contact?.isGroup && (
								<SessionWindowCounter
									ticketId={ticket?.id}
									channelType={ticket?.channel}
									isOfficial={ticket?.whatsapp?.channelType === "official"}
									sessionWindowExpiresAt={ticket?.sessionWindowExpiresAt}
									size="normal"
								/>
							)}
						</div>
					</div>
				)}

			/>
		);
	}

	const handleChange = (event) => {
		const value = event.target.value;

		setAmount(value);
	}


	return (
		<React.Fragment>
			{renderCardReader()}
		</React.Fragment>
	);
};

export default TicketInfo;
