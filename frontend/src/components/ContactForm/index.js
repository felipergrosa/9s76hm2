import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import InputMask from "react-input-mask";
import { FormControl, InputLabel, MenuItem, Select, Grid } from "@material-ui/core";
import { isValidCPF, isValidCNPJ } from "../../utils/validators";

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
		marginTop: -12,
		marginLeft: -12,
	},

    textCenter: {
        backgroundColor: 'red'
    }
}));

const ContactSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Parâmetros incompletos!")
		.max(50, "Parâmetros acima do esperado!")
		.required("Required"),
	number: Yup.string().min(8, "Parâmetros incompletos!").max(50, "Parâmetros acima do esperado!"),
	email: Yup.string().email("E-mail inválido"),
    cpfCnpj: Yup.string()
        .nullable()
        .test('cpfCnpj-validation', 'CPF/CNPJ inválido', (value) => {
            if (!value) return true; // Permite campo vazio
            const cleanValue = value.replace(/\D/g, '');
            if (cleanValue.length === 11) {
                return isValidCPF(cleanValue);
            }
            if (cleanValue.length === 14) {
                return isValidCNPJ(cleanValue);
            }
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
    bzEmpresa: Yup.string().nullable(),
    region: Yup.string().nullable(),
});

export function ContactForm ({ initialContact, onSave, onCancel }) {
	const classes = useStyles();

	const [contact, setContact] = useState(initialContact);

    useEffect(() => {
        setContact(initialContact);
    }, [initialContact]);

	const handleSaveContact = async values => {
		try {
			if (contact.id) {
				await api.put(`/contacts/${contact.id}`, values);
			} else {
				const { data } = await api.post("/contacts", values);
				if (onSave) {
					onSave(data);
				}
			}
			toast.success(i18n.t("contactModal.success"));
		} catch (err) {
			toastError(err);
		}
	};

    return (
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
            {({ values, errors, touched, isSubmitting }) => (
                <Form>
                    <Grid container spacing={1}>
                        {/* <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom>
                                {i18n.t("contactModal.form.mainInfo")}
                            </Typography>
                        </Grid> */}
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
                                className={classes.textField}
                                fullWidth
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
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Field
                                as={TextField}
                                label={i18n.t("contactModal.form.number")}
                                name="number"
                                error={touched.number && Boolean(errors.number)}
                                helperText={touched.number && errors.number}
                                placeholder="5513912344321"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Field
                                as={TextField}
                                label={i18n.t("contactModal.form.email")}
                                name="email"
                                error={touched.email && Boolean(errors.email)}
                                helperText={touched.email && errors.email}
                                placeholder="Email address"
                                fullWidth
                                margin="dense"
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Field name="cpfCnpj">
                                {({ field, form }) => {
                                    const cleanValue = field.value?.replace(/\D/g, '') || '';
                                    const mask = cleanValue.length > 11 ? "99.999.999/9999-99" : "999.999.999-999";
                                    return (
                                        <InputMask
                                            {...field}
                                            mask={mask}
                                            maskChar={null}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                const cleanValue = value.replace(/\D/g, '');
                                                form.setFieldValue('cpfCnpj', cleanValue);
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
                                label="Código do Representante"
                                name="representativeCode"
                                variant="outlined"
                                margin="dense"
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
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Field
                                as={TextField}
                                label="Região"
                                name="region"
                                variant="outlined"
                                margin="dense"
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
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl
    variant="outlined"
    margin="dense"
    fullWidth
>
    <InputLabel id="situation-select-label">Situação</InputLabel>
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
                                label="Data de Fundação"
                                name="foundationDate"
                                type="date"
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                variant="outlined"
                                margin="dense"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Field
                                as={TextField}
                                label="Limite de Crédito"
                                name="creditLimit"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} spacing={1}>
                            <Grid container spacing={1}>
                                <Grid xs={6} item>
                                    <Button
                                        onClick={onCancel}
                                        color="secondary"
                                        disabled={isSubmitting}
                                        variant="outlined"
                                        fullWidth
                                    >
                                        {i18n.t("contactModal.buttons.cancel")}
                                    </Button>
                                </Grid>
                                <Grid classes={classes.textCenter} xs={6} item>
                                    <Button
                                        type="submit"
                                        color="primary"
                                        disabled={isSubmitting}
                                        variant="contained"
                                        className={classes.btnWrapper}
                                        fullWidth
                                    >
                                        {contact.id
                                            ? `${i18n.t("contactModal.buttons.okEdit")}`
                                            : `${i18n.t("contactModal.buttons.okAdd")}`}
                                        {isSubmitting && (
                                            <CircularProgress
                                                size={24}
                                                className={classes.buttonProgress}
                                            />
                                        )}
                                    </Button>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </Form>
            )}
        </Formik>
    )
}
