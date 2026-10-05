import { AccessTime, ContentCopy, Delete } from "@mui/icons-material";
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
        borderLeft: "3px solid #F7953B",
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
        <AccessTime
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#F7953B"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Intervalo
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#475467",
          wordBreak: "break-word"
        }}
      >
        {data.sec} segundos
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
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});
