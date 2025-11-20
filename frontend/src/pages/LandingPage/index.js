import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Container, Box } from "@material-ui/core";
import { Helmet } from "react-helmet";
import Hero from "./components/Hero";
import Problems from "./components/Problems";
import Features from "./components/Features";
import Plans from "./components/Plans";
import Testimonials from "./components/Testimonials";
import Contact from "./components/Contact";
import LeadForm from "./components/LeadForm";
import Footer from "./components/Footer";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    minHeight: "100vh",
    backgroundColor: "#ffffff",
  },
  section: {
    padding: theme.spacing(8, 0),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(4, 0),
    },
  },
  sectionDark: {
    backgroundColor: "#f5f5f5",
  },
  sectionPrimary: {
    backgroundColor: theme.palette.primary?.main || "#065183",
    color: "#ffffff",
  },
}));

const LandingPage = () => {
  const classes = useStyles();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      // Tentar carregar planos públicos da API
      // Endpoint /plans/list não requer autenticação e aceita listPublic=false para buscar apenas públicos
      const response = await api.get("/plans/list", {
        params: { listPublic: "false" }
      });
      if (response.data && Array.isArray(response.data)) {
        // Filtrar apenas planos públicos
        const publicPlans = response.data.filter(plan => plan.isPublic !== false);
        setPlans(publicPlans.length > 0 ? publicPlans : response.data);
      } else if (response.data?.plans) {
        setPlans(response.data.plans);
      }
    } catch (error) {
      console.log("Não foi possível carregar planos da API, usando planos padrão");
      // Planos padrão caso a API não esteja disponível
      setPlans([
        {
          id: 1,
          name: "Básico",
          amount: "99.00",
          users: 3,
          connections: 1,
          queues: 3,
          recurrence: "mensal",
          trial: true,
          trialDays: 14,
          useWhatsapp: true,
          useCampaigns: false,
          useKanban: false,
          useOpenAi: false,
          useSchedules: true,
          useInternalChat: true,
        },
        {
          id: 2,
          name: "Premium",
          amount: "299.00",
          users: 10,
          connections: 3,
          queues: 10,
          recurrence: "mensal",
          trial: true,
          trialDays: 14,
          useWhatsapp: true,
          useCampaigns: true,
          useKanban: true,
          useOpenAi: true,
          useSchedules: true,
          useInternalChat: true,
        },
        {
          id: 3,
          name: "Enterprise",
          amount: "799.00",
          users: 50,
          connections: 10,
          queues: 50,
          recurrence: "mensal",
          trial: true,
          trialDays: 30,
          useWhatsapp: true,
          useCampaigns: true,
          useKanban: true,
          useOpenAi: true,
          useSchedules: true,
          useInternalChat: true,
          useExternalApi: true,
          useIntegrations: true,
        },
      ]);
    } finally {
      setLoadingPlans(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>TaktChat - Plataforma de Atendimento WhatsApp | Landing Page</title>
        <meta
          name="description"
          content="TaktChat é a plataforma completa de atendimento e campanhas via WhatsApp. Atendimento omnichannel, automação com IA, campanhas segmentadas e muito mais."
        />
        <meta name="keywords" content="WhatsApp, atendimento, automação, campanhas, chatbot, IA" />
      </Helmet>
      <div className={classes.root}>
        <Hero />
        <Box className={`${classes.section} ${classes.sectionDark}`}>
          <Container>
            <Problems />
          </Container>
        </Box>
        <Box className={classes.section}>
          <Container>
            <Features />
          </Container>
        </Box>
        <Box className={`${classes.section} ${classes.sectionDark}`}>
          <Container>
            <Plans plans={plans} loading={loadingPlans} />
          </Container>
        </Box>
        <Box className={classes.section}>
          <Container>
            <Testimonials />
          </Container>
        </Box>
        <Box className={`${classes.section} ${classes.sectionPrimary}`}>
          <Container>
            <LeadForm />
          </Container>
        </Box>
        <Box className={classes.section}>
          <Container>
            <Contact />
          </Container>
        </Box>
        <Footer />
      </div>
    </>
  );
};

export default LandingPage;

