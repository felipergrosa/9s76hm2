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
import { Grid, FormControl, InputLabel, MenuItem, Select, Checkbox, ListItemText, Chip } from "@material-ui/core";
import { Autocomplete } from "@material-ui/lab";
import ContactAvatar from "../ContactAvatar";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import InputMask from "react-input-mask";
import { isValidCPF, isValidCNPJ } from "../../utils/validators";
import usePermissions from "../../hooks/usePermissions";
// OTIMIZAÇÃO: ACCENT_MAP básico inline para evitar chunk de 22s
// import { autoCorrectText } from "../../hooks/useSpellChecker";
const ACCENT_MAP_BASIC = {
  'nao': 'não', 'sim': 'sim', 'esta': 'está', 'tambem': 'também', 'ja': 'já',
  'voce': 'você', 'voces': 'vocês', 'nos': 'nós', 'sao': 'são', 'entao': 'então',
  'ate': 'até', 'apos': 'após', 'so': 'só', 'mae': 'mãe', 'mes': 'mês',
  'pais': 'país', 'numero': 'número', 'informacao': 'informação', 'solucao': 'solução',
  'duvida': 'dúvida', 'endereco': 'endereço', 'servico': 'serviço', 'preco': 'preço',
  'proximo': 'próximo', 'ultimo': 'último', 'necessario': 'necessário', 'possivel': 'possível',
  'amanha': 'amanhã', 'ola': 'olá', 'vc': 'você', 'vcs': 'vocês', 'pq': 'porque',
  'tb': 'também', 'tbm': 'também', 'td': 'tudo', 'hj': 'hoje', 'msg': 'mensagem',
};
const autoCorrectTextBasic = (text) => {
  if (!text) return text;
  const words = text.split(/(\s+)/);
  return words.map(word => {
    if (/^\s+$/.test(word)) return word;
    const lower = word.toLowerCase();
    const cleanWord = lower.replace(/[.,!?;:]+$/, '');
    const punctuation = lower.slice(cleanWord.length);
    if (ACCENT_MAP_BASIC[cleanWord]) {
      let correction = ACCENT_MAP_BASIC[cleanWord];
      if (word[0] === word[0].toUpperCase()) {
        correction = correction.charAt(0).toUpperCase() + correction.slice(1);
      }
      return correction + punctuation;
    }
    return word;
  }).join('');
};
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
	foundationDate: Yup.date().nullable().transform((value, originalValue) => originalValue === "" ? null : value),
	creditLimit: Yup.string().nullable(),
	segment: Yup.string().nullable(),
	channels: Yup.array().of(Yup.string()).nullable(),
	dtUltCompra: Yup.date().nullable().transform((value, originalValue) => originalValue === "" ? null : value),
	vlUltCompra: Yup.mixed().nullable(),
	bzEmpresa: Yup.string().nullable(),
	region: Yup.string().nullable(),
	tags: Yup.array().nullable(),
	wallets: Yup.array().nullable(), // Agora representa usuários com tag pessoal no contato
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
	const [tagOptions, setTagOptions] = useState([]);
	const [loadingTags, setLoadingTags] = useState(false);
	const [userOptions, setUserOptions] = useState([]); // Usuários para campo wallets (tags pessoais)
	const [loadingUsers, setLoadingUsers] = useState(false);
	// Opções para campos autocomplete com freeSolo e lazy loading
	const [cityOptions, setCityOptions] = useState([]);
	const [cityHasMore, setCityHasMore] = useState(true);
	const [cityOffset, setCityOffset] = useState(0);
	const [cityLoading, setCityLoading] = useState(false);
	
	const [regionOptions, setRegionOptions] = useState([]);
	const [regionHasMore, setRegionHasMore] = useState(true);
	const [regionOffset, setRegionOffset] = useState(0);
	const [regionLoading, setRegionLoading] = useState(false);
	
	const [segmentOptions, setSegmentOptions] = useState([]);
	const [segmentHasMore, setSegmentHasMore] = useState(true);
	const [segmentOffset, setSegmentOffset] = useState(0);
	const [segmentLoading, setSegmentLoading] = useState(false);
	
	const [channelOptions, setChannelOptions] = useState([]);
	const [channelHasMore, setChannelHasMore] = useState(true);
	const [channelOffset, setChannelOffset] = useState(0);
	const [channelLoading, setChannelLoading] = useState(false);
	
	const [repOptions, setRepOptions] = useState([]);
	const [repHasMore, setRepHasMore] = useState(true);
	const [repOffset, setRepOffset] = useState(0);
	const [repLoading, setRepLoading] = useState(false);
	
	const [companyOptions, setCompanyOptions] = useState([]);
	const [companyHasMore, setCompanyHasMore] = useState(true);
	const [companyOffset, setCompanyOffset] = useState(0);
	const [companyLoading, setCompanyLoading] = useState(false);

	// Função auxiliar para correção automática de acentuação
	const handleAutoCorrect = (setFieldValue, fieldName, value) => {
		if (!value || typeof value !== 'string') return;
		const corrected = autoCorrectTextBasic(value);
		if (corrected !== value) {
			setFieldValue(fieldName, corrected);
		}
	};

	// Verificar permissão para editar campos do contato
	const { hasPermission } = usePermissions();
	const canEditFields = hasPermission("contacts.edit-fields");
	const canEditTags = hasPermission("contacts.edit-tags");
	const canEditWallets = hasPermission("contacts.edit-tags"); // Permissão de tags controla wallets também (são tags #)
	const canEditRepresentative = hasPermission("contacts.edit-representative");

	useEffect(() => {
		let isMountedLocal = true;
		
		const fetchTags = async () => {
			try {
				if (!isMountedLocal) return;
				setLoadingTags(true);
				const { data } = await api.get("/tags/");
				if (!isMountedLocal) return;
				// Garante que sempre seja um array (API pode retornar { tags: [...] } ou [...])
				const tagsArray = Array.isArray(data) ? data : (data?.tags || []);
				setTagOptions(tagsArray);
			} catch (err) {
				if (!isMountedLocal) return;
				// Silencia erro 403
				if (err?.response?.status !== 403) {
					toastError(err);
				}
			} finally {
				if (isMountedLocal) {
					setLoadingTags(false);
				}
			}
		};

		fetchTags();
		
		// Buscar valores únicos dos contatos para autocomplete (lazy loading inicial)
		const fetchUniqueValues = async () => {
			try {
				const limit = 50;
				const [citiesRes, regionsRes, segmentsRes, channelsRes, repsRes, companiesRes] = await Promise.all([
					api.get(`/contacts/unique-values?field=city&limit=${limit}&offset=0`),
					api.get(`/contacts/unique-values?field=region&limit=${limit}&offset=0`),
					api.get(`/contacts/unique-values?field=segment&limit=${limit}&offset=0`),
					api.get(`/contacts/unique-values?field=channel&limit=${limit}&offset=0`),
					api.get(`/contacts/unique-values?field=representativeCode&limit=${limit}&offset=0`),
					api.get(`/contacts/unique-values?field=bzEmpresa&limit=${limit}&offset=0`)
				]);
				
				if (!isMountedLocal) return;
				
				setCityOptions(citiesRes.data.values || []);
				setCityHasMore(citiesRes.data.hasMore);
				setCityOffset(limit);
				
				setRegionOptions(regionsRes.data.values || []);
				setRegionHasMore(regionsRes.data.hasMore);
				setRegionOffset(limit);
				
				setSegmentOptions(segmentsRes.data.values || []);
				setSegmentHasMore(segmentsRes.data.hasMore);
				setSegmentOffset(limit);
				
				setChannelOptions(channelsRes.data.values || []);
				setChannelHasMore(channelsRes.data.hasMore);
				setChannelOffset(limit);
				
				setRepOptions(repsRes.data.values || []);
				setRepHasMore(repsRes.data.hasMore);
				setRepOffset(limit);
				
				setCompanyOptions(companiesRes.data.values || []);
				setCompanyHasMore(companiesRes.data.hasMore);
				setCompanyOffset(limit);
			} catch (err) {
				// Silencioso - campos continuam funcionando como texto livre
				console.log("[ContactModal] Erro ao buscar valores únicos:", err);
			}
		};
		fetchUniqueValues();
		
		return () => {
			isMountedLocal = false;
		};
	}, []);

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
		channels: [],
		contactName: "",
		florder: false,
		dtUltCompra: "",
		vlUltCompra: "",
		bzEmpresa: "",
		region: "",
		tags: [],
		wallets: [],
		profilePicUrl: "",
		urlPicture: "",
	};

	const [contact, setContact] = useState(initialState);
	const [disableBot, setDisableBot] = useState(false);
	const [walletUsers, setWalletUsers] = useState([]); // Usuários calculados das tags pessoais

	// Buscar usuários para o campo wallets (baseado nas tags pessoais)
	useEffect(() => {
		let isMountedLocal = true;
		
		const fetchUsers = async () => {
			try {
				if (!isMountedLocal) return;
				setLoadingUsers(true);
				const { data } = await api.get("/users/", { params: { pageNumber: 1 } });
				if (!isMountedLocal) return;
				setUserOptions(data.users || []);
			} catch (err) {
				if (!isMountedLocal) return;
				// Silenciar erro 403 - usuário sem permissão, não logar erro
				if (err?.response?.status !== 403) {
					console.log("[ContactModal] Erro ao buscar usuários:", err);
				}
				// Usuário sem permissão - deixa array vazio, será tratado no useEffect abaixo
				setUserOptions([]);
			} finally {
				if (isMountedLocal) {
					setLoadingUsers(false);
				}
			}
		};

		fetchUsers();
		
		return () => {
			isMountedLocal = false;
		};
	}, []);

	// Buscar dados dos wallets quando userOptions está vazio (usuário sem permissão)
	useEffect(() => {
		const fetchWalletUsers = async () => {
			// Só executa se não temos userOptions mas temos contact.wallets
			if (userOptions.length > 0 || !contact.wallets || contact.wallets.length === 0) {
				return;
			}
			
			try {
				// Buscar dados dos usuários disponíveis (endpoint não requer permissão users.view)
				const { data: availableUsers } = await api.get("/users/available");
				
				// Filtrar apenas os usuários que estão na carteira do contato
				const walletData = availableUsers.filter(user => 
					contact.wallets.includes(user.id)
				);
				
				if (walletData.length > 0) {
					setWalletUsers(walletData);
				}
			} catch (err) {
				// Silencioso - usuário pode não ter permissão
			}
		};
		
		fetchWalletUsers();
	}, [userOptions.length, contact.wallets]);

	useEffect(() => {
		let isMountedLocal = true;
		
		const fetchContact = async () => {
			if (initialValues) {
				if (!isMountedLocal) return;
				setContact(prevState => {
					return {
						...prevState,
						...initialValues,
						tags: Array.isArray(initialValues.tags)
							? initialValues.tags.map(t => (typeof t === "object" ? t.id : t))
							: (initialValues.tags || [])
					};
				});
			}

			if (!contactId) return;

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (!isMountedLocal || !isMounted.current) return;
				setContact({
					...data,
					tags: Array.isArray(data.tags)
						? data.tags.map(t => (typeof t === "object" ? t.id : t))
						: []
				});
				setDisableBot(data.disableBot);
			} catch (err) {
				if (!isMountedLocal) return;
				toastError(err);
			}
		};

		fetchContact();
		
		return () => {
			isMountedLocal = false;
		};
	}, [contactId, open, initialValues]);

	// Calcular wallets (donos) baseado nas tags pessoais (#) do contato
	useEffect(() => {
		const calculateWalletUsers = () => {
			if (!contact.tags || contact.tags.length === 0 || userOptions.length === 0 || !tagOptions.length) {
				setWalletUsers([]);
				return;
			}

			// Extrair IDs das tags (podem ser objetos ou IDs diretos)
			const contactTagIds = Array.isArray(contact.tags) 
				? contact.tags.map(t => typeof t === 'object' ? t.id : t)
				: [];
			
			// Identificar quais tags do contato são pessoais (começam com #)
			const personalTagIds = contactTagIds.filter(tagId => {
				const tag = tagOptions.find(t => t.id === tagId);
				return tag && tag.name && tag.name.startsWith('#') && !tag.name.startsWith('##');
			});

			if (personalTagIds.length === 0) {
				setWalletUsers([]);
				return;
			}

			// Encontrar usuários que têm essas tags como allowedContactTags
			const walletUserList = userOptions.filter(user => {
				const userTags = user.allowedContactTags || [];
				return personalTagIds.some(ptid => userTags.includes(ptid));
			});

			setWalletUsers(walletUserList);
			
			// Atualizar valores do form com IDs dos wallets
			const walletIds = walletUserList.map(u => u.id);
			if (JSON.stringify(walletIds) !== JSON.stringify(contact.wallets || [])) {
				setContact(prev => ({ ...prev, wallets: walletIds }));
			}
		};

		calculateWalletUsers();
	}, [contact.tags, userOptions, tagOptions]);

	// Funções de lazy loading para campos autocomplete
	const loadMoreCities = async () => {
		if (cityLoading || !cityHasMore) return;
		try {
			setCityLoading(true);
			const limit = 50;
			const { data } = await api.get(`/contacts/unique-values?field=city&limit=${limit}&offset=${cityOffset}`);
			setCityOptions(prev => [...prev, ...(data.values || [])]);
			setCityHasMore(data.hasMore);
			setCityOffset(prev => prev + limit);
		} catch (err) {
		} finally {
			setCityLoading(false);
		}
	};

	const loadMoreRegions = async () => {
		if (regionLoading || !regionHasMore) return;
		try {
			setRegionLoading(true);
			const limit = 50;
			const { data } = await api.get(`/contacts/unique-values?field=region&limit=${limit}&offset=${regionOffset}`);
			setRegionOptions(prev => [...prev, ...(data.values || [])]);
			setRegionHasMore(data.hasMore);
			setRegionOffset(prev => prev + limit);
		} catch (err) {
		} finally {
			setRegionLoading(false);
		}
	};

	const loadMoreSegments = async () => {
		if (segmentLoading || !segmentHasMore) return;
		try {
			setSegmentLoading(true);
			const limit = 50;
			const { data } = await api.get(`/contacts/unique-values?field=segment&limit=${limit}&offset=${segmentOffset}`);
			setSegmentOptions(prev => [...prev, ...(data.values || [])]);
			setSegmentHasMore(data.hasMore);
			setSegmentOffset(prev => prev + limit);
		} catch (err) {
		} finally {
			setSegmentLoading(false);
		}
	};

	const loadMoreChannels = async () => {
		if (channelLoading || !channelHasMore) return;
		try {
			setChannelLoading(true);
			const limit = 50;
			const { data } = await api.get(`/contacts/unique-values?field=channel&limit=${limit}&offset=${channelOffset}`);
			setChannelOptions(prev => [...prev, ...(data.values || [])]);
			setChannelHasMore(data.hasMore);
			setChannelOffset(prev => prev + limit);
		} catch (err) {
		} finally {
			setChannelLoading(false);
		}
	};

	const loadMoreReps = async () => {
		if (repLoading || !repHasMore) return;
		try {
			setRepLoading(true);
			const limit = 50;
			const { data } = await api.get(`/contacts/unique-values?field=representativeCode&limit=${limit}&offset=${repOffset}`);
			setRepOptions(prev => [...prev, ...(data.values || [])]);
			setRepHasMore(data.hasMore);
			setRepOffset(prev => prev + limit);
		} catch (err) {
		} finally {
			setRepLoading(false);
		}
	};

	const loadMoreCompanies = async () => {
		if (companyLoading || !companyHasMore) return;
		try {
			setCompanyLoading(true);
			const limit = 50;
			const { data } = await api.get(`/contacts/unique-values?field=bzEmpresa&limit=${limit}&offset=${companyOffset}`);
			setCompanyOptions(prev => [...prev, ...(data.values || [])]);
			setCompanyHasMore(data.hasMore);
			setCompanyOffset(prev => prev + limit);
		} catch (err) {
		} finally {
			setCompanyLoading(false);
		}
	};

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
			channel: values.channel?.trim?.() || values.channel || null,
			contactName: values.contactName?.trim?.() || values.contactName || null,
			bzEmpresa: values.bzEmpresa?.trim?.() || values.bzEmpresa || null
		};

		try {
			if (contactId) {
				await api.put(`/contacts/${contactId}`, payload);
				handleClose();
			} else {
				const { data } = await api.post("/contacts", payload);
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
											onBlur={() => handleAutoCorrect(setFieldValue, 'clientCode', values.clientCode)}
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
											onBlur={() => handleAutoCorrect(setFieldValue, 'name', values.name)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Autocomplete
											freeSolo
											options={companyOptions}
											value={values.bzEmpresa || ''}
											onChange={(e, newValue) => setFieldValue('bzEmpresa', newValue || '')}
											onInputChange={(e, newInputValue) => setFieldValue('bzEmpresa', newInputValue)}
											disabled={!canEditFields}
											loading={companyLoading}
											ListboxProps={{
												onScroll: (event) => {
													const listboxNode = event.currentTarget;
													if (listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 20) {
														loadMoreCompanies();
													}
												}
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Empresa"
													variant="outlined"
													margin="dense"
													fullWidth
													InputLabelProps={{ shrink: true }}
												/>
											)}
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
											onBlur={() => handleAutoCorrect(setFieldValue, 'contactName', values.contactName)}
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
										<Autocomplete
											freeSolo
											options={repOptions}
											value={values.representativeCode || ''}
											onChange={(e, newValue) => setFieldValue('representativeCode', newValue || '')}
											onInputChange={(e, newInputValue) => setFieldValue('representativeCode', newInputValue)}
											disabled={!canEditRepresentative}
											loading={repLoading}
											ListboxProps={{
												onScroll: (event) => {
													const listboxNode = event.currentTarget;
													if (listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 20) {
														loadMoreReps();
													}
												}
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Código do Representante"
													variant="outlined"
													margin="dense"
													fullWidth
													InputLabelProps={{ shrink: true }}
												/>
											)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field
											as={TextField}
											label="E-mail"
											name="email"
											type="email"
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
											label="Nome Fantasia"
											name="fantasyName"
											variant="outlined"
											margin="dense"
											InputLabelProps={{
												shrink: true,
											}}
											fullWidth
											disabled={!canEditFields}
											onBlur={() => handleAutoCorrect(setFieldValue, 'fantasyName', values.fantasyName)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field name="vlUltCompra">
											{({ field, form }) => {
												// Formata valor para exibição
												const formatCurrency = (val) => {
													if (!val || val === 0) return '';
													return new Intl.NumberFormat('pt-BR', {
														style: 'currency',
														currency: 'BRL',
														minimumFractionDigits: 2
													}).format(val);
												};
												// Parse valor digitado
												const parseCurrency = (val) => {
													const numbers = String(val).replace(/\D/g, '');
													if (!numbers) return 0;
													return parseInt(numbers, 10) / 100;
												};
												return (
													<TextField
														name={field.name}
														value={formatCurrency(field.value)}
														onChange={(e) => {
															const val = parseCurrency(e.target.value);
															form.setFieldValue('vlUltCompra', val);
														}}
														label="Valor Última Compra"
														variant="outlined"
														margin="dense"
														InputLabelProps={{
															shrink: true,
														}}
														fullWidth
														disabled={!canEditFields}
													/>
												);
											}}
										</Field>
									</Grid>
									<Grid item xs={12} md={6}>
										<Autocomplete
											freeSolo
											options={cityOptions}
											value={values.city || ''}
											onChange={(e, newValue) => setFieldValue('city', newValue || '')}
											onInputChange={(e, newInputValue) => setFieldValue('city', newInputValue)}
											disabled={!canEditFields}
											loading={cityLoading}
											ListboxProps={{
												onScroll: (event) => {
													const listboxNode = event.currentTarget;
													if (listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 20) {
														loadMoreCities();
													}
												}
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Cidade"
													variant="outlined"
													margin="dense"
													fullWidth
													InputLabelProps={{ shrink: true }}
												/>
											)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Autocomplete
											freeSolo
											options={regionOptions}
											value={values.region || ''}
											onChange={(e, newValue) => setFieldValue('region', newValue || '')}
											onInputChange={(e, newInputValue) => setFieldValue('region', newInputValue)}
											disabled={!canEditFields}
											loading={regionLoading}
											ListboxProps={{
												onScroll: (event) => {
													const listboxNode = event.currentTarget;
													if (listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 20) {
														loadMoreRegions();
													}
												}
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Região"
													variant="outlined"
													margin="dense"
													fullWidth
													InputLabelProps={{ shrink: true }}
												/>
											)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Autocomplete
											freeSolo
											options={segmentOptions}
											value={values.segment || ''}
											onChange={(e, newValue) => setFieldValue('segment', newValue || '')}
											onInputChange={(e, newInputValue) => setFieldValue('segment', newInputValue)}
											disabled={!canEditFields}
											loading={segmentLoading}
											ListboxProps={{
												onScroll: (event) => {
													const listboxNode = event.currentTarget;
													if (listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 20) {
														loadMoreSegments();
													}
												}
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Segmento de Mercado"
													variant="outlined"
													margin="dense"
													fullWidth
													InputLabelProps={{ shrink: true }}
												/>
											)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Autocomplete
											multiple
											freeSolo
											options={channelOptions}
											value={values.channels || []}
											onChange={(e, newValue) => setFieldValue('channels', newValue || [])}
											disabled={!canEditFields}
											loading={channelLoading}
											ListboxProps={{
												onScroll: (event) => {
													const listboxNode = event.currentTarget;
													if (listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 20) {
														loadMoreChannels();
													}
												}
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Canais"
													variant="outlined"
													margin="dense"
													fullWidth
													InputLabelProps={{ shrink: true }}
													placeholder="WhatsApp, Instagram, Telegram..."
												/>
											)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field name="creditLimit">
											{({ field, form }) => {
												// Formata valor para exibição
												const formatCurrency = (val) => {
													if (!val || val === 0) return '';
													return new Intl.NumberFormat('pt-BR', {
														style: 'currency',
														currency: 'BRL',
														minimumFractionDigits: 2
													}).format(val);
												};
												// Parse valor digitado
												const parseCurrency = (val) => {
													const numbers = String(val).replace(/\D/g, '');
													if (!numbers) return 0;
													return parseInt(numbers, 10) / 100;
												};
												return (
													<TextField
														name={field.name}
														value={formatCurrency(field.value)}
														onChange={(e) => {
															const val = parseCurrency(e.target.value);
															form.setFieldValue('creditLimit', val);
														}}
														label="Limite de Crédito"
														variant="outlined"
														margin="dense"
														fullWidth
														disabled={!canEditFields}
													/>
												);
											}}
										</Field>
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
											onBlur={() => handleAutoCorrect(setFieldValue, 'instagram', values.instagram)}
										/>
									</Grid>
									<Grid item xs={12} md={6}>
										<Field name="situation">
											{({ field, form }) => (
												<FormControl variant="outlined" margin="dense" fullWidth disabled={!canEditFields}>
													<InputLabel shrink>Situação</InputLabel>
													<Select
														{...field}
														value={field.value || "Ativo"}
														onChange={(e) => form.setFieldValue("situation", e.target.value)}
														label="Situação"
													>
														<MenuItem value="Ativo">Ativo</MenuItem>
														<MenuItem value="Inativo">Inativo</MenuItem>
														<MenuItem value="Suspenso">Suspenso</MenuItem>
														<MenuItem value="Bloqueado">Bloqueado</MenuItem>
														<MenuItem value="Excluido">Excluído</MenuItem>
													</Select>
												</FormControl>
											)}
										</Field>
									</Grid>
									<Grid item xs={12} md={6}>
										{canEditWallets ? (
											<Autocomplete
												multiple
												options={userOptions}
												getOptionLabel={(option) => option.name?.toUpperCase() || ''}
												value={userOptions.filter(u => (values.wallets || []).includes(u.id))}
												onChange={(e, newValue) => {
													// Atualizar wallets
													setFieldValue("wallets", newValue.map(u => u.id));
													
													// Sincronizar tags: adicionar/remover tags pessoais dos usuários selecionados
													const currentTags = values.tags || [];
													const selectedUserIds = newValue.map(u => u.id);
													
													// Pegar todas as tags pessoais dos usuários selecionados
													const personalTagsToAdd = [];
													newValue.forEach(user => {
														const userTagId = user.allowedContactTags?.[0]; // Primeira tag pessoal do usuário
														if (userTagId && !currentTags.includes(userTagId)) {
															personalTagsToAdd.push(userTagId);
														}
													});
													
													// Remover tags pessoais de usuários que foram deselecionados
													const removedUsers = walletUsers.filter(u => !selectedUserIds.includes(u.id));
													const tagsToRemove = [];
													removedUsers.forEach(user => {
														const userTagId = user.allowedContactTags?.[0];
														if (userTagId && currentTags.includes(userTagId)) {
															tagsToRemove.push(userTagId);
														}
													});
													
													// Atualizar tags
													const newTags = [...currentTags, ...personalTagsToAdd].filter(t => !tagsToRemove.includes(t));
													setFieldValue("tags", [...new Set(newTags)]);
												}}
												disabled={loadingUsers}
												loading={loadingUsers}
												filterSelectedOptions
												renderTags={(value, getTagProps) =>
													value.map((option, index) => (
														<Chip
															{...getTagProps({ index })}
															key={option.id}
															label={option.name?.toUpperCase()}
															color="primary"
															size="small"
															style={{ height: '24px', fontSize: '11px' }}
														/>
													))
												}
												renderInput={(params) => (
													<TextField
														{...params}
														variant="outlined"
														margin="dense"
														label="Carteira (Responsável)"
														placeholder="Selecione responsáveis"
														fullWidth
													/>
												)}
											/>
										) : (
										<div>
											<Typography variant="caption" color="textSecondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>
												Carteira (Responsável)
											</Typography>
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
												{(() => {
													// Se temos walletUsers, mostra os nomes
													if (walletUsers.length > 0) {
														return walletUsers.map((option) => (
															<Chip
																key={option.id}
																label={option.name?.toUpperCase() || `USUÁRIO ${option.id}`}
																color="primary"
																size="small"
																style={{ height: '24px', fontSize: '11px' }}
															/>
														));
													}
													
													// Fallback: mostrar tags pessoais (tags com #) quando não temos dados dos usuários
													const allTags = (Array.isArray(tagOptions) ? tagOptions : []);
													const contactTagIds = (values.tags || []);
													const personalTags = allTags.filter(t => 
															contactTagIds.includes(t.id) && 
															t.name && t.name.startsWith('#') && !t.name.startsWith('##')
													);
													
													if (personalTags.length > 0) {
														return personalTags.map((tag) => (
															<Chip
																key={tag.id}
																label={tag.name?.toUpperCase()}
																style={{
																	backgroundColor: tag.color || '#4caf50',
																	height: '24px',
																	fontSize: '11px',
																	color: '#fff'
																}}
																size="small"
															/>
														));
													}
													
													// Se não tem nada, mostra —
													return <Typography style={{ fontSize: '14px', color: '#999' }}>—</Typography>;
												})()}
											</div>
										</div>
									)}
									</Grid>
									<Grid item xs={12} md={6}>
										{canEditTags ? (
											<Autocomplete
												multiple
												options={Array.isArray(tagOptions) ? tagOptions : []}
												getOptionLabel={(option) => option.name?.toUpperCase() || ''}
												value={(Array.isArray(tagOptions) ? tagOptions : []).filter(t => (values.tags || []).includes(t.id))}
												onChange={(e, newValue) => setFieldValue("tags", newValue.map(t => t.id))}
												disabled={loadingTags}
												loading={loadingTags}
												filterSelectedOptions
												renderTags={(value, getTagProps) =>
													value.map((option, index) => (
														<Chip
															{...getTagProps({ index })}
															key={option.id}
															label={option.name?.toUpperCase()}
															style={{
																backgroundColor: option.color || undefined,
																height: '24px',
																fontSize: '11px',
																color: '#fff'
															}}
															size="small"
														/>
													))
												}
												renderInput={(params) => (
													<TextField
														{...params}
														variant="outlined"
														margin="dense"
														label="Tags"
														placeholder="Selecione tags"
														fullWidth
													/>
												)}
											/>
										) : (
											<div>
												<Typography variant="caption" color="textSecondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>
													Tags
												</Typography>
												<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
													{(Array.isArray(tagOptions) ? tagOptions : []).filter(t => (values.tags || []).includes(t.id)).length === 0 ? (
														<Typography style={{ fontSize: '14px', color: '#999' }}>—</Typography>
													) : (
														// Tags: mostrar apenas as NÃO pessoais (não começam com #)
														(Array.isArray(tagOptions) ? tagOptions : []).filter(t => (values.tags || []).includes(t.id) && !(t.name && t.name.startsWith('#') && !t.name.startsWith('##'))).map((option) => (
															<Chip
																key={option.id}
																label={option.name?.toUpperCase()}
																style={{
																	backgroundColor: option.color || undefined,
																	height: '24px',
																	fontSize: '11px',
																	color: '#fff'
																}}
																size="small"
															/>
														))
													)}
												</div>
											</div>
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
