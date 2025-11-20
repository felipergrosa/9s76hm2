import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Box, Accordion, AccordionSummary, AccordionDetails, Container } from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

const useStyles = makeStyles((theme) => ({
    root: {
        width: "100%",
    },
    sectionTitle: {
        fontWeight: 700,
        marginBottom: theme.spacing(1),
        textAlign: "center",
    },
    sectionSubtitle: {
        textAlign: "center",
        marginBottom: theme.spacing(6),
        color: theme.palette.text.secondary,
    },
    accordion: {
        marginBottom: theme.spacing(2),
        borderRadius: "8px !important",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        "&:before": {
            display: "none",
        },
    },
    heading: {
        fontSize: theme.typography.pxToRem(16),
        fontWeight: 600,
        color: theme.palette.text.primary,
    },
    details: {
        color: theme.palette.text.secondary,
        lineHeight: 1.6,
    },
}));

const faqs = [
    {
        question: "O que é o TaktChat?",
        answer: "O TaktChat é uma plataforma completa de gestão de atendimento para WhatsApp. Com ele, você centraliza múltiplos atendentes em um único número, cria chatbots, automatiza respostas e gerencia todo o fluxo de conversas da sua empresa.",
    },
    {
        question: "Preciso manter o celular conectado?",
        answer: "Não! Uma vez conectado via QR Code, nossa plataforma mantém a conexão ativa na nuvem 24/7, sem necessidade de manter o celular ligado ou conectado à internet.",
    },
    {
        question: "Posso usar meu número atual?",
        answer: "Sim, você pode utilizar seu número atual de WhatsApp (seja Business ou pessoal). A migração é simples e rápida, feita através da leitura de um QR Code.",
    },
    {
        question: "Existe fidelidade ou multa de cancelamento?",
        answer: "Não. Nossos planos são pré-pagos e sem fidelidade. Você pode cancelar a qualquer momento sem custos adicionais ou multas.",
    },
    {
        question: "O que acontece se eu ultrapassar o limite de usuários?",
        answer: "Você pode fazer o upgrade do seu plano a qualquer momento diretamente no painel, ou entrar em contato com nosso suporte para um plano personalizado.",
    },
    {
        question: "Como funciona o suporte?",
        answer: "Oferecemos suporte especializado via WhatsApp e Email em horário comercial. Clientes do plano Enterprise possuem gerente de conta dedicado.",
    },
];

const FAQ = () => {
    const classes = useStyles();
    const [expanded, setExpanded] = React.useState(false);

    const handleChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    return (
        <Box className={classes.root}>
            <Container maxWidth="md">
                <Typography variant="h2" className={classes.sectionTitle}>
                    Perguntas Frequentes
                </Typography>
                <Typography variant="h6" className={classes.sectionSubtitle}>
                    Tire suas dúvidas sobre a plataforma
                </Typography>

                {faqs.map((faq, index) => (
                    <Accordion
                        key={index}
                        className={classes.accordion}
                        expanded={expanded === `panel${index}`}
                        onChange={handleChange(`panel${index}`)}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls={`panel${index}bh-content`}
                            id={`panel${index}bh-header`}
                        >
                            <Typography className={classes.heading}>{faq.question}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography className={classes.details}>
                                {faq.answer}
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Container>
        </Box>
    );
};

export default FAQ;
