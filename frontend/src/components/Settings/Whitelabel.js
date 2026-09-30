import React, { useEffect, useState, useContext, useRef } from "react";

import {
  Grid,
  FormControl,
  TextField,
  Paper,
  Typography,
  IconButton,
  InputAdornment,
  Select,
  MenuItem,
  InputLabel,
  Tooltip,
  makeStyles,
} from "@material-ui/core";

import {
  Colorize,
  CloudUpload,
  Delete,
} from "@material-ui/icons";

import { toast } from "react-toastify";
import useSettings from "../../hooks/useSettings";
import OnlyForSuperUser from "../OnlyForSuperUser";
import useAuth from "../../hooks/useAuth.js/index.js";
import ColorModeContext from "../../layout/themeContext";
import api from "../../services/api";
import { getBackendUrl } from "../../config";

import defaultLogoLight from "../../assets/logo.png";
import defaultLogoDark from "../../assets/logo-black.png";
import defaultLogoFavicon from "../../assets/favicon.ico";
import ColorBoxModal from "../ColorBoxModal/index.js";

const useStyles = makeStyles((theme) => ({
  section: {
    borderRadius: 12,
    padding: theme.spacing(3),
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.palette.type === "dark"
      ? "0 1px 4px rgba(0,0,0,0.4)"
      : "0 1px 4px rgba(0,0,0,0.06)",
  },
  sectionTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    marginBottom: 2,
  },
  sectionDesc: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2.5),
  },
  fullWidth: {
    width: "100%",
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 5,
    border: `1px solid ${theme.palette.divider}`,
  },
  uploadInput: {
    display: "none",
  },
  logoCard: {
    borderRadius: 10,
    border: `1px dashed ${theme.palette.divider}`,
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    height: "100%",
    transition: "border-color .15s ease",
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
  },
  logoCardLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  logoPreview: {
    borderRadius: 8,
    padding: theme.spacing(2),
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  logoPreviewLight: {
    backgroundColor: "#ffffff",
    border: `1px solid ${theme.palette.divider}`,
  },
  logoPreviewDark: {
    backgroundColor: "#303030",
  },
  logoPreviewFavicon: {
    backgroundColor: theme.palette.type === "dark" ? "#303030" : "#f5f5f5",
    border: `1px solid ${theme.palette.divider}`,
  },
  logoImg: {
    maxWidth: "100%",
    maxHeight: 72,
  },
  logoActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoHint: {
    fontSize: 11,
    color: theme.palette.text.disabled,
  },
}));

// Card reutilizável de upload de imagem (logo claro/escuro/favicon)
function LogoUploadCard({
  label,
  hint,
  previewClass,
  imgSrc,
  fileValue,
  inputRef,
  inputId,
  onUpload,
  onDelete,
}) {
  const classes = useStyles();

  return (
    <div className={classes.logoCard}>
      <Typography className={classes.logoCardLabel}>{label}</Typography>
      <div className={`${classes.logoPreview} ${previewClass}`}>
        {fileValue ? (
          <img className={classes.logoImg} src={imgSrc} alt={`${label}-preview`} />
        ) : (
          <Typography className={classes.logoHint}>Nenhuma imagem enviada</Typography>
        )}
      </div>
      <div className={classes.logoActions}>
        <Typography className={classes.logoHint}>{hint}</Typography>
        <div>
          {fileValue && (
            <Tooltip title="Remover">
              <IconButton size="small" onClick={onDelete}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <input
            type="file"
            id={inputId}
            ref={inputRef}
            accept="image/*"
            className={classes.uploadInput}
            onChange={onUpload}
          />
          <Tooltip title="Enviar imagem">
            <IconButton size="small" color="primary" onClick={() => inputRef.current.click()}>
              <CloudUpload fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default function Whitelabel(props) {
  const { settings } = props;
  const classes = useStyles();
  const [settingsLoaded, setSettingsLoaded] = useState({});

  const { getCurrentUserInfo } = useAuth();
  const [currentUser, setCurrentUser] = useState({});

  const { colorMode } = useContext(ColorModeContext);
  const [primaryColorLightModalOpen, setPrimaryColorLightModalOpen] = useState(false);
  const [primaryColorDarkModalOpen, setPrimaryColorDarkModalOpen] = useState(false);

  const logoLightInput = useRef(null);
  const logoDarkInput = useRef(null);
  const logoFaviconInput = useRef(null);
  const appNameInput = useRef(null);
  const [appName, setAppName] = useState(settingsLoaded.appName || "");

  const { update } = useSettings();

  function updateSettingsLoaded(key, value) {
    if (key === "primaryColorLight" || key === "primaryColorDark" || key === "appName") {
      localStorage.setItem(key, value);
    }

    // Usar função de atualização para garantir que usa o estado mais recente
    setSettingsLoaded((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    getCurrentUserInfo().then((u) => {
      setCurrentUser(u);
    });

    if (Array.isArray(settings) && settings.length) {
      const primaryColorLight = settings.find((s) => s.key === "primaryColorLight")?.value;
      const primaryColorDark = settings.find((s) => s.key === "primaryColorDark")?.value;
      const appLogoLight = settings.find((s) => s.key === "appLogoLight")?.value;
      const appLogoDark = settings.find((s) => s.key === "appLogoDark")?.value;
      const appLogoFavicon = settings.find((s) => s.key === "appLogoFavicon")?.value;
      const appName = settings.find((s) => s.key === "appName")?.value;
      const viewMode = settings.find((s) => s.key === "viewMode")?.value;

      // Limpar valores corrompidos (#undefined)
      const cleanColor = (color) => {
        if (!color || color === "#undefined" || color === "undefined") return "";
        return color;
      };

      setAppName(appName || "");
      setSettingsLoaded({
        ...settingsLoaded,
        primaryColorLight: cleanColor(primaryColorLight),
        primaryColorDark: cleanColor(primaryColorDark),
        appLogoLight,
        appLogoDark,
        appLogoFavicon,
        appName,
        viewMode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  async function handleSaveSetting(key, value) {
    const result = await update({
      key,
      value,
    });

    updateSettingsLoaded(key, value);
    toast.success("Operação atualizada com sucesso.");
  }

  const uploadLogo = async (e, mode) => {
    if (!e.target.files) {
      return;
    }

    const file = e.target.files[0];
    const formData = new FormData();

    formData.append("typeArch", "logo");
    formData.append("mode", mode);
    formData.append("file", file);

    await api
      .post("/settings-whitelabel/logo", formData, {
        onUploadProgress: (event) => {
          let progress = Math.round((event.loaded * 100) / event.total);
          console.log(`A imagem está ${progress}% carregada... `);
        },
      })
      .then((response) => {
        updateSettingsLoaded(`appLogo${mode}`, response.data);
        colorMode[`setAppLogo${mode}`](getBackendUrl() + "/public/" + response.data);
        toast.success("Imagem enviada com sucesso.");
      })
      .catch((err) => {
        console.error("Houve um problema ao realizar o upload da imagem.");
        toast.error("Não foi possível enviar a imagem.");
      });
  };

  const logoUrl = (file) =>
    file ? `${getBackendUrl()}/public/${file}` : "";

  return (
    <Grid spacing={3} container>
      <OnlyForSuperUser
        user={currentUser}
        yes={() => (
          <>
            {/* IDENTIDADE */}
            <Grid xs={12} item>
              <Paper className={classes.section} elevation={0}>
                <Typography className={classes.sectionTitle}>Identidade</Typography>
                <Typography className={classes.sectionDesc}>
                  Nome exibido no sistema e estilo visual padrão do painel.
                </Typography>
                <Grid spacing={2} container>
                  <Grid xs={12} sm={6} item>
                    <TextField
                      id="appname-field"
                      label="Nome do sistema"
                      variant="outlined"
                      size="small"
                      fullWidth
                      name="appName"
                      value={appName}
                      inputRef={appNameInput}
                      onChange={(e) => setAppName(e.target.value)}
                      onBlur={async () => {
                        await handleSaveSetting("appName", appName);
                        colorMode.setAppName(appName || "Multi100");
                      }}
                    />
                  </Grid>
                  <Grid xs={12} sm={6} item>
                    <FormControl variant="outlined" size="small" fullWidth>
                      <InputLabel id="viewmode-label">Estilo Visual</InputLabel>
                      <Select
                        labelId="viewmode-label"
                        id="viewmode-select"
                        label="Estilo Visual"
                        value={settingsLoaded.viewMode || "classic"}
                        onChange={async (e) => {
                          const value = e.target.value;
                          await handleSaveSetting("viewMode", value);
                          colorMode.setViewMode(value);
                        }}
                      >
                        <MenuItem value="classic">Clássico</MenuItem>
                        <MenuItem value="modern">Moderno (Deep UI)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* CORES */}
            <Grid xs={12} item>
              <Paper className={classes.section} elevation={0}>
                <Typography className={classes.sectionTitle}>Cores</Typography>
                <Typography className={classes.sectionDesc}>
                  Cor primária aplicada aos temas claro e escuro de todos os tenants.
                </Typography>
                <Grid spacing={2} container>
                  <Grid xs={12} sm={6} item>
                    <TextField
                      id="primary-color-light-field"
                      label="Cor Primária — Modo Claro"
                      variant="outlined"
                      size="small"
                      fullWidth
                      value={settingsLoaded.primaryColorLight || ""}
                      onClick={() => setPrimaryColorLightModalOpen(true)}
                      InputProps={{
                        readOnly: true,
                        startAdornment: (
                          <InputAdornment position="start">
                            <div
                              style={{ backgroundColor: settingsLoaded.primaryColorLight || "transparent" }}
                              className={classes.colorSwatch}
                            />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setPrimaryColorLightModalOpen(true)}
                            >
                              <Colorize fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <ColorBoxModal
                      open={primaryColorLightModalOpen}
                      handleClose={() => setPrimaryColorLightModalOpen(false)}
                      onChange={(color) => {
                        if (color && color.hex) {
                          handleSaveSetting("primaryColorLight", `#${color.hex}`);
                          colorMode.setPrimaryColorLight(`#${color.hex}`);
                        }
                      }}
                      currentColor={settingsLoaded.primaryColorLight}
                    />
                  </Grid>
                  <Grid xs={12} sm={6} item>
                    <TextField
                      id="primary-color-dark-field"
                      label="Cor Primária — Modo Escuro"
                      variant="outlined"
                      size="small"
                      fullWidth
                      value={settingsLoaded.primaryColorDark || ""}
                      onClick={() => setPrimaryColorDarkModalOpen(true)}
                      InputProps={{
                        readOnly: true,
                        startAdornment: (
                          <InputAdornment position="start">
                            <div
                              style={{ backgroundColor: settingsLoaded.primaryColorDark || "transparent" }}
                              className={classes.colorSwatch}
                            />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setPrimaryColorDarkModalOpen(true)}
                            >
                              <Colorize fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <ColorBoxModal
                      open={primaryColorDarkModalOpen}
                      handleClose={() => setPrimaryColorDarkModalOpen(false)}
                      onChange={(color) => {
                        if (color && color.hex) {
                          handleSaveSetting("primaryColorDark", `#${color.hex}`);
                          colorMode.setPrimaryColorDark(`#${color.hex}`);
                        }
                      }}
                      currentColor={settingsLoaded.primaryColorDark}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* LOGOTIPOS */}
            <Grid xs={12} item>
              <Paper className={classes.section} elevation={0}>
                <Typography className={classes.sectionTitle}>Logotipos e favicon</Typography>
                <Typography className={classes.sectionDesc}>
                  Imagens exibidas no login, menu lateral e aba do navegador. PNG ou SVG com fundo transparente recomendado.
                </Typography>
                <Grid spacing={2} container>
                  <Grid xs={12} sm={6} md={4} item>
                    <LogoUploadCard
                      label="Logotipo claro"
                      hint="Exibido no tema claro"
                      previewClass={classes.logoPreviewLight}
                      imgSrc={logoUrl(settingsLoaded.appLogoLight)}
                      fileValue={settingsLoaded.appLogoLight}
                      inputRef={logoLightInput}
                      inputId="upload-logo-light-button"
                      onUpload={(e) => uploadLogo(e, "Light")}
                      onDelete={() => {
                        handleSaveSetting("appLogoLight", "");
                        colorMode.setAppLogoLight(defaultLogoLight);
                      }}
                    />
                  </Grid>
                  <Grid xs={12} sm={6} md={4} item>
                    <LogoUploadCard
                      label="Logotipo escuro"
                      hint="Exibido no tema escuro"
                      previewClass={classes.logoPreviewDark}
                      imgSrc={logoUrl(settingsLoaded.appLogoDark)}
                      fileValue={settingsLoaded.appLogoDark}
                      inputRef={logoDarkInput}
                      inputId="upload-logo-dark-button"
                      onUpload={(e) => uploadLogo(e, "Dark")}
                      onDelete={() => {
                        handleSaveSetting("appLogoDark", "");
                        colorMode.setAppLogoDark(defaultLogoDark);
                      }}
                    />
                  </Grid>
                  <Grid xs={12} sm={6} md={4} item>
                    <LogoUploadCard
                      label="Favicon"
                      hint="Ícone da aba do navegador"
                      previewClass={classes.logoPreviewFavicon}
                      imgSrc={logoUrl(settingsLoaded.appLogoFavicon)}
                      fileValue={settingsLoaded.appLogoFavicon}
                      inputRef={logoFaviconInput}
                      inputId="upload-logo-favicon-button"
                      onUpload={(e) => uploadLogo(e, "Favicon")}
                      onDelete={() => {
                        handleSaveSetting("appLogoFavicon", "");
                        colorMode.setAppLogoFavicon(defaultLogoFavicon);
                      }}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </>
        )}
      />
    </Grid>
  );
}
