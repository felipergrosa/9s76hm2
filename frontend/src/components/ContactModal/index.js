import React, { useState, useEffect, useRef } from "react";
import { parseISO, format } from "date-fns";
import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { Close as CloseIcon } from "@material-ui/icons";
import CircularProgress from "@material-ui/core/CircularProgress";
import Switch from "@material-ui/core/Switch";
import withStyles from "@material-ui/core/styles/withStyles";
import { Grid, FormControl, InputLabel, MenuItem, Select, Checkbox, ListItemText } from "@material-ui/core";
import ContactAvatar from "../ContactAvatar";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { TagsContainer } from "../TagsContainer";
import InputMask from "react-input-mask";
import { isValidCPF, isValidCNPJ } from "../../utils/validators";
import usePermissions from "../../hooks/usePermissions";
// import AsyncSelect from "../AsyncSelect";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	textField: {
		marginRight: theme.spacing(1),
		flex: 1,
	},

	extraAttr: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
	}
}));

const ContactSchema = Yup.object().shape({
	clientCode: Yup.string().nullable().max(50, "Máximo 50 caracteres"),
	name: Yup.string()
		.min(2, "Parâmetros incompletos!")
		.max(250, "Parâmetros acima do esperado!")
		.required("Obrigatório"),
	number: Yup.string()
		.min(8, "Parâmetros incompletos!")
		.max(50, "Parâmetros acima do esperado!")
		.required("Obrigatório"),
	email: Yup.string().email("E-mail inválido"),
	contactName: Yup.string().nullable(),
	florder: Yup.boolean().nullable(),
	cpfCnpj: Yup.string()
		.nullable()
		.test('cpfCnpj-validation', 'CPF/CNPJ inválido', (value) => {
			if (!value) return true;
			const cleanValue = value.replace(/\D/g, '');
			if (cleanValue.length === 11) return isValidCPF(cleanValue);
			if (cleanValue.length === 14) return isValidCNPJ(cleanValue);
			return false;
		}),
	representativeCode: Yup.string().nullable(),
	city: Yup.string().nullable(),
	instagram: Yup.string().nullable(),
	situation: Yup.string().nullable(),
	fantasyName: Yup.string().nullable(),
	foundationDate: Yup.date().nullable(),
	creditLimit: Yup.string().nullable(),
	segment: Yup.string().nullable(),
	dtUltCompra: Yup.date().nullable(),
	vlUltCompra: Yup.mixed().nullable(),
	bzEmpresa: Yup.string().nullable(),
	region: Yup.string().nullable(),
	wallets: Yup.array().nullable(),
});

// Switch personalizado: verde quando ativo (checked), vermelho quando inativo
const GreenRedSwitch = withStyles({
	switchBase: {
		color: '#ef4444', // vermelho quando inativo
		'&$checked': {
			color: '#16a34a', // verde quando ativo
		},
		'&$checked + $track': {
			backgroundColor: '#16a34a',
		},
	},
	checked: {},
	track: {
		backgroundColor: '#fca5a5', // trilho vermelho claro quando inativo
	},
})(Switch);

const ContactModal = ({ open, onClose, contactId, initialValues, onSave }) => {
	const classes = useStyles();
	const isMounted = useRef(true);
	const [avatarOpen, setAvatarOpen] = useState(false);
	const [pendingTags, setPendingTags] = useState([]);
	const [userOptions, setUserOptions] = useState([]);
	const [loadingUsers, setLoadingUsers] = useState(false);

	// Verificar permissão para editar campos do contato
	const { hasPermission } = usePermissions();
	const canEditFields = hasPermission("contacts.edit-fields");

	const initialState = {
		clientCode: "",
		name: "",
		number: "",
		email: "",
		disableBot: false,
		lgpdAcceptedAt: "",
		cpfCnpj: "",
		representativeCode: "",
		city: "",
		instagram: "",
		situation: "Ativo",
		fantasyName: "",
		foundationDate: "",
		creditLimit: "",
		segment: "",
		contactName: "",
		florder: false,
		dtUltCompra: "",
		vlUltCompra: "",
		bzEmpresa: "",
		region: "",
		wallets: [],
	};

	const [contact, setContact] = useState(initialState);
	const [disableBot, setDisableBot] = useState(false);
	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchUsers = async () => {
			try {
				setLoadingUsers(true);
				const { data } = await api.get("/users/");
				setUserOptions(data.users || []);
			} catch (err) {
				toastError(err);
			} finally {
				setLoadingUsers(false);
			}
		};

		fetchUsers();
	}, []);

	useEffect(() => {
		const fetchContact = async () => {
			if (initialValues) {
				setContact(prevState => {
					return {
						...prevState,
						...initialValues,
						wallets: Array.isArray(initialValues.wallets)
							? initialValues.wallets.map(w => (typeof w === "object" ? w.id : w))
							: (initialValues.wallets || [])
					};
				});
			}

			if (!contactId) return;

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact({
						...data,
						wallets: Array.isArray(data.wallets)
							? data.wallets.map(w => (typeof w === "object" ? w.id : w))
							: []
					});
					setDisableBot(data.disableBot)
				}
			} catch (err) {
				toastError(err);
			}
		};

		fetchContact();
	}, [contactId, open, initialValues]);

	const handleClose = () => {
		onClose();
		setContact(initialState);
	};

	const handleSaveContact = async values => {
		const payload = {
			...values,
			clientCode: values.clientCode?.trim?.() || values.clientCode || null,
			disableBot: values.disableBot,
			representativeCode: values.representativeCode?.trim?.() || values.representativeCode || null,
			city: values.city?.trim?.() || values.city || null,
			region: values.region?.trim?.() || values.region || null,
			instagram: values.instagram?.trim?.() || values.instagram || null,
			situation: values.situation?.trim?.() || values.situation || null,
			fantasyName: values.fantasyName?.trim?.() || values.fantasyName || null,
			creditLimit: values.creditLimit?.trim?.() || values.creditLimit || null,
			segment: values.segment?.trim?.() || values.segment || null,
			contactName: values.contactName?.trim?.() || values.contactName || null,
			bzEmpresa: values.bzEmpresa?.trim?.() || values.bzEmpresa || null
		};

		try {
			if (contactId) {
				await api.put(`/contacts/${contactId}`, payload);
				handleClose();
			} else {
				const { data } = await api.post("/contacts", payload);
				// Sincroniza tags pendentes após criação, se houver
				if (Array.isArray(pendingTags) && pendingTags.length > 0) {
					try {
						await api.post('/tags/sync', { contactId: data.id, tags: pendingTags });
					} catch (syncErr) {
						// silencioso para não bloquear o fluxo
					}
				}
				if (onSave) {
					onSave(data);
				}
				handleClose();
			}
			toast.success(i18n.t("contactModal.success"));
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="sm"
				scroll="paper"
				PaperProps={{
					style: {
						maxHeight: '90vh',
						height: '90vh'
					}
				}}
			>
				<DialogTitle id="form-dialog-title">
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<span>{i18n.t("contactModal.form.mainInfo")} • {contactId ? i18n.t("contactModal.title.edit") : i18n.t("contactModal.title.add")}</span>
						{(() => {
							const avatarImageUrl = contact?.profilePicUrl || contact?.urlPicture;
							return (
								<div
									onClick={() => { if (avatarImageUrl) setAvatarOpen(true); }}
									style={{ cursor: avatarImageUrl ? 'pointer' : 'default' }}
								>
									<ContactAvatar contact={contact} style={{ width: 44, height: 44, borderRadius: '50%' }} />
								</div>
							);
						})()}
					</div>
				</DialogTitle>
				<Formik
					initialValues={contact}
					enableReinitialize={true}
					validationSchema={ContactSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveContact(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ values, errors, touched, isSubmitting, setFieldValue }) => (
						<Form style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
							<DialogContent dividers>
								<Grid container spacing={2}>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Código do Cliente"
											name="clientCode"
											variant="outlined"
											margin="dense"
											fullWidth
											InputLabelProps={{
												shrink: true,
											}}
											error={touched.clientCode && Boolean(errors.clientCode)}
											helperText={touched.clientCode && errors.clientCode}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label={i18n.t("contactModal.form.name")}
											name="name"
											autoFocus
											error={touched.name && Boolean(errors.name)}
											helperText={touched.name && errors.name}
											variant="outlined"
											margin="dense"
											fullWidth
											InputLabelProps={{
												shrink: true,
											}}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Empresa"
											name="bzEmpresa"
											variant="outlined"
											margin="dense"
											fullWidth
											InputLabelProps={{
												shrink: true,
											}}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field name="number">
											{({ field, form }) => {
												const cleanValue = field.value?.replace(/\D/g, '') || '';
												// Mask for Brazilian phone numbers: 55 (country code) + DDD (2 digits) + Number (9 digits)
												// Example: 55 (XX) 9XXXX-XXXX
												const mask = "+55 (99) 99999-9999";
												return (
													<InputMask
														{...field}
														mask={mask}
														maskChar={null}
														onChange={(e) => {
															const value = e.target.value;
															// Remove all non-digit characters
															const cleanValue2 = value.replace(/\D/g, '');
															form.setFieldValue('number', cleanValue2);
														}}
													>
														{(inputProps) => (
															<TextField
																{...inputProps}
																label={i18n.t("contactModal.form.number")}
																variant="outlined"
																margin="dense"
																fullWidth
																error={touched.number && Boolean(errors.number)}
																helperText={touched.number && errors.number}
																placeholder="+55 (XX) XXXXX-XXXX"
																InputLabelProps={{
																	shrink: true,
																}}
															/>
														)}
													</InputMask>
												)
											}}
										</Field>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Nome do Contato"
											name="contactName"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field name="cpfCnpj">
											{({ field, form }) => {
												const cleanValue = field.value?.replace(/\D/g, '') || '';
												// Determinar máscara: CPF (11 dígitos) ou CNPJ (14 dígitos)
												const mask = cleanValue.length > 11
													? "99.999.999/9999-99"
													: "999.999.999-999";
												return (
													<InputMask
														{...field}
														mask={mask}
														maskChar={null}
														onChange={(e) => {
															const value = e.target.value;
															form.setFieldValue('cpfCnpj', value);
														}}
													>
														{(inputProps) => (
															<TextField
																{...inputProps}
																label="CPF/CNPJ"
																variant="outlined"
																margin="dense"
																fullWidth
																error={touched.cpfCnpj && Boolean(errors.cpfCnpj)}
																helperText={touched.cpfCnpj && errors.cpfCnpj}
																placeholder="Digite CPF ou CNPJ"
																InputLabelProps={{
																	shrink: true,
																}}
															/>
														)}
													</InputMask>
												);
											}}
										</Field>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Código do Representante"
											name="representativeCode"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
											disabled={!canEditFields}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Nome Fantasia"
											name="fantasyName"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
											disabled={!canEditFields}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Cidade"
											name="city"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
											disabled={!canEditFields}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Região"
											name="region"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
											disabled={!canEditFields}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Data de Fundação"
											name="foundationDate"
											type="date"
											InputLabelProps={{
												shrink: true,
											}}
											variant="outlined"
											margin="dense"
											disabled={!canEditFields}
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Limite de Crédito"
											name="creditLimit"
											InputLabelProps={{
												shrink: true,
											}}
											variant="outlined"
											margin="dense"
											disabled={!canEditFields}
											placeholder="Insira numeros"
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Segmento de Mercado"
											name="segment"
											InputLabelProps={{
												shrink: true,
											}}
											variant="outlined"
											margin="dense"
											disabled={!canEditFields}
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Última Compra"
											name="dtUltCompra"
											type="date"
											InputLabelProps={{
												shrink: true,
											}}
											variant="outlined"
											margin="dense"
											disabled={!canEditFields}
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Instagram"
											name="instagram"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
											disabled={!canEditFields}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											disabled={!canEditFields || loadingUsers}
										>
											<InputLabel id="wallets-label">Carteira (responsáveis)</InputLabel>
											<Select
												labelId="wallets-label"
												multiple
												value={values.wallets || []}
												onChange={(e) => setFieldValue("wallets", e.target.value)}
												label="Carteira (responsáveis)"
												renderValue={(selected) => {
													const ids = Array.isArray(selected) ? selected : [];
													const names = userOptions
														.filter(u => ids.includes(u.id))
														.map(u => u.name);
													return names.join(", ");
												}}
											>
												{userOptions.map(user => (
													<MenuItem key={user.id} value={user.id}>
														<Checkbox
															checked={Array.isArray(values.wallets) && values.wallets.indexOf(user.id) > -1}
														/>
														<ListItemText primary={user.name} />
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>
									<Grid item xs={12} md={6}>
										{contact?.id ? (
											<TagsContainer contact={contact} />
										) : (
											<TagsContainer contact={{}} pendingTags={pendingTags} onPendingChange={setPendingTags} />
										)}
									</Grid>
									<Grid item xs={12} md={6}>
										<div style={{ display: 'flex', gap: 24, alignItems: 'center', paddingTop: 8 }}>
											<div>
												<Typography variant="subtitle2" gutterBottom>Encomenda</Typography>
												<GreenRedSwitch
													size="small"
													checked={Boolean(values.florder)}
													onChange={() => setFieldValue('florder', !values.florder)}
													name="florder"
												/>
												<Typography variant="body2" component="span" style={{ marginLeft: 8, fontWeight: 600, color: values.florder ? '#16a34a' : '#ef4444' }}>
													{values.florder ? 'Sim' : 'Não'}
												</Typography>
											</div>
											<div>
												<Typography variant="subtitle2" gutterBottom>Desabilitar chatbot</Typography>
												<GreenRedSwitch
													size="small"
													checked={values.disableBot}
													onChange={() => setFieldValue('disableBot', !values.disableBot)}
													name="disableBot"
												/>
												<Typography variant="body2" component="span" style={{ marginLeft: 8, fontWeight: 600, color: values.disableBot ? '#16a34a' : '#ef4444' }}>
													{values.disableBot ? 'Sim' : 'Não'}
												</Typography>
											</div>
										</div>
									</Grid>
								</Grid>
								{/* Linha única: Conexão (esquerda) | Termos LGPD (direita) */}
								<div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 8 }}>
									<Typography variant="subtitle1">
										{i18n.t("contactModal.form.whatsapp")} {contact?.whatsapp ? contact?.whatsapp.name : ""}
									</Typography>
									<Typography variant="subtitle1">
										{i18n.t("contactModal.form.termsLGDP")} {contact?.lgpdAcceptedAt ? format(new Date(contact?.lgpdAcceptedAt), "dd/MM/yyyy 'às' HH:mm") : ""}
									</Typography>
								</div>
								<Typography
									style={{ marginBottom: 8, marginTop: 12 }}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.extraInfo")}
								</Typography>

								<FieldArray name="extraInfo">
									{({ push, remove }) => (
										<>
											{values.extraInfo &&
												values.extraInfo.length > 0 &&
												values.extraInfo.map((info, index) => (
													<div
														className={classes.extraAttr}
														key={`${index}-info`}
													>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraName")}
															name={`extraInfo[${index}].name`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
															InputLabelProps={{
																shrink: true,
															}}
														/>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraValue")}
															name={`extraInfo[${index}].value`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
															InputLabelProps={{
																shrink: true,
															}}
														/>
														<IconButton
															size="small"
															onClick={() => remove(index)}
														>
															<DeleteOutlineIcon />
														</IconButton>
													</div>
												))}
											<div className={classes.extraAttr}>
												<Button
													style={{ flex: 1, marginTop: 8 }}
													variant="outlined"
													color="primary"
													onClick={() => push({ name: "", value: "" })}
												>
													{`+ ${i18n.t("contactModal.buttons.addExtraInfo")}`}
												</Button>
											</div>
										</>
									)}
								</FieldArray>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									disabled={isSubmitting}
									variant="contained"
									startIcon={<CloseIcon />}
									style={{
										background: 'linear-gradient(145deg, rgba(150, 150, 150, 0.95), rgba(100, 100, 100, 0.9))',
										backdropFilter: 'blur(12px)',
										WebkitBackdropFilter: 'blur(12px)',
										border: '1px solid rgba(255, 255, 255, 0.2)',
										color: '#fff',
										boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
										textTransform: 'none',
										fontWeight: 600,
										borderRadius: '8px',
									}}
								>
									{i18n.t("contactModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{contactId
										? `${i18n.t("contactModal.buttons.okEdit")}`
										: `${i18n.t("contactModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
			{/* Modal do Avatar */}
			<Dialog open={avatarOpen} onClose={() => setAvatarOpen(false)} maxWidth="md">
				<DialogContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					{(() => {
						const avatarImageUrl = contact?.profilePicUrl || contact?.urlPicture;
						return avatarImageUrl ? (
							<img src={avatarImageUrl} alt="Avatar" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 8 }} />
						) : (
							<ContactAvatar contact={contact} style={{ width: 270, height: 270, borderRadius: 10 }} />
						);
					})()}
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default ContactModal;
