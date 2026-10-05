import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Checkbox,
  FormControlLabel,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { X as CloseIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  RocketLaunch,
  LibraryBooks,
  CallSplit,
  Save,
} from "@mui/icons-material";

const useStyles = makeStyles((theme) => ({
  title: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: theme.spacing(1),
  },
  stepBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
  },
  stepTitle: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
  },
  stepBody: {
    fontSize: "0.9rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.6,
    "& ul": {
      margin: theme.spacing(1, 0, 0),
      paddingLeft: theme.spacing(2.5),
    },
    "& li": {
      marginBottom: theme.spacing(0.5),
    },
  },
  dots: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: theme.palette.divider,
    transition: "background-color 150ms ease",
  },
  dotActive: {
    backgroundColor: theme.palette.primary.main,
  },
}));

const STEPS = [
  {
    title: "Bem-vindo ao construtor de fluxos",
    icon: <RocketLaunch fontSize="small" />,
    body: (
      <>
        <p>
          Aqui você monta automações de conversa de forma visual — parecido com
          o ManyChat — para WhatsApp, Messenger e Instagram.
        </p>
        <ul>
          <li>Cada bloco é uma ação: enviar mensagem, fazer pergunta, esperar, transferir para atendente.</li>
          <li>As conexões (linhas) definem a ordem em que os blocos são executados.</li>
          <li>O bloco <b>Início</b> é sempre o ponto de entrada do fluxo.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Adicionando blocos",
    icon: <LibraryBooks fontSize="small" />,
    body: (
      <>
        <p>Use a paleta <b>Blocos</b> na lateral esquerda:</p>
        <ul>
          <li><b>Clique</b> em um bloco para adicioná-lo ao lado do último bloco do canvas.</li>
          <li><b>Arraste</b> um bloco até o canvas para posicioná-lo onde quiser.</li>
          <li>Os blocos estão agrupados por categoria: Fluxo, Mensagens, Lógica, Atendimento e Integrações.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Conectando e editando",
    icon: <CallSplit fontSize="small" />,
    body: (
      <>
        <ul>
          <li><b>Conectar:</b> arraste do ponto na lateral direita de um bloco até o ponto na lateral esquerda do próximo.</li>
          <li><b>Editar:</b> dê duplo clique em um bloco para abrir a configuração.</li>
          <li><b>Duplicar/excluir:</b> use os ícones no canto superior direito de cada bloco.</li>
          <li><b>Remover conexão:</b> clique na linha e depois no botão de excluir — ou selecione e aperte Delete.</li>
          <li><b>Menu:</b> cada opção numerada tem sua própria saída — conecte cada uma ao destino correspondente.</li>
          <li><b>Condição, Horário comercial e Randomizador:</b> têm duas saídas — conecte as duas (ex.: verdadeiro/falso, dentro/fora do horário).</li>
          <li><b>Blocos de atendimento:</b> Tag, Atribuir atendente, Nota interna e Atualizar contato agem sobre o contato/ticket sem enviar mensagem ao cliente.</li>
          <li><b>Ir para fluxo:</b> continua a conversa em outro fluxo já criado — útil para reaproveitar sequências comuns.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Salvar, rascunho e publicar",
    icon: <Save fontSize="small" />,
    body: (
      <>
        <ul>
          <li><b>Salvar:</b> grava as alterações sem mudar o estado do fluxo.</li>
          <li><b>Rascunho:</b> salva sem afetar o fluxo que está em produção.</li>
          <li><b>Publicar:</b> salva e ativa o fluxo para os contatos.</li>
          <li>O indicador <b>"Alterações não salvas"</b> aparece sempre que houver mudanças pendentes.</li>
          <li>Em <b>Mais ações</b> (⋮) você pode importar e exportar fluxos em JSON.</li>
        </ul>
      </>
    ),
  },
];

const FlowBuilderGuide = ({ open, onClose }) => {
  const classes = useStyles();
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleClose = () => {
    onClose && onClose(dontShowAgain);
    setStep(0);
  };

  return (
    <Dialog open={!!open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography className={classes.title}>
        <span>Como funciona o construtor</span>
        <IconButton size="small" onClick={handleClose} aria-label="Fechar ajuda">
          <CloseIcon size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <div className={classes.stepBadge}>
          {current.icon}
          Passo {step + 1} de {STEPS.length}
        </div>
        <div className={classes.stepTitle}>{current.title}</div>
        <div className={classes.stepBody}>{current.body}</div>
      </DialogContent>
      <DialogActions
        style={{ justifyContent: "space-between", padding: "12px 16px" }}
      >
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              color="primary"
            />
          }
          label={<span style={{ fontSize: "0.8rem" }}>Não mostrar novamente</span>}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={classes.dots}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`${classes.dot} ${i === step ? classes.dotActive : ""}`}
              />
            ))}
          </div>
          <Button
            size="small"
            disabled={step === 0}
            startIcon={<ChevronLeft size={16} />}
            onClick={() => setStep((s) => s - 1)}
          >
            Voltar
          </Button>
          {isLast ? (
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleClose}
            >
              Concluir
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              color="primary"
              endIcon={<ChevronRight size={16} />}
              onClick={() => setStep((s) => s + 1)}
            >
              Próximo
            </Button>
          )}
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderGuide;
