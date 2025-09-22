import React, { useEffect, useState, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Paper from "@material-ui/core/Paper";
import CreateIcon from '@material-ui/icons/Create';
import BlockIcon from "@material-ui/icons/Block";
import LockOpenIcon from "@material-ui/icons/LockOpen";
import VolumeUpIcon from "@material-ui/icons/VolumeUp";
import VolumeOffIcon from "@material-ui/icons/VolumeOff";
import formatSerializedId from '../../utils/formatSerializedId';
import { i18n } from "../../translate/i18n";
import ContactAvatar from "../ContactAvatar";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import { CardHeader, Tooltip, Dialog, DialogContent, CircularProgress, Collapse } from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import { ContactForm } from "../ContactForm";
import ContactModal from "../ContactModal";
import { ContactNotes } from "../ContactNotes";

import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { toast } from "react-toastify";
import { TagsKanbanContainer } from "../TagsKanbanContainer";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
    },
    drawerPaper: {
        width: drawerWidth,
        display: "flex",
        borderTop: "1px solid rgba(0, 0, 0, 0.12)",
        borderRight: "1px solid rgba(0, 0, 0, 0.12)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
    },
    header: {
        display: "flex",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        backgroundColor: theme.palette.inputBackground,
        alignItems: "center",
        padding: theme.spacing(0, 1),
        minHeight: "50px",
        justifyContent: "flex-start",
    },
    content: {
        display: "",
        backgroundColor: theme.palette.inputBackground,
        flexDirection: "column",
        padding: "8px 0px 8px 8px",
        height: "100%",
        justifyContent: "center",
        overflowY: "scroll",
        ...theme.scrollbarStyles,
    },

    contactAvatar: {
        margin: 15,
        width: 180,
        height: 180,
        borderRadius: 10,
    },

    contactHeader: {
        display: "flex",
        padding: 8,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        "& > *": {
            margin: 4,
        },
    },

    nameRow: {
        display: "flex",
        alignItems: "center",
        width: "100%",
    },

    nameText: {
        flex: "1 1 auto",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer",
        maxWidth: drawerWidth - 80,
    },

    cardHeaderSubheader: {
        whiteSpace: "normal",
        overflow: "visible",
        display: "block",
        wordBreak: "break-word",
        lineHeight: 1.2,
    },

    contactDetails: {
        marginTop: 8,
        padding: 8,
        display: "flex",
        flexDirection: "column",
    },
    contactExtraInfo: {
        marginTop: 4,
        padding: 6,
    },
}));

const ContactDrawer = ({ open, handleDrawerClose, contact, ticket, loading }) => {
    const classes = useStyles();

    const [modalOpen, setModalOpen] = useState(false);
    const [blockingContact, setBlockingContact] = useState(contact.active);
    const [openForm, setOpenForm] = useState(false);
    const { get } = useCompanySettings();
    const [hideNum, setHideNum] = useState(false);
    const { user } = useContext(AuthContext);
    const [acceptAudioMessage, setAcceptAudio] = useState(contact?.acceptAudioMessage ?? true);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);
    const [avatarLargeUrl, setAvatarLargeUrl] = useState(null);
    const [notesOpen, setNotesOpen] = useState(true);

    // URL da imagem do avatar para visualização ampliada
    const avatarImageUrl = contact?.contact
        ? (contact.contact.profilePicUrl || contact.contact.urlPicture)
        : (contact?.urlPicture || contact?.profilePicUrl);

    // Helper de moeda robusto: aceita "1.234,56", "1234.56", "R$ 1.234,56", etc.
    const formatCurrencyBRL = (val, fallback = null) => {
        if (val == null || val === '') return fallback;
        const s = String(val).trim().replace(/\s+/g,'').replace(/R\$?/i,'');
        let num;
        if (s.includes(',')) {
            const normalized = s.replace(/\./g, '').replace(/,/g, '.');
            num = Number(normalized);
        } else {
            num = Number(s);
        }
        if (isNaN(num)) return fallback ?? String(val);
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
    };

    useEffect(() => {
        async function fetchData() {

            const lgpdHideNumber = await get({
                "column": "lgpdHideNumber"
            });

            if (lgpdHideNumber === "enabled") setHideNum(true);

        }
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setOpenForm(false);
    }, [open, contact]);

    // Sincroniza o estado local do ícone de áudio quando o contato recebido por props mudar
    useEffect(() => {
        setAcceptAudio(contact?.acceptAudioMessage ?? true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contact?.id, contact?.acceptAudioMessage]);

    // Carrega a imagem grande ao abrir o modal
    useEffect(() => {
        let revokeUrl = null;
        const fetchImage = async () => {
            try {
                if (!avatarImageUrl) return;
                const { data, headers } = await api.get(avatarImageUrl, { responseType: "blob" });
                const url = window.URL.createObjectURL(new Blob([data], { type: headers["content-type"] }));
                setAvatarLargeUrl(url);
                revokeUrl = url;
            } catch (err) {
                toastError(err);
            }
        };
        if (avatarModalOpen) {
            setAvatarLargeUrl(null);
            fetchImage();
        }
        return () => {
            if (revokeUrl) window.URL.revokeObjectURL(revokeUrl);
        };
    }, [avatarModalOpen, avatarImageUrl]);


    const handleContactToggleAcceptAudio = async () => {
        try {
            const contact = await api.put(`/contacts/toggleAcceptAudio/${ticket.contact.id}`);
            setAcceptAudio(contact.data.acceptAudioMessage);
        } catch (err) {
            toastError(err);
        }
    };

    const handleBlockContact = async (contactId) => {
        try {
            await api.put(`/contacts/block/${contactId}`, { active: false });
            toast.success("Contato bloqueado");
        } catch (err) {
            toastError(err);
        }

        setBlockingContact(true);
    };

    const handleUnBlockContact = async (contactId) => {
        try {
            await api.put(`/contacts/block/${contactId}`, { active: true });
            toast.success("Contato desbloqueado");
        } catch (err) {
            toastError(err);
        }
        setBlockingContact(false);
    };

    if (loading) return null;

    return (
        <>
            <Drawer
                className={classes.drawer}
                variant="persistent"
                anchor="right"
                open={open}
                PaperProps={{ style: { position: "absolute" } }}
                BackdropProps={{ style: { position: "absolute" } }}
                ModalProps={{
                    container: document.getElementById("drawer-container"),
                    style: { position: "absolute" },
                }}
                classes={{
                    paper: classes.drawerPaper,
                }}
            >
                <div className={classes.header}>
                    <IconButton onClick={handleDrawerClose}>
                        <CloseIcon />
                    </IconButton>
                    <Typography style={{ justifySelf: "center" }}>
                        {i18n.t("contactDrawer.header")}
                    </Typography>
                </div>
                
                {loading ? (
                    <ContactDrawerSkeleton classes={classes} />
                ) : (
                        <div className={classes.content}>
                            <Paper square variant="outlined" className={classes.contactHeader}>
                                <div onClick={() => avatarImageUrl && setAvatarModalOpen(true)} style={{ cursor: avatarImageUrl ? "pointer" : "default" }}>
                                    <ContactAvatar contact={contact} style={{ width: 270, height: 270, borderRadius: 10 }} />
                                </div>
                            <CardHeader
                                onClick={() => { }}
                                style={{ cursor: "pointer", width: '100%' }}
                                disableTypography
                                classes={{ subheader: classes.cardHeaderSubheader }}
                                title={
                                    <Tooltip title={contact?.name || ""}>
                                        <div className={classes.nameRow} onClick={() => setModalOpen(true)}>
                                            <Typography className={classes.nameText}>
                                                {contact?.name || ""}
                                            </Typography>
                                            <CreateIcon style={{ fontSize: 16, marginLeft: 5, flex: "0 0 auto" }} />
                                        </div>
                                    </Tooltip>
                                }
                                subheader={
                                    <>
                                        <Typography style={{ fontSize: 12 }}>
                                            {hideNum && user.profile === "user" ? formatSerializedId(contact.number).slice(0, -6) + "**-**" + contact.number.slice(-2) : formatSerializedId(contact.number)}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            <Link href={`mailto:${contact.email}`}>{contact.email}</Link>
                                        </Typography>
                                        {contact.contactName && (
                                          <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {`Nome do Contato: ${contact.contactName}`}
                                          </Typography>
                                        )}
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.cpfCnpj && `CPF/CNPJ: ${contact.cpfCnpj}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.representativeCode && `Cód. Representante: ${contact.representativeCode}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.city && `Cidade: ${contact.city}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {`Encomenda: ${contact.florder ? 'Sim' : 'Não'}`}
                                        </Typography>
                                        {contact.dtUltCompra && (
                                          <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {`Última Compra: ${new Date(contact.dtUltCompra).toLocaleDateString()}`}
                                          </Typography>
                                        )}
                                        {typeof contact.vlUltCompra !== 'undefined' && contact.vlUltCompra !== null && (
                                          <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {`Valor Última Compra: ${formatCurrencyBRL(contact.vlUltCompra, '—')}`}
                                          </Typography>
                                        )}
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.instagram && `Instagram: ${contact.instagram}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.fantasyName && `Nome Fantasia: ${contact.fantasyName}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.situation && `Situação: ${contact.situation}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                           {contact.segment && `Segmento: ${contact.segment}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.foundationDate && `Data de Fundação: ${new Date(contact.foundationDate).toLocaleDateString()}`}
                                        </Typography>
                                        <Typography style={{ color: "primary", fontSize: 12 }}>
                                            {contact.creditLimit && contact.creditLimit !== '' && `Limite de Crédito: ${formatCurrencyBRL(contact.creditLimit, '')}`}
                                        </Typography>
                                    </>
                                }
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                                <Tooltip title={i18n.t("contactDrawer.buttons.edit")}>
                                    <IconButton color="primary" onClick={() => setModalOpen(true)} aria-label="Editar contato">
                                        <CreateIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={acceptAudioMessage ? "Aceitar Áudio habilitado" : "Aceitar Áudio desabilitado"}>
                                    <IconButton onClick={() => handleContactToggleAcceptAudio()} aria-label="Alternar áudio">
                                        {acceptAudioMessage ? (
                                            <VolumeUpIcon style={{ color: "green" }} />
                                        ) : (
                                            <VolumeOffIcon style={{ color: "grey" }} />
                                        )}
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={!contact.active ? "Desbloquear contato" : "Bloquear contato"}>
                                    <IconButton
                                        color="secondary"
                                        onClick={() => contact.active
                                            ? handleBlockContact(contact.id)
                                            : handleUnBlockContact(contact.id)}
                                        disabled={loading}
                                        aria-label={!contact.active ? "Desbloquear contato" : "Bloquear contato"}
                                    >
                                        {contact.active ? <BlockIcon /> : <LockOpenIcon />}
                                    </IconButton>
                                </Tooltip>
                            </div>
                            {(contact.id && openForm) && <ContactForm initialContact={contact} onCancel={() => setOpenForm(false)} />}
                        </Paper>
                        
                        <TagsKanbanContainer ticket={ticket} className={classes.contactTags} />
                        <Paper square variant="outlined" className={classes.contactDetails}>
                            <div
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                                onClick={() => setNotesOpen(prev => !prev)}
                                aria-expanded={notesOpen}
                            >
                                <Typography variant="subtitle1">
                                    {i18n.t("ticketOptionsMenu.appointmentsModal.title")}
                                </Typography>
                                <IconButton size="small" aria-label={notesOpen ? "Recolher" : "Expandir"}>
                                    {notesOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                            </div>
                            <Collapse in={notesOpen} timeout="auto" unmountOnExit>
                                <div style={{ marginTop: 10 }}>
                                    <ContactNotes ticket={ticket} />
                                </div>
                                <div style={{ marginTop: 12 }}>
                                    <Typography variant="subtitle1">
                                        {i18n.t("contactDrawer.extraInfo")}
                                    </Typography>
                                    {contact?.extraInfo?.map(info => (
                                        <Paper
                                            key={info.id}
                                            square
                                            variant="outlined"
                                            className={classes.contactExtraInfo}
                                        >
                                            <InputLabel>{info.name}</InputLabel>
                                            <Typography component="div" noWrap style={{ paddingTop: 2 }}>
                                                <MarkdownWrapper>{info.value}</MarkdownWrapper>
                                            </Typography>
                                        </Paper>
                                    ))}
                                </div>
                            </Collapse>
                        </Paper>
                    </div>
                )}
            </Drawer>
            {/* Modal de edição do contato: fora do Collapse para permanecer montado */}
            <ContactModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                contactId={contact.id}
            ></ContactModal>
            {/* Modal para exibir a imagem do avatar ampliada diretamente */}
            <Dialog open={avatarModalOpen} onClose={() => setAvatarModalOpen(false)} maxWidth="md">
                <DialogContent style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {avatarImageUrl && (
                        avatarLargeUrl ? (
                            <img
                                src={avatarLargeUrl}
                                alt="Avatar"
                                style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
                            />
                        ) : (
                            <CircularProgress />
                        )
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ContactDrawer;
