import React, { useState, useEffect, Suspense } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Container, Box, CircularProgress } from "@material-ui/core";
import { Helmet } from "react-helmet";
import ReactGA from "react-ga4";
import api from "../../services/api";

// Lazy loading components for performance
const Hero = React.lazy(() => import("./components/Hero"));
const Problems = React.lazy(() => import("./components/Problems"));
const Features = React.lazy(() => import("./components/Features"));
const Plans = React.lazy(() => import("./components/Plans"));
const Testimonials = React.lazy(() => import("./components/Testimonials"));
const Contact = React.lazy(() => import("./components/Contact"));
const LeadForm = React.lazy(() => import("./components/LeadForm"));
const Footer = React.lazy(() => import("./components/Footer"));
const FAQ = React.lazy(() => import("./components/FAQ"));
const ChatWidget = React.lazy(() => import("./components/ChatWidget"));
const CookieBanner = React.lazy(() => import("./components/CookieBanner"));

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    overflowX: "hidden",
  },
  section: {
    padding: theme.spacing(10, 0),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(6, 0),
    },
  },
  sectionDark: {
    backgroundColor: "#f8f9fa",
  },
  sectionPrimary: {
    background: "linear-gradient(135deg, #065183 0%, #0a7ab8 100%)",
    color: "#ffffff",
  },
  loader: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
  },
}));

const LandingPage = () => {
  const classes = useStyles();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    // Initialize Google Analytics
    // Substitua 'G-XXXXXXXXXX' pelo seu ID de medição real
    ReactGA.initialize("G-XXXXXXXXXX");
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });

    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await api.get("/plans/list", {
        params: { listPublic: "false" }
      });
      if (response.data && Array.isArray(response.data)) {
        const publicPlans = response.data.filter(plan => plan.isPublic !== false);
        setPlans(publicPlans.length > 0 ? publicPlans : response.data);
      } else if (response.data?.plans) {
        setPlans(response.data.plans);
      }
    } catch (error) {
      console.log("Não foi possível carregar planos da API, usando planos padrão");
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

  // Structured Data - SoftwareApplication
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "TaktChat",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": plans.length > 0 ? plans.map(plan => ({
      "@type": "Offer",
      "name": plan.name,
      "price": parseFloat(plan.amount || 0).toFixed(2),
      "priceCurrency": "BRL",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock",
      "url": "https://taktchat.com.br"
    })) : [{
      "@type": "Offer",
      "price": "99.00",
      "priceCurrency": "BRL"
    }],
    "description": "Plataforma completa de atendimento e automação para WhatsApp. Centralize conversas, crie chatbots inteligentes com IA, gerencie equipes e escale suas vendas.",
    "url": "https://taktchat.com.br",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150"
    },
    "featureList": [
      "Atendimento WhatsApp Multi-usuário",
      "Chatbot com Inteligência Artificial",
      "Campanhas em Massa",
      "Kanban de Atendimento",
      "Agendamento de Mensagens",
      "Chat Interno da Equipe",
      "API para Integrações",
      "Webhooks e Integrações"
    ]
  };

  // Structured Data - Organization
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "TaktChat",
    "url": "https://taktchat.com.br",
    "logo": "https://taktchat.com.br/logo.png",
    "description": "Plataforma de atendimento e automação para WhatsApp",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+55-14-98125-2988",
      "contactType": "customer service",
      "areaServed": "BR",
      "availableLanguage": ["Portuguese"]
    },
    "sameAs": [
      "https://www.facebook.com/taktchat",
      "https://www.instagram.com/taktchat",
      "https://www.linkedin.com/company/taktchat"
    ]
  };

  // Structured Data - FAQPage
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "O que é o TaktChat?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "O TaktChat é uma plataforma completa de gestão de atendimento para WhatsApp. Com ele, você centraliza múltiplos atendentes em um único número, cria chatbots, automatiza respostas e gerencia todo o fluxo de conversas da sua empresa."
        }
      },
      {
        "@type": "Question",
        "name": "Preciso manter o celular conectado?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Não! Uma vez conectado via QR Code, nossa plataforma mantém a conexão ativa na nuvem 24/7, sem necessidade de manter o celular ligado ou conectado à internet."
        }
      },
      {
        "@type": "Question",
        "name": "Posso usar meu número atual?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sim, você pode utilizar seu número atual de WhatsApp (seja Business ou pessoal). A migração é simples e rápida, feita através da leitura de um QR Code."
        }
      },
      {
        "@type": "Question",
        "name": "Existe fidelidade ou multa de cancelamento?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Não. Nossos planos são pré-pagos e sem fidelidade. Você pode cancelar a qualquer momento sem custos adicionais ou multas."
        }
      }
    ]
  };

  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <html lang="pt-BR" />
        <title>TaktChat - Plataforma de Atendimento WhatsApp | Automação e IA</title>
        <meta
          name="title"
          content="TaktChat - Plataforma de Atendimento WhatsApp | Automação e IA"
        />
        <meta
          name="description"
          content="Centralize seu atendimento no WhatsApp, automatize conversas com IA e gerencie sua equipe com o TaktChat. Teste grátis por 14 dias. Planos a partir de R$ 99/mês."
        />
        <meta
          name="keywords"
          content="WhatsApp Business API, Chatbot, Atendimento WhatsApp, Automação WhatsApp, CRM WhatsApp, TaktChat, WhatsApp para empresas, Chatbot IA, Atendimento online, Gestão de conversas, Multi-atendente WhatsApp"
        />
        <meta name="author" content="TaktChat" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="language" content="Portuguese" />
        <meta name="revisit-after" content="7 days" />
        <meta name="rating" content="general" />
        <link rel="canonical" href="https://taktchat.com.br/" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://taktchat.com.br/" />
        <meta property="og:title" content="TaktChat - Revolucione seu Atendimento no WhatsApp" />
        <meta property="og:description" content="Centralize conversas, crie chatbots inteligentes com IA e escale suas vendas. Teste grátis por 14 dias. Planos flexíveis sem fidelidade." />
        <meta property="og:image" content="https://taktchat.com.br/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="TaktChat - Plataforma de Atendimento WhatsApp" />
        <meta property="og:site_name" content="TaktChat" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:locale:alternate" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://taktchat.com.br/" />
        <meta name="twitter:title" content="TaktChat - Revolucione seu Atendimento no WhatsApp" />
        <meta name="twitter:description" content="Centralize conversas, crie chatbots inteligentes com IA e escale suas vendas. Teste grátis por 14 dias." />
        <meta name="twitter:image" content="https://taktchat.com.br/og-image.jpg" />
        <meta name="twitter:image:alt" content="TaktChat - Plataforma de Atendimento WhatsApp" />
        <meta name="twitter:creator" content="@taktchat" />
        <meta name="twitter:site" content="@taktchat" />

        {/* Mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <meta name="theme-color" content="#065183" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TaktChat" />

        {/* Structured Data - Multiple Schemas */}
        <script type="application/ld+json">
          {JSON.stringify(softwareApplicationSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      <div className={classes.root}>
        <Suspense fallback={<Box className={classes.loader}><CircularProgress /></Box>}>
          <Hero />

          <Box className={`${classes.section} ${classes.sectionDark}`}>
            <Container>
              <Problems />
            </Container>
          </Box>

          <Box className={classes.section} id="features">
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

          <Box className={`${classes.section} ${classes.sectionDark}`}>
            <FAQ />
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
          <ChatWidget />
          <CookieBanner />
        </Suspense>
      </div>
    </>
  );
};

export default LandingPage;

