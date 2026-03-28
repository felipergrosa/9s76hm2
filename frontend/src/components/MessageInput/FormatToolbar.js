import React, { useState, useRef, useEffect } from "react";
import { makeStyles } from "@material-ui/core";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  X
} from "lucide-react";

const useStyles = makeStyles((theme) => ({
  toolbar: {
    position: "fixed",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#2a3942",
    border: theme.mode === "light" ? "1px solid #e9edef" : "1px solid #3b4a54",
    borderRadius: 8,
    boxShadow: theme.mode === "light" 
      ? "0 2px 8px rgba(0, 0, 0, 0.15)" 
      : "0 2px 8px rgba(0, 0, 0, 0.3)",
    padding: "4px",
    display: "flex",
    gap: "2px",
    zIndex: 9999,
    transform: "translateX(-50%)",
    transition: "opacity 0.2s ease",
    maxWidth: "90vw",
  },
  toolbarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    cursor: "pointer",
    color: theme.mode === "light" ? "#54656f" : "#aebac1",
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: theme.mode === "light" ? "#f0f2f5" : "#3b4a54",
      color: theme.mode === "light" ? "#3b4a54" : "#e9edef",
    },
    "&:active": {
      transform: "scale(0.95)",
    },
  },
  activeButton: {
    backgroundColor: theme.mode === "light" ? "#e8f0fd" : "#2b5278",
    color: theme.palette.primary.main,
    "&:hover": {
      backgroundColor: theme.mode === "light" ? "#d1e3fd" : "#364b5f",
    },
  },
  separator: {
    width: "1px",
    height: "20px",
    backgroundColor: theme.mode === "light" ? "#e9edef" : "#3b4a54",
    margin: "0 4px",
  },
}));

const FormatToolbar = ({ 
  visible, 
  position, 
  onClose, 
  onFormat, 
  inputRef,
  selection
}) => {
  const classes = useStyles();
  const toolbarRef = useRef(null);

  // Fechar toolbar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [visible, onClose]);

  // Ajustar posição para não sair da tela
  const adjustPosition = (pos) => {
    if (!toolbarRef.current) return pos;
    
    const rect = toolbarRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = pos.x;
    let adjustedY = pos.y;
    
    // Ajustar horizontalmente
    if (rect.right > viewportWidth - 10) {
      adjustedX = viewportWidth - rect.width - 20;
    }
    if (rect.left < 10) {
      adjustedX = 10;
    }
    
    // Ajustar verticalmente - mostrar abaixo se não tiver espaço acima
    if (rect.top < 10) {
      adjustedY = pos.y + 40; // Mostrar abaixo se não tiver espaço acima
    } else if (rect.bottom > viewportHeight - 10) {
      adjustedY = viewportHeight - rect.height - 20;
    } else {
      // Manter próximo ao texto selecionado (acima)
      adjustedY = pos.y - 10;
    }
    
    return { x: adjustedX, y: adjustedY };
  };

  const adjustedPosition = visible ? adjustPosition(position) : { x: 0, y: 0 };

  const applyFormat = (formatType) => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    const start = selection.start;
    const end = selection.end;
    const selectedText = selection.text;
    
    if (!selectedText) return;
    
    let formattedText = "";
    
    switch (formatType) {
      case "bold":
        formattedText = `*${selectedText}*`;
        break;
      case "italic":
        formattedText = `_${selectedText}_`;
        break;
      case "strikethrough":
        formattedText = `~${selectedText}~`;
        break;
      case "code":
        formattedText = `\`${selectedText}\``;
        break;
      case "bulletList":
        formattedText = selectedText
          .split("\n")
          .map(line => `• ${line}`)
          .join("\n");
        break;
      case "numberedList":
        formattedText = selectedText
          .split("\n")
          .map((line, index) => `${index + 1}. ${line}`)
          .join("\n");
        break;
      case "quote":
        formattedText = selectedText
          .split("\n")
          .map(line => `> ${line}`)
          .join("\n");
        break;
      default:
        return;
    }
    
    // Aplicar a formatação ao texto
    const newValue = 
      input.value.substring(0, start) + 
      formattedText + 
      input.value.substring(end);
    
    onFormat(newValue, start, start + formattedText.length);
    onClose();
  };

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className={classes.toolbar}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("bold")}
        title="Negrito (Ctrl+B)"
      >
        <Bold size={16} />
      </div>
      
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("italic")}
        title="Itálico (Ctrl+I)"
      >
        <Italic size={16} />
      </div>
      
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("strikethrough")}
        title="Tachado"
      >
        <Strikethrough size={16} />
      </div>
      
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("code")}
        title="Código"
      >
        <Code size={16} />
      </div>
      
      <div className={classes.separator} />
      
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("bulletList")}
        title="Lista com marcadores"
      >
        <List size={16} />
      </div>
      
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("numberedList")}
        title="Lista numerada"
      >
        <ListOrdered size={16} />
      </div>
      
      <div
        className={classes.toolbarButton}
        onClick={() => applyFormat("quote")}
        title="Citação"
      >
        <Quote size={16} />
      </div>
      
      <div className={classes.separator} />
      
      <div
        className={classes.toolbarButton}
        onClick={onClose}
        title="Fechar"
      >
        <X size={16} />
      </div>
    </div>
  );
};

export default FormatToolbar;
