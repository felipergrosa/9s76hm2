import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Grid, FormHelperText, FormControlLabel, Checkbox } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

// Funções de validação e formatação
const validateCPF = (cpf) => {
  cpf = cpf.replace(/[\D]/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let rest = 11 - (sum % 11);
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  rest = 11 - (sum % 11);
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.charAt(10))) return false;
  
  return true;
};

const validateCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/[\D]/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  
  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  const digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  
  return true;
};

const formatCpfCnpj = (value) => {
  if (!value) return '';
  
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(\-\d{2})\d+?$/, '$1');
  } else {
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\/\d{4})(\d)/, '$1-$2')
      .replace(/(\-\d{2})\d+?$/, '$1');
  }
};

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  formContainer: {
    width: '100%',
    padding: theme.spacing(1, 2, 2, 2),
  },
  field: {
    marginBottom: theme.spacing(1),
  },
  buttonContainer: {
    marginTop: theme.spacing(3),
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(2),
  },
  buttonProgress: {
    color: green[500],
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
  },
  textCenter: {
    display: 'flex',
    alignItems: 'center'
  },
  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  btnWrapper: {
    position: "relative",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  }
}));

const ContactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Nome muito curto!")
    .max(50, "Nome muito longo!")
    .required("Obrigatório"),
  number: Yup.string()
    .min(8, "Número muito curto!")
    .max(50, "Número muito longo!")
    .required("Obrigatório"),
  email: Yup.string().email("E-mail inválido"),
  cpfCnpj: Yup.string()
    .test('cpfCnpj', 'CPF/CNPJ inválido', function(value) {
      if (!value) return true;
      const numbers = value.replace(/\D/g, '');
      if (numbers.length === 11) return validateCPF(numbers);
      if (numbers.length === 14) return validateCNPJ(numbers);
      return false;
    }),
  creditLimit: Yup.string().nullable(),
  situation: Yup.mixed().oneOf(['Ativo', 'Inativo', 'Suspenso']).default('Ativo'),
  representativeCode: Yup.string().nullable(),
  city: Yup.string().nullable(),
  region: Yup.string().nullable(),
  segment: Yup.string().nullable(),
  channels: Yup.array().of(Yup.string()).nullable(),
  instagram: Yup.string().nullable(),
  fantasyName: Yup.string().nullable(),
  foundationDate: Yup.string().nullable(),
  disableBot: Yup.boolean().default(false)
});

const ContactForm = ({ initialContact, onSave, onCancel }) => {
  const classes = useStyles();
  const [contact, setContact] = useState({
    name: '',
    number: '',
    email: '',
    disableBot: false,
    cpfCnpj: '',
    representativeCode: '',
    city: '',
    region: '',
    segment: '',
    channels: [],
    instagram: '',
    situation: 'Ativo',
    fantasyName: '',
    foundationDate: '',
    creditLimit: '',
    ...initialContact
  });

  useEffect(() => {
    if (initialContact) {
      setContact(prev => ({
        ...prev,
        ...initialContact,
        cpfCnpj: initialContact.cpfCnpj || '',
        representativeCode: initialContact.representativeCode || '',
        city: initialContact.city || '',
        region: initialContact.region || '',
        segment: initialContact.segment || '',
        channels: initialContact.channels || [],
        instagram: initialContact.instagram || '',
        situation: initialContact.situation || 'Ativo',
        fantasyName: initialContact.fantasyName || '',
        foundationDate: initialContact.foundationDate || '',
        creditLimit: initialContact.creditLimit || '',
        disableBot: initialContact.disableBot || false
      }));
    }
  }, [initialContact]);

  const handleSaveContact = async (values) => {
    try {
      if (values.id) {
        await api.put(`/contacts/${values.id}`, values);
      } else {
        const { data } = await api.post("/contacts", values);
        if (onSave) onSave(data);
      }
      toast.success(i18n.t("contactModal.success"));
      if (onSave) onSave(values);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Formik
      initialValues={contact}
      enableReinitialize={true}
      validationSchema={ContactSchema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          await handleSaveContact(values);
          setSubmitting(false);
        } catch (err) {
          setSubmitting(false);
        }
      }}
    >
      {({ values, errors, touched, isSubmitting, handleChange, handleBlur, setFieldValue }) => (
        <Form className={classes.formContainer}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Field
                as={TextField}
                label={i18n.t("contactModal.form.name")}
                name="name"
                autoFocus
                error={touched.name && Boolean(errors.name)}
                helperText={touched.name && errors.name}
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
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
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>
            <Grid item xs={12}>
              <Field
                as={TextField}
                label={i18n.t("contactModal.form.email")}
                name="email"
                error={touched.email && Boolean(errors.email)}
                helperText={touched.email && errors.email}
                placeholder="email@exemplo.com"
                fullWidth
                margin="normal"
                variant="outlined"
                className={classes.field}
              />
            </Grid>

            {/* Seção de Dados Adicionais */}
            <Grid item xs={12} style={{ marginTop: '16px' }}>
              <h3 style={{ marginBottom: '16px' }}>Dados Adicionais</h3>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="CPF/CNPJ"
                name="cpfCnpj"
                variant="outlined"
                margin="normal"
                fullWidth
                value={formatCpfCnpj(values.cpfCnpj || '')}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setFieldValue('cpfCnpj', value);
                }}
                onBlur={handleBlur}
                error={touched.cpfCnpj && Boolean(errors.cpfCnpj)}
                helperText={
                  touched.cpfCnpj && errors.cpfCnpj 
                    ? errors.cpfCnpj 
                    : values.cpfCnpj && values.cpfCnpj.length > 0
                        ? values.cpfCnpj.replace(/[^\d]/g, '').length === 11 
                            ? 'CPF válido' 
                            : values.cpfCnpj.replace(/[^\d]/g, '').length === 14 
                                ? 'CNPJ válido'
                                : '11 dígitos para CPF ou 14 para CNPJ'
                        : 'Opcional - informe CPF (11 dígitos) ou CNPJ (14 dígitos)'
                }
                inputProps={{
                  maxLength: 18
                }}
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Código do Representante"
                name="representativeCode"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Cidade"
                name="city"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Região"
                name="region"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Segmento de Mercado"
                name="segment"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                name="channels"
                render={({ field }) => (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={['WhatsApp', 'Instagram', 'Messenger', 'Telegram', 'WebChat']}
                    value={field.value || []}
                    onChange={(e, newValue) => field.onChange(newValue || [])}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          label={option}
                          size="small"
                          color="primary"
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Canais"
                        variant="outlined"
                        margin="normal"
                        fullWidth
                        placeholder="WhatsApp, Instagram, Telegram..."
                      />
                    )}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Instagram"
                name="instagram"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Nome Fantasia"
                name="fantasyName"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                select
                label="Situação"
                name="situation"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
                SelectProps={{
                  native: true,
                }}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Suspenso">Suspenso</option>
              </Field>
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Data de Fundação"
                name="foundationDate"
                type="date"
                variant="outlined"
                margin="normal"
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <Field
                as={TextField}
                label="Limite de Crédito"
                name="creditLimit"
                variant="outlined"
                margin="normal"
                fullWidth
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.disableBot || false}
                    onChange={handleChange}
                    name="disableBot"
                    color="primary"
                  />
                }
                label="Desativar Bot"
                className={classes.field}
              />
            </Grid>

            <Grid item xs={12} className={classes.buttonContainer}>
              <Button
                variant="outlined"
                onClick={onCancel}
                style={{ marginRight: '8px' }}
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
                {i18n.t("contactModal.buttons.ok")}
                {isSubmitting && (
                  <CircularProgress
                    size={24}
                    className={classes.buttonProgress}
                  />
                )}
              </Button>
            </Grid>
          </Grid>
        </Form>
      )}
    </Formik>
  );
};

export default ContactForm;
