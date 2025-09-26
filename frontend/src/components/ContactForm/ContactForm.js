import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Grid, FormHelperText } from "@material-ui/core";
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
  contactName: Yup.string().nullable(),
  florder: Yup.boolean().nullable(),
  cpfCnpj: Yup.string()
    .test('cpfCnpj', 'CPF/CNPJ inválido', function(value) {
      if (!value) return true;
      const numbers = value.replace(/\D/g, '');
      if (numbers.length === 11) return validateCPF(numbers);
      if (numbers.length === 14) return validateCNPJ(numbers);
      return false;
    }),
  creditLimit: Yup.string().nullable(),
  situation: Yup.mixed().oneOf(['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo', 'Suspenso']).default('Ativo'),
  bzEmpresa: Yup.string().nullable()
});

const ContactForm = ({ initialContact, onSave, onCancel }) => {
  const classes = useStyles();
  const [contact, setContact] = useState({
    ...initialContact,
    cpfCnpj: initialContact?.cpfCnpj || '',
    representativeCode: initialContact?.representativeCode || '',
    city: initialContact?.city || '',
    instagram: initialContact?.instagram || '',
    situation: initialContact?.situation || 'Ativo',
    fantasyName: initialContact?.fantasyName || '',
    foundationDate: initialContact?.foundationDate || '',
    creditLimit: initialContact?.creditLimit || '',
    contactName: initialContact?.contactName || '',
    florder: Boolean(initialContact?.florder) || false,
    bzEmpresa: initialContact?.bzEmpresa || ''
  });

  useEffect(() => {
    setContact({
      ...initialContact,
      cpfCnpj: initialContact?.cpfCnpj || '',
      representativeCode: initialContact?.representativeCode || '',
      city: initialContact?.city || '',
      instagram: initialContact?.instagram || '',
      situation: initialContact?.situation || 'Ativo',
      fantasyName: initialContact?.fantasyName || '',
      foundationDate: initialContact?.foundationDate || '',
      creditLimit: initialContact?.creditLimit || '',
      contactName: initialContact?.contactName || '',
      florder: Boolean(initialContact?.florder) || false,
      bzEmpresa: initialContact?.bzEmpresa || ''
    });
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
      onSubmit={async (values, actions) => {
        const cleanedValues = Object.entries(values).reduce((acc, [key, value]) => {
          acc[key] = value === '' ? null : value;
          return acc;
        }, {});
        
        await handleSaveContact(cleanedValues);
        actions.setSubmitting(false);
      }}
    >
      {({ values, errors, touched, isSubmitting, handleChange, handleBlur }) => (
        <Form className={classes.formContainer}>
          <Grid container spacing={2}>
            {/* Linha 1 - Nome e Empresa */}
            <Grid item xs={12} sm={6}>
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
                className={classes.field}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Empresa"
                name="bzEmpresa"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>

            {/* Linha 2 - Email e Número */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label={i18n.t("contactModal.form.email")}
                name="email"
                error={touched.email && Boolean(errors.email)}
                helperText={touched.email && errors.email}
                placeholder="email@exemplo.com"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
                className={classes.field}
              />
            </Grid>

            {/* Linha 1.1 - Nome do Contato (contactName) e Encomenda (florder) */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Nome do Contato"
                name="contactName"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <div className={classes.field} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label htmlFor="florder" style={{ minWidth: 100 }}>Encomenda</label>
                <input
                  id="florder"
                  name="florder"
                  type="checkbox"
                  checked={Boolean(values.florder)}
                  onChange={(e) => handleChange({ target: { name: 'florder', value: e.target.checked } })}
                  onBlur={handleBlur}
                  style={{ transform: 'scale(1.1)' }}
                />
                <span>{values.florder ? 'Sim' : 'Não'}</span>
              </div>
            </Grid>

            {/* Linha 3 - Cidade e CPF/CNPJ */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Cidade"
                name="city"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <div className={classes.field}>
                <TextField
                  label="CPF/CNPJ"
                  name="cpfCnpj"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  value={formatCpfCnpj(values.cpfCnpj || '')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    handleChange({
                      target: { name: 'cpfCnpj', value }
                    });
                  }}
                  onBlur={handleBlur}
                  error={touched.cpfCnpj && Boolean(errors.cpfCnpj)}
                  inputProps={{
                    maxLength: 18
                  }}
                />
                <FormHelperText 
                  style={{ 
                    color: touched.cpfCnpj && errors.cpfCnpj ? '#f44336' : 'rgba(0, 0, 0, 0.54)',
                    marginTop: 4,
                    marginLeft: 14,
                    fontSize: '0.75rem'
                  }}
                >
                  {touched.cpfCnpj && errors.cpfCnpj 
                    ? errors.cpfCnpj 
                    : values.cpfCnpj?.length > 0 
                      ? values.cpfCnpj.replace(/\D/g, '').length === 11 
                        ? 'CPF válido' 
                        : values.cpfCnpj.replace(/\D/g, '').length === 14 
                          ? 'CNPJ válido'
                          : '11 dígitos para CPF ou 14 para CNPJ'
                      : 'Apenas números (11 para CPF ou 14 para CNPJ)'
                  }
                </FormHelperText>
              </div>
            </Grid>

            {/* Linha 4 - Instagram e Nome Fantasia */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Instagram"
                name="instagram"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>

            {/* Linha 4 - Nome Fantasia e Código do Representante */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Nome Fantasia"
                name="fantasyName"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Código do Representante"
                name="representativeCode"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>

            {/* Linha 5 - Situação e Data de Fundação */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Situação"
                name="situation"
                select
                variant="outlined"
                margin="dense"
                fullWidth
                SelectProps={{
                  native: true,
                }}
                className={classes.field}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Suspenso">Suspenso</option>
              </Field>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Data de Fundação"
                name="foundationDate"
                type="date"
                variant="outlined"
                margin="dense"
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
                className={classes.field}
              />
            </Grid>

            {/* Linha 6 - Limite de Crédito */}
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                label="Limite de Crédito"
                name="creditLimit"
                variant="outlined"
                margin="dense"
                fullWidth
                className={classes.field}
              />
            </Grid>
          </Grid>

          {/* Botões */}
          <div className={classes.buttonContainer}>
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
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default ContactForm;
