import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import PermissionTransferList from "../PermissionTransferList";

const RoleSchema = Yup.object().shape({
  name: Yup.string().min(2, "Mínimo 2 caracteres").required("Obrigatório"),
  description: Yup.string().nullable()
});

const initialState = {
  name: "",
  description: "",
  permissions: []
};

const RoleModal = ({ open, onClose, roleId }) => {
  const [role, setRole] = useState(initialState);

  useEffect(() => {
    if (!open) return;
    if (!roleId) {
      setRole(initialState);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data } = await api.get(`/roles/${roleId}`);
        setRole({
          name: data.name || "",
          description: data.description || "",
          permissions: Array.isArray(data.permissions) ? data.permissions : []
        });
      } catch (err) {
        toastError(err);
      }
    };
    fetchRole();
  }, [roleId, open]);

  const handleClose = () => {
    onClose();
    setRole(initialState);
  };

  const handleSave = async values => {
    try {
      if (roleId) {
        await api.put(`/roles/${roleId}`, values);
      } else {
        await api.post("/roles", values);
      }
      toast.success("Perfil de acesso salvo com sucesso");
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{roleId ? "Editar Perfil de Acesso" : "Novo Perfil de Acesso"}</DialogTitle>
      <Formik
        initialValues={role}
        enableReinitialize
        validationSchema={RoleSchema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSave(values);
            actions.setSubmitting(false);
          }, 300);
        }}
      >
        {({ values, errors, touched, isSubmitting, setFieldValue }) => (
          <Form>
            <DialogContent dividers>
              <Field
                as={TextField}
                label="Nome"
                name="name"
                autoFocus
                variant="outlined"
                margin="dense"
                fullWidth
                error={touched.name && Boolean(errors.name)}
                helperText={touched.name && errors.name}
              />
              <Field
                as={TextField}
                label="Descrição"
                name="description"
                variant="outlined"
                margin="dense"
                fullWidth
                multiline
                rows={2}
              />

              <PermissionTransferList
                value={values.permissions}
                onChange={permissions => setFieldValue("permissions", permissions)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="primary" variant="contained" disabled={isSubmitting}>
                {roleId ? "Salvar" : "Adicionar"}
                {isSubmitting && <CircularProgress size={20} style={{ marginLeft: 8 }} />}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default RoleModal;
