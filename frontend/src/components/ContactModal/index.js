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
import CircularProgress from "@material-ui/core/CircularProgress";
import Switch from "@material-ui/core/Switch";
import withStyles from "@material-ui/core/styles/withStyles";
import { Grid, FormControl, InputLabel, MenuItem, Select } from "@material-ui/core";
import ContactAvatar from "../ContactAvatar";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { TagsContainer } from "../TagsContainer";
import InputMask from "react-input-mask";
import { isValidCPF, isValidCNPJ } from "../../utils/validators";
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

	const initialState = {
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
	};

	const [contact, setContact] = useState(initialState);
	const [disableBot, setDisableBot] = useState(false);
	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchContact = async () => {
			if (initialValues) {
				setContact(prevState => {
					return { ...prevState, ...initialValues };
				});
			}

			if (!contactId) return;

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact(data);
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
		try {
			if (contactId) {
				await api.put(`/contacts/${contactId}`, { ...values, disableBot: values.disableBot });
				handleClose();
			} else {
				const { data } = await api.post("/contacts", { ...values, disableBot: values.disableBot });
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
			<Dialog open={open} onClose={handleClose} maxWidth="sm" scroll="paper">
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
						<Form>
							<DialogContent dividers>
								<Grid container spacing={2}>
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
											disabled
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
											disabled
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
											//disabled
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
											disabled
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
											disabled
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="Valor da Última Compra (R$)"
											name="vlUltCompra"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											placeholder="Ex.: 1.234,56"
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
										>
											<InputLabel id="situation-select-label" shrink>Situação</InputLabel>
											<Field
												as={Select}
												labelId="situation-select-label"
												id="situation-select"
												name="situation"
												label="Situação"
											>
												<MenuItem value="Ativo">Ativo</MenuItem>
												<MenuItem value="Baixado">Baixado</MenuItem>
												<MenuItem value="Ex-Cliente">Ex-Cliente</MenuItem>
												<MenuItem value="Excluido">Excluído</MenuItem>
												<MenuItem value="Futuro">Futuro</MenuItem>
												<MenuItem value="Inativo">Inativo</MenuItem>
											</Field>
										</FormControl>
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
										/>
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
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
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
