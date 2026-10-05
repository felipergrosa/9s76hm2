import { ContentCopy, Delete } from "@mui/icons-material";
import React, { memo } from "react";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { SiOpenai } from "react-icons/si";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  console.log(12, "openaiNode", data);

  const tbi = data?.typebotIntegration || {};
  let attachmentsCount = 0;
  try {
    const atts = typeof tbi.attachments === 'string' ? JSON.parse(tbi.attachments) : tbi.attachments;
    attachmentsCount = Array.isArray(atts) ? atts.length : 0;
  } catch (_) {
    attachmentsCount = 0;
  }
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E7EC",
        borderLeft: "3px solid #0872b9",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 1px 3px rgba(16,24,40,0.08)",
        minWidth: 170,
        maxWidth: 220
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#fff",
          border: "2px solid #D0D5DD",
          width: "16px",
          height: "16px",
          top: "20px",
          left: "-12px",
          cursor: "pointer",
        }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 8,
          top: 8,
          cursor: "pointer",
          gap: 6,
        }}
      >
        <ContentCopy
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
          sx={{ width: "14px", height: "14px", color: "#98A2B3" }}
        />

        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: "14px", height: "14px", color: "#98A2B3" }}
        />
      </div>
      <div
        style={{
          flexDirection: "row",
          display: "flex",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <SiOpenai
          style={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#0872b9",
            flexShrink: 0
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          OpenAI/Gemini
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#475467",
          width: 180,
          wordBreak: "break-word"
        }}
      >
        <div
          style={{
            backgroundColor: "#F2F4F7",
            marginBottom: "6px",
            borderRadius: "6px",
            padding: "6px"
          }}
        >
          <div style={{ textAlign: "center", fontWeight: 600, color: "#101828" }}>
            OpenAI/Gemini
          </div>
        </div>

        <div style={{ lineHeight: 1.4 }}>
          <div><strong>Ação:</strong> {tbi.name || "—"}</div>
          <div><strong>Integração:</strong> {tbi.integrationId ? `#${tbi.integrationId}` : "—"}</div>
          <div><strong>Fila:</strong> {tbi.queueId ? `#${tbi.queueId}` : "—"}</div>
          <div><strong>Modelo:</strong> {tbi.model || "—"}</div>
          <div><strong>Temp.:</strong> {tbi.temperature ?? "—"}</div>
          <div><strong>Máx. Msgs:</strong> {tbi.maxMessages ?? "—"}</div>
          <div><strong>Anexos:</strong> {attachmentsCount}</div>
        </div>
      </div>
      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#fff",
          border: "2px solid #D0D5DD",
          width: "16px",
          height: "16px",
          top: "70%",
          right: "-11px",
          cursor: "pointer",
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});
