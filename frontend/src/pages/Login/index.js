import React, { useState, useEffect, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button, TextField, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { IconButton, InputAdornment, Switch } from "@mui/material";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import EmailIcon from "@material-ui/icons/Email";
import LockIcon from "@material-ui/icons/Lock";
import { Helmet } from "react-helmet";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    position: "relative",
    // Cor do fundo animado tela de login
    background: "linear-gradient(-45deg,rgb(218, 149, 92),rgb(60, 183, 231),rgb(31, 113, 143),rgb(118, 240, 211))",
    backgroundSize: "400% 400%",
    animation: "$gradientAnimation 15s ease infinite",
  },
  "@keyframes gradientAnimation": {
    "0%": {
      backgroundPosition: "0% 50%",
    },
    "50%": {
      backgroundPosition: "100% 50%",
    },
    "100%": {
      backgroundPosition: "0% 50%",
    },
  },
  formSide: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "40px",
    zIndex: 1,
    [theme.breakpoints.down("sm")]: {
      padding: "20px",
    },
  },
  formContainer: {
    width: "100%",
    maxWidth: "400px",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
    padding: "30px",
    animation: "$fadeIn 1s ease-in-out",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "340px",
      padding: "20px",
    },
  },
  "@keyframes fadeIn": {
    "0%": { opacity: 0, transform: "translateY(20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
  logoImg: {
    display: "block",
    margin: "0 auto 20px",
    maxWidth: "150px",
    height: "auto",
  },
  submitBtn: {
    marginTop: "20px",
    background: theme.palette.primary.main,
    backgroundSize: "200%",
    color: "#fff",
    borderRadius: "8px",
    padding: "12px",
    fontWeight: "bold",
    width: "100%",
    cursor: "pointer",
    transition: "all 0.5s ease",
    "&:hover": {
      backgroundPosition: "right",
      boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)",
    },
  },
  registerBtn: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    borderRadius: "8px",
    padding: "12px",
    fontWeight: "bold",
    width: "100%",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "10px",
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
      boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.2)",
    },
  },
  forgotPassword: {
    marginTop: "15px",
    textAlign: "center",
  },
  forgotPasswordLink: {
    color: theme.palette.primary.main,
    textDecoration: "none",
    fontWeight: "500",
    "&:hover": {
      textDecoration: "underline",
    },
  },
  rememberMeContainer: {
    display: "flex",
    alignItems: "center",
    marginTop: "10px",
  },
  whatsappButton: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    backgroundColor: theme.palette.primary.main,
    borderRadius: "50%",
    width: "60px",
    height: "60px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 4px 12px #044012",
    transition: "all 0.3s ease",
    animation: "$bounce 2s infinite",
    cursor: "pointer",
    zIndex: 999,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
      transform: "scale(1.1)",
      boxShadow: "0 8px 16px #05491c",
    },
  },
  whatsappIcon: {
    width: "64px",
    height: "64px",
    objectFit: "contain",
  },
  "@keyframes bounce": {
    "0%, 100%": {
      transform: "translateY(0)",
    },
    "50%": {
      transform: "translateY(-5px)",
    },
  },
}));

const Login = () => {
  const classes = useStyles();
  const { handleLogin } = useContext(AuthContext);
  const [user, setUser] = useState({ email: "", password: "", remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [userCreationEnabled, setUserCreationEnabled] = useState(true);

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL === "https://localhost:8090"
      ? "https://localhost:8090"
      : process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    const fetchUserCreationStatus = async () => {
      try {
        const response = await fetch(`${backendUrl}/settings/userCreation`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user creation status");
        }

        const data = await response.json();
        setUserCreationEnabled(data.userCreation === "enabled");
      } catch (err) {
        console.error("Erro ao verificar userCreation:", err);
        setUserCreationEnabled(false);
      }
    };

    fetchUserCreationStatus();
  }, [backendUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(user);
  };

  return (
    <>
      <Helmet>
        <title>Login</title>
      </Helmet>

      <div className={classes.root}>
        <form className={classes.formContainer} onSubmit={handleSubmit}>
          <img src="/logo.png" alt="Logo" className={classes.logoImg} />
          {error && <Typography color="error">{error}</Typography>}
          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            type="email"
            value={user.email}
            onChange={(e) => setUser({ ...user, email: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            type={showPassword ? "text" : "password"}
            value={user.password}
            onChange={(e) => setUser({ ...user, password: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <div className={classes.rememberMeContainer}>
            <Switch
              checked={user.remember}
              onChange={(e) => setUser({ ...user, remember: e.target.checked })}
              name="remember"
              sx={{
                "& .MuiSwitch-thumb": {
                  backgroundColor: user.remember ? "#4F0F96" : "#C3C3C3",
                },
                "& .Mui-checked": {
                  color: "#4F0F96",
                },
                "& .Mui-checked + .MuiSwitch-track": {
                  backgroundColor: "#4F0F96",
                },
                "& .MuiSwitch-track": {
                  backgroundColor: user.remember ? "#4F0F96" : "#C3C3C3",
                },
              }}
            />
            <Typography>Lembrar de mim</Typography>
          </div>
          <div>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              className={classes.submitBtn}
            >
              Entrar
            </Button>
            {userCreationEnabled && (
              <Button
                component={RouterLink}
                to="/signup"
                variant="contained"
                className={classes.registerBtn}
              >
                Cadastre-se
              </Button>
            )}
          </div>
          <div className={classes.forgotPassword}>
            <RouterLink
              to="/forgot-password"
              className={classes.forgotPasswordLink}
            >
              Esqueceu a senha?
            </RouterLink>
          </div>
        </form>
        <div
          className={classes.whatsappButton}
          onClick={() => window.open("https://wa.me/5511916130562")}
        >
          <img
            src="https://clickscertos.com.br/wp-content/uploads/2025/05/iconzapzap.png"
            alt="WhatsApp"
            className={classes.whatsappIcon}
          />
        </div>
      </div>
    </>
  );
};

export default Login;
