import { RocketLaunch } from "@mui/icons-material";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable }) => {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E7EC",
        borderLeft: "3px solid #3ABA38",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 1px 3px rgba(16,24,40,0.08)",
        minWidth: 170,
        maxWidth: 220
      }}
    >
      <div
        style={{
          flexDirection: "row",
          display: "flex",
          alignItems: "center",
          marginBottom: 4
        }}
      >
        <RocketLaunch
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#3aba38"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Inicio do fluxo
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#475467",
          wordBreak: "break-word"
        }}
      >
        Este bloco marca o inicio do seu fluxo!
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
