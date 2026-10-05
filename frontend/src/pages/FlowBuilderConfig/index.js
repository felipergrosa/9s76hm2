import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { SiOpenai } from "react-icons/si";
import typebotIcon from "../../assets/typebot-ico.png";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

import audioNode from "./nodes/audioNode";
import conditionNode from "./nodes/conditionNode";
import businessHoursNode from "./nodes/businessHoursNode";
import assignUserNode from "./nodes/assignUserNode";
import internalNoteNode from "./nodes/internalNoteNode";
import updateContactNode from "./nodes/updateContactNode";
import tagNode from "./nodes/tagNode";
import webhookNode from "./nodes/webhookNode";
import endNode from "./nodes/endNode";
import gotoFlowNode from "./nodes/gotoFlowNode";
import typebotNode from "./nodes/typebotNode";
import openaiNode from "./nodes/openaiNode";
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import questionNode from "./nodes/questionNode";
import fileNode from "./nodes/fileNode";
import subscribeDripNode from "./nodes/subscribeDripNode";
import optOutNode from "./nodes/optOutNode";
import notifyTeamNode from "./nodes/notifyTeamNode";
import sendTemplateNode from "./nodes/sendTemplateNode";
import csatNode from "./nodes/csatNode";
import setStatusNode from "./nodes/setStatusNode";
import aiAgentNode from "./nodes/aiAgentNode";
import smartDelayNode from "./nodes/smartDelayNode";
import waitReplyNode from "./nodes/waitReplyNode";

import api from "../../services/api";

import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";
import { Stack, Menu, MenuItem, Divider } from "@mui/material";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import { Box, CircularProgress, Tooltip, IconButton } from "@material-ui/core";
import BallotIcon from '@mui/icons-material/Ballot';
import MoreVertIcon from "@mui/icons-material/MoreVert";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import FlowBuilderGuide from "../../components/FlowBuilderGuide";

import "reactflow/dist/style.css";
import "./flowbuilder.css";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from "react-flow-renderer";
import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderConditionModal from "../../components/FlowBuilderConditionModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import {
  AccessTime,
  AccountTree,
  CallSplit,
  ContactPage,
  DynamicFeed,
  Http,
  ImportExport,
  LibraryBooks,
  LocalOffer,
  PersonPin,
  RocketLaunch,
  Schedule,
  StickyNote2,
  StopCircle,
  AttachFile,
  Repeat,
  PersonRemove,
  Notifications,
  Article,
  Star,
  Flag,
  SmartToy,
  HourglassTop,
  QuestionAnswer,
} from "@mui/icons-material";
import RemoveEdge from "./nodes/removeEdge";
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";

import { useNodeStorage } from "../../stores/useNodeStorage";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import singleBlockNode from "./nodes/singleBlockNode";
import ticketNode from "./nodes/ticketNode";
import { ConfirmationNumber } from "@material-ui/icons";
import FlowBuilderTypebotModal from "../../components/FlowBuilderAddTypebotModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderAddQuestionModal from "../../components/FlowBuilderAddQuestionModal";
import FlowBuilderTagModal from "../../components/FlowBuilderTagModal";
import FlowBuilderWebhookModal from "../../components/FlowBuilderWebhookModal";
import FlowBuilderEndModal from "../../components/FlowBuilderEndModal";
import FlowBuilderGotoFlowModal from "../../components/FlowBuilderGotoFlowModal";
import FlowBuilderBusinessHoursModal from "../../components/FlowBuilderBusinessHoursModal";
import FlowBuilderAssignUserModal from "../../components/FlowBuilderAssignUserModal";
import FlowBuilderInternalNoteModal from "../../components/FlowBuilderInternalNoteModal";
import FlowBuilderUpdateContactModal from "../../components/FlowBuilderUpdateContactModal";
import FlowBuilderFileModal from "../../components/FlowBuilderFileModal";
import FlowBuilderSubscribeDripModal from "../../components/FlowBuilderSubscribeDripModal";
import FlowBuilderOptOutModal from "../../components/FlowBuilderOptOutModal";
import FlowBuilderNotifyTeamModal from "../../components/FlowBuilderNotifyTeamModal";
import FlowBuilderSendTemplateModal from "../../components/FlowBuilderSendTemplateModal";
import FlowBuilderCsatModal from "../../components/FlowBuilderCsatModal";
import FlowBuilderSetStatusModal from "../../components/FlowBuilderSetStatusModal";
import FlowBuilderAiAgentModal from "../../components/FlowBuilderAiAgentModal";
import FlowBuilderSmartDelayModal from "../../components/FlowBuilderSmartDelayModal";
import FlowBuilderWaitReplyModal from "../../components/FlowBuilderWaitReplyModal";
import FlowValidationDialog from "../../components/FlowValidationDialog";
import GetAppIcon from "@mui/icons-material/GetApp";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { exportFlow } from "../../services/flowBuilder";
import FlowImportModal from "../../components/FlowImportModal";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    position: "relative",
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.background.default : "#F8F9FA",
    overflow: "hidden",
    display: "flex",
    flexDirection: "row",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
  },
  palette: {
    width: 232,
    flexShrink: 0,
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    ...theme.scrollbarStyles,
  },
  paletteHeader: {
    padding: theme.spacing(1.5, 2, 1),
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },
  paletteCategory: {
    padding: theme.spacing(1, 2, 0.5),
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.disabled,
  },
  paletteItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    margin: theme.spacing(0, 1, 0.5),
    padding: theme.spacing(1, 1.25),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    cursor: "grab",
    transition: "box-shadow 120ms ease, border-color 120ms ease",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      boxShadow: "0 2px 6px rgba(16,24,40,0.08)",
    },
    "&:active": {
      cursor: "grabbing",
    },
  },
  paletteItemIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paletteItemTitle: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  paletteItemDesc: {
    fontSize: "0.68rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.25,
  },
  canvasHint: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-40%, -50%)",
    zIndex: 5,
    pointerEvents: "none",
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: "0.9rem",
    maxWidth: 340,
    lineHeight: 1.5,
    padding: theme.spacing(2, 3),
    borderRadius: 12,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(0,0,0,0.35)"
        : "rgba(255,255,255,0.85)",
    border: `1px dashed ${theme.palette.divider}`,
  },
}));

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  typebot: typebotNode,
  openai: openaiNode,
  question: questionNode,
  condition: conditionNode,
  businessHours: businessHoursNode,
  assignUser: assignUserNode,
  internalNote: internalNoteNode,
  updateContact: updateContactNode,
  tag: tagNode,
  webhook: webhookNode,
  end: endNode,
  gotoFlow: gotoFlowNode,
  file: fileNode,
  subscribeDrip: subscribeDripNode,
  optOut: optOutNode,
  notifyTeam: notifyTeamNode,
  sendTemplate: sendTemplateNode,
  csat: csatNode,
  setStatus: setStatusNode,
  aiAgent: aiAgentNode,
  smartDelay: smartDelayNode,
  waitReply: waitReplyNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge,
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio do fluxo" },
    type: "start",
  },
];

const initialEdges = [];

export const FlowBuilderConfig = () => {
  const classes = useStyles();
  const history = useHistory();
  const { id } = useParams();

  const storageItems = useNodeStorage();

  const { user } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("flowbuilder.create");
  const canEdit = hasPermission("flowbuilder.edit");

  const [loading, setLoading] = useState(false);
  const [dataNode, setDataNode] = useState(null);
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTypebot, setModalAddTypebot] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddQuestion, setModalAddQuestion] = useState(null);
  const [modalAddCondition, setModalAddCondition] = useState(null);
  const [modalAddBusinessHours, setModalAddBusinessHours] = useState(null);
  const [modalAddAssignUser, setModalAddAssignUser] = useState(null);
  const [modalAddInternalNote, setModalAddInternalNote] = useState(null);
  const [modalAddUpdateContact, setModalAddUpdateContact] = useState(null);
  const [modalAddTag, setModalAddTag] = useState(null);
  const [modalAddWebhook, setModalAddWebhook] = useState(null);
  const [modalAddEnd, setModalAddEnd] = useState(null);
  const [modalAddGotoFlow, setModalAddGotoFlow] = useState(null);
  const [modalAddFile, setModalAddFile] = useState(null);
  const [modalAddSubscribeDrip, setModalAddSubscribeDrip] = useState(null);
  const [modalAddOptOut, setModalAddOptOut] = useState(null);
  const [modalAddNotifyTeam, setModalAddNotifyTeam] = useState(null);
  const [modalAddSendTemplate, setModalAddSendTemplate] = useState(null);
  const [modalAddCsat, setModalAddCsat] = useState(null);
  const [modalAddSetStatus, setModalAddSetStatus] = useState(null);
  const [modalAddAiAgent, setModalAddAiAgent] = useState(null);
  const [modalAddSmartDelay, setModalAddSmartDelay] = useState(null);
  const [modalAddWaitReply, setModalAddWaitReply] = useState(null);
  const [validationIssues, setValidationIssues] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [flowStatus, setFlowStatus] = useState("published"); // item 9 do plano: draft/published
  const [rfInstance, setRfInstance] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return !localStorage.getItem("flowbuilder_guide_seen");
    } catch {
      return false;
    }
  });

  const addNode = (type, data) => {
    // Se o bloco veio de drag-and-drop, usa a posição do drop; senão
    // posiciona ao lado do último nó (comportamento legado).
    const posY = dropPosition
      ? dropPosition.y
      : nodes[nodes.length - 1].position.y;
    const posX = dropPosition
      ? dropPosition.x
      : nodes[nodes.length - 1].position.x + nodes[nodes.length - 1].width + 40;
    setDirty(true);
    if (type === "start") {
      return setNodes((old) => {
        return [
        //  ...old.filter((item) => item.id !== "1"),
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: "Inicio do fluxo" },
            type: "start",
          },
        ];
      });
    }
    if (type === "text") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message",
          },
        ];
      });
    }
    if (type === "interval") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval",
          },
        ];
      });
    }
    if (type === "condition") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              key: data.key,
              condition: data.condition,
              value: data.value,
            },
            type: "condition",
          },
        ];
      });
    }
    if (type === "menu") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption,
            },
            type: "menu",
          },
        ];
      });
    }
    if (type === "img") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img",
          },
        ];
      });
    }
    if (type === "audio") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio",
          },
        ];
      });
    }
    if (type === "randomizer") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer",
          },
        ];
      });
    }
    if (type === "video") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video",
          },
        ];
      });
    }
    if (type === "singleBlock") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock",
          },
        ];
      });
    }

    if (type === "ticket") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket",
          },
        ];
      });
    }

    if (type === "typebot") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "typebot",
          },
        ];
      });
    }

    if (type === "openai") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }

    if (type === "question") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "question",
          },
        ];
      });
    }

    // Tipos novos (tag, webhook, end, gotoFlow) seguem o padrão genérico:
    // data carrega o payload inteiro configurado no modal.
    return setNodes((old) => {
      return [
        ...old,
        {
          id: geraStringAleatoria(30),
          position: { x: posX, y: posY },
          data: { ...data },
          type,
        },
      ];
    });
  };

  // Após criar o nó, limpa a posição pendente de drop para não afetar
  // blocos adicionados depois por clique.
  const addAndResetDrop = (type, data) => {
    addNode(type, data);
    setDropPosition(null);
  };

  const textAdd = (data) => {
    addAndResetDrop("text", data);
  };

  const intervalAdd = (data) => {
    addAndResetDrop("interval", data);
  };

  const conditionAdd = (data) => {
    addAndResetDrop("condition", data);
  };

  const menuAdd = (data) => {
    addAndResetDrop("menu", data);
  };

  const imgAdd = (data) => {
    addAndResetDrop("img", data);
  };

  const audioAdd = (data) => {
    addAndResetDrop("audio", data);
  };

  const randomizerAdd = (data) => {
    addAndResetDrop("randomizer", data);
  };

  const videoAdd = (data) => {
    addAndResetDrop("video", data);
  };

  const singleBlockAdd = (data) => {
    addAndResetDrop("singleBlock", data);
  };

  const ticketAdd = (data) => {
    addAndResetDrop("ticket", data);
  };

  const typebotAdd = (data) => {
    addAndResetDrop("typebot", data);
  };

  const openaiAdd = (data) => {
    addAndResetDrop("openai", data);
  };

  const questionAdd = (data) => {
    addAndResetDrop("question", data);
  };

  const businessHoursAdd = (data) => {
    addAndResetDrop("businessHours", data);
  };

  const assignUserAdd = (data) => {
    addAndResetDrop("assignUser", data);
  };

  const internalNoteAdd = (data) => {
    addAndResetDrop("internalNote", data);
  };

  const updateContactAdd = (data) => {
    addAndResetDrop("updateContact", data);
  };

  const tagAdd = (data) => {
    addAndResetDrop("tag", data);
  };

  const webhookAdd = (data) => {
    addAndResetDrop("webhook", data);
  };

  const endAdd = (data) => {
    addAndResetDrop("end", data);
  };

  const gotoFlowAdd = (data) => {
    addAndResetDrop("gotoFlow", data);
  };

  const fileAdd = (data) => {
    addAndResetDrop("file", data);
  };

  const subscribeDripAdd = (data) => {
    addAndResetDrop("subscribeDrip", data);
  };

  const optOutAdd = (data) => {
    addAndResetDrop("optOut", data);
  };

  const notifyTeamAdd = (data) => {
    addAndResetDrop("notifyTeam", data);
  };

  const sendTemplateAdd = (data) => {
    addAndResetDrop("sendTemplate", data);
  };

  const csatAdd = (data) => {
    addAndResetDrop("csat", data);
  };

  const setStatusAdd = (data) => {
    addAndResetDrop("setStatus", data);
  };

  const aiAgentAdd = (data) => {
    addAndResetDrop("aiAgent", data);
  };

  const smartDelayAdd = (data) => {
    addAndResetDrop("smartDelay", data);
  };

  const waitReplyAdd = (data) => {
    addAndResetDrop("waitReply", data);
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);
          if (data.flow.flow !== null) {
            const flowNodes = data.flow.flow.nodes
            setNodes(flowNodes);
            setEdges(data.flow.flow.connections);
            const filterVariables = flowNodes.filter(nd  => nd.type === "question")
            const variables = filterVariables.map(variable => variable.data.typebotIntegration.answerKey)
            localStorage.setItem('variables', JSON.stringify(variables))
          }
          setFlowStatus(data.flow.status || "published");
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes((old) => old.filter((item) => item.id !== storageItems.node));
      setEdges((old) => {
        const newData = old.filter((item) => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          (item) => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        (item) => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map((node) => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY,
        },
        selected: false,
        style: { backgroundColor: "#555555", padding: 0, borderRadius: 8 },
      };
      setNodes((old) => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action]);

  const [nodes, setNodes, onNodesChangeRaw] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState(initialEdges);

  // Marca "não salvo" apenas para mudanças reais (posição/remover/adicionar),
  // ignorando seleção/dimensão para não acender o indicador ao só clicar.
  const onNodesChange = useCallback(
    (changes) => {
      if (changes.some((c) => !["select", "dimensions"].includes(c.type))) {
        setDirty(true);
      }
      onNodesChangeRaw(changes);
    },
    [onNodesChangeRaw]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      if (changes.some((c) => !["select"].includes(c.type))) {
        setDirty(true);
      }
      onEdgesChangeRaw(changes);
    },
    [onEdgesChangeRaw]
  );

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) => {
        setDirty(true);
        return addEdge(
          {
            ...params,
            type: "buttonedge", // garante que use RemoveEdge
            data: {
              onDelete: (idToDelete) => {
                setEdges((prev) =>
                  prev.filter((ed) => ed.id !== idToDelete)
                );
              }
            }
          },
          eds
        );
      }),
    [setEdges]
  );

  // Drag & drop da paleta: react-flow-renderer usa project() para converter
  // coordenadas da tela em coordenadas do canvas.
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !rfInstance) return;
      const bounds = event.target
        .closest(".react-flow")
        .getBoundingClientRect();
      const position = rfInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      setDropPosition(position);
      clickActions(type);
    },
    // clickActions depende dos setters de modal — estáveis por referência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rfInstance]
  );


  const saveFlow = async (status) => {
    const payload = {
      idFlow: id,
      nodes: nodes,
      connections: edges,
    };
    if (status === "draft" || status === "published") {
      payload.status = status;
    }
    await api
      .post("/flowbuilder/flow", payload)
      .then((res) => {
        setDirty(false);
        if (status === "draft" || status === "published") {
          setFlowStatus(status);
          toast.success(
            status === "draft" ? "Salvo como rascunho" : "Fluxo publicado com sucesso"
          );
        } else {
          toast.success("Fluxo salvo com sucesso");
        }
      });
  };

  const doubleClick = (event, node) => {
    console.log("NODE", node);
    setDataNode(node);
    if (node.type === "message") {
      setModalAddText("edit");
    }
    if (node.type === "interval") {
      setModalAddInterval("edit");
    }

    if (node.type === "menu") {
      setModalAddMenu("edit");
    }
    if (node.type === "img") {
      setModalAddImg("edit");
    }
    if (node.type === "audio") {
      setModalAddAudio("edit");
    }
    if (node.type === "randomizer") {
      setModalAddRandomizer("edit");
    }
    if (node.type === "singleBlock") {
      setModalAddSingleBlock("edit");
    }
    if (node.type === "ticket") {
      setModalAddTicket("edit");
    }
    if (node.type === "typebot") {
      setModalAddTypebot("edit");
    }
    if (node.type === "openai") {
      setModalAddOpenAI("edit");
    }
    if (node.type === "question") {
      setModalAddQuestion("edit");
    }
    if (node.type === "condition") {
      setModalAddCondition("edit");
    }
    if (node.type === "businessHours") {
      setModalAddBusinessHours("edit");
    }
    if (node.type === "assignUser") {
      setModalAddAssignUser("edit");
    }
    if (node.type === "internalNote") {
      setModalAddInternalNote("edit");
    }
    if (node.type === "updateContact") {
      setModalAddUpdateContact("edit");
    }
    if (node.type === "tag") {
      setModalAddTag("edit");
    }
    if (node.type === "webhook") {
      setModalAddWebhook("edit");
    }
    if (node.type === "end") {
      setModalAddEnd("edit");
    }
    if (node.type === "gotoFlow") {
      setModalAddGotoFlow("edit");
    }
    if (node.type === "file") {
      setModalAddFile("edit");
    }
    if (node.type === "subscribeDrip") {
      setModalAddSubscribeDrip("edit");
    }
    if (node.type === "optOut") {
      setModalAddOptOut("edit");
    }
    if (node.type === "notifyTeam") {
      setModalAddNotifyTeam("edit");
    }
    if (node.type === "sendTemplate") {
      setModalAddSendTemplate("edit");
    }
    if (node.type === "csat") {
      setModalAddCsat("edit");
    }
    if (node.type === "setStatus") {
      setModalAddSetStatus("edit");
    }
    if (node.type === "aiAgent") {
      setModalAddAiAgent("edit");
    }
    if (node.type === "smartDelay") {
      setModalAddSmartDelay("edit");
    }
    if (node.type === "waitReply") {
      setModalAddWaitReply("edit");
    }
  };

  // Seleção de nó usa a classe .selected do react-flow (estilizada no CSS),
  // sem sobrescrever o style do card — antes o clique pintava fundo azul.
  const clickEdge = (event, edge) => {
    setEdges((edges) =>
      edges.map((e) =>
        e.id === edge.id
          ? {
              ...e,
              data: {
                ...(e.data || {}),
                selected: true,
                onDelete: (id) => {
                  setEdges((eds) => eds.filter((ed) => ed.id !== id));
                }
              }
            }
          : { ...e, data: { ...(e.data || {}), selected: false } }
      )
    );
  };


  const updateNode = (dataAlter) => {
    setNodes((old) =>
      old.map((itemNode) => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddOpenAI(null);
    setModalAddTypebot(null);
    setModalAddCondition(null);
    setModalAddBusinessHours(null);
    setModalAddAssignUser(null);
    setModalAddInternalNote(null);
    setModalAddUpdateContact(null);
    setModalAddTag(null);
    setModalAddWebhook(null);
    setModalAddEnd(null);
    setModalAddGotoFlow(null);
  };

  // Validação pré-publish no estilo ManyChat: blocos órfãos, início sem
  // saída, opções de menu sem destino e condição sem os dois ramos.
  const validateFlow = () => {
    const issues = [];
    const labelOf = (n) => {
      const names = {
        start: "Início",
        message: "Mensagem",
        singleBlock: "Conteúdo",
        menu: "Menu",
        question: "Pergunta",
        condition: "Condição",
        businessHours: "Horário comercial",
        randomizer: "Randomizador",
        interval: "Intervalo",
        ticket: "Ticket",
        assignUser: "Atribuir atendente",
        tag: "Tag",
        internalNote: "Nota interna",
        updateContact: "Atualizar contato",
        webhook: "Webhook",
        end: "Fim do fluxo",
        gotoFlow: "Ir para fluxo",
        openai: "OpenAI",
        typebot: "TypeBot",
        img: "Imagem",
        audio: "Áudio",
        video: "Vídeo",
        file: "Arquivo",
        subscribeDrip: "Sequência",
        optOut: "Descadastrar",
        notifyTeam: "Notificar equipe",
        sendTemplate: "Template WhatsApp",
        csat: "Pesquisa de satisfação",
        setStatus: "Alterar status",
        aiAgent: "Agente IA",
        smartDelay: "Espera inteligente",
        waitReply: "Aguardar resposta",
      };
      const base = names[n.type] || n.type;
      const detail =
        n.data?.label || n.data?.message || n.data?.key || "";
      return detail ? `${base} (“${String(detail).slice(0, 30)}”)` : base;
    };

    const startNodes = nodes.filter((n) => n.type === "start");
    if (startNodes.length === 0) {
      issues.push("O fluxo não tem bloco de Início.");
    } else {
      startNodes.forEach((s) => {
        if (!edges.some((e) => e.source === s.id)) {
          issues.push("O bloco Início não está conectado a nenhum próximo passo.");
        }
      });
    }

    nodes.forEach((n) => {
      if (n.type === "start") return;
      if (!edges.some((e) => e.target === n.id)) {
        issues.push(
          `Bloco ${labelOf(n)} não tem conexão de entrada — nunca será executado.`
        );
      }
    });

    nodes
      .filter((n) => n.type === "menu")
      .forEach((n) => {
        (n.data?.arrayOption || []).forEach((opt) => {
          const handle = `a${opt.number}`;
          if (
            !edges.some(
              (e) => e.source === n.id && e.sourceHandle === handle
            )
          ) {
            issues.push(
              `Menu “${String(n.data?.message || "").slice(0, 30)}”: a opção [${opt.number}] não tem destino.`
            );
          }
        });
      });

    nodes
      .filter((n) => n.type === "condition" || n.type === "businessHours")
      .forEach((n) => {
        const [aLabel, bLabel] =
          n.type === "businessHours"
            ? ["Dentro do horário", "Fora do horário"]
            : ["Verdadeiro", "Falso"];
        ["a", "b"].forEach((h) => {
          if (!edges.some((e) => e.source === n.id && e.sourceHandle === h)) {
            issues.push(
              `${labelOf(n)}: falta conectar a saída ${
                h === "a" ? aLabel : bLabel
              }.`
            );
          }
        });
      });

    nodes
      .filter((n) => n.type === "randomizer")
      .forEach((n) => {
        ["a", "b"].forEach((h) => {
          if (!edges.some((e) => e.source === n.id && e.sourceHandle === h)) {
            issues.push(
              `Randomizador: falta conectar a saída ${h === "a" ? "A" : "B"}.`
            );
          }
        });
      });

    nodes
      .filter((n) => n.type === "waitReply")
      .forEach((n) => {
        // Saída "b" (timeout) é opcional — sem ela o bloco espera
        // indefinidamente como uma pergunta comum.
        if (!edges.some((e) => e.source === n.id && e.sourceHandle === "a")) {
          issues.push(
            `${labelOf(n)}: falta conectar a saída Respondeu.`
          );
        }
      });

    return issues;
  };

  const handlePublish = () => {
    const issues = validateFlow();
    if (issues.length > 0) {
      setValidationIssues(issues);
      return;
    }
    saveFlow("published");
  };

  // Paleta de blocos no estilo ManyChat: categorias + nome + descrição,
  // suportando clique para adicionar e drag-and-drop para o canvas.
  const paletteGroups = [
    {
      category: "Fluxo",
      items: [
        {
          icon: <RocketLaunch sx={{ color: "#3ABA38" }} />,
          color: "#3ABA38",
          name: "Início",
          desc: "Ponto de entrada do fluxo",
          type: "start",
        },
        {
          icon: <AccessTime sx={{ color: "#F7953B" }} />,
          color: "#F7953B",
          name: "Intervalo",
          desc: "Aguarda antes do próximo passo",
          type: "interval",
        },
        {
          icon: <AccountTree sx={{ color: "#0EA5E9" }} />,
          color: "#0EA5E9",
          name: "Ir para fluxo",
          desc: "Continua em outro fluxo publicado",
          type: "gotoFlow",
        },
        {
          icon: <HourglassTop sx={{ color: "#14B8A6" }} />,
          color: "#14B8A6",
          name: "Espera inteligente",
          desc: "Pausa de minutos, horas ou dias",
          type: "smartDelay",
        },
        {
          icon: <QuestionAnswer sx={{ color: "#F43F5E" }} />,
          color: "#F43F5E",
          name: "Aguardar resposta",
          desc: "Segue ao responder ou no timeout",
          type: "waitReply",
        },
        {
          icon: <StopCircle sx={{ color: "#B42318" }} />,
          color: "#B42318",
          name: "Fim do fluxo",
          desc: "Encerra a automação (ou o ticket)",
          type: "end",
        },
      ],
    },
    {
      category: "Mensagens",
      items: [
        {
          icon: <LibraryBooks sx={{ color: "#EC5858" }} />,
          color: "#EC5858",
          name: "Conteúdo",
          desc: "Texto, imagem, áudio e vídeo em sequência",
          type: "content",
        },
        {
          icon: <DynamicFeed sx={{ color: "#683AC8" }} />,
          color: "#683AC8",
          name: "Menu",
          desc: "Opções numeradas para o contato escolher",
          type: "menu",
        },
        {
          icon: <BallotIcon sx={{ color: "#0E9F8A" }} />,
          color: "#0E9F8A",
          name: "Pergunta",
          desc: "Captura resposta em variável",
          type: "question",
        },
        {
          icon: <AttachFile sx={{ color: "#2563EB" }} />,
          color: "#2563EB",
          name: "Arquivo",
          desc: "Envia PDF ou outro documento",
          type: "file",
        },
        {
          icon: <Article sx={{ color: "#128C7E" }} />,
          color: "#128C7E",
          name: "Template WhatsApp",
          desc: "Modelo aprovado da API oficial",
          type: "sendTemplate",
        },
      ],
    },
    {
      category: "Lógica",
      items: [
        {
          icon: <ImportExport sx={{ color: "#6366F1" }} />,
          color: "#6366F1",
          name: "Condição",
          desc: "Desvia o fluxo conforme variável",
          type: "condition",
        },
        {
          icon: <Schedule sx={{ color: "#0891B2" }} />,
          color: "#0891B2",
          name: "Horário comercial",
          desc: "Desvia conforme dia e horário",
          type: "businessHours",
        },
        {
          icon: <CallSplit sx={{ color: "#1FBADC" }} />,
          color: "#1FBADC",
          name: "Randomizador",
          desc: "Divide o fluxo por porcentagem (A/B)",
          type: "random",
        },
      ],
    },
    {
      category: "Atendimento",
      items: [
        {
          icon: <ConfirmationNumber sx={{ color: "#B42318" }} />,
          color: "#B42318",
          name: "Ticket",
          desc: "Direciona para uma fila de atendimento",
          type: "ticket",
        },
        {
          icon: <PersonPin sx={{ color: "#16A34A" }} />,
          color: "#16A34A",
          name: "Atribuir atendente",
          desc: "Passa o ticket para um usuário",
          type: "assignUser",
        },
        {
          icon: <LocalOffer sx={{ color: "#8B5CF6" }} />,
          color: "#8B5CF6",
          name: "Tag",
          desc: "Adiciona ou remove tag do contato",
          type: "tag",
        },
        {
          icon: <StickyNote2 sx={{ color: "#D97706" }} />,
          color: "#D97706",
          name: "Nota interna",
          desc: "Comentário visível só para a equipe",
          type: "internalNote",
        },
        {
          icon: <ContactPage sx={{ color: "#7C3AED" }} />,
          color: "#7C3AED",
          name: "Atualizar contato",
          desc: "Grava campo no cadastro do contato",
          type: "updateContact",
        },
        {
          icon: <Flag sx={{ color: "#475467" }} />,
          color: "#475467",
          name: "Alterar status",
          desc: "Muda o status do ticket",
          type: "setStatus",
        },
        {
          icon: <Star sx={{ color: "#EAB308" }} />,
          color: "#EAB308",
          name: "Pesquisa de satisfação",
          desc: "Pede nota de 0 a 10 ao contato",
          type: "csat",
        },
        {
          icon: <Notifications sx={{ color: "#F59E0B" }} />,
          color: "#F59E0B",
          name: "Notificar equipe",
          desc: "Alerta interno para os atendentes",
          type: "notifyTeam",
        },
        {
          icon: <Repeat sx={{ color: "#9333EA" }} />,
          color: "#9333EA",
          name: "Sequência",
          desc: "Inscreve ou remove de uma cadência",
          type: "subscribeDrip",
        },
        {
          icon: <PersonRemove sx={{ color: "#DC2626" }} />,
          color: "#DC2626",
          name: "Descadastrar",
          desc: "Remove o contato das automações",
          type: "optOut",
        },
      ],
    },
    {
      category: "Integrações",
      items: [
        {
          icon: <SiOpenai style={{ color: "#101828" }} />,
          color: "#101828",
          name: "OpenAI",
          desc: "Resposta gerada por IA",
          type: "openai",
        },
        {
          icon: <SmartToy sx={{ color: "#EC4899" }} />,
          color: "#EC4899",
          name: "Agente IA",
          desc: "Transfere o ticket para um agente autônomo",
          type: "aiAgent",
        },
        {
          icon: <Http sx={{ color: "#F97316" }} />,
          color: "#F97316",
          name: "Webhook",
          desc: "Chama API externa e guarda o retorno",
          type: "webhook",
        },
        {
          icon: (
            <Box
              component="img"
              sx={{ width: 22, height: 22 }}
              src={typebotIcon}
              alt="Typebot"
            />
          ),
          color: "#3B82F6",
          name: "TypeBot",
          desc: "Executa um bot do Typebot",
          type: "typebot",
        },
      ],
    },
  ];

  const clickActions = (type) => {
    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "typebot":
        setModalAddTypebot("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "question":
        setModalAddQuestion("create");
        break;
      case "condition":
        setModalAddCondition("create");
        break;
      case "businessHours":
        setModalAddBusinessHours("create");
        break;
      case "assignUser":
        setModalAddAssignUser("create");
        break;
      case "internalNote":
        setModalAddInternalNote("create");
        break;
      case "updateContact":
        setModalAddUpdateContact("create");
        break;
      case "tag":
        setModalAddTag("create");
        break;
      case "webhook":
        setModalAddWebhook("create");
        break;
      case "end":
        setModalAddEnd("create");
        break;
      case "gotoFlow":
        setModalAddGotoFlow("create");
        break;
      case "file":
        setModalAddFile("create");
        break;
      case "subscribeDrip":
        setModalAddSubscribeDrip("create");
        break;
      case "optOut":
        setModalAddOptOut("create");
        break;
      case "notifyTeam":
        setModalAddNotifyTeam("create");
        break;
      case "sendTemplate":
        setModalAddSendTemplate("create");
        break;
      case "csat":
        setModalAddCsat("create");
        break;
      case "setStatus":
        setModalAddSetStatus("create");
        break;
      case "aiAgent":
        setModalAddAiAgent("create");
        break;
      case "smartDelay":
        setModalAddSmartDelay("create");
        break;
      case "waitReply":
        setModalAddWaitReply("create");
        break;
      default:
    }
  };

  return (
    <Stack sx={{ height: "100vh" }}>
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />

      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />

      <FlowBuilderTypebotModal
        open={modalAddTypebot}
        onSave={typebotAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTypebot}
      />

      <FlowBuilderAddQuestionModal
        open={modalAddQuestion}
        onSave={questionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddQuestion}
      />

      <FlowBuilderConditionModal
        open={modalAddCondition}
        onSave={conditionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddCondition}
      />

      <FlowBuilderTagModal
        open={modalAddTag}
        onSave={tagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTag}
      />

      <FlowBuilderWebhookModal
        open={modalAddWebhook}
        onSave={webhookAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddWebhook}
      />

      <FlowBuilderEndModal
        open={modalAddEnd}
        onSave={endAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddEnd}
      />

      <FlowBuilderGotoFlowModal
        open={modalAddGotoFlow}
        onSave={gotoFlowAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddGotoFlow}
        currentFlowId={id}
      />

      <FlowBuilderBusinessHoursModal
        open={modalAddBusinessHours}
        onSave={businessHoursAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddBusinessHours}
      />

      <FlowBuilderAssignUserModal
        open={modalAddAssignUser}
        onSave={assignUserAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAssignUser}
      />

      <FlowBuilderInternalNoteModal
        open={modalAddInternalNote}
        onSave={internalNoteAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInternalNote}
      />

      <FlowBuilderUpdateContactModal
        open={modalAddUpdateContact}
        onSave={updateContactAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddUpdateContact}
      />

      <FlowBuilderFileModal
        open={modalAddFile}
        onSave={fileAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddFile}
      />

      <FlowBuilderSubscribeDripModal
        open={modalAddSubscribeDrip}
        onSave={subscribeDripAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSubscribeDrip}
      />

      <FlowBuilderOptOutModal
        open={modalAddOptOut}
        onSave={optOutAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOptOut}
      />

      <FlowBuilderNotifyTeamModal
        open={modalAddNotifyTeam}
        onSave={notifyTeamAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddNotifyTeam}
      />

      <FlowBuilderSendTemplateModal
        open={modalAddSendTemplate}
        onSave={sendTemplateAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSendTemplate}
      />

      <FlowBuilderCsatModal
        open={modalAddCsat}
        onSave={csatAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddCsat}
      />

      <FlowBuilderSetStatusModal
        open={modalAddSetStatus}
        onSave={setStatusAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSetStatus}
      />

      <FlowBuilderAiAgentModal
        open={modalAddAiAgent}
        onSave={aiAgentAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAiAgent}
      />

      <FlowBuilderSmartDelayModal
        open={modalAddSmartDelay}
        onSave={smartDelayAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSmartDelay}
      />

      <FlowBuilderWaitReplyModal
        open={modalAddWaitReply}
        onSave={waitReplyAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddWaitReply}
      />

      <FlowValidationDialog
        issues={validationIssues}
        onClose={() => setValidationIssues(null)}
        onPublishAnyway={() => {
          setValidationIssues(null);
          saveFlow("published");
        }}
      />

      <FlowImportModal open={importModal} onClose={() => setImportModal(false)} />

      <FlowBuilderGuide
        open={guideOpen}
        onClose={(dontShowAgain) => {
          if (dontShowAgain) {
            try {
              localStorage.setItem("flowbuilder_guide_seen", "1");
            } catch {}
          }
          setGuideOpen(false);
        }}
      />

      <MainHeader>
        <Box display="flex" alignItems="center" gap={1}>
          <Title>Construtor de fluxo</Title>
          {id && (
            <Box
              component="span"
              sx={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 8,
                backgroundColor: flowStatus === "draft" ? "#fff3cd" : "#d4edda",
                color: flowStatus === "draft" ? "#856404" : "#155724",
              }}
            >
              {flowStatus === "draft" ? "Rascunho" : "Publicado"}
            </Box>
          )}
          {dirty && (
            <Box
              component="span"
              sx={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 8,
                backgroundColor: "#fdecea",
                color: "#b3261e",
              }}
            >
              Alterações não salvas
            </Box>
          )}
        </Box>
        <MainHeaderButtonsWrapper>
          <Tooltip title="Ajuda: como montar um fluxo">
            <IconButton
              size="small"
              onClick={() => setGuideOpen(true)}
              aria-label="Ajuda do construtor de fluxo"
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          {(canCreate || canEdit) && (
            <>
              <Tooltip title="Mais ações">
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  aria-label="Mais ações do fluxo"
                >
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
              >
                {canCreate && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      setImportModal(true);
                    }}
                  >
                    <UploadFileIcon fontSize="small" sx={{ mr: 1 }} />
                    Importar fluxo
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    exportFlow(id);
                  }}
                >
                  <GetAppIcon fontSize="small" sx={{ mr: 1 }} />
                  Exportar fluxo
                </MenuItem>
                {canEdit && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      saveFlow("draft");
                    }}
                  >
                    Salvar como rascunho
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
          {canEdit && (
            <Button
              variant="outlined"
              color="primary"
              sx={{ textTransform: "none", mr: 1 }}
              onClick={() => saveFlow()}
            >
              Salvar
            </Button>
          )}
          {canEdit && (
            <Button
              variant="contained"
              color="primary"
              sx={{ textTransform: "none" }}
              onClick={handlePublish}
            >
              Publicar
            </Button>
          )}
        </MainHeaderButtonsWrapper>
      </MainHeader>
      {!loading && (
        <Paper className={classes.mainPaper} variant="outlined">
          {/* Paleta lateral de blocos — estilo ManyChat */}
          <div className={classes.palette}>
            <div className={classes.paletteHeader}>Blocos</div>
            {paletteGroups.map((group) => (
              <div key={group.category}>
                <div className={classes.paletteCategory}>{group.category}</div>
                {group.items.map((item) => (
                  <Tooltip
                    key={item.type}
                    title="Clique para adicionar ou arraste para o canvas"
                    placement="right"
                  >
                    <div
                      className={classes.paletteItem}
                      draggable={canEdit}
                      onDragStart={(e) => onDragStart(e, item.type)}
                      onClick={() => canEdit && clickActions(item.type)}
                    >
                      <div
                        className={classes.paletteItemIcon}
                        style={{ backgroundColor: `${item.color}1a` }}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <div className={classes.paletteItemTitle}>
                          {item.name}
                        </div>
                        <div className={classes.paletteItemDesc}>
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>

          <div className="flow-canvas-container">
            {nodes.length <= 1 && !loading && (
              <div className={classes.canvasHint}>
                Arraste um bloco da paleta ao lado ou clique nele para começar a
                montar o fluxo. Conecte os blocos pelo ponto da lateral direita.
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              deleteKeyCode={["Backspace", "Delete"]}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={doubleClick}
              onEdgeClick={clickEdge}
              onConnect={onConnect}
              onInit={setRfInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              className="react-flow"
              defaultEdgeOptions={{
                animated: true,
                className: "edge-line"
              }}
            >
              <Controls />
              <MiniMap pannable zoomable />
              <Background variant="dots" gap={16} size={1.2} color="#D0D5DD" />
            </ReactFlow>
          </div>
        </Paper>
      )}
      {loading && (
        <Stack justifyContent={"center"} alignItems={"center"} height={"70vh"}>
          <CircularProgress />
        </Stack>
      )}
    </Stack>
  );
};