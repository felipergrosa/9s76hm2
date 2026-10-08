import { ContentCopy, Delete } from "@mui/icons-material";
import { Barcode } from "lucide-react";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { i18n } from "../../../translate/i18n";

// Nó "2ª via Asaas": duas saídas — "a" (cobranças enviadas) em cima e
// "b" (falha: doc inválido, cliente/cobrança não encontrado, erro da API)
// embaixo, mesmo contrato dos nós condition/businessHours.
export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();

  const resumo = [
    data?.incluirBoletoUrl !== false ? "boleto" : null,
    data?.incluirPix ? "PIX" : null,
    data?.incluirPixQr ? "QR" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E7EC",
        borderLeft: "3px solid #7C3AED",
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
        <Barcode
          size={16}
          color="#7C3AED"
          style={{ marginRight: "6px", flexShrink: 0 }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
          {i18n.t("flowbuilderNodes.asaasCharge.name")}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#475467",
          width: 180,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {data?.campoDocumento
          ? `{{${data.campoDocumento}}}`
          : i18n.t("flowbuilderNodes.asaasCharge.docFromContact")}
        {resumo ? ` · ${resumo}` : ""}
      </div>
      {/* Saída "a": cobranças encontradas e enviadas */}
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
      {/* Saída "b": falha na consulta ou nenhuma cobrança encontrada */}
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
