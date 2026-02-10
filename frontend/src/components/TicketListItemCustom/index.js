import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { parseISO, format, isSameDay, isYesterday } from "date-fns";
import clsx from "clsx";
import { useHistory, useParams } from "react-router-dom";

import {
    ListItem,
    ListItemText,
    ListItemAvatar,
    Typography,
    Divider,
    Badge,
    ListItemSecondaryAction,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Paper,
    Tooltip
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { green, grey } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

import ContactTag from "../ContactTag";
import ContactAvatar from "../ContactAvatar";
import { v4 as uuidv4 } from "uuid";

import {
    Users as GroupIcon,
    Check as Done,
    XCircle as HighlightOff,
    RotateCcw as Replay,
    ArrowLeftRight as SwapHoriz,
    Eye as VisibilityIcon,
    X as CloseIcon,
    MessageSquare as MessageIcon,
} from "lucide-react";

import ConnectionIcon from "../ConnectionIcon";
import AcceptTicketWithouSelectQueue from "../AcceptTicketWithoutQueueModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import ShowTicketOpen from "../ShowTicketOpenModal";
import { isNil } from "lodash";
import { toast } from "react-toastify";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { blue } from "@material-ui/core/colors";

const useStyles = makeStyles((theme) => ({
    ticket: {
        position: "relative"
    },

    pendingTicket: {
        cursor: "unset",
    },
    queueTag: {
        background: "#FCFCFC",
        color: "#000",
        marginRight: 1,
        padding: 1,
        fontWeight: 'bold',
        borderRadius: 3,
        fontSize: "0.5em",
        whiteSpace: "nowrap"
    },
    noTicketsDiv: {
        display: "flex",
        height: "100px",
        margin: 40,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    newMessagesCount: {
        justifySelf: "flex-end",
        textAlign: "right",
        position: "relative",
        top: 0,
        color: "green",
        fontWeight: "bold",
        marginRight: "10px",
        borderRadius: 0,
    },

    unreadBelowDate: {
        marginTop: 8,
    },
    noTicketsText: {
        textAlign: "center",
        color: "rgb(146, 104, 104)",
        fontSize: "14px",
        lineHeight: "1.4",
    },
    connectionTag: {
        background: "green",
        color: "#FFF",
        marginRight: 1,
        padding: "1px 5px",
        fontWeight: 'bold',
        borderRadius: 4,
        fontSize: "0.7em",
    },
    noTicketsTitle: {
        textAlign: "center",
        fontSize: "16px",
        fontWeight: "600",
        margin: "0px",
    },

    contactNameWrapper: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginLeft: "5px",
        fontWeight: "bold",
        color: theme.mode === 'light' ? "black" : "white",
        minWidth: 0,
        paddingRight: 60,
    },
    contactNameText: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },

    lastMessageTime: {
        justifySelf: "flex-end",
        textAlign: "right",
        position: "relative",
        top: 0,
        marginRight: "1px",
        color: theme.mode === 'light' ? "black" : grey[400],
        fontSize: 11,
    },

    rightMetaAction: {
        top: 10,
        transform: "none",
        right: 8,
    },

    rightSideMeta: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        gap: 1,
        position: "relative",
    },

    unreadPlaceholder: {
        visibility: "hidden",
    },

    rightBadgeDummy: {
        width: 1,
        height: 1,
        display: "inline-block",
    },

    secondaryContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
        minWidth: 0,
        paddingRight: 110,
        overflow: "hidden",
    },

    pillsRow: {
        display: "flex",
        flexWrap: "wrap",
        flexDirection: "row",
        alignItems: "center",
        alignContent: "flex-start",
        gap: 1,
        marginLeft: "5px",
        marginTop: 2,
        maxWidth: "100%",
        minHeight: 18,
        "& > *": {
            flex: "0 0 auto",
            maxWidth: "100%"
        }
    },

    lastMessageTimeUnread: {
        justifySelf: "flex-end",
        textAlign: "right",
        position: "relative",
        top: -5,
        color: "green",
        fontWeight: "bold",
        marginRight: "1px",
        fontSize: 10,
    },

    closedBadge: {
        alignSelf: "center",
        justifySelf: "flex-end",
        marginRight: 32,
        marginLeft: "auto",
    },

    contactLastMessage: {
        paddingRight: "0%",
        marginLeft: "5px",
        color: theme.mode === 'light' ? "black" : grey[400],
        display: "block",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },

    contactLastMessageUnread: {
        paddingRight: 20,
        fontWeight: "bold",
        color: theme.mode === 'light' ? "black" : grey[400],
        display: "block",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },

    badgeStyle: {
        color: "white",
        backgroundColor: green[500],
    },

    acceptButton: {
        position: "absolute",
        right: "1px",
    },

    ticketQueueColor: {
        flex: "none",
        height: "100%",
        position: "absolute",
        top: "0%",
        left: "0%",
    },

    avatarContainer: {
        position: 'relative',
        width: 50,
        height: 50,
    },
    channelBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        background: '#fff',
        borderRadius: '50%',
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(0,0,0,0.15)'
    },
    channelIconAdjust: {
        position: 'relative',
        top: -3,
    },

    ticketInfo: {
        position: "relative",
        top: -13
    },
    secondaryContentSecond: {
        display: 'flex',
        alignItems: "center",
        flexWrap: "nowrap",
        flexDirection: "row",
        alignContent: "center",
        gap: theme.spacing(0.5),
    },
    ticketInfo1: {
        position: "relative",
        top: 13,
        right: 0
    },
    ticketActionButtons: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.25),
        position: 'absolute !important',
        bottom: "8px !important",
        right: "8px !important",
        top: "auto !important",
        left: "auto !important",
        zIndex: 999,
    },
    actionButton: {
        minWidth: 24,
        minHeight: 24,
        padding: 2,
    },
    Radiusdot: {
        "& .MuiBadge-badge": {
            borderRadius: 2,
            position: "inherit",
            height: 16,
            margin: 2,
            padding: 3
        },
        "& .MuiBadge-anchorOriginTopRightRectangle": {
            transform: "scale(1) translate(0%, -40%)",
        },
    },
    connectionIcon: {
        marginRight: theme.spacing(1)
    },
    dialogTitle: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: theme.palette.primary.main,
        color: "white",
        paddingBottom: theme.spacing(1),
    },
    closeButton: {
        color: "white",
    },
    messagesContainer: {
        height: "60vh", // Use viewport height instead of fixed pixels
        maxHeight: "600px", // Set a maximum height
        overflowY: "auto",
        padding: theme.spacing(2),
        scrollBehavior: "smooth", // Add smooth scrolling
    },
    scrollToBottomBtn: {
        position: "absolute",
        bottom: theme.spacing(2),
        right: theme.spacing(2),
        zIndex: 1000,
        backgroundColor: theme.palette.primary.main,
        color: "white",
        "&:hover": {
            backgroundColor: theme.palette.primary.dark,
        },
    },
    messageItem: {
        padding: theme.spacing(1),
        margin: theme.spacing(1, 0),
        borderRadius: theme.spacing(1),
        maxWidth: "80%",
        position: "relative",
    },
    fromMe: {
        backgroundColor: "#dcf8c6",
        marginLeft: "auto",
    },
    fromThem: {
        backgroundColor: "#f5f5f5",
    },
    messageTime: {
        fontSize: "0.75rem",
        color: grey[500],
        position: "absolute",
        bottom: "2px",
        right: "8px",
    },
    messageText: {
        marginBottom: theme.spacing(2),
        wordBreak: "break-word",
    },
    emptyMessages: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: grey[500],
    },
    messagesHeader: {
        display: "flex",
        alignItems: "center",
        padding: theme.spacing(1, 2),
        backgroundColor: theme.palette.grey[100],
    },
    messageAvatar: {
        marginRight: theme.spacing(1),
    },
    messageIcon: {
        marginRight: theme.spacing(1),
        color: theme.palette.primary.main,
    },
    loadingMessages: {
        display: "flex",
        justifyContent: "center",
        padding: theme.spacing(3),
    }
}));

const TicketListItemCustom = ({ setTabOpen, ticket }) => {
    const classes = useStyles();
    const theme = useTheme();
    const history = useHistory();
    const [loading, setLoading] = useState(false);
    const [acceptTicketWithouSelectQueueOpen, setAcceptTicketWithouSelectQueueOpen] = useState(false);
    const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);

    const [openAlert, setOpenAlert] = useState(false);
    const [userTicketOpen, setUserTicketOpen] = useState("");
    const [queueTicketOpen, setQueueTicketOpen] = useState("");
    const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);

    // New states for the ticket messages
    const [ticketMessages, setTicketMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const { ticketId } = useParams();
    const isMounted = useRef(true);
    const { setCurrentTicket } = useContext(TicketsContext);
    const { user } = useContext(AuthContext);

    const { get: getSetting } = useCompanySettings();

    useEffect(() => {
        console.log("======== TicketListItemCustom ===========")
        console.log(ticket)
        console.log("=========================================")
    }, [ticket]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleOpenAcceptTicketWithouSelectQueue = useCallback(() => {
        setAcceptTicketWithouSelectQueueOpen(true);
    }, []);

    const handleCloseTicket = async (id) => {
        // Se for grupo, apenas navega para /tickets sem tentar fechar
        if (ticket.isGroup) {
            history.push(`/tickets/`);
            return;
        }
        
        const setting = await getSetting(
            {
                "column": "requiredTag"
            }
        );

        if (setting.requiredTag === "enabled") {
            //verificar se tem uma tag   
            try {
                const contactTags = await api.get(`/contactTags/${ticket.contact.id}`);
                if (!contactTags.data.tags) {
                    toast.warning(i18n.t("messagesList.header.buttons.requiredTag"))
                } else {
                    await api.put(`/tickets/${id}`, {
                        status: "closed",
                        userId: user?.id || null,
                    });

                    if (isMounted.current) {
                        setLoading(false);
                    }

                    history.push(`/tickets/`);
                }
            } catch (err) {
                setLoading(false);
                toastError(err);
            }
        } else {
            setLoading(true);
            try {
                await api.put(`/tickets/${id}`, {
                    status: "closed",
                    userId: user?.id || null,
                });

            } catch (err) {
                setLoading(false);
                toastError(err);
            }
            if (isMounted.current) {
                setLoading(false);
            }

            history.push(`/tickets/`);
        }
    };

    const handleCloseIgnoreTicket = async (id) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${id}`, {
                status: "closed",
                userId: user?.id || null,
                sendFarewellMessage: false,
                amountUsedBotQueues: 0
            });

        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }

        history.push(`/tickets/`);
    };

    const truncate = (str, len) => {
        if (!isNil(str)) {
            if (str.length > len) {
                return str.substring(0, len) + "...";
            }
            return str;
        }
    };

    const handleCloseTransferTicketModal = useCallback(() => {
        if (isMounted.current) {
            setTransferTicketModalOpen(false);
        }
    }, []);

    const handleOpenTransferModal = (e) => {
        e.stopPropagation();
        setTransferTicketModalOpen(true);
    }

    const handleAcepptTicket = async (id) => {
        setLoading(true);
        try {
            const otherTicket = await api.put(`/tickets/${id}`, ({
                status: ticket.isGroup && ticket.channel === 'whatsapp' ? "group" : "open",
                userId: user?.id,
            }));

            if (otherTicket.data.id !== ticket.id) {
                // Verificar se posso acessar: meu ticket ou de usuário que gerencio
                const managedIds = (user?.managedUserIds || []).map(id => Number(id));
                const canAccess = otherTicket.data.userId === user?.id || 
                                  user?.profile === "admin" || 
                                  user?.super ||
                                  managedIds.includes(Number(otherTicket.data.userId));
                
                if (!canAccess) {
                    setOpenAlert(true);
                    setUserTicketOpen(otherTicket.data.user?.name || "");
                    setQueueTicketOpen(otherTicket.data.queue?.name || "");
                } else {
                    setLoading(false);
                    setTabOpen(ticket.isGroup ? "group" : "open");
                    handleSelectTicket(otherTicket.data);
                    history.push(`/tickets/${otherTicket.uuid}`);
                }
            } else {
                let setting;

                try {
                    setting = await getSetting({
                        "column": "sendGreetingAccepted"
                    });
                } catch (err) {
                    toastError(err);
                }

                if (setting.sendGreetingAccepted === "enabled" && (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")) {
                    handleSendMessage(ticket.id);
                }
                if (isMounted.current) {
                    setLoading(false);
                }

                setTabOpen(ticket.isGroup ? "group" : "open");
                handleSelectTicket(ticket);
                history.push(`/tickets/${ticket.uuid}`);
            }
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
    };

    const handleSendMessage = async (id) => {
        let setting;

        try {
            setting = await getSetting({
                "column": "greetingAcceptedMessage"
            })
        } catch (err) {
            toastError(err);
        }

        const msg = `${setting.greetingAcceptedMessage}`;
        const message = {
            read: 1,
            fromMe: true,
            mediaUrl: "",
            body: `${msg.trim()}`,
        };
        try {
            await api.post(`/messages/${id}`, message);
        } catch (err) {
            toastError(err);
        }
    };

    const handleCloseAlert = useCallback(() => {
        setOpenAlert(false);
        setLoading(false);
    }, []);

    const handleSelectTicket = (ticket) => {
        const code = uuidv4();
        const { id, uuid } = ticket;
        setCurrentTicket({ id, uuid, code });
    };

    // Function to fetch messages for the ticket
    const fetchTicketMessages = async (ticketId) => {
        if (!ticketId) return;

        setLoadingMessages(true);
        try {
            const { data } = await api.get(`/messages/${ticketId}`);
            if (isMounted.current) {
                setTicketMessages(data.messages);
            }
        } catch (err) {
            toastError(err);
        } finally {
            setLoadingMessages(false);
        }
    };

    // Handle opening the message dialog
    const handleOpenMessageDialog = (e) => {
        e.stopPropagation();
        setOpenTicketMessageDialog(true);
        fetchTicketMessages(ticket.id);
    };

    return (
        <React.Fragment key={ticket.id}>
            {openAlert && (
                <ShowTicketOpen
                    isOpen={openAlert}
                    handleClose={handleCloseAlert}
                    user={userTicketOpen}
                    queue={queueTicketOpen}
                />
            )}
            {acceptTicketWithouSelectQueueOpen && (
                <AcceptTicketWithouSelectQueue
                    modalOpen={acceptTicketWithouSelectQueueOpen}
                    onClose={(e) => setAcceptTicketWithouSelectQueueOpen(false)}
                    ticketId={ticket.id}
                    ticket={ticket}
                />
            )}
            {transferTicketModalOpen && (
                <TransferTicketModalCustom
                    modalOpen={transferTicketModalOpen}
                    onClose={handleCloseTransferTicketModal}
                    ticketid={ticket.id}
                    ticket={ticket}
                />
            )}

            {/* Improved Message Dialog */}
            <Dialog
                open={openTicketMessageDialog}
                onClose={() => setOpenTicketMessageDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle disableTypography className={classes.dialogTitle}>
                    <Typography variant="h6">
                        Espiando a conversa
                    </Typography>
                    <IconButton
                        aria-label="close"
                        className={classes.closeButton}
                        onClick={() => setOpenTicketMessageDialog(false)}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <div className={classes.messagesHeader}>
                    <ContactAvatar
                        contact={ticket?.contact}
                        className={classes.messageAvatar}
                    />
                    <div>
                        <Typography variant="subtitle1">
                            {ticket.contact?.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                            {ticket.whatsapp?.name || ticket.channel}
                        </Typography>
                    </div>
                </div>

                <Divider />

                <DialogContent className={classes.messagesContainer}>
                    {loadingMessages ? (
                        <div className={classes.loadingMessages}>
                            <Typography>Carregando mensagens...</Typography>
                        </div>
                    ) : ticketMessages.length === 0 ? (
                        <div className={classes.emptyMessages}>
                            <MessageIcon fontSize="large" />
                            <Typography variant="body1">
                                {i18n.t("ticketsList.noMessages")}
                            </Typography>
                        </div>
                    ) : (
                        ticketMessages.map((message) => (
                            <Paper
                                key={message.id}
                                className={clsx(
                                    classes.messageItem,
                                    message.fromMe ? classes.fromMe : classes.fromThem
                                )}
                                elevation={0}
                            >
                                <Typography className={classes.messageText}>
                                    {message.body.includes('data:image/png;base64') ? (
                                        <MarkdownWrapper>Localização</MarkdownWrapper>
                                    ) : message.body.includes('BEGIN:VCARD') ? (
                                        <MarkdownWrapper>Contato</MarkdownWrapper>
                                    ) : message.body.includes('fb.me') ? (
                                        <MarkdownWrapper>Clique de Anúncio</MarkdownWrapper>
                                    ) : (
                                        <MarkdownWrapper>{message.body}</MarkdownWrapper>
                                    )}
                                </Typography>
                                <Typography variant="caption" className={classes.messageTime}>
                                    {format(parseISO(message.createdAt), "HH:mm")}
                                </Typography>
                            </Paper>
                        ))
                    )}
                </DialogContent>
            </Dialog>

            <ListItem
                button
                dense
                onClick={(e) => {
                    console.log('e', e)
                    const isCheckboxClicked = (e.target.tagName.toLowerCase() === 'input' && e.target.type === 'checkbox')
                        || (e.target.tagName.toLowerCase() === 'svg' && e.target.type === undefined)
                        || (e.target.tagName.toLowerCase() === 'path' && e.target.type === undefined);
                    // Se o clique foi no Checkbox, não execute handleSelectTicket

                    if (isCheckboxClicked) return;

                    handleSelectTicket(ticket);
                }}
                selected={ticketId && ticketId === ticket.uuid}
                className={clsx(classes.ticket, "ticket-list-item-core", {
                    [classes.pendingTicket]: ticket.status === "pending",
                })}
                style={{
                    position: "relative",
                    paddingBottom: theme.spacing(2.5), // espaço para os botões no rodapé
                }}
            >
                <ListItemAvatar style={{ marginLeft: "-10px" }}>
                    <div className={classes.avatarContainer}>
                        <ContactAvatar
                            contact={ticket?.contact}
                            style={{ width: 50, height: 50 }}
                        />
                        {ticket.channel && (
                            <div className={classes.channelBadge}>
                                <div className={classes.channelIconAdjust}>
                                    <ConnectionIcon width="14" height="14" connectionType={ticket.channel} />
                                </div>
                            </div>
                        )}
                    </div>
                </ListItemAvatar>
                <ListItemText
                    disableTypography
                    primary={
                        <div className={classes.contactNameWrapper}>
                            {ticket.isGroup && ticket.channel === "whatsapp" && (
                                <GroupIcon fontSize="small" style={{ color: grey[700], marginBottom: '-1px' }} />
                            )}
                            <Typography
                                noWrap
                                component="span"
                                variant="body2"
                                className={classes.contactNameText}
                            >
                                {ticket.contact?.name}
                            </Typography>
                        </div>
                    }
                    secondary={
                        <span className={classes.secondaryContainer}>
                            <Typography
                                className={Number(ticket.unreadMessages) > 0 ? classes.contactLastMessageUnread : classes.contactLastMessage}
                                noWrap
                                component="span"
                                variant="body2"
                            >
                                {ticket.lastMessage ? (
                                    <>
                                        {ticket.lastMessage.includes('fb.me') ? (
                                            <MarkdownWrapper>Clique de Anúncio</MarkdownWrapper> //Clique de Anúncio adicionado
                                        ) : ticket.lastMessage.includes('data:image/png;base64') ?
                                            <MarkdownWrapper>Localização</MarkdownWrapper> :
                                            <> {ticket.lastMessage.includes('BEGIN:VCARD') ?
                                                <MarkdownWrapper>Contato</MarkdownWrapper> :
                                                <MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>}
                                            </>
                                        }
                                    </>
                                ) : (
                                    <br />
                                )}
                            </Typography>

                            <span className={classes.pillsRow}>
                                {ticket?.whatsapp ? (
                                    <Badge
                                        className={classes.connectionTag}
                                        style={{
                                            backgroundColor:
                                                ticket.channel === "whatsapp"
                                                    ? "#25D366"
                                                    : ticket.channel === "facebook"
                                                        ? "#4267B2"
                                                        : "#E1306C"
                                        }}
                                    >
                                        {ticket.whatsapp?.name.toUpperCase()}
                                    </Badge>
                                ) : null}

                                {/* Badge de fila - não exibe para grupos */}
                                {!ticket.isGroup && (
                                    <Badge style={{ backgroundColor: ticket.queue?.color || "#7c7c7c" }} className={classes.connectionTag}>
                                        {ticket.queueId ? ticket.queue?.name.toUpperCase() : ticket.status === "lgpd" ? "LGPD" : "SEM FILA"}
                                    </Badge>
                                )}

                                {ticket?.user && (
                                    <Badge style={{ backgroundColor: "#000000" }} className={classes.connectionTag}>
                                        {ticket.user?.name.toUpperCase()}
                                    </Badge>
                                )}

                                {ticket.tags?.map((tag) => (
                                    <ContactTag tag={tag} key={`ticket-contact-tag-${ticket.id}-${tag.id}`} />
                                ))}
                            </span>
                        </span>
                    }
                />
                <ListItemSecondaryAction className={classes.rightMetaAction}>
                    {(ticket.lastMessage || ticket.updatedAt) && (
                        <div className={classes.rightSideMeta}>
                            <Typography
                                className={Number(ticket.unreadMessages) > 0 ? classes.lastMessageTimeUnread : classes.lastMessageTime}
                                component="span"
                                variant="body2"
                            >
                                {(() => {
                                    const d = parseISO(ticket.updatedAt);
                                    if (isSameDay(d, new Date())) return format(d, "HH:mm");
                                    if (isYesterday(d)) return "Ontem";
                                    return format(d, "dd/MM/yy");
                                })()}
                            </Typography>

                            <Badge
                                className={`${classes.newMessagesCount} ${classes.unreadBelowDate} ${Number(ticket.unreadMessages) > 0 ? "" : classes.unreadPlaceholder}`}
                                badgeContent={ticket.unreadMessages}
                                classes={{
                                    badge: classes.badgeStyle,
                                }}
                            >
                                <span className={classes.rightBadgeDummy} />
                            </Badge>
                        </div>
                    )}

                </ListItemSecondaryAction>

                <div
                    className={classes.ticketActionButtons}
                    style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        display: 'flex',
                        gap: 4,
                        zIndex: 999
                    }}
                >
                    {/* Aceitar ticket sem fila */}
                    {((ticket.status === "pending" || ticket.status === "bot") && (ticket.queueId === null || ticket.queueId === undefined)) && (
                        <Tooltip title={i18n.t("ticketsList.buttons.accept")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleOpenAcceptTicketWithouSelectQueue();
                                }}
                                disabled={loading}
                            >
                                <Done fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Aceitar ticket com fila */}
                    {((ticket.status === "pending" || ticket.status === "bot") && ticket.queueId !== null) && (
                        <Tooltip title={i18n.t("ticketsList.buttons.accept")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleAcepptTicket(ticket.id);
                                }}
                                disabled={loading}
                            >
                                <Done fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Transferir ticket - não disponível para grupos */}
                    {!ticket.isGroup && (ticket.status === "pending" || ticket.status === "open" || ticket.status === "group" || ticket.status === "bot" || ticket.status === "campaign") && (
                        <Tooltip title={i18n.t("ticketsList.buttons.transfer")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={handleOpenTransferModal}
                                disabled={loading}
                            >
                                <SwapHoriz fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Espiar conversa - não disponível para grupos */}
                    {!ticket.isGroup && (ticket.status === "open" || ticket.status === "group" || ticket.status === "bot" || ticket.status === "campaign") && (
                        <Tooltip title="Espiar Conversa">
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={handleOpenMessageDialog}
                            >
                                <VisibilityIcon fontSize="small" style={{ color: blue[700] }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Fechar ticket */}
                    {(ticket.status === "open" || ticket.status === "group" || ticket.status === "bot" || ticket.status === "campaign") && (
                        <Tooltip title={i18n.t("ticketsList.buttons.closed")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleCloseTicket(ticket.id);
                                }}
                                disabled={loading}
                            >
                                <HighlightOff fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Ignorar ticket pendente */}
                    {((ticket.status === "pending" || ticket.status === "lgpd") && (user.userClosePendingTicket === "enabled" || user.profile === "admin")) && (
                        <Tooltip title={i18n.t("ticketsList.buttons.ignore")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleCloseIgnoreTicket(ticket.id);
                                }}
                                disabled={loading}
                            >
                                <HighlightOff fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Reabrir ticket fechado sem fila */}
                    {(ticket.status === "closed" && (ticket.queueId === null || ticket.queueId === undefined)) && (
                        <Tooltip title={i18n.t("ticketsList.buttons.reopen")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleOpenAcceptTicketWithouSelectQueue();
                                }}
                                disabled={loading}
                            >
                                <Replay fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Reabrir ticket fechado com fila */}
                    {(ticket.status === "closed" && ticket.queueId !== null) && (
                        <Tooltip title={i18n.t("ticketsList.buttons.reopen")}>
                            <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleAcepptTicket(ticket.id);
                                }}
                                disabled={loading}
                            >
                                <Replay fontSize="small" style={{ color: theme.mode === "light" ? "#0872B9" : "#FFF" }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </div>
            </ListItem>
            {/* <Divider variant="inset" component="li" /> */}
        </React.Fragment>
    );
};

export default TicketListItemCustom;
