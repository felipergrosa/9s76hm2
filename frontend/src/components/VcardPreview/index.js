import React, { useEffect, useState, useContext } from 'react';
import { useHistory } from "react-router-dom";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { toast } from "react-toastify";

import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";

import { AuthContext } from "../../context/Auth/AuthContext";

import { Button, Divider, useTheme, } from "@material-ui/core";
import { isNil } from 'lodash';
import ShowTicketOpen from '../ShowTicketOpenModal';
import { grey } from '@material-ui/core/colors';
import ContactAvatar from "../ContactAvatar";

const VcardPreview = ({ contact, numbers, queueId, whatsappId }) => {
    const theme = useTheme();
    const history = useHistory();
    const { user } = useContext(AuthContext);

    const companyId = user.companyId;

    const [openAlert, setOpenAlert] = useState(false);
    const [userTicketOpen, setUserTicketOpen] = useState("");
    const [queueTicketOpen, setQueueTicketOpen] = useState("");

    const [selectedContact, setContact] = useState({
        id: 0,
        name: "",
        number: 0,
        profilePicUrl: ""
    });

    // useEffect(() => {
    //     const delayDebounceFn = setTimeout(() => {
    //         const fetchContacts = async () => {
    //             try {
    //                 const number = numbers.replace(/\D/g, "");
    //                 const { data } = await api.get(`/contacts/profile/${number}`);

    //                 let obj = {
    //                     id: data.contactId,
    //                     name: contact,
    //                     number: numbers,
    //                     profilePicUrl: data.profilePicUrl
    //                 }

    //                 setContact(obj)

    //             } catch (err) {
    //                 console.log(err)
    //                 toastError(err);
    //             }
    //         };
    //         fetchContacts();
    //     }, 500);
    //     return () => clearTimeout(delayDebounceFn);
    // }, [contact, numbers]);


    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            const fetchContacts = async () => {
                try {
                    if (isNil(numbers)) {
                        return
                    }
                    const number = numbers.replace(/\D/g, "");
                    
                    const getData = await api.get(`/contacts/profile/${number}`);

                    if (getData.data.contactId && getData.data.contactId !== 0) {
                        let obj = {
                            id: getData.data.contactId,
                            name: contact,
                            number: numbers,
                            profilePicUrl: getData.data.urlPicture
                        }

                        setContact(obj)
                  
                    } else {
                        let contactObj = {
                            name: contact,
                            number: number,
                            email: "",
                            companyId: companyId
                        }

                        const { data } = await api.post("/contacts", contactObj);
                        setContact(data)
                    }
            
                } catch (err) {
                    console.log(err)
                    toastError(err);
                }
            };
            fetchContacts();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [companyId, contact, numbers]);

    const handleCloseAlert = () => {
        setOpenAlert(false);
        setOpenAlert(false);
        setUserTicketOpen("");
        setQueueTicketOpen("");
    };

    const handleNewChat = async () => {
        try {
            const { data: ticket } = await api.post("/tickets", {
                contactId: selectedContact.id,
                userId: user.id,
                status: "open",
                queueId,
                companyId: companyId,
                whatsappId
            });

            history.push(`/tickets/${ticket.uuid}`);
        } catch (err) {
            try {
                const data = err?.response?.data || {};
                const isStringData = typeof data === "string";
                const errorField = isStringData ? undefined : data?.error;
                const code = isStringData
                    ? data
                    : typeof errorField === "string"
                        ? errorField
                        : data?.message;

                // Caso específico: já existe um ticket aberto para o contato
                if (code === "ERR_OTHER_OPEN_TICKET") {
                    toast.error(i18n.t("backendErrors.ERR_OTHER_OPEN_TICKET"));
                    return;
                }

                // Compatibilidade com backend antigo: error como JSON string com dados do ticket
                if (typeof errorField === "string" && errorField.trim().startsWith("{")) {
                    const ticket = JSON.parse(errorField);
                    // Verificar se posso acessar: meu ticket ou de usuário que gerencio
                    const managedIds = (user?.managedUserIds || []).map(id => Number(id));
                    const canAccess = ticket.userId === user?.id || 
                                      user?.profile === "admin" || 
                                      user?.super ||
                                      managedIds.includes(Number(ticket.userId));
                    
                    if (!canAccess) {
                        setOpenAlert(true);
                        setUserTicketOpen(ticket?.user?.name);
                        setQueueTicketOpen(ticket?.queue?.name);
                    } else {
                        setOpenAlert(false);
                        setUserTicketOpen("");
                        setQueueTicketOpen("");
                        history.push(`/tickets/${ticket.uuid}`);
                    }
                    return;
                }
            } catch (_) {
                // ignora erros de parse e cai no tratamento genérico
            }
            // Fallback genérico
            toastError(err);
        }
    }

    return (
        <>
            <div style={{
                minWidth: "250px",
            }}>
                <ShowTicketOpen
                    isOpen={openAlert}
                    handleClose={handleCloseAlert}
                    user={userTicketOpen}
                    queue={queueTicketOpen}
                />
                <Grid container spacing={1}>
                    <Grid item xs={2}>
                        <ContactAvatar 
                            contact={selectedContact}
                        />
                    </Grid>
                    <Grid item xs={9}>
                        <Typography
                            style={{ marginTop: "12px", marginLeft: "10px" }}
                            color="primary"
                            variant="subtitle1"
                            gutterBottom
                        >
                            {selectedContact.name}
                        </Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Divider />
                        <Button
                            fullWidth
                            color="primary"
                            onClick={handleNewChat}
                            disabled={!selectedContact.number}
                        >Conversar</Button>
                    </Grid>
                </Grid>
            </div>
        </>
    );

};

export default VcardPreview;