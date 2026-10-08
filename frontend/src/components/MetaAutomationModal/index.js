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
import { i18n } from "../../translate/i18n";

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

// Valores dos gatilhos — mesmos usados pelo matcher do webhook no backend
export const TRIGGER_OPTIONS = [
	"comment_keyword",
	"comment_any",
	"story_mention",
	"referral_ref",
	"dm_keyword",
];

// Gatilhos que exibem o campo "alvo" (matchValue) — label vem do i18n
const TRIGGERS_WITH_MATCH_VALUE = [
	"comment_keyword",
	"dm_keyword",
	"referral_ref",
	"story_mention",
];

// Comportamentos que só existem para gatilhos de comentário
const COMMENT_TRIGGERS = ["comment_keyword", "comment_any"];

// Tipos de attachment aceitos pelo Send API da Meta (mídia de recompensa)
const REWARD_MEDIA_TYPES = ["image", "video", "audio", "file"];

const MetaAutomationSchema = Yup.object().shape({
	name: Yup.string().required(i18n.t("metaAutomations.modal.required")),
	whatsappId: Yup.number()
		.typeError(i18n.t("metaAutomations.modal.selectConnection"))
		.required(i18n.t("metaAutomations.modal.required")),
	channel: Yup.string()
		.oneOf(["facebook", "instagram", "both"])
		.required(i18n.t("metaAutomations.modal.required")),
	trigger: Yup.string().required(i18n.t("metaAutomations.modal.required")),
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
	autoLikeComment: false,
	requireFollower: false,
	nonFollowerAction: "skip",
	nonFollowerText: "",
	rewardMediaUrl: "",
	rewardMediaType: "image",
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
					nonFollowerAction: data.nonFollowerAction || "skip",
					rewardMediaType: data.rewardMediaType || "image",
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
			!!(values.rewardMediaUrl && values.rewardMediaUrl.trim()) ||
			!!values.flowId;
		if (!hasAction) {
			toast.error(i18n.t("metaAutomations.modal.validationAction"));
			return;
		}

		const isCommentTrigger = COMMENT_TRIGGERS.includes(values.trigger);
		const rewardUrl = (values.rewardMediaUrl || "").trim();
		const payload = {
			...values,
			flowId: values.flowId || null,
			matchValue: TRIGGERS_WITH_MATCH_VALUE.includes(values.trigger)
				? values.matchValue
				: "",
			publicReplyText: isCommentTrigger ? values.publicReplyText : "",
			// Auto-like só existe para comentários
			autoLikeComment: isCommentTrigger ? values.autoLikeComment : false,
			// Sem URL de recompensa, o tipo não faz sentido persistir
			rewardMediaUrl: rewardUrl || "",
			rewardMediaType: rewardUrl ? values.rewardMediaType : "",
			nonFollowerText: values.requireFollower ? values.nonFollowerText : "",
		};

		try {
			if (ruleId) {
				await api.put(`/meta-automations/${ruleId}`, payload);
				toast.success(i18n.t("metaAutomations.toasts.updated"));
			} else {
				await api.post("/meta-automations", payload);
				toast.success(i18n.t("metaAutomations.toasts.created"));
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
					{ruleId
						? i18n.t("metaAutomations.modal.editTitle")
						: i18n.t("metaAutomations.modal.createTitle")}
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
											label={i18n.t("metaAutomations.modal.name")}
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
											<InputLabel>{i18n.t("metaAutomations.modal.connection")}</InputLabel>
											<Select
												value={values.whatsappId}
												onChange={e => setFieldValue("whatsappId", e.target.value)}
												label={i18n.t("metaAutomations.modal.connection")}
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
													{i18n.t("metaAutomations.modal.connectionEmpty")}
												</Typography>
											)}
										</FormControl>
									</Grid>

									<Grid item xs={12} sm={6}>
										<FormControl variant="outlined" margin="dense" fullWidth>
											<InputLabel>{i18n.t("metaAutomations.modal.channel")}</InputLabel>
											<Select
												value={values.channel}
												onChange={e => setFieldValue("channel", e.target.value)}
												label={i18n.t("metaAutomations.modal.channel")}
											>
												<MenuItem value="facebook">Facebook</MenuItem>
												<MenuItem value="instagram">Instagram</MenuItem>
												<MenuItem value="both">{i18n.t("metaAutomations.channels.both")}</MenuItem>
											</Select>
										</FormControl>
									</Grid>

									<Grid item xs={12} sm={6}>
										<FormControl variant="outlined" margin="dense" fullWidth>
											<InputLabel>{i18n.t("metaAutomations.modal.trigger")}</InputLabel>
											<Select
												value={values.trigger}
												onChange={e => setFieldValue("trigger", e.target.value)}
												label={i18n.t("metaAutomations.modal.trigger")}
											>
												{TRIGGER_OPTIONS.map(t => (
													<MenuItem key={t} value={t}>
														{i18n.t(`metaAutomations.triggers.${t}`)}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									{TRIGGERS_WITH_MATCH_VALUE.includes(values.trigger) && (
										<Grid item xs={12} sm={6}>
											<Field
												as={TextField}
												label={i18n.t(
													`metaAutomations.modal.matchValueLabels.${values.trigger}`
												)}
												name="matchValue"
												variant="outlined"
												margin="dense"
												fullWidth
											/>
										</Grid>
									)}

									<Grid item xs={12}>
										<Typography className={classes.sectionLabel}>
											{i18n.t("metaAutomations.modal.actionsSection")}
										</Typography>
									</Grid>

									<Grid item xs={12}>
										<Field
											as={TextField}
											label={i18n.t("metaAutomations.modal.dmMessage")}
											name="dmText"
											multiline
											rows={3}
											variant="outlined"
											margin="dense"
											fullWidth
										/>
										<Typography className={classes.hint}>
											{i18n.t("metaAutomations.modal.dmHint")}
										</Typography>
									</Grid>

									<Grid item xs={12} sm={8}>
										<Field
											as={TextField}
											label={i18n.t("metaAutomations.modal.rewardUrl")}
											name="rewardMediaUrl"
											variant="outlined"
											margin="dense"
											fullWidth
											placeholder="https://..."
										/>
									</Grid>

									<Grid item xs={12} sm={4}>
										<FormControl variant="outlined" margin="dense" fullWidth>
											<InputLabel>{i18n.t("metaAutomations.modal.rewardType")}</InputLabel>
											<Select
												value={values.rewardMediaType}
												onChange={e => setFieldValue("rewardMediaType", e.target.value)}
												label={i18n.t("metaAutomations.modal.rewardType")}
											>
												{REWARD_MEDIA_TYPES.map(t => (
													<MenuItem key={t} value={t}>
														{i18n.t(`metaAutomations.modal.rewardTypes.${t}`)}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									<Grid item xs={12}>
										<Typography className={classes.hint}>
											{i18n.t("metaAutomations.modal.rewardHint")}
										</Typography>
									</Grid>

									{COMMENT_TRIGGERS.includes(values.trigger) && (
										<Grid item xs={12}>
											<Field
												as={TextField}
												label={i18n.t("metaAutomations.modal.publicReply")}
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
											<InputLabel>{i18n.t("metaAutomations.modal.flow")}</InputLabel>
											<Select
												value={values.flowId}
												onChange={e => setFieldValue("flowId", e.target.value)}
												label={i18n.t("metaAutomations.modal.flow")}
											>
												<MenuItem value="">{i18n.t("metaAutomations.modal.flowNone")}</MenuItem>
												{flows.map(f => (
													<MenuItem key={f.id} value={f.id}>
														{f.name}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Grid>

									{COMMENT_TRIGGERS.includes(values.trigger) && (
										<Grid item xs={12} sm={6}>
											<FormControlLabel
												control={
													<Switch
														checked={Boolean(values.autoLikeComment)}
														onChange={e => setFieldValue("autoLikeComment", e.target.checked)}
														color="primary"
													/>
												}
												label={i18n.t("metaAutomations.modal.autoLike")}
											/>
											<Typography className={classes.hint}>
												{i18n.t("metaAutomations.modal.autoLikeHint")}
											</Typography>
										</Grid>
									)}

									<Grid item xs={12} sm={6}>
										<FormControlLabel
											control={
												<Switch
													checked={Boolean(values.requireFollower)}
													onChange={e => setFieldValue("requireFollower", e.target.checked)}
													color="primary"
												/>
											}
											label={i18n.t("metaAutomations.modal.requireFollower")}
										/>
										<Typography className={classes.hint}>
											{i18n.t("metaAutomations.modal.requireFollowerHint")}
										</Typography>
									</Grid>

									{values.requireFollower && (
										<>
											<Grid item xs={12} sm={6}>
												<FormControl variant="outlined" margin="dense" fullWidth>
													<InputLabel>{i18n.t("metaAutomations.modal.nonFollowerAction")}</InputLabel>
													<Select
														value={values.nonFollowerAction}
														onChange={e => setFieldValue("nonFollowerAction", e.target.value)}
														label={i18n.t("metaAutomations.modal.nonFollowerAction")}
													>
														<MenuItem value="skip">
															{i18n.t("metaAutomations.modal.nonFollowerSkip")}
														</MenuItem>
														<MenuItem value="ask_follow">
															{i18n.t("metaAutomations.modal.nonFollowerAsk")}
														</MenuItem>
													</Select>
												</FormControl>
											</Grid>
											{values.nonFollowerAction === "ask_follow" && (
												<Grid item xs={12}>
													<Field
														as={TextField}
														label={i18n.t("metaAutomations.modal.nonFollowerText")}
														name="nonFollowerText"
														multiline
														rows={2}
														variant="outlined"
														margin="dense"
														fullWidth
													/>
												</Grid>
											)}
										</>
									)}

									<Grid item xs={12}>
										<FormControlLabel
											control={
												<Switch
													checked={Boolean(values.active)}
													onChange={e => setFieldValue("active", e.target.checked)}
													color="primary"
												/>
											}
											label={i18n.t("metaAutomations.modal.active")}
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
									{i18n.t("metaAutomations.modal.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{ruleId
										? i18n.t("metaAutomations.modal.save")
										: i18n.t("metaAutomations.modal.create")}
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
