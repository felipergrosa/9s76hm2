import { ContentCopy, Delete, DynamicFeed } from "@mui/icons-material";
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
        borderLeft: "3px solid #683AC8",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 1px 3px rgba(16,24,40,0.08)",
        minWidth: 170,
        maxWidth: 220,
        width: 180
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
        <DynamicFeed
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#683AC8"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Menu
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 12,
            color: "#475467",
            wordBreak: "break-word",
            height: "50px",
            overflow: "hidden",
            marginBottom: "8px"
          }}
        >
          {data.message}
        </div>
      </div>
      {data.arrayOption.map(option => (
        <div
          style={{
            marginBottom: "9px",
            justifyContent: "end",
            display: "flex"
          }}
        >
          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "10px",
              position: "relative",
              display: "flex",
              color: "#475467",
              justifyContent: "center",
              flexDirection: "column",
              alignSelf: "end"
            }}
          >
            {`[${option.number}] ${option.value}`}
          </div>
          <Handle
            type="source"
            position="right"
            id={"a" + option.number}
            style={{
              top: 74 + 23 * option.number,
              background: "#fff",
              border: "2px solid #D0D5DD",
              width: "16px",
              height: "16px",
              right: "-11px",
              cursor: 'pointer'
            }}
            isConnectable={isConnectable}
          />
        </div>
      ))}
    </div>
  );
});
