import {
  AccessTime,
  ContentCopy,
  Delete,
  Image,
  LibraryBooks,
  Message,
  MicNone,
  Videocam
} from "@mui/icons-material";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Typography } from "@mui/material";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E7EC",
        borderLeft: "3px solid #EC5858",
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
        <LibraryBooks
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#EC5858"
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          Conteúdo
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
        {data.seq.map(item => (
          <div
            style={{
              backgroundColor: "#F2F4F7",
              marginBottom: "3px",
              borderRadius: "6px"
            }}
          >
            {item.includes("message") && (
              <div style={{ gap: "5px", padding: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    flexDirection: "row",
                    justifyContent: "center"
                  }}
                >
                  <Message sx={{ color: "#EC5858", width: "16px", height: "16px" }} />
                </div>
                <Typography
                  textAlign={"center"}
                  sx={{
                    textOverflow: "ellipsis",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    color: "#475467"
                  }}
                >
                  {
                    data.elements.filter(itemLoc => itemLoc.number === item)[0]
                      .value
                  }
                </Typography>
              </div>
            )}
            {item.includes("interval") && (
              <div style={{ gap: "5px", padding: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    flexDirection: "row",
                    justifyContent: "center"
                  }}
                >
                  <AccessTime sx={{ color: "#EC5858", width: "16px", height: "16px" }} />
                </div>
                <Typography
                  textAlign={"center"}
                  sx={{
                    textOverflow: "ellipsis",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    color: "#475467"
                  }}
                >
                  {
                    data.elements.filter(itemLoc => itemLoc.number === item)[0]
                      .value
                  }{" "}
                  segundos
                </Typography>
              </div>
            )}
            {item.includes("img") && (
              <div style={{ gap: "5px", padding: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    flexDirection: "row",
                    justifyContent: "center"
                  }}
                >
                  <Image sx={{ color: "#EC5858", width: "16px", height: "16px" }} />
                </div>
                <Typography
                  textAlign={"center"}
                  sx={{
                    textOverflow: "ellipsis",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    color: "#475467"
                  }}
                >
                  {
                    data.elements.filter(itemLoc => itemLoc.number === item)[0]
                      .original
                  }
                </Typography>
              </div>
            )}
            {item.includes("audio") && (
              <div style={{ gap: "5px", padding: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    flexDirection: "row",
                    justifyContent: "center"
                  }}
                >
                  <MicNone sx={{ color: "#EC5858", width: "16px", height: "16px" }} />
                </div>
                <Typography
                  textAlign={"center"}
                  sx={{
                    textOverflow: "ellipsis",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    color: "#475467"
                  }}
                >
                  {
                    data.elements.filter(itemLoc => itemLoc.number === item)[0]
                      .original
                  }
                </Typography>
              </div>
            )}
            {item.includes("video") && (
              <div style={{ gap: "5px", padding: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    flexDirection: "row",
                    justifyContent: "center"
                  }}
                >
                  <Videocam sx={{ color: "#EC5858", width: "16px", height: "16px" }} />
                </div>
                <Typography
                  textAlign={"center"}
                  sx={{
                    textOverflow: "ellipsis",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    color: "#475467"
                  }}
                >
                  {
                    data.elements.filter(itemLoc => itemLoc.number === item)[0]
                      .original
                  }
                </Typography>
              </div>
            )}
          </div>
        ))}
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
          top: "90%",
          right: "-11px",
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});
