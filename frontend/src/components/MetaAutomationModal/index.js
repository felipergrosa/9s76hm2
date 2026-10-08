import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
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
	sectionLabel: {
		marginTop: theme.spacing(1),
		marginBottom: theme.spacing(0.5),
		color: theme.palette.text.secondary,
		fontSize: "0.78rem",
		fontWeight: 600,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	},
	hint: {
		color: theme.palette.text.secondary,
		fontSize: "0.75rem",
		marginTop: theme.spacing(0.5),
	},
}));

// Rótulos amigáveis dos gatilhos — mesmos valores usados pelo matcher do webhook
export const TRIGGER_OPTIONS = [
	{ value: "comment_keyword", label: "Comentário com palavra-chave" },
	{ value: "comment_any", label: "Qualquer comentário" },
	{ value: "story_mention", label: "Menção em story" },
	{ value: "referral_ref", label: "Link m.me com ref" },
	{ value: "dm_keyword", label: "DM com palavra-chave" },
];

// Label do campo "alvo" (matchValue) varia conforme o gatilho;
// gatilhos ausentes do mapa não exibem o campo
const MATCH_VALUE_LABELS = {
	comment_keyword: "Palavra-chave",
	dm_keyword: "Palavra-chave",
	referral_ref: "Ref do link",
	story_mention: "ID do post/media (opcional)",
};

// Resposta pública só existe para gatilhos de comentário
const COMMENT_TRIGGERS = ["comment_keyword", "comment_any"];

const MetaAutomationSchema = Yup.object().shape({
	name: Yup.string().required("Obrigatório"),
	whatsappId: Yup.number()
		.typeError("Selecione uma conexão")
		.required("Obrigatório"),
	channel: Yup.string()
		.oneOf(["facebook", "instagram", "both"])
		.required("Obrigatório"),
	trigger: Yup.string().required("Obrigatório"),
});

const initialState = {
	name: "",
	whatsappId: "",
	channel: "both",
	trigger: "comment_keyword",
	matchValue: "",
	dmText: "",
	publicReplyText: "",
	flowId: "",
	active: true,
};

const MetaAutomationModal = ({ open, onClose, ruleId, onSaved }) => {
	const classes = useStyles();

	const [rule, setRule] = useState(initialState);
	const [whatsapps, setWhatsapps] = useState([]);
	const [flows, setFlows] = useState([]);

	// Conexões Meta: /whatsapp pode retornar array direto ou objeto paginado
	useEffect(() => {
		const fetchWhatsapps = async () => {
			try {
				const { data } = await api.get("/whatsapp");
				const list = Array.isArray(data)
					? data
					: (data && Array.isArray(data.whatsapps) ? data.whatsapps : []);
				setWhatsapps(
					list.filter(
						w => w.channel === "facebook" || w.channel === "instagram"
					)
				);
			} catch (err) {
				toastError(err);
			}
		};
		fetchWhatsapps();
	}, []);

	// Fluxos publicados do FlowBuilder — ação opcional da regra
	useEffect(() => {
		const fetchFlows = async () => {
			try {
				const { data } = await api.get("/flowbuilder");
				const list = Array.isArray(data?.flows) ? data.flows : [];
				setFlows(list.filter(f => f.status === "published"));
			} catch (err) {
				// 403 = sem permissão flowbuilder.view — select fica só com "Nenhum"
				if (err?.response?.status !== 403) {
					toastError(err);
				}
			}
		};
		fetchFlows();
	}, []);

	// Edição: carrega a regra quando o modal abre com ruleId
	useEffect(() => {
		if (!open) return;
		if (!ruleId) {
			setRule(initialState);
			return;
		}
		const fetchRule = async () => {
			try {
				const { data } = await api.get(`/meta-automations/${ruleId}`);
				setRule({
					...initialState,
					...data,
					flowId: data.flowId || "",
				});
			} catch (err) {
				toastError(err);
			}
		};
		fetchRule();
	}, [ruleId, open]);

	const handleClose = () => {
		setRule(initialState);
		onClose();
	};

	const handleSave = async values => {
		// Ao menos uma ação é obrigatória: DM, resposta pública ou fluxo
		const hasAction =
			!!(values.dmText && values.dmText.trim()) ||
			!!(values.publicReplyText && values.publicReplyText.trim()) ||
			!!values.flowId;
		if (!hasAction) {
			toast.error(
				"Defina ao menos uma ação: mensagem de DM, resposta pública ou fluxo."
			);
			return;
		}

		const payload = {
			...values,
			flowId: values.flowId || null,
			matchValue: MATCH_VALUE_LABELS[values.trigger]
				? values.matchValue
				: "",
			publicReplyText: COMMENT_TRIGGERS.includes(values.trigger)
				? values.publicReplyText
				: "",
		};

		try {
			if (ruleId) {
				await api.put(`/meta-automations/${ruleId}`, payload);
				toast.success("Regra de automação atualizada");
			} else {
				await api.post("/meta-automations", payload);
				toast.success("Regra de automação criada");
			}
			if (onSaved) onSaved();
			handleClose();
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
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="meta-automation-dialog-title">
					{ruleId ? "Editar regra de automação" : "Nova regra de automação"}
				</DialogTitle>
				<Formik
					initialValues={rule}
					enableReinitialize={true}
					validationSchema={MetaAutomationSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSave(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ values, errors, touched, isSubmitting, setFieldValue }) => (
						<Form>
							<DialogContent dividers>
								<Grid container spacing={2}>
									<Grid item xs={12}>
										<Field
											as={TextField}
											label="Nome da regra"
											name="name"
											autoFocus
											error={touched.name && Boolean(errors.name)}
											helperText={touched.name && errors.name}
											variant="outlined"
											margin="dense"
											fullWidth
										/>
									</Grid>

									<Grid item xs={12} sm={6}>
										<FormControl
											variant="outlined"
											margin="dense"
											fullWidth
											error={touched.whatsappId && Boolean(errors.whatsappId)}
										>
											<InputLabel>Conexão</InputLabel>
											<Select
												value={values.whatsappId}
												onChange={e => setFieldValue("whatsappId", e.target.value)}
												label="Conexão"
											>
												{whatsapps.map(w => (
													<MenuItem key={w.id} value={w.id}>
														{w.name} ({w.channel === "facebook" ? "Facebook" : "Instagram"})
													</MenuItem>
												))}
											</Select>
											{touched.whatsappId && errors.whatsappId && (
												<Typography variant="caption" color="error">
													{errors.whatsappId}
												</Typography>
											)}
											{whatsapps.length === 0 && (
												<Typography className={classes.hint}>
													Nenhuma conexão Facebook/Instagram encontrada.
												</Typography>
											)}
										</FormControl>
									</Grid>

									<Grid item xs={12} sm={6}>
										<FormControl variant="outlined" margin="dense" fullWidth>
											<InputLabel>Canal</InputLabel>
											<Select
												value={values.channel}
												onChange={e => setFieldValue("channel", e.target.value)}
												label="Canal"
											>
												<MenuItem value="facebook">Facebook</MenuItem>
												<MenuItem value="instagram">Instagram</MenuItem>
												<MenuItem value="both">Ambos</MenuItem>
											</Select>
										</FormControl>
									</Grid>

									<Grid item xs={12} sm={6}>
										<FormControl variant="outlined" margin="dense" fullWidth>
											<InputLabel>Gatilho</InputLabel>
											<Select
												value={values.trigger}
												onChange={e => setFieldValue("trigger", e.target.value)}
												label="Gatilho"
											>
												{TRIGGER_OPTIONS.map(t => (
													<MenuItem key={t.value} value={t.value}>
														{t.label}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									{MATCH_VALUE_LABELS[values.trigger] && (
										<Grid item xs={12} sm={6}>
											<Field
												as={TextField}
												label={MATCH_VALUE_LABELS[values.trigger]}
												name="matchValue"
												variant="outlined"
												margin="dense"
												fullWidth
											/>
										</Grid>
									)}

									<Grid item xs={12}>
										<Typography className={classes.sectionLabel}>
											Ações
										</Typography>
									</Grid>

									<Grid item xs={12}>
										<Field
											as={TextField}
											label="Mensagem de DM"
											name="dmText"
											multiline
											rows={3}
											variant="outlined"
											margin="dense"
											fullWidth
										/>
										<Typography className={classes.hint}>
											Variáveis disponíveis: {"{{contact.name}}"} — opcional se um
											fluxo estiver selecionado.
										</Typography>
									</Grid>

									{COMMENT_TRIGGERS.includes(values.trigger) && (
										<Grid item xs={12}>
											<Field
												as={TextField}
												label="Resposta pública ao comentário"
												name="publicReplyText"
												multiline
												rows={2}
												variant="outlined"
												margin="dense"
												fullWidth
											/>
										</Grid>
									)}

									<Grid item xs={12}>
										<FormControl variant="outlined" margin="dense" fullWidth>
											<InputLabel>Fluxo (FlowBuilder)</InputLabel>
											<Select
												value={values.flowId}
												onChange={e => setFieldValue("flowId", e.target.value)}
												label="Fluxo (FlowBuilder)"
											>
												<MenuItem value="">Nenhum</MenuItem>
												{flows.map(f => (
													<MenuItem key={f.id} value={f.id}>
														{f.name}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									<Grid item xs={12}>
										<FormControlLabel
											control={
												<Switch
													checked={Boolean(values.active)}
													onChange={e => setFieldValue("active", e.target.checked)}
													color="primary"
												/>
											}
											label="Regra ativa"
										/>
									</Grid>
								</Grid>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{ruleId ? "Salvar" : "Criar regra"}
									{isSubmitting && (
										<CircularProgress size={24} className={classes.buttonProgress} />
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default MetaAutomationModal;
