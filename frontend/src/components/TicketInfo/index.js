import React, { useEffect, useState } from "react";
import { i18n } from "../../translate/i18n";
import { CardHeader } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Tooltip from "@material-ui/core/Tooltip";
import ContactAvatar from "../ContactAvatar";
import api from "../../services/api";
import ConnectionIcon from "../ConnectionIcon";

const TicketInfo = ({ contact, ticket, onClick }) => {
	const [amount, setAmount] = useState("");

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
            overflow: 'hidden',
            minWidth: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
        },
        title: {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            display: 'block',
        },
        subheaderRoot: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflow: 'hidden',
        },
        subheaderText: {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            width: '100%',
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
				titleTypographyProps={{ noWrap: true, classes: { root: classes.title } }}
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
						<span className={classes.subheaderText}>
							{ticket.user && `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`}
						</span>
						<div className={classes.tagsRow}>
							{(Array.isArray(tags) ? tags.slice(0, 8) : []).map((tag) => (
								<Tooltip key={tag.id || tag.name} title={tag.name} placement="top">
									<span className={classes.tagDot} style={{ backgroundColor: tag.color || '#999' }} />
								</Tooltip>
							))}
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
