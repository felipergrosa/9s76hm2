import React, { useState, useEffect, useContext, useRef } from "react";

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
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import useWhatsApps from "../../hooks/useWhatsApps";
import useTags from "../../hooks/useTags";
import useUsers from "../../hooks/useUsers";
import usePermissions from "../../hooks/usePermissions";

import { Can } from "../Can";
import { Avatar, Grid, Input, Paper, Tab, Tabs, Chip, Typography, Divider } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { getBackendUrl } from "../../config";
import TabPanel from "../TabPanel";
import AvatarUploader from "../AvatarUpload";
import PermissionTransferList from "../PermissionTransferList";
import LegacySettingsGroup from "../LegacySettingsGroup";
import VisibilityIcon from "@material-ui/icons/Visibility";
import GroupIcon from "@material-ui/icons/Group";
import DashboardIcon from "@material-ui/icons/Dashboard";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import CloseIcon from "@material-ui/icons/Close";
import HierarchyTutorial from "./HierarchyTutorial";
import GroupPermissionSelector from "../GroupPermissionSelector";

const backendUrl = getBackendUrl();

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
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  avatar: {
    width: theme.spacing(12),
    height: theme.spacing(12),
    margin: theme.spacing(2),
    cursor: 'pointer',
    borderRadius: '50%',
    border: '2px solid #ccc',
  },
  updateDiv: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateInput: {
    display: 'none',
  },
  updateLabel: {
    padding: theme.spacing(1),
    margin: theme.spacing(1),
    textTransform: 'uppercase',
    textAlign: 'center',
    cursor: 'pointer',
    border: '2px solid #ccc',
    borderRadius: '5px',
    minWidth: 160,
    fontWeight: 'bold',
    color: '#555',
  },
  errorUpdate: {
    border: '2px solid red',
  },
  errorText: {
    color: 'red',
    fontSize: '0.8rem',
    fontWeight: 'bold',
  }
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Required"),
  password: Yup.string().min(5, "Parâmetros incompletos!").max(50, "Parâmetros acima do esperado!"),
  email: Yup.string().email("E-mail inválido").required("Required"),
  allHistoric: Yup.string().nullable(),
  allowedContactTags: Yup.array().of(Yup.number()).nullable(),
  allowedConnectionIds: Yup.array().of(Yup.number()).nullable(),
  isPrivate: Yup.boolean().nullable(),
});

const UserModal = ({ open, onClose, userId }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
    email: "",
    password: "",
    profile: "user",
    super: false,
    startWork: "00:00",
    endWork: "23:59",
    farewellMessage: "",
    allTicket: "disable",
    allowGroup: false,
    defaultTheme: "light",
    defaultMenu: "open",
    allHistoric: "disabled",
    allUserChat: "disabled",
    userClosePendingTicket: "enabled",
    showDashboard: "disabled",
    allowRealTime: "disabled",
    allowConnections: "disabled",
    allowedContactTags: [],
    managedUserIds: [],
    supervisorViewMode: "include",
    permissions: [],
    allowedConnectionIds: [],
    isPrivate: false,
    color: "",
  };

  const { user: loggedInUser } = useContext(AuthContext);
  const { hasPermission, isAdmin } = usePermissions();

  // Verifica se está editando próprio perfil e se tem permissão
  const isEditingOwnProfile = userId === loggedInUser?.id;
  const canEditOwnProfile = hasPermission("users.edit-own");
  const canEditUsers = hasPermission("users.edit");
  const isUserAdmin = isAdmin();

  // Determina se pode salvar baseado nas permissões
  const canSave = !isEditingOwnProfile || canEditOwnProfile || canEditUsers || isUserAdmin;

  const [user, setUser] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [whatsappId, setWhatsappId] = useState('');
  const { loading, whatsApps } = useWhatsApps();
  const [profileUrl, setProfileUrl] = useState(null)
  const [tab, setTab] = useState("general");
  const [avatar, setAvatar] = useState(null);
  const startWorkRef = useRef();
  const endWorkRef = useRef();

  const { tags, loading: tagsLoading } = useTags(); // Usar o hook
  const { users: allUsers, loading: usersLoading } = useUsers(); // Lista de usuários para selecionar gerenciados

  // DEBUG: Log das tags carregadas
  useEffect(() => {
    console.log("[UserModal DEBUG] Tags carregadas:", tags);
    console.log("[UserModal DEBUG] Tags loading:", tagsLoading);
    console.log("[UserModal DEBUG] Total tags:", tags?.length);
    
    // Categorizar tags
    const personal = tags?.filter(t => t.name?.startsWith('#') && !t.name?.startsWith('##')) || [];
    const group = tags?.filter(t => t.name?.startsWith('##')) || [];
    const region = tags?.filter(t => t.name?.startsWith('###')) || [];
    const others = tags?.filter(t => !t.name?.startsWith('#')) || [];
    
    console.log("[UserModal DEBUG] Tags pessoais (#):", personal);
    console.log("[UserModal DEBUG] Tags grupo (##):", group);
    console.log("[UserModal DEBUG] Tags região (###):", region);
    console.log("[UserModal DEBUG] Tags outras:", others);
  }, [tags, tagsLoading]);

  useEffect(() => {
    const fetchUser = async () => {

      if (!userId) return;
      try {
        const { data } = await api.get(`/users/${userId}`);
        setUser(prevState => {
          return {
            ...prevState,
            ...data,
            permissions: Array.isArray(data.permissions) ? data.permissions : []
          };
        });

        const { profileImage } = data;
        setProfileUrl(`${backendUrl}/public/company${data.companyId}/${profileImage}`);

        const userQueueIds = data.queues?.map(queue => queue.id);
        setSelectedQueueIds(userQueueIds);
        setWhatsappId(data.whatsappId ? data.whatsappId : '');
      } catch (err) {
        // 403 = sem permissão users.view (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    };

    fetchUser();
  }, [userId, open]);

  const handleClose = () => {
    onClose();
    setUser(initialState);
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleSaveUser = async (values) => {
    console.log("[UserModal] handleSaveUser chamado", values);
    console.log("[UserModal] userId:", userId);
    
    const uploadAvatar = async (file) => {
      try {
        const formData = new FormData();
        formData.append("userId", file.id);
        formData.append("typeArch", "user");
        formData.append("profileImage", avatar);

        const { data } = await api.post(`/users/${file.id}/media-upload`, formData);
        localStorage.setItem("profileImage", data.user.profileImage);
      } catch (err) {
        // 403 = sem permissão users.edit-own (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    };

    const userData = {
      ...values,
      whatsappId,
      queueIds: selectedQueueIds,
      allowedContactTags: values.allowedContactTags || [],
      permissions: values.permissions || [], // Enviar permissions
    };

    try {
      if (userId) {
        const { data } = await api.put(`/users/${userId}`, userData);

        // Corrigido: usar comparação correta e esperar uploadAvatar
        if (avatar && (!user?.profileImage || user?.profileImage !== avatar.name)) {
          await uploadAvatar(data);
        }
      } else {
        const { data } = await api.post("/users", userData);

        // Novo usuário, sempre faz upload se avatar existir
        if (avatar) {
          await uploadAvatar(data);
        }
      }

      if (userId === loggedInUser.id) {
        handleClose();
        toast.success(i18n.t("userModal.success"));
        window.location.reload();
      } else {
        handleClose();
        toast.success(i18n.t("userModal.success"));
      }
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
        PaperProps={{
          style: {
            maxHeight: '90vh',
            height: '90vh'
          }
        }}
      >
        <DialogTitle id="form-dialog-title">
          {userId
            ? `${i18n.t("userModal.title.edit")}`
            : `${i18n.t("userModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={UserSchema}
          onSubmit={(values, actions) => {
            console.log("[UserModal] onSubmit chamado", values);
            setTimeout(() => {
              handleSaveUser(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, setFieldValue, values }) => (
            <Form style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <Paper className={classes.mainPaper} elevation={1}>
                <Tabs
                  value={tab}
                  indicatorColor="primary"
                  textColor="primary"
                  scrollButtons="on"
                  variant="scrollable"
                  onChange={handleTabChange}
                  className={classes.tab}
                >
                  <Tab label={i18n.t("userModal.tabs.general")} value={"general"} />
                  <Tab label={i18n.t("userModal.tabs.permissions")} value={"permissions"} />
                  {loggedInUser.super && <Tab label="Como usar?" value={"tutorial"} />}
                </Tabs>
              </Paper>
              <Paper className={classes.paper} elevation={0} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <DialogContent dividers>
                  <TabPanel
                    className={classes.container}
                    value={tab}
                    name={"general"}
                  >
                    <Grid container spacing={2} alignItems="flex-start">
                      <Grid item xs={12} md={4} xl={4}>
                        <FormControl className={classes.updateDiv}>
                          <AvatarUploader
                            setAvatar={setAvatar}
                            avatar={user.profileImage}
                            companyId={user.companyId}
                            onRemove={() => {
                              user.profileImage = null;
                              setFieldValue("profileImage", null);
                              setAvatar(null);
                            }}
                          />
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={8} xl={8}>
                        <Grid container spacing={1}>
                          <Grid item xs={12}>
                            <Field
                              as={TextField}
                              label={i18n.t("userModal.form.name")}
                              autoFocus
                              name="name"
                              error={touched.name && Boolean(errors.name)}
                              helperText={touched.name && errors.name}
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Field
                              as={TextField}
                              label={i18n.t("userModal.form.password")}
                              type="password"
                              name="password"
                              error={touched.password && Boolean(errors.password)}
                              helperText={touched.password && errors.password}
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              label={i18n.t("userModal.form.color") || "Cor do usuário"}
                              name="color"
                              type="color"
                              variant="outlined"
                              margin="dense"
                              fullWidth
                              value={values.color || ""}
                              onChange={(e) => setFieldValue("color", e.target.value)}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={8} xl={8}>
                        <Field
                          as={TextField}
                          label={i18n.t("userModal.form.email")}
                          name="email"
                          error={touched.email && Boolean(errors.email)}
                          helperText={touched.email && errors.email}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={4} xl={4}>
                        <FormControl
                          variant="outlined"
                          //className={classes.formControl}
                          margin="dense"
                          fullWidth
                        >
                          <Can
                            user={loggedInUser}
                            perform="users.edit"
                            yes={() => (
                              <>
                                <InputLabel id="profile-selection-input-label">
                                  {i18n.t("userModal.form.profile")}
                                </InputLabel>

                                <Field
                                  as={Select}
                                  label={i18n.t("userModal.form.profile")}
                                  name="profile"
                                  labelId="profile-selection-label"
                                  id="profile-selection"
                                  required
                                >
                                  <MenuItem value="admin">Admin</MenuItem>
                                  <MenuItem value="user">User</MenuItem>
                                </Field>
                              </>
                            )}
                          />
                        </FormControl>
                      </Grid>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={12} xl={12}>
                        <Can
                          user={loggedInUser}
                          perform="users.edit"
                          yes={() => (
                            <QueueSelect
                              selectedQueueIds={selectedQueueIds}
                              onChange={values => setSelectedQueueIds(values)}
                              fullWidth
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={12} xl={12}>
                        <Can
                          user={loggedInUser}
                          perform="users.edit"
                          yes={() => (
                            <FormControl variant="outlined" margin="dense" className={classes.maxWidth} fullWidth>
                              <InputLabel>
                                {i18n.t("userModal.form.whatsapp")}
                              </InputLabel>
                              <Select
                                value={whatsappId || ''}
                                onChange={(e) => setWhatsappId(e.target.value)}
                                label={i18n.t("userModal.form.whatsapp")}
                              >
                                <MenuItem value="">&nbsp;</MenuItem>
                                {whatsApps.map((whatsapp) => (
                                  <MenuItem key={whatsapp.id} value={whatsapp.id}>{whatsapp.name}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                    </Grid>
                    <Can
                      user={loggedInUser}
                      perform="user-modal:editProfile"
                      yes={() => (
                        <Grid container spacing={1}>
                          <Grid item xs={12} md={6} xl={6}>
                            <Field
                              as={TextField}
                              label={i18n.t("userModal.form.startWork")}
                              type="time"
                              ampm={"false"}
                              inputRef={startWorkRef}
                              InputLabelProps={{
                                shrink: true,
                              }}
                              inputProps={{
                                step: 600, // 5 min
                              }}
                              fullWidth
                              name="startWork"
                              error={
                                touched.startWork && Boolean(errors.startWork)
                              }
                              helperText={
                                touched.startWork && errors.startWork
                              }
                              variant="outlined"
                              margin="dense"
                              className={classes.textField}
                            />
                          </Grid>
                          <Grid item xs={12} md={6} xl={6}>
                            <Field
                              as={TextField}
                              label={i18n.t("userModal.form.endWork")}
                              type="time"
                              ampm={"false"}
                              inputRef={endWorkRef}
                              InputLabelProps={{
                                shrink: true,
                              }}
                              inputProps={{
                                step: 600, // 5 min
                              }}
                              fullWidth
                              name="endWork"
                              error={
                                touched.endWork && Boolean(errors.endWork)
                              }
                              helperText={
                                touched.endWork && errors.endWork
                              }
                              variant="outlined"
                              margin="dense"
                              className={classes.textField}
                            />
                          </Grid>
                        </Grid>
                      )}
                    />

                    <Field
                      as={TextField}
                      label={i18n.t("userModal.form.farewellMessage")}
                      type="farewellMessage"
                      multiline
                      rows={2}
                      fullWidth
                      name="farewellMessage"
                      error={touched.farewellMessage && Boolean(errors.farewellMessage)}
                      helperText={touched.farewellMessage && errors.farewellMessage}
                      variant="outlined"
                      margin="dense"
                    />

                    <Grid container spacing={1}>
                      <Grid item xs={12} md={6} xl={6}>
                        <FormControl
                          variant="outlined"
                          className={classes.maxWidth}
                          margin="dense"
                          fullWidth
                        >
                          <>
                            <InputLabel >
                              {i18n.t("userModal.form.defaultTheme")}
                            </InputLabel>

                            <Field
                              as={Select}
                              label={i18n.t("userModal.form.defaultTheme")}
                              name="defaultTheme"
                              type="defaultTheme"
                              required
                            >
                              <MenuItem value="light">{i18n.t("userModal.form.defaultThemeLight")}</MenuItem>
                              <MenuItem value="dark">{i18n.t("userModal.form.defaultThemeDark")}</MenuItem>
                            </Field>
                          </>

                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6} xl={6}>

                        <FormControl
                          variant="outlined"
                          className={classes.maxWidth}
                          margin="dense"
                          fullWidth
                        >
                          <>
                            <InputLabel >
                              {i18n.t("userModal.form.defaultMenu")}
                            </InputLabel>

                            <Field
                              as={Select}
                              label={i18n.t("userModal.form.defaultMenu")}
                              name="defaultMenu"
                              type="defaultMenu"
                              required
                            >
                              <MenuItem value={"open"}>{i18n.t("userModal.form.defaultMenuOpen")}</MenuItem>
                              <MenuItem value={"closed"}>{i18n.t("userModal.form.defaultMenuClosed")}</MenuItem>
                            </Field>
                          </>

                        </FormControl>
                      </Grid>
                    </Grid>
                  </TabPanel>
                  <TabPanel
                    className={classes.container}
                    value={tab}
                    name={"permissions"}
                  >
                    <Can
                      user={loggedInUser}
                      perform="users.edit"
                      yes={() =>
                        <>
                          {/* NOVO: Sistema de Permissões Granulares */}
                          <Grid container spacing={1}>
                            <Grid item xs={12}>
                              <PermissionTransferList
                                value={values.permissions || []}
                                onChange={(permissions) => setFieldValue("permissions", permissions)}
                                disabled={false}
                              />
                            </Grid>
                          </Grid>

                          {/* Seção de Grupos Permitidos - aparece quando allowGroup está habilitado */}
                          {values.allowGroup && userId && (
                            <>
                              <Divider style={{ marginTop: 16, marginBottom: 16 }} />
                              <Typography variant="subtitle2" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <GroupIcon fontSize="small" />
                                Grupos Permitidos
                              </Typography>
                              <Typography variant="caption" color="textSecondary" style={{ marginBottom: 12, display: 'block' }}>
                                Selecione quais grupos este usuário poderá visualizar e interagir.
                              </Typography>
                              <GroupPermissionSelector
                                userId={userId}
                              // disabled={values.profile === 'admin' || values.super} // Agora todos podem ter permissões específicas
                              />
                            </>
                          )}


                          {/* Tags permitidas - exibe apenas tags pessoais (com 1x #, não ##) */}
                          <Divider style={{ marginTop: 16, marginBottom: 16 }} />
                          <Typography variant="subtitle2" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            Tags Pessoais (Carteiras)
                          </Typography>
                          <Typography variant="caption" color="textSecondary" style={{ marginBottom: 12, display: 'block' }}>
                            💡 Tags pessoais definem quais contatos o usuário pode visualizar. Tags devem começar com <strong>#</strong> (ex: #João, #EquipeVendas)
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={12}>
                              <Field name="allowedContactTags">
                                {({ field, form }) => {
                                  const selectedIds = field.value || [];
                                  // Filtra para mostrar apenas tags pessoais (começam com # mas NÃO com ##)
                                  const personalTags = tags.filter(t =>
                                    t.name && t.name.startsWith('#') && !t.name.startsWith('##')
                                  );
                                  const selectedObjects = personalTags.filter(t => selectedIds.includes(t.id));
                                  
                                  // DEBUG: Log das tags no dropdown
                                  console.log("[UserModal] Tags disponíveis:", tags?.length);
                                  console.log("[UserModal] Tags pessoais filtradas:", personalTags?.length, personalTags?.map(t => t.name));
                                  console.log("[UserModal] selectedIds:", selectedIds);
                                  console.log("[UserModal] tagsLoading:", tagsLoading);
                                  
                                  // Avisar se há tags sem formato correto
                                  const invalidTags = tags.filter(t => 
                                    t.name && !t.name.startsWith('#') && selectedIds.includes(t.id)
                                  );
                                  
                                  return (
                                    <>
                                      <Autocomplete
                                        multiple
                                        options={personalTags}
                                        value={selectedObjects}
                                        getOptionLabel={(option) => option?.name || ""}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                        onChange={(e, value) => form.setFieldValue("allowedContactTags", (value || []).map(v => v.id))}
                                        loading={tagsLoading}
                                        filterSelectedOptions
                                        renderTags={(value, getTagProps) =>
                                          value.map((option, index) => (
                                            <Chip
                                              {...getTagProps({ index })}
                                              key={option.id}
                                              label={option.name}
                                              style={{ backgroundColor: option.color || undefined, color: "#fff" }}
                                            />
                                          ))
                                        }
                                        renderInput={(params) => (
                                          <TextField
                                            {...params}
                                            variant="outlined"
                                            margin="dense"
                                            label="Tags Pessoais (Carteiras)"
                                            placeholder="Selecione tags que começam com #"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            helperText={personalTags.length === 0 ? "⚠️ Nenhuma tag pessoal encontrada. Crie tags com # no início (ex: #João)" : ""}
                                          />
                                        )}
                                      />
                                      {invalidTags.length > 0 && (
                                        <Typography variant="caption" color="error" style={{ marginTop: 8, display: 'block' }}>
                                          ⚠️ Atenção: {invalidTags.length} tag(s) selecionada(s) não tem formato correto (devem começar com #)
                                        </Typography>
                                      )}
                                    </>
                                  );
                                }}
                              </Field>
                            </Grid>
                          </Grid>

                          {/* Usuários gerenciados - para supervisores verem carteiras de outros usuários */}
                          {/* Apenas superadmin pode ver esta opção */}
                          {loggedInUser.super && (
                            <>
                              <Grid container spacing={1}>
                                <Grid item xs={12} md={6}>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        checked={values.super}
                                        onChange={(e) => setFieldValue("super", e.target.checked)}
                                        name="super"
                                        color="primary"
                                      />
                                    }
                                    label={
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        Super Admin (Acesso Total)
                                        <span title="Super Admin" style={{ fontSize: '1.2rem' }}>👑</span>
                                      </div>
                                    }
                                  />
                                </Grid>
                              </Grid>

                              <Divider style={{ marginTop: 16, marginBottom: 16 }} />
                              <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                                {i18n.t("userModal.form.managedUsers") || "Usuários Gerenciados (Supervisor)"}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" style={{ marginBottom: 8, display: 'block' }}>
                                {values.supervisorViewMode === "include"
                                  ? "Selecione os usuários cujas carteiras este usuário poderá visualizar. Deixe vazio para ver todos como admin normal."
                                  : "Selecione os usuários cujas carteiras este usuário NÃO poderá visualizar. Verá todos os outros."}
                              </Typography>
                              <Grid container spacing={1}>
                                <Grid item xs={12}>
                                  <FormControl variant="outlined" margin="dense" fullWidth>
                                    <InputLabel>Modo de visualização</InputLabel>
                                    <Field
                                      as={Select}
                                      name="supervisorViewMode"
                                      label="Modo de visualização"
                                    >
                                      <MenuItem value="include">Sim - Ver apenas os selecionados</MenuItem>
                                      <MenuItem value="exclude">Não - Ver todos exceto os selecionados</MenuItem>
                                    </Field>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                  <Field name="managedUserIds">
                                    {({ field, form }) => {
                                      const selectedIds = field.value || [];
                                      // Filtra para não mostrar o próprio usuário sendo editado
                                      const availableUsers = allUsers.filter(u => u.id !== userId);
                                      const selectedObjects = availableUsers.filter(u => selectedIds.includes(u.id));
                                      return (
                                        <Autocomplete
                                          multiple
                                          options={availableUsers}
                                          value={selectedObjects}
                                          getOptionLabel={(option) => option?.name || ""}
                                          onChange={(e, value) => form.setFieldValue("managedUserIds", (value || []).map(v => v.id))}
                                          loading={usersLoading}
                                          filterSelectedOptions
                                          renderTags={(value, getTagProps) =>
                                            value.map((option, index) => (
                                              <Chip
                                                {...getTagProps({ index })}
                                                key={option.id}
                                                label={option.name}
                                                style={{ backgroundColor: values.supervisorViewMode === "include" ? "#3f51b5" : "#f44336", color: "#fff" }}
                                              />
                                            ))
                                          }
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              variant="outlined"
                                              margin="dense"
                                              label={values.supervisorViewMode === "include" ? "Usuários que posso ver" : "Usuários que NÃO posso ver"}
                                              fullWidth
                                              InputLabelProps={{ shrink: true }}
                                            />
                                          )}
                                        />
                                      );
                                    }}
                                  </Field>
                                </Grid>
                              </Grid>
                            </>
                          )}

                          {/* Seção de Conexões Permitidas (Novo Hierarquia) */}
                          <Divider style={{ marginTop: 16, marginBottom: 16 }} />
                          <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                            Conexões Permitidas (Apenas estas aparecerão para o usuário)
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={12}>
                              <Field name="allowedConnectionIds">
                                {({ field, form }) => {
                                  const selectedIds = field.value || [];
                                  const selectedObjects = whatsApps.filter(w => selectedIds.includes(w.id));
                                  return (
                                    <Autocomplete
                                      multiple
                                      options={whatsApps}
                                      value={selectedObjects}
                                      getOptionLabel={(option) => option?.name || ""}
                                      onChange={(e, value) => form.setFieldValue("allowedConnectionIds", (value || []).map(v => v.id))}
                                      loading={loading}
                                      filterSelectedOptions
                                      renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                          <Chip
                                            {...getTagProps({ index })}
                                            key={option.id}
                                            label={option.name}
                                            style={{ backgroundColor: "#25D366", color: "#fff" }} // Cor do WhatsApp
                                          />
                                        ))
                                      }
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          variant="outlined"
                                          margin="dense"
                                          label="Conexões Liberadas"
                                          placeholder="Selecione..."
                                          fullWidth
                                          InputLabelProps={{ shrink: true }}
                                        />
                                      )}
                                    />
                                  );
                                }}
                              </Field>
                            </Grid>
                          </Grid>

                          {/* Ghost Mode (Apenas para Admins editando Admins? Ou Admin editando qualquer um?) */}
                          {/* O plano diz: Super Admin tem opção para não exibir nada seu. */}
                          {/* Então só aparece se o usuário editado FOR Admin ou Super */}
                          {(values.profile === 'admin') && (
                            <>
                              <Divider style={{ marginTop: 16, marginBottom: 16 }} />
                              <Grid container spacing={1}>
                                <Grid item xs={12}>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        checked={values.isPrivate}
                                        onChange={(e) => setFieldValue("isPrivate", e.target.checked)}
                                        name="isPrivate"
                                        color="secondary"
                                      />
                                    }
                                    label="Modo Privado (Ghost Mode) - Oculta tickets e usuário de não-admins"
                                  />
                                </Grid>
                              </Grid>
                            </>
                          )}
                        </>

                      }
                    />
                  </TabPanel>

                  {/* ABA: COMO USAR? (Visível apenas para Super Admin) */}
                  {loggedInUser.super && (
                    <TabPanel
                      className={classes.container}
                      value={tab}
                      name={"tutorial"}
                    >
                      <HierarchyTutorial />
                    </TabPanel>
                  )}
                </DialogContent>
              </Paper>
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
                  {i18n.t("userModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting || !canSave}
                  variant="contained"
                  className={classes.btnWrapper}
                  title={!canSave ? "Você não tem permissão para editar este perfil" : ""}
                  onClick={() => {
                    console.log("[UserModal] Botão Salvar clicado");
                    console.log("[UserModal] canSave:", canSave);
                    console.log("[UserModal] isSubmitting:", isSubmitting);
                    console.log("[UserModal] errors:", errors);
                    console.log("[UserModal] touched:", touched);
                  }}
                >
                  {userId
                    ? `${i18n.t("userModal.buttons.okEdit")}`
                    : `${i18n.t("userModal.buttons.okAdd")}`}
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
    </div >
  );
};

export default UserModal;
