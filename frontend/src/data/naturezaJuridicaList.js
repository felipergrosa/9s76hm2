// Naturezas Jurídicas - Receita Federal do Brasil
// code = id retornado pelo cnpj.ws (ex: "206-2")
const NJ = [
  // Empresas privadas mais comuns
  {c:"206-2", l:"206-2 - Sociedade Empresária Limitada (LTDA)"},
  {c:"213-5", l:"213-5 - Empresário Individual (EI)"},
  {c:"230-5", l:"230-5 - Empresa Individual de Responsabilidade Limitada (EIRELI)"},
  {c:"204-6", l:"204-6 - Sociedade Anônima Aberta (S/A)"},
  {c:"205-4", l:"205-4 - Sociedade Anônima Fechada (S/A)"},
  {c:"223-2", l:"223-2 - Sociedade Simples Pura"},
  {c:"224-0", l:"224-0 - Sociedade Simples Limitada"},
  {c:"214-3", l:"214-3 - Cooperativa"},
  {c:"399-9", l:"399-9 - Associação Privada"},
  {c:"412-0", l:"412-0 - Produtor Rural (Pessoa Física)"},
  {c:"408-1", l:"408-1 - Contribuinte Individual"},
  // MEI
  {c:"213-5", l:"213-5 - MEI - Microempreendedor Individual"},
  // Outros tipos empresariais
  {c:"201-1", l:"201-1 - Empresa Pública"},
  {c:"203-8", l:"203-8 - Sociedade de Economia Mista"},
  {c:"207-0", l:"207-0 - Sociedade Empresária em Nome Coletivo"},
  {c:"208-9", l:"208-9 - Sociedade Empresária em Comandita Simples"},
  {c:"209-7", l:"209-7 - Sociedade Empresária em Comandita por Ações"},
  {c:"212-7", l:"212-7 - Sociedade em Conta de Participação"},
  {c:"225-9", l:"225-9 - Sociedade Simples em Nome Coletivo"},
  {c:"226-7", l:"226-7 - Sociedade Simples em Comandita Simples"},
  // Entidades do terceiro setor
  {c:"302-6", l:"302-6 - Condomínio Edilício"},
  {c:"306-9", l:"306-9 - Entidade Sindical"},
  {c:"308-5", l:"308-5 - Fundação Privada"},
  {c:"313-1", l:"313-1 - Organização Religiosa"},
  {c:"321-2", l:"321-2 - Organização Social (OS)"},
  // Setor público
  {c:"101-5", l:"101-5 - Órgão Público do Poder Executivo Federal"},
  {c:"102-3", l:"102-3 - Órgão Público do Poder Executivo Estadual"},
  {c:"103-1", l:"103-1 - Órgão Público do Poder Executivo Municipal"},
  {c:"120-1", l:"120-1 - Ministério Público Federal"},
  {c:"130-9", l:"130-9 - Tribunal"},
  {c:"140-6", l:"140-6 - Tribunal"},
  // Outros
  {c:"305-0", l:"305-0 - Partido Político"},
  {c:"401-4", l:"401-4 - Empresa Individual Imobiliária"},
  {c:"409-0", l:"409-0 - Candidato a Cargo Político Eletivo"},
  {c:"411-1", l:"411-1 - Leiloeiro"},
  {c:"501-0", l:"501-0 - Organização Internacional"},
];

export default NJ.map(({c, l}) => ({ code: c, label: l }));
