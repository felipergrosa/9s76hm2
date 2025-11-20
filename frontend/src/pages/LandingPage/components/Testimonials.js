import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Grid, Box, Card, CardContent, Avatar } from "@material-ui/core";
import { Rating } from "@material-ui/lab";

const useStyles = makeStyles((theme) => ({
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
  testimonialCard: {
    height: "100%",
    padding: theme.spacing(3),
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    "&:hover": {
      transform: "translateY(-5px)",
      boxShadow: theme.shadows[8],
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  testimonialContent: {
    marginBottom: theme.spacing(2),
    fontStyle: "italic",
    color: theme.palette.text.secondary,
    fontSize: "1.1rem",
    lineHeight: 1.8,
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.95rem",
      lineHeight: 1.6,
    },
  },
  testimonialAuthor: {
    display: "flex",
    alignItems: "center",
    marginTop: theme.spacing(2),
  },
  avatar: {
    marginRight: theme.spacing(2),
    width: theme.spacing(6),
    height: theme.spacing(6),
    backgroundColor: theme.palette.primary.main,
  },
  authorInfo: {
    flexGrow: 1,
  },
  authorName: {
    fontWeight: 600,
  },
  authorCompany: {
    fontSize: "0.9rem",
    color: theme.palette.text.secondary,
  },
  rating: {
    marginBottom: theme.spacing(1),
  },
}));

const testimonials = [
  {
    name: "Maria Silva",
    company: "E-commerce Plus",
    role: "Diretora de Atendimento",
    rating: 5,
    text: "O TaktChat revolucionou nosso atendimento. Agora conseguimos gerenciar todas as conversas em um só lugar, com automação inteligente que economizou 70% do tempo da equipe.",
    avatar: "MS",
  },
  {
    name: "João Santos",
    company: "Tech Solutions",
    role: "CEO",
    rating: 5,
    text: "As campanhas segmentadas aumentaram nossa taxa de conversão em 3x. A integração com IA é impressionante e os relatórios nos dão visibilidade completa da operação.",
    avatar: "JS",
  },
  {
    name: "Ana Costa",
    company: "Digital Marketing Pro",
    role: "Gerente de Marketing",
    rating: 5,
    text: "O Flow Builder visual facilitou muito a criação de jornadas automatizadas. A equipe adorou a interface intuitiva e os resultados superaram nossas expectativas.",
    avatar: "AC",
  },
  {
    name: "Carlos Oliveira",
    company: "Service Corp",
    role: "Diretor de Operações",
    rating: 5,
    text: "O sistema anti-ban nos deu segurança para escalar nossas campanhas. Com a API Oficial, temos uptime de 99.9% e zero preocupação com bloqueios.",
    avatar: "CO",
  },
  {
    name: "Patricia Lima",
    company: "Retail Group",
    role: "Coordenadora de Vendas",
    rating: 5,
    text: "A organização Kanban transformou nossa gestão de tickets. Agora temos visibilidade completa do fluxo de atendimento e conseguimos priorizar melhor as demandas.",
    avatar: "PL",
  },
  {
    name: "Roberto Alves",
    company: "Consultoria Empresarial",
    role: "Sócio Fundador",
    rating: 5,
    text: "O multi-empresa nativo foi essencial para nosso negócio. Conseguimos gerenciar múltiplas empresas em uma única plataforma, economizando tempo e recursos.",
    avatar: "RA",
  },
];

const Testimonials = () => {
  const classes = useStyles();

  return (
    <Box>
      <Typography variant="h2" className={classes.sectionTitle}>
        O que Nossos Clientes Dizem
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Depoimentos reais de empresas que transformaram seu atendimento
      </Typography>
      <Grid container spacing={4}>
        {testimonials.map((testimonial, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card className={classes.testimonialCard} variant="outlined">
              <CardContent>
                <Rating value={testimonial.rating} readOnly className={classes.rating} />
                <Typography variant="body1" className={classes.testimonialContent}>
                  "{testimonial.text}"
                </Typography>
                <Box className={classes.testimonialAuthor}>
                  <Avatar className={classes.avatar}>
                    {testimonial.avatar}
                  </Avatar>
                  <Box className={classes.authorInfo}>
                    <Typography variant="subtitle1" className={classes.authorName}>
                      {testimonial.name}
                    </Typography>
                    <Typography variant="body2" className={classes.authorCompany}>
                      {testimonial.role} - {testimonial.company}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Testimonials;

