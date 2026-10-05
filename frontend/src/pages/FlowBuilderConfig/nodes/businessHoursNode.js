import { ContentCopy, Delete, Schedule } from "@mui/icons-material";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E7EC",
        borderLeft: "3px solid #0891B2",
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
          cursor: 'pointer'
        }}
        onConnect={params => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 8,
          top: 8,
          cursor: "pointer",
          gap: 6
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
          marginBottom: 4
        }}
      >
        <Schedule
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#0891B2"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Horário comercial
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
        {`${(data.days || []).join(", ") || "Todos os dias"} · ${data.start || "08:00"}–${data.end || "18:00"}`}
      </div>
      {/* Saída "a": segue quando ESTÁ dentro do horário comercial */}
      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          top: 10,
          right: "-11px",
          background: "#fff",
          border: "2px solid #D0D5DD",
          width: "16px",
          height: "16px",
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
      {/* Saída "b": segue quando está FORA do horário comercial */}
      <Handle
        type="source"
        position="right"
        id="b"
        style={{
          bottom: 10,
          top: "auto",
          right: "-11px",
          background: "#fff",
          border: "2px solid #D0D5DD",
          width: "16px",
          height: "16px",
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});
