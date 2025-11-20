import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Grid, Box, Card, CardContent } from "@material-ui/core";
import EmailIcon from "@material-ui/icons/Email";
import PhoneIcon from "@material-ui/icons/Phone";
import LocationOnIcon from "@material-ui/icons/LocationOn";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import { getNumberSupport } from "../../../config";

const useStyles = makeStyles((theme) => ({
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    textAlign: "center",
    marginBottom: theme.spacing(6),
    color: theme.palette.text.secondary,
  },
  contactCard: {
    height: "100%",
    padding: theme.spacing(3),
    backgroundColor: "#ffffff",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: "12px",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    "&:hover": {
      transform: "translateY(-5px)",
      boxShadow: theme.shadows[8],
      borderColor: theme.palette.primary.main,
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  contactIcon: {
    fontSize: "3rem",
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      fontSize: "2.5rem",
    },
  },
  contactTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    color: theme.palette.text.primary,
  },
  contactInfo: {
    color: theme.palette.text.secondary,
    fontSize: "1.1rem",
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.95rem",
    },
  },
  contactLink: {
    color: theme.palette.primary.main,
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
      color: theme.palette.primary.dark,
    },
  },
}));

const Contact = () => {
  const classes = useStyles();
  const supportNumber = getNumberSupport() || "5514981252988";

  const formatPhoneForWhatsApp = (phone) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, "");
    return cleaned;
  };

  const formatPhoneDisplay = (phone) => {
    // Formata para exibição: (14) 98125-2988
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  const whatsappLink = `https://wa.me/${formatPhoneForWhatsApp(supportNumber)}`;

  const contactInfo = [
    {
      icon: <EmailIcon />,
      title: "Email",
      info: "contato@taktchat.com",
      link: "mailto:contato@taktchat.com",
    },
    {
      icon: <PhoneIcon />,
      title: "WhatsApp",
      info: formatPhoneDisplay(supportNumber),
      link: whatsappLink,
    },
    {
      icon: <LocationOnIcon />,
      title: "Localização",
      info: "São Paulo, SP - Brasil",
      link: null,
    },
    {
      icon: <AccessTimeIcon />,
      title: "Horário de Atendimento",
      info: "Segunda a Sexta: 9h às 18h",
      link: null,
    },
  ];

  return (
    <Box>
      <Typography variant="h2" className={classes.sectionTitle}>
        Entre em Contato
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Estamos prontos para ajudar você a transformar seu atendimento
      </Typography>
      <Grid container spacing={4}>
        {contactInfo.map((contact, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card className={classes.contactCard}>
              <CardContent>
                <Box className={classes.contactIcon}>{contact.icon}</Box>
                <Typography variant="h6" className={classes.contactTitle}>
                  {contact.title}
                </Typography>
                {contact.link ? (
                  <Typography
                    variant="body1"
                    component="a"
                    href={contact.link}
                    target={contact.link.startsWith("http") ? "_blank" : "_self"}
                    rel={contact.link.startsWith("http") ? "noopener noreferrer" : undefined}
                    className={classes.contactLink}
                    style={{ 
                      display: "block",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                    }}
                  >
                    {contact.info}
                  </Typography>
                ) : (
                  <Typography variant="body1" className={classes.contactInfo}>
                    {contact.info}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Contact;

