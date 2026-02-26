import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
	createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ContactModal from "../ContactModal";
import toastError from "../../errors/toastError"; 
import { AuthContext } from "../../context/Auth/AuthContext";
import { Typography } from "@mui/material";
import { FormControlLabel, Switch } from "@material-ui/core";

const ForwardMessageModal = ({ messages, onClose, modalOpen }) => {
    const [optionsContacts, setOptionsContacts] = useState([]);
	const [loading, setLoading] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [selectedContact, setSelectedContact] = useState(null);
	const [newContact, setNewContact] = useState({});
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const { user } = useContext(AuthContext);
	const [sending, setSending] = useState(false);
	const [messageSending, setMessageSending] = useState('');
	const [signMessage, setSignMessage] = useState(true);
	const [externalNumber, setExternalNumber] = useState("");
	const [useExternalNumber, setUseExternalNumber] = useState(false);

    useEffect(() => {
		if (!modalOpen || searchParam.length < 3) {
			setLoading(false);
			return;
		}
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchContacts = async () => {
				try {
					const { data } = await api.get("contacts", {
						params: { searchParam },
					});
					console.log('contacts', data.contacts);
					setOptionsContacts(data.contacts);
					setLoading(false);
				} catch (err) {
					setLoading(false);
					toastError(err);
				}
			};

			fetchContacts();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, modalOpen]);

	const history = useHistory();

	const sleep = (ms) => {
		return new Promise(resolve => setTimeout(resolve, ms));
	};

    const handleForwardMessage = async(contactL) => {
		const responseList = [];
		for (const message of messages) {
			setSending(true);
			try {
				setMessageSending(message.id);
				const response = await api.post('/message/forward', {messageId: message.id, contactId: contactL.id, signMessage: signMessage});
				responseList.push(response);
				await sleep(900); // CORREÇÃO: aguardar o delay entre mensagens
			} catch (error) {
				toastError(error);
			}		
		}
		setSending(false);

		history.push('/tickets');
    }

	// Encaminhar para número externo (que pode não estar no CRM)
	const handleForwardToExternal = async() => {
		if (!externalNumber || externalNumber.length < 10) {
			toastError({ message: "Digite um número válido (ex: 5511999999999)" });
			return;
		}

		const responseList = [];
		for (const message of messages) {
			setSending(true);
			try {
				setMessageSending(message.id);
				const response = await api.post('/message/forward-external', {
					messageId: message.id, 
					number: externalNumber
				});
				responseList.push(response);
				await sleep(900);
			} catch (error) {
				toastError(error);
			}		
		}
		setSending(false);

		history.push('/tickets');
    }

    const handleSelectOption = (e, newValue) => {
		if (newValue?.number) {
			setSelectedContact(newValue);
		} else if (newValue?.name) {
			setNewContact({ name: newValue.name });
			setContactModalOpen(true);
		}
	};

    const handleClose = () => {
		onClose();
		setSearchParam("");
		setSelectedContact(null);
		setSending(false);
		setExternalNumber("");
		setUseExternalNumber(false);
	};

    const handleCloseContactModal = () => {
		setContactModalOpen(false);
	};

    const renderOption = optionL => {
		if (optionL.number) {
			return `${optionL.name} - ${optionL.number}`;
		} else {
			return `Nenhum contato encontrado com o nome ${optionL.name}`;
		}
	};

	const renderOptionLabel = optionL => {
		if (optionL.number) {
			return `${optionL.name} - ${optionL.number}`;
		} else {
			return `${optionL.name}`;
		}
	};

	const filter = createFilterOptions({
		trim: true,
	});

	const createAddContactOption = (filterOptions, params) => {
		const filtered = filter(filterOptions, params);

		if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
			filtered.push({
				name: `${params.inputValue}`,
			});
		}

		return filtered;
	};

    return (
        <>
			<ContactModal
				open={contactModalOpen}
				initialValues={newContact}
				onClose={handleCloseContactModal}
			></ContactModal>
			<Dialog open={modalOpen} onClose={handleClose}>
				<DialogTitle id="form-dialog-title">
					Encaminhar mensagem
				</DialogTitle>
				<DialogContent dividers>
					{/* Toggle para escolher entre contato existente ou número externo */}
					<FormControlLabel
						style={{ marginBottom: 16 }}
						label="Enviar para número externo"
						control={
							<Switch
								checked={useExternalNumber}
								onChange={(e) => {
									setUseExternalNumber(e.target.checked);
									setSelectedContact(null);
									setExternalNumber("");
								}}
								color="primary"
							/>
						}
					/>

					{useExternalNumber ? (
						/* Campo para número externo */
						<TextField
							label="Número (com DDD e DDI)"
							placeholder="5511999999999"
							variant="outlined"
							fullWidth
							value={externalNumber}
							onChange={(e) => setExternalNumber(e.target.value.replace(/\D/g, ""))}
							helperText="Digite o número completo com código do país (ex: 5511999999999)"
							style={{ width: 300 }}
						/>
					) : (
						/* Autocomplete para contatos existentes */
						<Autocomplete
							options={optionsContacts}
							loading={loading}
							style={{ width: 300 }}
							clearOnBlur
							autoHighlight
							freeSolo
							clearOnEscape
							getOptionLabel={renderOptionLabel}
							renderOption={renderOption}
							filterOptions={createAddContactOption}
							onChange={(e, newValue) => handleSelectOption(e, newValue)}
							renderInput={params => (
								<TextField
									{...params}
									label={i18n.t("newTicketModal.fieldLabel")}
									variant="outlined"
									autoFocus
									onChange={e => setSearchParam(e.target.value)}
									onKeyPress={e => {
										if (loading || !selectedContact) return;
										else if (e.key === "Enter") {
											// handleSaveTicket(selectedContact.id);
										}
									}}
									InputProps={{
										...params.InputProps,
										endAdornment: (
											<React.Fragment>
												{loading ? (
													<CircularProgress color="inherit" size={20} />
												) : null}
												{params.InputProps.endAdornment}
											</React.Fragment>
										),
									}}
								/>
							)}
						/>
					)}
				</DialogContent>
				<DialogActions>
					{sending && (
						<>
							<CircularProgress color="inherit" size={20} />
							<Typography variant="body1" color="textSecondary">
								Enviando {messageSending}...
							</Typography>
						</>
					)}
					<FormControlLabel
						style={{ marginRight: 7, color: "gray" }}
						label={i18n.t("messagesInput.signMessage")}
						labelPlacement="start"
						control={
							<Switch
								size="small"
								checked={signMessage}
								onChange={(e) => {
									setSignMessage(e.target.checked);
								}}
								name="showAllTickets"
								color="primary"
							/>
						}
					/>
					<ButtonWithSpinner
						variant="contained"
						type="button"
						disabled={
							sending || 
							(useExternalNumber ? externalNumber.length < 10 : !selectedContact)
						}
						onClick={() => {
							if (useExternalNumber) {
								handleForwardToExternal();
							} else {
								handleForwardMessage(selectedContact);
							}
						}}
						color="primary"
						loading={loading}
					>
						Encaminhar
					</ButtonWithSpinner>
				</DialogActions>
			</Dialog>
		</>
    );
};

export default ForwardMessageModal;