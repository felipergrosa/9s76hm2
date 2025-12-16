import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Button } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  buttonsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 8,
    width: "100%",
    maxWidth: 280,
  },
  interactiveButton: {
    backgroundColor: "transparent",
    border: "1px solid rgba(0, 168, 132, 0.5)",
    borderRadius: 8,
    padding: "10px 16px",
    color: "#00a884",
    fontWeight: 500,
    fontSize: 14,
    textTransform: "none",
    justifyContent: "center",
    "&:hover": {
      backgroundColor: "rgba(0, 168, 132, 0.08)",
      border: "1px solid #00a884",
    },
  },
  buttonDescription: {
    fontSize: 11,
    opacity: 0.7,
    marginLeft: 8,
    display: "block",
  },
}));

/**
 * Componente para renderizar botões interativos do WhatsApp
 * Suporta buttonsMessage, interactiveMessage e listMessage
 */
const ButtonsPreview = ({ message }) => {
  const classes = useStyles();

  // Tenta extrair botões do dataJson
  const extractButtons = () => {
    if (!message?.dataJson) return null;

    try {
      const data = typeof message.dataJson === "string" 
        ? JSON.parse(message.dataJson) 
        : message.dataJson;

      // buttonsMessage (botões simples)
      if (data?.message?.buttonsMessage) {
        const bm = data.message.buttonsMessage;
        return {
          type: "buttons",
          title: bm.contentText || bm.text || "",
          footer: bm.footerText || "",
          buttons: (bm.buttons || []).map((b) => ({
            id: b.buttonId,
            text: b.buttonText?.displayText || b.buttonText || "",
          })),
        };
      }

      // interactiveMessage com nativeFlowMessage (botões nativos Meta)
      if (data?.message?.interactiveMessage?.nativeFlowMessage) {
        const im = data.message.interactiveMessage;
        const nfm = im.nativeFlowMessage;
        const buttons = (nfm.buttons || [])
          .filter((b) => b.name === "quick_reply" || b.name === "cta_url")
          .map((b) => {
            try {
              const params = JSON.parse(b.buttonParamsJson || "{}");
              return {
                id: params.id || "",
                text: params.display_text || "",
                url: params.url || null,
              };
            } catch {
              return { id: "", text: "", url: null };
            }
          })
          .filter((b) => b.text);

        return {
          type: "interactive",
          title: im.body?.text || "",
          footer: im.footer?.text || "",
          buttons,
        };
      }

      // viewOnceMessage com interactiveMessage
      if (data?.message?.viewOnceMessage?.message?.interactiveMessage) {
        const im = data.message.viewOnceMessage.message.interactiveMessage;
        const nfm = im.nativeFlowMessage;
        if (nfm?.buttons) {
          const buttons = (nfm.buttons || [])
            .filter((b) => b.name === "quick_reply" || b.name === "cta_url")
            .map((b) => {
              try {
                const params = JSON.parse(b.buttonParamsJson || "{}");
                return {
                  id: params.id || "",
                  text: params.display_text || "",
                  url: params.url || null,
                };
              } catch {
                return { id: "", text: "", url: null };
              }
            })
            .filter((b) => b.text);

          return {
            type: "interactive",
            title: im.body?.text || "",
            footer: im.footer?.text || "",
            buttons,
          };
        }
      }

      // listMessage (lista com seções)
      if (data?.message?.listMessage) {
        const lm = data.message.listMessage;
        const allRows = [];
        (lm.sections || []).forEach((section) => {
          (section.rows || []).forEach((row) => {
            allRows.push({
              id: row.rowId || "",
              text: row.title || "",
              description: row.description || "",
            });
          });
        });

        return {
          type: "list",
          title: lm.title || "",
          description: lm.description || "",
          buttonText: lm.buttonText || "Ver opções",
          footer: lm.footerText || "",
          rows: allRows,
        };
      }

      return null;
    } catch (e) {
      console.error("Erro ao extrair botões:", e);
      return null;
    }
  };

  const buttonData = extractButtons();

  if (!buttonData || (!buttonData.buttons?.length && !buttonData.rows?.length)) {
    return null;
  }

  return (
    <div className={classes.buttonsContainer}>
      {/* Botões simples ou interativos */}
      {buttonData.buttons?.map((btn, idx) => (
        <Button
          key={idx}
          className={classes.interactiveButton}
          fullWidth
          onClick={() => {
            if (btn.url) {
              window.open(btn.url, "_blank");
            }
          }}
        >
          {btn.text}
        </Button>
      ))}

      {/* Lista de opções */}
      {buttonData.rows?.map((row, idx) => (
        <Button
          key={idx}
          className={classes.interactiveButton}
          fullWidth
        >
          {row.text}
          {row.description && (
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>
              {row.description}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
};

export default ButtonsPreview;
