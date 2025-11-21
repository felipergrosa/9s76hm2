import React, { useState, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Box, Accordion, AccordionSummary, AccordionDetails, Container, TextField, InputAdornment } from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import SearchIcon from "@material-ui/icons/Search";

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
    searchContainer: {
        marginBottom: theme.spacing(4),
        maxWidth: "500px",
        margin: "0 auto",
        marginBottom: theme.spacing(4),
    },
    searchField: {
        "& .MuiOutlinedInput-root": {
            borderRadius: "50px",
            backgroundColor: "#f9f9f9",
            "&:hover": {
                backgroundColor: "#fff",
            },
            "&.Mui-focused": {
                backgroundColor: "#fff",
            },
        },
    },
    accordion: {
        marginBottom: theme.spacing(2),
        borderRadius: "8px !important",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        opacity: 1,
        transform: "translateY(0)",
        "&.hidden": {
            opacity: 0.3,
            transform: "translateY(-10px)",
            maxHeight: 0,
            overflow: "hidden",
            marginBottom: 0,
        },
        "&:before": {
            display: "none",
        },
    },
    noResults: {
        textAlign: "center",
        padding: theme.spacing(4),
        color: theme.palette.text.secondary,
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
    const [searchQuery, setSearchQuery] = useState("");

    const handleChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    const filteredFaqs = useMemo(() => {
        if (!searchQuery.trim()) {
            return faqs;
        }
        const query = searchQuery.toLowerCase();
        return faqs.filter(
            (faq) =>
                faq.question.toLowerCase().includes(query) ||
                faq.answer.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    return (
        <Box className={classes.root}>
            <Container maxWidth="md">
                <Typography variant="h2" className={classes.sectionTitle}>
                    Perguntas Frequentes
                </Typography>
                <Typography variant="h6" className={classes.sectionSubtitle}>
                    Tire suas dúvidas sobre a plataforma
                </Typography>

                <Box className={classes.searchContainer}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Buscar perguntas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={classes.searchField}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                {filteredFaqs.length === 0 ? (
                    <Typography variant="body1" className={classes.noResults}>
                        Nenhuma pergunta encontrada para "{searchQuery}"
                    </Typography>
                ) : (
                    filteredFaqs.map((faq, index) => {
                        const originalIndex = faqs.indexOf(faq);
                        const isVisible = !searchQuery || filteredFaqs.includes(faq);
                        
                        return (
                            <Accordion
                                key={originalIndex}
                                className={`${classes.accordion} ${!isVisible ? "hidden" : ""}`}
                                expanded={expanded === `panel${originalIndex}`}
                                onChange={handleChange(`panel${originalIndex}`)}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls={`panel${originalIndex}bh-content`}
                                    id={`panel${originalIndex}bh-header`}
                                >
                                    <Typography className={classes.heading}>{faq.question}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography className={classes.details}>
                                        {faq.answer}
                                    </Typography>
                                </AccordionDetails>
                            </Accordion>
                        );
                    })
                )}
            </Container>
        </Box>
    );
};

export default FAQ;
