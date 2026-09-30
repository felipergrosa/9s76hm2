import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import moment from "moment";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";

import {
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import AddIcon from "@material-ui/icons/Add";
import SearchIcon from "@material-ui/icons/Search";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import BusinessIcon from "@material-ui/icons/Business";
import PhonelinkSetupIcon from "@material-ui/icons/PhonelinkSetup";
import { Visibility, VisibilityOff } from "@material-ui/icons";

import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";
import toastError from "../../../errors/toastError";
import TableRowSkeleton from "../../../components/TableRowSkeleton";
import ConfirmationModal from "../../../components/ConfirmationModal";
import ButtonWithSpinner from "../../../components/ButtonWithSpinner";
import WhatsAppModalCompany from "../../../components/CompanyWhatsapps";
import useCompanies from "../../../hooks/useCompanies";
import usePlans from "../../../hooks/usePlans";
import usePermissions from "../../../hooks/usePermissions";
import useDebounce from "../../../hooks/useDebounce";
import { useDate } from "../../../hooks/useDate";

const useStyles = makeStyles((theme) => ({
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 360,
  },
  countText: {
    color: theme.palette.text.secondary,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  tablePaper: {
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
  },
  tableScroll: {
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },
  headCell: {
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.03em",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    whiteSpace: "nowrap",
  },
  bodyCell: {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    whiteSpace: "nowrap",
  },
  cellCaption: {
    color: theme.palette.text.secondary,
    fontSize: 11.5,
    lineHeight: 1.35,
  },
  rowHover: {
    transition: "background-color 120ms ease",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  emptyState: {
    padding: theme.spacing(8, 4),
    textAlign: "center",
    color: theme.palette.text.secondary,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
  },
}));

// Chip de status no padrão novo (tailwind + dark:)
const chipBaseClass =
  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";

const StatusChip = ({ active }) => (
  <span
    className={`${chipBaseClass} ${
      active
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    }`}
  >
    {active ? i18n.t("compaies.table.yes") : i18n.t("compaies.table.no")}
  </span>
);

const EMPTY_RECORD = {
  name: "",
  email: "",
  password: "",
  phone: "",
  document: "",
  planId: "",
  status: true,
  dueDate: "",
  recurrence: "",
};

// Modal de criação/edição — consolida o formulário inline do CompaniesManager
// (mesmos campos + incremento de vencimento) e o modal enxuto do Companies,
// que não enviava plano/vencimento nem `password` (campo exigido pelo backend).
const CompanyFormDialog = ({ open, onClose, company, onSubmit, loading }) => {
  const [plans, setPlans] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const { list: listPlans } = usePlans();
  const isEditing = Boolean(company && company.id);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await listPlans();
        if (mounted) setPlans(Array.isArray(list) ? list : list?.plans || []);
      } catch (e) {
        // Select de planos fica vazio se falhar — não bloqueia o form
        toastError(e);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialValues = useMemo(() => {
    if (!company) return { ...EMPTY_RECORD };
    return {
      id: company.id,
      name: company.name || "",
      email: company.email || "",
      // Senha nunca vem preenchida do backend: vazio = manter a atual
      password: "",
      phone: company.phone || "",
      document: company.document || "",
      planId: company.planId || "",
      status: company.status === false ? false : true,
      dueDate:
        company.dueDate && moment(company.dueDate).isValid()
          ? moment(company.dueDate).format("YYYY-MM-DD")
          : "",
      recurrence: company.recurrence || "",
    };
  }, [company]);

  // Senha obrigatória apenas na criação (backend exige min 5 no POST;
  // no PUT, enviar vazio rehashearia a senha do usuário-dono — por isso é removida)
  const CompanySchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "Parâmetros incompletos!")
      .max(50, "Parâmetros acima do esperado!")
      .required("Nome é obrigatório"),
    email: Yup.string()
      .email("Email é inválido")
      .required("E-mail é obrigatório"),
    password: isEditing
      ? Yup.string().min(5, "Senha deve ter ao menos 5 caracteres")
      : Yup.string()
          .required("Senha é obrigatória")
          .min(5, "Senha deve ter ao menos 5 caracteres"),
  });

  // Incrementa o vencimento conforme a recorrência (mesma lógica do CompaniesManager)
  const incrementDueDate = (values, setFieldValue) => {
    if (!values.dueDate) return;
    const add = {
      MENSAL: [1, "month"],
      BIMESTRAL: [2, "month"],
      TRIMESTRAL: [3, "month"],
      SEMESTRAL: [6, "month"],
      ANUAL: [12, "month"],
    }[values.recurrence];
    if (!add) return;
    setFieldValue(
      "dueDate",
      moment(values.dueDate).add(add[0], add[1]).format("YYYY-MM-DD")
    );
  };

  const handleSubmit = (values) => {
    const data = { ...values };
    if (!data.dueDate || !moment(data.dueDate).isValid()) {
      data.dueDate = null;
    }
    // "" quebraria a coluna integer de planId no Postgres
    if (data.planId === "") {
      data.planId = null;
    }
    if (isEditing && !data.password) {
      delete data.password;
    }
    onSubmit(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        {isEditing
          ? i18n.t("companyModal.title.edit")
          : i18n.t("companyModal.title.add")}
      </DialogTitle>
      <Formik
        enableReinitialize
        initialValues={initialValues}
        validationSchema={CompanySchema}
        onSubmit={(values, { setSubmitting }) => {
          handleSubmit(values);
          setSubmitting(false);
        }}
      >
        {({ values, touched, errors, setFieldValue }) => (
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.name")}
                    name="name"
                    autoFocus
                    required
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.email")}
                    name="email"
                    required
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.password")}
                    name="password"
                    required={!isEditing}
                    error={touched.password && Boolean(errors.password)}
                    helperText={
                      (touched.password && errors.password) ||
                      (isEditing
                        ? "Deixe em branco para manter a senha atual"
                        : "")
                    }
                    type={showPassword ? "text" : "password"}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword((s) => !s)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.phone")}
                    name="phone"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.document")}
                    name="document"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    select
                    label={i18n.t("compaies.table.plan")}
                    name="planId"
                    required
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  >
                    {plans.map((plan) => (
                      <MenuItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </MenuItem>
                    ))}
                  </Field>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    select
                    label={i18n.t("compaies.table.active")}
                    name="status"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  >
                    <MenuItem value={true}>{i18n.t("compaies.table.yes")}</MenuItem>
                    <MenuItem value={false}>{i18n.t("compaies.table.no")}</MenuItem>
                  </Field>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    label={i18n.t("compaies.table.dueDate")}
                    name="dueDate"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Field
                    as={TextField}
                    select
                    label={i18n.t("compaies.table.recurrence")}
                    name="recurrence"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  >
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="MENSAL">
                      {i18n.t("compaies.table.monthly")}
                    </MenuItem>
                    <MenuItem value="BIMESTRAL">
                      {i18n.t("compaies.table.bimonthly")}
                    </MenuItem>
                    <MenuItem value="TRIMESTRAL">
                      {i18n.t("compaies.table.quarterly")}
                    </MenuItem>
                    <MenuItem value="SEMESTRAL">
                      {i18n.t("compaies.table.semester")}
                    </MenuItem>
                    <MenuItem value="ANUAL">
                      {i18n.t("compaies.table.yearly")}
                    </MenuItem>
                  </Field>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} color="secondary" variant="outlined">
                {i18n.t("companyModal.buttons.cancel")}
              </Button>
              {isEditing && values.recurrence && values.dueDate && (
                <Tooltip title="Soma a recorrência ao vencimento atual">
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => incrementDueDate(values, setFieldValue)}
                  >
                    + {i18n.t("compaies.table.dueDate")}
                  </Button>
                </Tooltip>
              )}
              <ButtonWithSpinner
                type="submit"
                color="primary"
                variant="contained"
                loading={loading}
              >
                {isEditing
                  ? i18n.t("companyModal.buttons.okEdit")
                  : i18n.t("companyModal.buttons.okAdd")}
              </ButtonWithSpinner>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

// Aba "Empresas" do console /admin — consolida src/pages/Companies (tabela
// completa com dados de plano/pasta) e src/components/CompaniesManager
// (formulário completo + ações) num único componente autocontido.
const EmpresasTab = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { list, save, update, remove } = useCompanies();
  const { dateToClient, datetimeToClient } = useDate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("companies.create");
  const canEdit = hasPermission("companies.edit");
  const canDelete = hasPermission("companies.delete");

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchParam = useDebounce(searchInput, 500);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState(null);

  // Conexões: null = ainda não carregou; [] = carregou vazio/falhou
  const [allWhatsapps, setAllWhatsapps] = useState(null);
  const [connModalOpen, setConnModalOpen] = useState(false);
  const [connWhatsapps, setConnWhatsapps] = useState([]);
  const [connCompany, setConnCompany] = useState(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      // GET /companies/list — retorna todos os campos + plan {id,name,amount}
      const data = await list();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWhatsapps = useCallback(async () => {
    try {
      const { data } = await api.get("/whatsapp/all/", {
        params: { session: 0 },
      });
      const list = Array.isArray(data) ? data : [];
      setAllWhatsapps(list);
      return list;
    } catch (err) {
      // 403 = sem permissão connections.view — lista fica vazia
      if (err?.response?.status !== 403) {
        toastError(err);
      }
      setAllWhatsapps([]);
      return [];
    }
  }, []);

  useEffect(() => {
    loadCompanies();
    loadWhatsapps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca client-side com debounce de 500ms — nome, e-mail, telefone e CNPJ/CPF
  const filteredCompanies = useMemo(() => {
    const s = (searchParam || "").toLowerCase().trim();
    if (!s) return companies;
    return companies.filter((c) =>
      `${c.name || ""} ${c.email || ""} ${c.phone || ""} ${c.document || ""}`
        .toLowerCase()
        .includes(s)
    );
  }, [companies, searchParam]);

  // Contagem de conexões por empresa (para exibir no tooltip da ação)
  const connCountByCompany = useMemo(() => {
    const map = {};
    (allWhatsapps || []).forEach((w) => {
      map[w.companyId] = (map[w.companyId] || 0) + 1;
    });
    return map;
  }, [allWhatsapps]);

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setFormOpen(true);
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingCompany(null);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (data.id !== undefined) {
        await update(data);
      } else {
        await save(data);
      }
      await loadCompanies();
      handleCloseForm();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error(
        "Não foi possível realizar a operação. Verifique se já existe uma empresa com o mesmo nome ou se os campos foram preenchidos corretamente"
      );
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await remove(deletingCompany.id);
      toast.success(i18n.t("compaies.toasts.deleted"));
      await loadCompanies();
    } catch (err) {
      toastError(err);
    }
    setDeletingCompany(null);
  };

  // Abre o modal de conexões da empresa — mesmo fluxo de AllConnections,
  // mas abre mesmo sem conexões (lá só abria se houvesse >0)
  const handleOpenConnections = async (company) => {
    let all = allWhatsapps;
    if (all === null) {
      all = await loadWhatsapps();
    }
    setConnWhatsapps(all.filter((w) => w.companyId === company.id));
    setConnCompany(company);
    setConnModalOpen(true);
  };

  const handleCloseConnections = () => {
    setConnModalOpen(false);
    setConnWhatsapps([]);
    setConnCompany(null);
  };

  const renderPlanValue = (company) =>
    company.planId !== null && company.plan && company.plan.amount
      ? company.plan.amount.toLocaleString("pt-br", {
          minimumFractionDigits: 2,
        })
      : "00.00";

  // Destaque de linha por vencimento — mesma regra das telas antigas,
  // com cores via palette para não estourar no dark mode
  const rowStyle = (record) => {
    // Guard: moment(undefined) é válido (data atual) — sem dueDate, sem destaque
    if (record.dueDate && moment(record.dueDate).isValid()) {
      const diff = moment(record.dueDate).diff(moment(), "days");
      const isDark = theme.palette.type === "dark";
      if (diff <= 0) {
        return {
          backgroundColor: isDark ? "rgba(244, 67, 54, 0.18)" : "#fa8c8c",
        };
      }
      if (diff >= 1 && diff <= 5) {
        return {
          backgroundColor: isDark ? "rgba(255, 213, 79, 0.14)" : "#fffead",
        };
      }
    }
    return {};
  };

  return (
    <Box>
      <ConfirmationModal
        title={
          deletingCompany &&
          `${i18n.t("compaies.confirmationModal.deleteTitle")} ${
            deletingCompany.name
          }?`
        }
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      >
        {i18n.t("compaies.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <CompanyFormDialog
        open={formOpen}
        onClose={handleCloseForm}
        company={editingCompany}
        onSubmit={handleSave}
        loading={saving}
      />

      <WhatsAppModalCompany
        open={connModalOpen}
        onClose={handleCloseConnections}
        filteredWhatsapps={connWhatsapps}
        companyInfos={connCompany}
      />

      <Box className={classes.toolbar}>
        <TextField
          placeholder={i18n.t("contacts.searchPlaceholder")}
          type="search"
          variant="outlined"
          size="small"
          className={classes.searchField}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ color: "gray" }} fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="body2" className={classes.countText}>
          {i18n.t("compaies.title")} ({filteredCompanies.length})
        </Typography>
        <Box flex={1} />
        {canCreate && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenCreate}
            startIcon={<AddIcon />}
          >
            {i18n.t("compaies.buttons.add")}
          </Button>
        )}
      </Box>

      <Paper className={classes.tablePaper} elevation={0} variant="outlined">
        <div className={classes.tableScroll}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.ID")}
                </TableCell>
                <TableCell className={classes.headCell}>
                  {i18n.t("compaies.table.name")}
                </TableCell>
                <TableCell className={classes.headCell}>
                  {i18n.t("compaies.table.email")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.phone")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.namePlan")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.value")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.active")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.createdAt")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.dueDate")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.lastLogin")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  Pasta
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("compaies.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton columns={12} />
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow
                    key={company.id}
                    className={classes.rowHover}
                    style={rowStyle(company)}
                  >
                    <TableCell align="center" className={classes.bodyCell}>
                      {company.id}
                    </TableCell>
                    <TableCell className={classes.bodyCell}>
                      {company.name || "—"}
                    </TableCell>
                    <TableCell className={classes.bodyCell}>
                      {company.email || "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {company.phone || "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {company?.plan?.name || "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {i18n.t("compaies.table.money")} {renderPlanValue(company)}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <StatusChip active={company.status !== false} />
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {company.createdAt ? dateToClient(company.createdAt) : "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {company.dueDate ? dateToClient(company.dueDate) : "—"}
                      {company.recurrence && (
                        <div className={classes.cellCaption}>
                          {company.recurrence}
                        </div>
                      )}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {company.lastLogin
                        ? datetimeToClient(company.lastLogin)
                        : "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {company.folderSize || "—"}
                      {(company.numberFileFolder || company.updatedAtFolder) && (
                        <div className={classes.cellCaption}>
                          {company.numberFileFolder || 0} arq.
                          {company.updatedAtFolder
                            ? ` · ${datetimeToClient(company.updatedAtFolder)}`
                            : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <Tooltip
                        title={`${i18n.t("connections.title")} (${
                          connCountByCompany[company.id] || 0
                        })`}
                      >
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenConnections(company)}
                          >
                            <PhonelinkSetupIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {canEdit && (
                        <Tooltip title={i18n.t("companyModal.title.edit")}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(company)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title={i18n.t("compaies.table.delete")}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setDeletingCompany(company);
                                setConfirmOpen(true);
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filteredCompanies.length === 0 && (
          <Box className={classes.emptyState}>
            <BusinessIcon className={classes.emptyIcon} />
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {searchParam
                ? "Nenhuma empresa encontrada para a busca."
                : "Nenhuma empresa cadastrada."}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {searchParam
                ? "Ajuste o termo pesquisado ou limpe o campo de busca."
                : "Clique em Adicionar empresa para cadastrar a primeira."}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default EmpresasTab;
