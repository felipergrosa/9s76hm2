import { ContentCopy, Delete } from "@mui/icons-material";
import React, { memo } from "react";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { Box } from "@material-ui/core";
import typebotIcon from "../../../assets/typebot-ico.png";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  console.log(12, "ticketNode", data);
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
        <Box
          component="img"
          sx={{
            width: 16,
            height: 16,
            marginRight: "6px",
          }}
          src={typebotIcon}
          alt="icon"
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          TypeBot
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
            marginBottom: "3px",
            borderRadius: "6px",
          }}
        >
          <div style={{ gap: "5px", padding: "6px" }}>
            <div style={{ textAlign: "center" }}>TypeBot</div>
          </div>
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
