import React, { useState, useEffect, useContext, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field, FieldArray } from "formik";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import CloseIcon from "@material-ui/icons/Close";
import SendIcon from "@material-ui/icons/Send";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { Chip, FormControl, FormControlLabel, Grid, IconButton, InputLabel, MenuItem, Select, Switch, Typography, Tooltip, InputAdornment, Box } from "@material-ui/core";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import moment from "moment"
import { AuthContext } from "../../context/Auth/AuthContext";
import { isArray, capitalize } from "lodash";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import AttachFile from "@material-ui/icons/AttachFile";
import { head } from "lodash";
import ConfirmationModal from "../ConfirmationModal";
import MessageVariablesPicker from "../MessageVariablesPicker";
import useQueues from "../../hooks/useQueues";
import UserStatusIcon from "../UserModal/statusIcon";
import { Facebook, Instagram, WhatsApp } from "@material-ui/icons";
import { Sparkles } from "lucide-react";
import ChatAssistantPanel from "../ChatAssistantPanel";
import WhatsAppPopover from "../WhatsAppPopover";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	// multFieldLine: {
	// 	display: "flex",
	// 	"& > *:not(:last-child)": {
	// 		marginRight: theme.spacing(1),
	// 	},
	// },

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	// formControl: {
	// 	margin: theme.spacing(1),
	// 	minWidth: 120,
	// },
}));

const ScheduleSchema = Yup.object().shape({
	body: Yup.string()
		.min(5, "Mensagem muito curta")
		.required("Obrigatório"),
	contactId: Yup.number().required("Obrigatório"),
	sendAt: Yup.string().required("Obrigatório")
});

const ScheduleModal = ({ open, onClose, scheduleId, contactId, cleanContact, reload }) => {
	const classes = useStyles();
	const history = useHistory();
	const { user, socket } = useContext(AuthContext);
	const isMounted = useRef(true);
	const { companyId } = user;

	const initialState = {
		body: "",
		contactId: "",
		sendAt: moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
		sentAt: "",
		openTicket: "enabled",
		ticketUserId: "",
		queueId: "",
		statusTicket: "closed",
		intervalo: 1,
		valorIntervalo: 0,
		enviarQuantasVezes: 1,
		tipoDias: 4,
		assinar: false
	};

	const initialContact = {
		id: "",
		name: "",
		channel: ""
	}

	const [schedule, setSchedule] = useState(initialState);
	const [currentContact, setCurrentContact] = useState(initialContact);
	const [contacts, setContacts] = useState([initialContact]);
	const [intervalo, setIntervalo] = useState(1);
	// const [valorIntervalo, setValorIntervalo] = useState(initialContact);
	// const [enviarQuantasVezes, setEnviarQuantasVezes] = useState(initialContact);
	const [tipoDias, setTipoDias] = useState(4);
	const [attachment, setAttachment] = useState(null);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [isUploading, setIsUploading] = useState(false);
	const attachmentFile = useRef(null);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const messageInputRef = useRef();
	const [channelFilter, setChannelFilter] = useState("whatsapp");
	const [whatsapps, setWhatsapps] = useState([]);
	const [allQueues, setAllQueues] = useState([]);
	const [queues, setQueues] = useState([]);
	const [options, setOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selectedWhatsapps, setSelectedWhatsapps] = useState("");
	const [selectedUser, setSelectedUser] = useState(null);
	const [selectedQueue, setSelectedQueue] = useState("");
	const [assistantOpen, setAssistantOpen] = useState(false);

	const { findAllForSelection } = useQueues();

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        // Usa findAllForSelection - SEM permissão queues.view
        const list = await findAllForSelection();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

	useEffect(() => {
		if (open) {
			const fetchUsers = async () => {
				setLoading(true);
				try {
					// Usa /users/available - SEM permissão users.view
					const { data } = await api.get("/users/available");
					setOptions(data);
					setLoading(false);
				} catch (err) {
					setLoading(false);
					console.error("Erro ao buscar usuários disponíveis:", err);
					setOptions([]);
				}
			};

			fetchUsers();
		}
	}, [open]);

	// Listener para atualização de status dos usuários em tempo real
	useEffect(() => {
		if (open && user?.companyId) {
			const onCompanyUser = (data) => {
				if (data.action === "update") {
					// Atualiza o usuário na lista se existir
					setOptions(prev => {
						const index = prev.findIndex(u => u.id === data.user.id);
						if (index !== -1) {
							const updated = [...prev];
							updated[index] = { ...updated[index], ...data.user };
							return updated;
						}
						return prev;
					});
				}
			};
			
			socket.on(`company-${user.companyId}-user`, onCompanyUser);
			
			return () => {
				socket.off(`company-${user.companyId}-user`, onCompanyUser);
			};
		}
	}, [open, user?.companyId, socket]);

	useEffect(() => {
		api
			.get(`/whatsapp/filter`, { params: { session: 0, channel: channelFilter } })
			.then(({ data }) => {
				// Mapear os dados recebidos da API para adicionar a propriedade 'selected'
				const mappedWhatsapps = data.map((whatsapp) => ({
					...whatsapp,
					selected: false,
				}));

				setWhatsapps(mappedWhatsapps);
				if (mappedWhatsapps.length && mappedWhatsapps?.length === 1) {
					setSelectedWhatsapps(mappedWhatsapps[0].id)
				}
			});
	}, [currentContact, channelFilter])

	useEffect(() => {
		console.log('[ScheduleModal] useEffect contactId/contacts:', { contactId, contactsCount: contacts.length });
		if (contactId && contacts.length) {
			const contact = contacts.find(c => c.id == contactId);
			console.log('[ScheduleModal] Contato encontrado:', contact);
			if (contact) {
				setCurrentContact(contact);
			}
		}
	}, [contactId, contacts]);

	useEffect(() => {
		const { companyId } = user;
		if (open) {
			try {
				(async () => {
					const { data: contactList } = await api.get('/contacts/list', { params: { companyId: companyId } });
					let customList = contactList.map((c) => ({ id: c.id, name: c.name, channel: c.channel }));
					if (isArray(customList)) {
						setContacts([{ id: "", name: "", channel: "" }, ...customList]);
					}
					if (contactId) {
						setSchedule(prevState => {
							return { ...prevState, contactId }
						});
					}

					if (!scheduleId) return;

					const { data } = await api.get(`/schedules/${scheduleId}`);
					setSchedule(prevState => {
						return { ...prevState, ...data, sendAt: moment(data.sendAt).format('YYYY-MM-DDTHH:mm') };
					});
					console.log(data)
					if (data.whatsapp) {
						setSelectedWhatsapps(data.whatsapp.id);
					}

					if (data.ticketUser) {
						setSelectedUser(data.ticketUser);
					}
					if (data.queueId) {
						setSelectedQueue(data.queueId);
					}

					if (data.intervalo) {
						setIntervalo(data.intervalo);
					}

					if (data.tipoDias) {
						setTipoDias(data.tipoDias);
					}

					setCurrentContact(data.contact);
				})()
			} catch (err) {
				toastError(err);
			}
		}
	}, [scheduleId, contactId, open, user]);

	const filterOptions = createFilterOptions({
		trim: true,
	});

	const handleClose = () => {
		onClose();
		setAttachment(null);
		setSchedule(initialState);
	};

	const handleAttachmentFile = (e) => {
		const file = head(e.target.files);
		if (file) {
			setAttachment(file);
		}
	};

	const IconChannel = (channel) => {
		switch (channel) {
			case "facebook":
				return <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />;
			case "instagram":
				return <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />;
			case "whatsapp":
				return <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
			default:
				return "error";
		}
	};

	const renderOption = option => {
		if (option.name) {
			return <>
				{IconChannel(option.channel)}
				<Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
					{option.name}
				</Typography>
			</>
		} else {
			return `${i18n.t("newTicketModal.add")} ${option.name}`;
		}
	};
	const handleSaveSchedule = async values => {
		const scheduleData = {
			...values, userId: user.id, whatsappId: selectedWhatsapps, ticketUserId: selectedUser?.id || null,
			queueId: selectedQueue || null, intervalo: intervalo || 1, tipoDias: tipoDias || 4
		};

		try {
			if (scheduleId) {
				await api.put(`/schedules/${scheduleId}`, scheduleData);
				if (attachment != null) {
					setIsUploading(true);
					setUploadProgress(0);
					const formData = new FormData();
					formData.append("file", attachment);
					await api.post(
						`/schedules/${scheduleId}/media-upload`,
						formData,
						{
							onUploadProgress: (progressEvent) => {
								const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
								setUploadProgress(progress);
							}
						}
					);
					setIsUploading(false);
				}
			} else {
				const { data } = await api.post("/schedules", scheduleData);
				if (attachment != null) {
					setIsUploading(true);
					setUploadProgress(0);
					const formData = new FormData();
					formData.append("file", attachment);
					await api.post(`/schedules/${data.id}/media-upload`, formData, {
						onUploadProgress: (progressEvent) => {
							const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
							setUploadProgress(progress);
						}
					});
					setIsUploading(false);
				}
			}
			toast.success(i18n.t("scheduleModal.success"));
			if (typeof reload == 'function') {
				reload();
			}
			if (contactId) {
				if (typeof cleanContact === 'function') {
					cleanContact();
					history.push('/schedules');
				}
			}
		} catch (err) {
			toastError(err);
			setIsUploading(false);
		}
		setCurrentContact(initialContact);
		setSchedule(initialState);
		setAttachment(null);
		setUploadProgress(0);
		handleClose();
	};
	const handleClickMsgVar = async (msgVar, setValueFunc) => {
		const el = messageInputRef.current;
		const firstHalfText = el.value.substring(0, el.selectionStart);
		const secondHalfText = el.value.substring(el.selectionEnd);
		const newCursorPos = el.selectionStart + msgVar.length;

		setValueFunc("body", `${firstHalfText}${msgVar}${secondHalfText}`);

		await new Promise(r => setTimeout(r, 100));
		messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
	};

	const deleteMedia = async () => {
		if (attachment) {
			setAttachment(null);
			attachmentFile.current.value = null;
		}

		if (schedule.mediaPath) {
			await api.delete(`/schedules/${schedule.id}/media-upload`);
			setSchedule((prev) => ({
				...prev,
				mediaPath: null,
			}));
			toast.success(i18n.t("scheduleModal.toasts.deleted"));
			if (typeof reload == "function") {
				console.log(reload);
				console.log("1");
				reload();
			}
		}
	};

	return (
		<div className={classes.root}>
			<ConfirmationModal
				title={i18n.t("scheduleModal.confirmationModal.deleteTitle")}
				open={confirmationOpen}
				onClose={() => setConfirmationOpen(false)}
				onConfirm={deleteMedia}
			>
				{i18n.t("scheduleModal.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="md"
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="form-dialog-title">
					{schedule.status === 'ERRO' ? 'Erro de Envio' : `Mensagem ${capitalize(schedule.status)}`}
				</DialogTitle>
				<div style={{ display: "none" }}>
					<input
						type="file"
						accept=".png,.jpg,.jpeg"
						ref={attachmentFile}
						onChange={(e) => handleAttachmentFile(e)}
					/>
				</div>
				<Formik
					initialValues={schedule}
					enableReinitialize={true}
					validationSchema={ScheduleSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveSchedule(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => (
						<Form>
							<DialogContent dividers>
								{/* ASSISTENTE NO TOPO */}
								<ChatAssistantPanel
									open={assistantOpen}
									inputMessage={values.body}
									setInputMessage={(val) => setFieldValue("body", val)}
									queueId={selectedQueue}
									whatsappId={selectedWhatsapps}
									onClose={() => setAssistantOpen(false)}
									bottom={495}
									bottomMobile={450}
								/>

								<div className={classes.multFieldLine}>
									<FormControl
										variant="outlined"
										fullWidth
									>
										<Autocomplete
											fullWidth
											value={currentContact}
											options={contacts}
											onChange={(e, contact) => {
												const contactId = contact ? contact.id : '';
												setSchedule({ ...schedule, contactId });
												setCurrentContact(contact ? contact : initialContact);
												setChannelFilter(contact ? contact.channel : "whatsapp");
											}}
											getOptionLabel={(option) => option.name}
											renderOption={renderOption}
											getOptionSelected={(option, value) => {
												return value.id === option.id
											}}
											renderInput={(params) => <TextField {...params} variant="outlined" placeholder="Contato" />}
										/>
									</FormControl>
								</div>
								<Box display="flex" alignItems="flex-start" gap={1} width="100%">
									<Field
										as={TextField}
										rows={4}
										multiline={true}
										label={i18n.t("scheduleModal.form.body")}
										name="body"
										inputRef={messageInputRef}
										error={touched.body && Boolean(errors.body)}
										helperText={touched.body && errors.body}
										variant="outlined"
										margin="dense"
										fullWidth
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<Tooltip title="Assistente de Chat">
														<IconButton
															size="small"
															aria-label="assistant"
															onClick={() => setAssistantOpen(prev => !prev)}
															>
																<Sparkles size={18} />
															</IconButton>
														</Tooltip>
												</InputAdornment>
											),
										}}
									/>
									<WhatsAppPopover
										onSelectEmoji={(emoji) => handleEmojiSelect(emoji, setFieldValue)}
										disabled={isSubmitting}
									/>
								</Box>
								<Grid item xs={12} md={12} xl={12}>
									<MessageVariablesPicker
										disabled={isSubmitting}
										onClick={value => handleClickMsgVar(value, setFieldValue)}
									/>
								</Grid>
								<Grid container spacing={1}>
									{/* LINHA 1: Conexão | Abrir Ticket | Busca Usuários | Transferir para Fila */}
									<Grid item xs={12} md={3} xl={3}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											className={classes.formControl}
										>
											<InputLabel id="whatsapp-selection-label">
												{i18n.t("campaigns.dialog.form.whatsapp")}
											</InputLabel>
											<Field
												as={Select}
												label={i18n.t("campaigns.dialog.form.whatsapp")}
												placeholder={i18n.t("campaigns.dialog.form.whatsapp")}
												labelId="whatsapp-selection-label"
												id="whatsappIds"
												name="whatsappIds"
												required
												error={touched.whatsappId && Boolean(errors.whatsappId)}
												value={selectedWhatsapps}
												onChange={(event) => setSelectedWhatsapps(event.target.value)}
											>
												{whatsapps &&
													whatsapps.map((whatsapp) => (
														<MenuItem key={whatsapp.id} value={whatsapp.id}>
															{whatsapp.name}
														</MenuItem>
													))}
											</Field>
										</FormControl>
									</Grid>

									<Grid item xs={12} md={3} xl={3}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											className={classes.formControl}
										>
											<InputLabel id="openTicket-selection-label">
												{i18n.t("campaigns.dialog.form.openTicket")}
											</InputLabel>
											<Field
												as={Select}
												label={i18n.t("campaigns.dialog.form.openTicket")}
												placeholder={i18n.t(
													"campaigns.dialog.form.openTicket"
												)}
												labelId="openTicket-selection-label"
												id="openTicket"
												name="openTicket"
												error={
													touched.openTicket && Boolean(errors.openTicket)
												}
											>
												<MenuItem value={"enabled"}>{i18n.t("campaigns.dialog.form.enabledOpenTicket")}</MenuItem>
												<MenuItem value={"disabled"}>{i18n.t("campaigns.dialog.form.disabledOpenTicket")}</MenuItem>
											</Field>
										</FormControl>
									</Grid>

									<Grid item xs={12} md={3} xl={3}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											className={classes.formControl}
										>
											<InputLabel id="user-selection-label">
												{i18n.t("transferTicketModal.fieldLabel")}
											</InputLabel>
											<Select
												labelId="user-selection-label"
												label={i18n.t("transferTicketModal.fieldLabel")}
												value={selectedUser?.id || ""}
												onChange={(e) => {
													const userId = e.target.value;
													const user = options.find(u => u.id === userId);
													setSelectedUser(user || null);

													if (user != null && Array.isArray(user.queues)) {
														if (user.queues.length === 1) {
															setSelectedQueue(user.queues[0].id);
														}
														setQueues(user.queues);
													} else {
														setQueues(allQueues);
														setSelectedQueue("");
													}
												}}
												fullWidth
												disabled={values.openTicket === "disabled"}
											>
												<MenuItem value="">
													<em>Nenhum</em>
												</MenuItem>
												{options.map((user) => (
													<MenuItem key={user.id} value={user.id}>
														{user.name}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									<Grid item xs={12} md={3} xl={3}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											className={classes.formControl}
										>
											<InputLabel>
												{i18n.t("transferTicketModal.fieldQueueLabel")}
											</InputLabel>
											<Select
												value={selectedQueue}
												onChange={(e) => setSelectedQueue(e.target.value)}
												label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
												disabled={values.openTicket === "disabled"}
											>
												{queues.map((queue) => (
													<MenuItem key={queue.id} value={queue.id}>
														{queue.name}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									{/* LINHA 2: Status do Ticket | Data do Agendamento | Enviar Assinatura */}
									<Grid item xs={12} md={3} xl={3}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											className={classes.formControl}
										>
											<InputLabel id="statusTicket-selection-label">
												{i18n.t("campaigns.dialog.form.statusTicket")}
											</InputLabel>
											<Field
												as={Select}
												disabled={values.openTicket === "disabled"}
												label={i18n.t("campaigns.dialog.form.statusTicket")}
												placeholder={i18n.t(
													"campaigns.dialog.form.statusTicket"
												)}
												labelId="statusTicket-selection-label"
												id="statusTicket"
												name="statusTicket"
												error={
													touched.statusTicket && Boolean(errors.statusTicket)
												}
											>
												<MenuItem value={"closed"}>{i18n.t("campaigns.dialog.form.closedTicketStatus")}</MenuItem>
												<MenuItem value={"open"}>{i18n.t("campaigns.dialog.form.openTicketStatus")}</MenuItem>
											</Field>
										</FormControl>
									</Grid>

									<Grid item xs={12} md={6} xl={6}>
										<Field
											as={TextField}
											label={i18n.t("scheduleModal.form.sendAt")}
											type="datetime-local"
											name="sendAt"
											error={touched.sendAt && Boolean(errors.sendAt)}
											helperText={touched.sendAt && errors.sendAt}
											variant="outlined"
											fullWidth
											size="small"
											style={{ marginTop: '8px' }}
										/>
									</Grid>

									<Grid item xs={12} md={3} xl={3} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
										<FormControlLabel
											control={
												<Field
													as={Switch}
													color="primary"
													name="assinar"
													checked={values.assinar}
													disabled={values.openTicket === "disabled"}
												/>
											}
											label={i18n.t("scheduleModal.form.assinar")}
										/>
									</Grid>
								</Grid>

								<h3>Recorrência</h3>
								<p>
									Você pode escolher enviar a mensagem de forma recorrente e
									escolher o intervalo. Caso seja uma mensagem a ser enviada
									uma unica vez, não altere nada nesta seção.
								</p>
								<br />
								<Grid container spacing={1}>
									{/* LINHA 3: Intervalo | Valor do Intervalo | Enviar quantas vezes | Configuração de Dias Úteis */}
									<Grid item xs={12} md={3} xl={3}>
										<FormControl size="small" fullWidth variant="outlined">
											<InputLabel id="demo-simple-select-label">Intervalo</InputLabel>
											<Select
												labelId="demo-simple-select-label"
												id="demo-simple-select"
												value={intervalo}
												onChange={(e) =>
													setIntervalo(e.target.value || 1)
												}
												label="Intervalo"
											>
												<MenuItem value={1}>Dias</MenuItem>
												<MenuItem value={2}>Semanas</MenuItem>
												<MenuItem value={3}>Meses</MenuItem>
												<MenuItem value={4}>Minutos</MenuItem>
											</Select>
										</FormControl>
									</Grid>

									<Grid item xs={12} md={3} xl={3}>
										<Field
											as={TextField}
											label="Valor do Intervalo"
											name="valorIntervalo"
											size="small"
											error={touched.valorIntervalo && Boolean(errors.valorIntervalo)}
											InputLabelProps={{ shrink: true }}
											variant="outlined"
											fullWidth
										/>
									</Grid>

									<Grid item xs={12} md={3} xl={3}>
										<Field
											as={TextField}
											label="Enviar quantas vezes"
											name="enviarQuantasVezes"
											size="small"
											error={
												touched.enviarQuantasVezes &&
												Boolean(errors.enviarQuantasVezes)
											}
											variant="outlined"
											fullWidth
										/>
									</Grid>

									<Grid item xs={12} md={3} xl={3}>
										<FormControl size="small" fullWidth variant="outlined">
											<InputLabel id="tipo-dias-label">Agendar em dias úteis</InputLabel>
											<Select
												labelId="tipo-dias-label"
												id="tipoDias"
												value={tipoDias}
												onChange={(e) =>
													setTipoDias(e.target.value || 4)
												}
												label="Agendar em dias úteis"
											>
												<MenuItem value={4}>Enviar normalmente em dias não úteis</MenuItem>
												<MenuItem value={5}>Enviar um dia útil antes</MenuItem>
												<MenuItem value={6}>Enviar um dia útil depois</MenuItem>
											</Select>
										</FormControl>
									</Grid>
								</Grid>
								{(schedule.mediaPath || attachment) && (
									<Grid xs={12} item>
										<Button startIcon={<AttachFile />}>
											{attachment ? attachment.name : schedule.mediaName}
										</Button>
										<IconButton
											onClick={() => setConfirmationOpen(true)}
											color="secondary"
										>
											<DeleteOutline color="secondary" />
										</IconButton>
									</Grid>
								)}
							</DialogContent>
							<DialogActions>
								{!attachment && !schedule.mediaPath && (
									<Button
										color="primary"
										onClick={() => attachmentFile.current.click()}
										disabled={isSubmitting}
										variant="outlined"
										size="medium"
										style={{
											textTransform: 'none',
											fontWeight: 500,
											borderRadius: '8px',
											padding: '8px 16px'
										}}
									>
										{i18n.t("quickMessages.buttons.attach")}
									</Button>
								)}
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
									size="medium"
									startIcon={<CloseIcon />}
									style={{
										textTransform: 'none',
										fontWeight: 500,
										borderRadius: '8px',
										padding: '8px 16px',
										borderColor: '#d32f2f',
										color: '#d32f2f'
									}}
								>
									{i18n.t("scheduleModal.buttons.cancel")}
								</Button>
								{(schedule.sentAt === null || schedule.sentAt === "") && (
									<>
										<Button
											type="submit"
											color="primary"
											disabled={isSubmitting || isUploading}
											variant="contained"
											className={classes.btnWrapper}
											size="medium"
											startIcon={isSubmitting || isUploading ? <CircularProgress size={16} /> : <SendIcon />}
											style={{
												textTransform: 'none',
												fontWeight: 600,
												borderRadius: '8px',
												padding: '8px 20px',
												boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)'
											}}
										>
											{scheduleId
												? `${i18n.t("scheduleModal.buttons.okEdit")}`
												: `${i18n.t("scheduleModal.buttons.okAdd")}`}
											{isSubmitting && (
												<CircularProgress
													size={24}
													className={classes.buttonProgress}
												/>
											)}
										</Button>
										{isUploading && (
											<Box mt={1} width="100%">
												<Typography variant="caption" color="textSecondary" align="center" display="block">
													Enviando anexo... {uploadProgress}%
												</Typography>
												<Box 
													width="100%" 
													height={4} 
													bgcolor="grey.300" 
													borderRadius={2}
													overflow="hidden"
												>
													<Box
														width={`${uploadProgress}%`}
														height={4}
														bgcolor="primary.main"
														style={{
															transition: 'width 0.3s ease'
														}}
													/>
												</Box>
											</Box>
										)}
									</>
								)}
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default ScheduleModal;