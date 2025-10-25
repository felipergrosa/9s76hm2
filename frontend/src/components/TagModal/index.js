import React, { useState, useEffect, useContext } from "react";

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
import { Colorize, Add, Delete, PlayArrow, Visibility } from "@material-ui/icons";
import { ColorBox } from 'material-ui-color';

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select, Typography, Paper, Divider, Chip, Box } from "@material-ui/core";
import { Grid } from "@material-ui/core";
import Autocomplete from '@material-ui/lab/Autocomplete';

const SITUATION_VALUES = [
	"Ativo",
	"Baixado",
	"Ex-Cliente",
	"Excluido",
	"Futuro",
	"Inativo"
];

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
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
	formControl: {
		margin: theme.spacing(1),
		minWidth: 120,
	},
	colorAdorment: {
		width: 20,
		height: 20,
	},
	automationSection: {
		marginTop: theme.spacing(2),
		padding: theme.spacing(2),
		backgroundColor: theme.palette.background.default,
	},
	ruleCard: {
		padding: theme.spacing(2),
		marginBottom: theme.spacing(1),
		backgroundColor: theme.palette.background.paper,
	},
}));

const TagSchema = Yup.object().shape({
	name: Yup.string()
		.min(3, "Mensagem muito curta")
		.required("Obrigatório")
});

const TagModal = ({ open, onClose, tagId, kanban }) => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);
	const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
	const [lanes, setLanes] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selectedLane, setSelectedLane] = useState([]);
	const [selectedRollbackLane, setSelectedRollbackLane] = useState([]);
	const [tagRules, setTagRules] = useState([]);
	const [applyingRules, setApplyingRules] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewContacts, setPreviewContacts] = useState([]);
	const [fieldValues, setFieldValues] = useState({});

	const fetchFieldValues = async fieldName => {
		if (!fieldName) return;
		if (fieldName === 'situation') {
			setFieldValues(prev => ({
				...prev,
				situation: SITUATION_VALUES
			}));
			return;
		}
		try {
			const { data } = await api.get(`/tag-rules/field-values/${fieldName}`);
			setFieldValues(prev => ({
				...prev,
				[fieldName]: data.values || []
			}));
		} catch (err) {
			console.error("Erro ao buscar valores do campo:", err);
		}
	};

	const initialState = {
		name: "",
		color: getRandomHexColor(),
		kanban: kanban,
		timeLane: 0,
		nextLaneId: 0,
		greetingMessageLane: "",
		rollbackLaneId: 0,
	};

	const [tag, setTag] = useState(initialState);

	useEffect(() => {
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchTags = async () => {
				try {
					const { data } = await api.get("/tags/", {
						params: { kanban: 1, tagId },
					});
					setLanes(data.tags);
				} catch (err) {
					toastError(err);
				}
			};
			fetchTags();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, []);

	useEffect(() => {
		try {
			(async () => {
				if (!tagId) return;

				const { data } = await api.get(`/tags/${tagId}`);
				setTag(prevState => {
					return { ...prevState, ...data };
				});
				if (data.nextLaneId) {
					setSelectedLane(data.nextLaneId);
				}
				if (data.rollbackLaneId) {
					setSelectedRollbackLane(data.rollbackLaneId);
				}

				// Busca regras de automação se for tag de permissão (#)
				if (data.name && data.name.startsWith('#')) {
					try {
						const { data: rulesData } = await api.get(`/tag-rules/tag/${tagId}`);
						const rulesForDisplay = rulesData.map(r => {
							let valuesArray = [];
							if (r.operator === 'in' && r.value) {
								try {
									const parsed = JSON.parse(r.value);
									if (Array.isArray(parsed)) {
										valuesArray = parsed;
									} else if (typeof parsed === 'string') {
										valuesArray = parsed.split(',').map(v => v.trim()).filter(v => v);
									}
								} catch (e) {
									valuesArray = r.value.split(',').map(v => v.trim()).filter(v => v);
								}
							}
							return {
								...r,
								operator: 'in',
								value: valuesArray
							};
						});
						setTagRules(rulesForDisplay);
						// Pré-carrega valores disponíveis para cada campo
						const uniqueFields = [...new Set(rulesForDisplay.map(rule => rule.field).filter(Boolean))];
						for (const fieldName of uniqueFields) {
							await fetchFieldValues(fieldName);
						}
					} catch (err) {
						console.error("Erro ao buscar regras:", err);
					}
				}
			})()
		} catch (err) {
			toastError(err);
		}
	}, [tagId, open]);

	const handleClose = () => {
		setTag(initialState);
		setColorPickerModalOpen(false);
		setTagRules([]);
		onClose();
	};

	const handleAddRule = () => {
		setTagRules([...tagRules, {
			field: "",
			operator: "in",
			value: [],
			active: true,
			logic: "AND"
		}]);
	};

	const handleRemoveRule = async (index, ruleId) => {
		if (ruleId) {
			try {
				await api.delete(`/tag-rules/${ruleId}`);
				toast.success("Regra removida com sucesso!");
			} catch (err) {
				toastError(err);
				return;
			}
		}
		const newRules = tagRules.filter((_, i) => i !== index);
		setTagRules(newRules);
	};

	const handleRuleChange = async (index, field, value) => {
		const newRules = [...tagRules];
		newRules[index][field] = value;

		// Garante operador default 'in'
		if (!newRules[index].operator) {
			newRules[index].operator = "in";
		}

		if (field === 'field') {
			// Limpa valores anteriores
			newRules[index].value = [];

			if (value) {
				if (value === 'situation') {
					setFieldValues(prev => ({
						...prev,
						situation: SITUATION_VALUES
					}));
				} else {
					try {
						const { data } = await api.get(`/tag-rules/field-values/${value}`);
						setFieldValues(prev => ({
							...prev,
							[value]: data.values || []
						}));
					} catch (err) {
						console.error("Erro ao buscar valores do campo:", err);
					}
				}
			}
		}

		if (field === 'value' && !Array.isArray(value)) {
			newRules[index].value = value ? [value] : [];
		}

		setTagRules(newRules);
	};

	const handleSaveRules = async () => {
		if (!tagId) {
			toast.warning("Salve a tag primeiro antes de adicionar regras");
			return false;
		}

		try {
			for (const rule of tagRules) {
				if (!rule.field) continue;
				const valuesArray = Array.isArray(rule.value)
					? rule.value.filter(v => v && v.trim())
					: (rule.value ? [rule.value] : []);
				if (valuesArray.length === 0) continue;

				const valueToSave = JSON.stringify(valuesArray);

				const ruleData = {
					tagId: tagId,
					field: rule.field,
					operator: 'in',
					value: valueToSave,
					active: rule.active
				};

				if (rule.id) {
					await api.put(`/tag-rules/${rule.id}`, ruleData);
				} else {
					await api.post('/tag-rules', ruleData);
				}
			}
			toast.success("Regras salvas com sucesso!");
			// Recarrega regras
			const { data: rulesData } = await api.get(`/tag-rules/tag/${tagId}`);
			const rulesForDisplay = rulesData.map(r => {
				let valuesArray = [];
				if (r.operator === 'in' && r.value) {
					try {
						const parsed = JSON.parse(r.value);
						if (Array.isArray(parsed)) {
							valuesArray = parsed;
						} else if (typeof parsed === 'string') {
							valuesArray = parsed.split(',').map(v => v.trim()).filter(v => v);
						}
					} catch (e) {
						valuesArray = r.value.split(',').map(v => v.trim()).filter(v => v);
					}
				}
				return {
					...r,
					operator: 'in',
					value: valuesArray
				};
			});
			setTagRules(rulesForDisplay);
			const uniqueFields = [...new Set(rulesForDisplay.map(rule => rule.field).filter(Boolean))];
			for (const fieldName of uniqueFields) {
				await fetchFieldValues(fieldName);
			}
			return true;
		} catch (err) {
			toastError(err);
			return false;
		}
	};

	const handlePreviewRules = async () => {
		if (!tagId) {
			toast.warning("Salve a tag primeiro");
			return;
		}
		const saved = await handleSaveRules();
		if (!saved) return;

		try {
			const { data } = await api.get(`/tag-rules/preview/${tagId}`);
			setPreviewContacts(data.contacts || []);
			toast.info(`${data.contactsCount} contatos serão afetados`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleApplyRules = async () => {
		if (!tagId) {
			toast.warning("Salve a tag primeiro");
			return;
		}
		const saved = await handleSaveRules();
		if (!saved) return;

		setApplyingRules(true);
		try {
			const { data } = await api.post(`/tag-rules/apply/${tagId}`);
			toast.success(`Regras aplicadas! ${data.results[0]?.contactsAffected || 0} contatos afetados`);
		} catch (err) {
			toastError(err);
		} finally {
			setApplyingRules(false);
		}
	};

	const handleSaveTag = async values => {
		// Validação: usuários não-admin não podem criar tags com #
		if (user.profile !== "admin" && values.name && values.name.startsWith("#")) {
			toast.error("Apenas administradores podem criar tags de permissão (com #)");
			return;
		}

		const tagData = { ...values, userId: user?.id, kanban: kanban, nextLaneId: selectedLane || null, rollbackLaneId: selectedRollbackLane || null };

		try {
			if (tagId) {
				await api.put(`/tags/${tagId}`, tagData);
			} else {
				await api.post("/tags", tagData);
			}
			toast.success(kanban === 0 ? `${i18n.t("tagModal.success")}` : `${i18n.t("tagModal.successKanban")}`);

		} catch (err) {
			toastError(err);
		}
		handleClose();
	};

	function getRandomHexColor() {
		// Gerar valores aleatórios para os componentes de cor
		const red = Math.floor(Math.random() * 256); // Valor entre 0 e 255
		const green = Math.floor(Math.random() * 256); // Valor entre 0 e 255
		const blue = Math.floor(Math.random() * 256); // Valor entre 0 e 255

		// Converter os componentes de cor em uma cor hexadecimal
		const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;

		return hexColor;
	}

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="md"
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="form-dialog-title">
					{(tagId ? (kanban === 0 ? `${i18n.t("tagModal.title.edit")}` : `${i18n.t("tagModal.title.editKanban")}`) :
						(kanban === 0 ? `${i18n.t("tagModal.title.add")}` : `${i18n.t("tagModal.title.addKanban")}`))
					}
				</DialogTitle>
				<Formik
					initialValues={tag}
					enableReinitialize={true}
					validationSchema={TagSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveTag(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values }) => (
						<Form>
							<DialogContent dividers>
								<Grid container spacing={1}>
									<Grid item xs={12} md={12} xl={12}>
										<Field
											as={TextField}
											label={i18n.t("tagModal.form.name")}
											name="name"
											error={touched.name && Boolean(errors.name)}
											helperText={touched.name && errors.name}
											variant="outlined"
											margin="dense"
											onChange={(e) => setTag(prev => ({ ...prev, name: e.target.value }))}
											fullWidth

										/>
									</Grid>
									<Grid item xs={12} md={12} xl={12}>
										<Field
											as={TextField}
											fullWidth
											label={i18n.t("tagModal.form.color")}
											name="color"
											autoFocus
											id="color"
											error={touched.color && Boolean(errors.color)}
											helperText={touched.color && errors.color}
											InputProps={{
												startAdornment: (
													<InputAdornment position="start">
														<div
															style={{ backgroundColor: values.color }}
															className={classes.colorAdorment}
														></div>
													</InputAdornment>
												),
												endAdornment: (
													<IconButton
														size="small"
														color="default"
														onClick={() => setColorPickerModalOpen(!colorPickerModalOpen)}
													>
														<Colorize />
													</IconButton>
												),
											}}
											variant="outlined"
											margin="dense"
										/>

										{colorPickerModalOpen && (
											<div>
												<ColorBox
													disableAlpha={true}
													hslGradient={false}
													style={{ margin: '20px auto 0' }}
													value={tag.color}
													onChange={val => {
														setTag(prev => ({ ...prev, color: `#${val.hex}` }));
													}}
												/>
											</div>
										)}
									</Grid>

									{kanban === 1 && (
										<>
											<Grid item xs={12} md={6} xl={6}>
												<Field
													as={TextField}
													label={i18n.t("tagModal.form.timeLane")}
													name="timeLane"
													error={touched.timeLane && Boolean(errors.timeLane)}
													helperText={touched.timeLane && errors.timeLane}
													variant="outlined"
													margin="dense"
													onChange={(e) => setTag(prev => ({ ...prev, timeLane: e.target.value }))}
													fullWidth
												/>
											</Grid>
											<Grid item xs={12} md={6} xl={6}>
												<FormControl
													variant="outlined"
													margin="dense"
													fullWidth
													className={classes.formControl}
												>
													<InputLabel id="whatsapp-selection-label">
														{i18n.t("tagModal.form.nextLaneId")}
													</InputLabel>
													<Field
														as={Select}
														label={i18n.t("tagModal.form.nextLaneId")}
														placeholder={i18n.t("tagModal.form.nextLaneId")}
														labelId="whatsapp-selection-label"
														id="nextLaneId"
														name="nextLaneId"
														style={{ left: "-7px" }}
														error={touched.nextLaneId && Boolean(errors.nextLaneId)}
														value={selectedLane}
														onChange={(e) => setSelectedLane(e.target.value || null)}
													>
														<MenuItem value={null}>&nbsp;</MenuItem>
														{lanes &&
															lanes.map((lane) => (
																<MenuItem key={lane.id} value={lane.id}>
																	{lane.name}
																</MenuItem>
															))}
													</Field>
												</FormControl>
											</Grid>
											<Grid item xs={12} md={12} xl={12}>
												<Field
													as={TextField}
													label={i18n.t("tagModal.form.greetingMessageLane")}
													name="greetingMessageLane"
													rows={5}
													multiline
													error={touched.greetingMessageLane && Boolean(errors.greetingMessageLane)}
													helperText={touched.greetingMessageLane && errors.greetingMessageLane}
													variant="outlined"
													margin="dense"
													onChange={(e) => setTag(prev => ({ ...prev, greetingMessageLane: e.target.value }))}
													fullWidth
												/>
											</Grid>
											<Grid item xs={12} md={12} xl={12}>
												<FormControl
													variant="outlined"
													margin="dense"
													fullWidth
													className={classes.formControl}
												>
													<InputLabel id="whatsapp-selection-label">
														{i18n.t("tagModal.form.rollbackLaneId")}
													</InputLabel>
													<Field
														as={Select}
														label={i18n.t("tagModal.form.rollbackLaneId")}
														placeholder={i18n.t("tagModal.form.rollbackLaneId")}
														labelId="whatsapp-selection-label"
														id="rollbackLaneId"
														name="rollbackLaneId"
														style={{ left: "-7px" }}
														error={touched.rollbackLaneId && Boolean(errors.rollbackLaneId)}
														value={selectedRollbackLane}
														onChange={(e) => setSelectedRollbackLane(e.target.value)}
													>
														<MenuItem value={null}>&nbsp;</MenuItem>
														{lanes &&
															lanes.map((lane) => (
																<MenuItem key={lane.id} value={lane.id}>
																	{lane.name}
																</MenuItem>
															))}
													</Field>
												</FormControl>
											</Grid>
										</>
									)}

									{/* Seção de Automação - apenas para tags de permissão (#) */}
									{kanban === 0 && tag.name && tag.name.startsWith('#') && tagId && (
										<Grid item xs={12}>
											<Paper className={classes.automationSection}>
												<Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
													<Typography variant="h6">
														🤖 Automação de Tags
													</Typography>
													<Box>
														<Button
															size="small"
															startIcon={<Add />}
															onClick={handleAddRule}
															color="primary"
															variant="outlined"
															style={{ marginRight: 8 }}
														>
															Nova Regra
														</Button>
														<Button
															size="small"
															startIcon={<Visibility />}
															onClick={handlePreviewRules}
															color="default"
															variant="outlined"
															disabled={tagRules.length === 0}
															style={{ marginRight: 8 }}
														>
															Preview
														</Button>
														<Button
															size="small"
															startIcon={<PlayArrow />}
															onClick={handleApplyRules}
															color="secondary"
															variant="contained"
															disabled={applyingRules || tagRules.length === 0}
														>
															{applyingRules ? "Aplicando..." : "Aplicar Agora"}
														</Button>
													</Box>
												</Box>

												<Typography variant="body2" color="textSecondary" gutterBottom>
													Defina regras para aplicar esta tag automaticamente em contatos que atendam TODAS as condições (AND).
												</Typography>

												<Divider style={{ margin: '16px 0' }} />

												{tagRules.length === 0 ? (
													<Box textAlign="center" py={3}>
														<Typography variant="body2" color="textSecondary">
															Nenhuma regra configurada. Clique em "Nova Regra" para começar.
														</Typography>
													</Box>
												) : (
													tagRules.map((rule, index) => (
														<Paper key={index} className={classes.ruleCard} elevation={2}>
															<Grid container spacing={2} alignItems="center">
																<Grid item xs={12} sm={3}>
																	<TextField
																		select
																		fullWidth
																		size="small"
																		label="Campo"
																		value={rule.field}
																		onChange={(e) => handleRuleChange(index, 'field', e.target.value)}
																		variant="outlined"
																	>
																		<MenuItem value="representativeCode">Código do Representante</MenuItem>
																		<MenuItem value="city">Cidade</MenuItem>
																		<MenuItem value="region">Região</MenuItem>
																		<MenuItem value="segment">Segmento</MenuItem>
																		<MenuItem value="situation">Situação</MenuItem>
																	</TextField>
																</Grid>

																<Grid item xs={12} sm={8}>
																	{fieldValues[rule.field] && fieldValues[rule.field].length > 0 ? (
																		<Autocomplete
																			multiple
																			freeSolo
																			size="small"
																			options={fieldValues[rule.field] || []}
																			value={Array.isArray(rule.value) ? rule.value : []}
																			onChange={(e, newValue) => handleRuleChange(index, 'value', newValue)}
																			renderInput={(params) => (
																				<TextField
																					{...params}
																					variant="outlined"
																					label="Valores"
																					placeholder="Selecione ou digite"
																				/>
																			)}
																			disabled={rule.operator === 'not_null' || rule.operator === 'is_null'}
																		/>
																	) : (
																		<TextField
																			fullWidth
																			size="small"
																			label={'Valores (separados por vírgula)'}
																			value={Array.isArray(rule.value) ? rule.value.join(', ') : ''}
																			onChange={(e) => {
																				const parts = e.target.value.split(',').map(v => v.trim()).filter(v => v);
																				handleRuleChange(index, 'value', parts);
																			}}
																			variant="outlined"
																			placeholder={'Sul, Sudeste, Centro-Oeste'}
																		/>
																	)}
																</Grid>

																<Grid item xs={12} sm={1}>
																	<IconButton
																		size="small"
																		color="secondary"
																		onClick={() => handleRemoveRule(index, rule.id)}
																	>
																		<Delete />
																	</IconButton>
																</Grid>

																{rule.id && (
																	<Grid item xs={12}>
																		<Chip
																			size="small"
																			label={`Regra #${rule.id}`}
																			color="primary"
																			variant="outlined"
																		/>
																	</Grid>
																)}
															</Grid>
														</Paper>
													))
												)}

												{tagRules.length > 0 && (
													<Box mt={2} display="flex" justifyContent="flex-end">
														<Button
															variant="contained"
															color="primary"
															onClick={handleSaveRules}
														>
															Salvar Regras
														</Button>
													</Box>
												)}
											</Paper>
										</Grid>
									)}
								</Grid>

							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("tagModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{tagId
										? `${i18n.t("tagModal.buttons.okEdit")}`
										: `${i18n.t("tagModal.buttons.okAdd")}`}
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
		</div>
	);
};

export default TagModal;
