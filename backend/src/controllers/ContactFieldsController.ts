import { Request, Response } from "express";

// Campos básicos de contato disponíveis para tags mustache
const CONTACT_FIELDS = [
  { name: "nome", label: "Nome completo" },
  { name: "primeiro-nome", label: "Primeiro nome" },
  { name: "email", label: "E-mail" },
  { name: "cidade", label: "Cidade" },
  { name: "codigo-representante", label: "Código do representante" },
  { name: "situacao", label: "Situação" },
  { name: "fantasia", label: "Nome fantasia" },
  { name: "data-fundacao", label: "Data de fundação" },
  { name: "limite-credito", label: "Limite de crédito" },
  { name: "segmento", label: "Segmento" },
  { name: "cnpj-cpf", label: "CNPJ/CPF" },
  { name: "telefone", label: "Telefone" },
  { name: "endereco", label: "Endereço" },
  { name: "cep", label: "CEP" },
  { name: "estado", label: "Estado" },
  { name: "pais", label: "País" }
];

export const getContactFields = async (req: Request, res: Response) => {
  try {
    return res.json(CONTACT_FIELDS);
  } catch (error) {
    console.error("Erro ao buscar campos de contato:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export default {
  getContactFields
};
