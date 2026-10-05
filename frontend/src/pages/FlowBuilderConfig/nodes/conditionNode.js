import { ImportExport } from "@mui/icons-material";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable }) => {
  const typeCondition = (value) => {
    if(value === 1){
      return '=='
    }
    if(value === 2){
      return '>='
    }
    if(value === 3){
      return '<='
    }
    if(value === 4){
      return '<'
    }
    if(value === 5){
      return '>'
    }
  }
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E7EC",
        borderLeft: "3px solid #475467",
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
          cursor: 'pointer'
        }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />
      <div
        style={{
          flexDirection: "row",
          display: "flex",
          alignItems: "center",
          marginBottom: 4
        }}
      >
        <ImportExport
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#475467"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Condição
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#475467", wordBreak: "break-word" }}>
        {data.key} {typeCondition(data.condition)} {data.value}
      </div>
      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          top: 10,
          background: "#fff",
          border: "2px solid #D0D5DD",
          width: "16px",
          height: "16px",
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position="right"
        id="b"
        style={{
          bottom: 10,
          top: "auto",
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
