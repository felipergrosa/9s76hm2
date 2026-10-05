import { CallSplit, ContentCopy, Delete } from "@mui/icons-material";
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
        borderLeft: "3px solid #1FBADC",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 1px 3px rgba(16,24,40,0.08)",
        minWidth: 170,
        maxWidth: 220,
        width: "185px"
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
        <CallSplit
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#1FBADC"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Randomizador
        </div>
      </div>
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 12,
          justifyContent: "end",
          position: "relative",
          display: "flex",
          color: "#475467"
        }}
      >
        {`${data.percent}%`}
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
          right: "-11px",
          marginTop: "-5px",
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 12,
          justifyContent: "end",
          position: "relative",
          display: "flex",
          marginTop: "8px",
          color: "#475467"
        }}
      >
        {`${100 - data.percent}%`}
      </div>
      <Handle
        type="source"
        position="right"
        id="b"
        style={{
          background: "#fff",
          border: "2px solid #D0D5DD",
          width: "16px",
          height: "16px",
          right: "-11px",
          top: 73,
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});
