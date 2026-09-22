// Nichos de prospecção — atalhos que preenchem a palavra-chave (Google Maps)
// ou o CNAE (RF Pesquisa Avançada).
// cnae no formato CNAE 2.0; os 7 dígitos usados na API são obtidos removendo não-dígitos.
const LEAD_SEGMENT_PRESETS = [
  { label: "Arquitetura e urbanismo",    mapsKeyword: "escritório de arquitetura",   cnae: "7111-1/00" },
  { label: "Engenharia",                 mapsKeyword: "empresa de engenharia",       cnae: "7112-0/00" },
  { label: "Odontologia",                mapsKeyword: "clínica odontológica",        cnae: "8630-5/04" },
  { label: "Clínicas médicas",           mapsKeyword: "clínica médica",              cnae: "8630-5/01" },
  { label: "Academias",                  mapsKeyword: "academia de ginástica",       cnae: "9313-1/00" },
  { label: "Restaurantes",               mapsKeyword: "restaurante",                 cnae: "5611-2/01" },
  { label: "Advocacia",                  mapsKeyword: "escritório de advocacia",     cnae: "6911-7/01" },
  { label: "Contabilidade",              mapsKeyword: "escritório de contabilidade", cnae: "6920-6/01" },
  { label: "Imobiliárias",               mapsKeyword: "imobiliária",                 cnae: "6810-2/02" },
  { label: "Clínicas de estética",       mapsKeyword: "clínica de estética",         cnae: "9602-5/02" },
  { label: "Veterinária",                mapsKeyword: "clínica veterinária",         cnae: "7500-1/00" },
  { label: "Farmácias",                  mapsKeyword: "farmácia",                    cnae: "4771-7/01" },
  { label: "Escolas e educação infantil", mapsKeyword: "escola",                     cnae: "8511-2/00" },
  { label: "Supermercados",              mapsKeyword: "supermercado",                cnae: "4711-3/02" },
  { label: "Salões de beleza",           mapsKeyword: "salão de beleza",             cnae: "9602-5/01" },
];

export default LEAD_SEGMENT_PRESETS;
