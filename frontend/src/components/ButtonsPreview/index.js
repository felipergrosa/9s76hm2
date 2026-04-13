import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Button } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  buttonsContainer: {
    display: "flex",
    flexDirection: "column",
    marginTop: 8,
    width: "100%",
    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
  },
  interactiveButton: {
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 0,
    padding: "10px 12px",
    color: "#00a884",
    fontWeight: 500,
    fontSize: 14,
    textTransform: "none",
    justifyContent: "flex-start",
    minHeight: 0,
    "&:hover": {
      backgroundColor: "rgba(0, 168, 132, 0.08)",
    },
    "& .MuiButton-label": {
      justifyContent: "flex-start",
      width: "100%",
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

      if (data?.preview) {
        return {
          type: data.preview.type || "buttons",
          title: data.preview.title || "",
          footer: data.preview.footer || "",
          buttons: (data.preview.buttons || []).map((button) => ({
            id: button.id || "",
            text: button.text || "",
            url: button.url || null,
            phone: button.phone || null,
            type: button.type || "quick_reply"
          })),
          rows: (data.preview.rows || []).map((row) => ({
            id: row.id || "",
            text: row.text || "",
            description: row.description || ""
          }))
        };
      }

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

      // templateMessage (templates comerciais com botões)
      if (data?.message?.templateMessage) {
        const tm = data.message.templateMessage;
        
        // Tentar extrair de hydratedTemplate
        const template = tm.hydratedTemplate || tm.hydratedFourRowTemplate || tm.fourRowTemplate;
        
        if (template) {
          const buttons = [];
          
          // hydratedButtons (botões rápidos)
          if (template.hydratedButtons) {
            template.hydratedButtons.forEach((btn) => {
              if (btn.quickReplyButton) {
                buttons.push({
                  id: btn.quickReplyButton.id || "",
                  text: btn.quickReplyButton.displayText || "",
                  type: "quick_reply"
                });
              } else if (btn.urlButton) {
                buttons.push({
                  id: btn.urlButton.displayText || "",
                  text: btn.urlButton.displayText || "",
                  url: btn.urlButton.url || "",
                  type: "url"
                });
              } else if (btn.callButton) {
                buttons.push({
                  id: btn.callButton.displayText || "",
                  text: btn.callButton.displayText || "",
                  phone: btn.callButton.phoneNumber || "",
                  type: "call"
                });
              }
            });
          }

          if (buttons.length > 0) {
            return {
              type: "template",
              title: template.hydratedContentText || template.title || "",
              footer: template.hydratedFooterText || "",
              buttons,
            };
          }
        }
      }

      // highlyStructuredMessage (templates da API oficial WhatsApp Business)
      if (data?.message?.highlyStructuredMessage?.hydratedHsm) {
        const hsm = data.message.highlyStructuredMessage.hydratedHsm;
        const template = hsm.hydratedTemplate;
        
        if (template) {
          const buttons = [];
          
          // hydratedButtons da API oficial
          if (template.hydratedButtons) {
            template.hydratedButtons.forEach((btn) => {
              if (btn.quickReplyButton) {
                buttons.push({
                  id: btn.quickReplyButton.id || "",
                  text: btn.quickReplyButton.displayText || "",
                  type: "quick_reply"
                });
              } else if (btn.urlButton) {
                buttons.push({
                  id: btn.urlButton.displayText || "",
                  text: btn.urlButton.displayText || "",
                  url: btn.urlButton.url || "",
                  type: "url"
                });
              } else if (btn.callButton) {
                buttons.push({
                  id: btn.callButton.displayText || "",
                  text: btn.callButton.displayText || "",
                  phone: btn.callButton.phoneNumber || "",
                  type: "call"
                });
              }
            });
          }

          if (buttons.length > 0) {
            return {
              type: "hsm",
              title: template.hydratedContentText || "",
              footer: template.hydratedFooterText || "",
              buttons,
            };
          }
        }
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
            } else if (btn.phone) {
              window.open(`tel:${btn.phone}`, "_self");
            }
          }}
        >
          {btn.type === "url" && "🔗 "}
          {btn.type === "call" && "📞 "}
          {btn.type !== "url" && btn.type !== "call" && "↩ "}
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
