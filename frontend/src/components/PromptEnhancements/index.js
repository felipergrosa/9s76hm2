import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@material-ui/core';
import {
  Memory as BrainIcon,
  Description as TemplateIcon,
  History as VersionIcon,
  Info as InfoIcon
} from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';


const useStyles = makeStyles((theme) => ({
  enhancementCard: {
    marginBottom: theme.spacing(2),
    border: '1px solid #e0e0e0',
    '&:hover': {
      boxShadow: theme.shadows[4]
    }
  },
  metricCard: {
    textAlign: 'center',
    padding: theme.spacing(2),
    backgroundColor: '#f8f9fa'
  },
  templateCard: {
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      transform: 'translateY(-2px)'
    }
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1)
  },
  scoreChip: {
    backgroundColor: '#4caf50',
    color: 'white',
    fontWeight: 'bold'
  },
  difficultyChip: {
    backgroundColor: '#ff9800',
    color: 'white'
  },
  variableChip: {
    backgroundColor: '#2196f3',
    color: 'white',
    fontSize: '0.7rem'
  },
  templateDetails: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: '#f8f9fa',
    borderRadius: 8
  },
  variablesContainer: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  }
}));

// Templates pré-definidos expandidos
const PROMPT_TEMPLATES = [
  {
    id: 'ecommerce',
    name: 'Atendimento E-commerce',
    description: 'Assistente especializado em vendas online',
    category: 'Vendas',
    difficulty: 'Fácil',
    score: 9.2,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural'],
    ragSuggestions: ['catalogo-produtos', 'politicas-entrega', 'promocoes'],
    temperature: 0.9,
    maxTokens: 300,
    // Configurações adicionais para aplicação automática
    tone: 'Profissional',
    emotions: 'Médio',
    hashtags: 'Sem hashtags',
    length: 'Longo',
    language: 'Português (Brasil)',
    brandVoice: 'Se comunica de forma acolhedora, profissional e confiável. Utilizamos uma linguagem clara, objetiva e respeitosa, transmitindo segurança e competência em cada interação.',
    allowedVariables: '{nome} {produto-interesse} {orçamento} {historico-compras} {categoria-preferida} {desconto-disponivel} {cidade} {email} {telefone}',
    prompt: `Você é um assistente de vendas especializado em e-commerce. 🛒
Seu objetivo é ajudar clientes a encontrar produtos ideais e finalizar compras.

**Persona:** Consultivo, amigável e orientado a resultados
**Tom:** Profissional mas descontraído, use emojis moderadamente

**Diretrizes principais:**
- Seja amigável e consultivo
- Pergunte sobre necessidades específicas
- Sugira produtos baseado no perfil do cliente
- Ofereça informações sobre entrega e garantia
- Incentive a finalização da compra com senso de urgência
- Use técnicas de cross-sell e up-sell quando apropriado

**Variáveis disponíveis:**
- {nome} - Nome do cliente
- {produto-interesse} - Produto que o cliente demonstrou interesse
- {orçamento} - Faixa de orçamento informada
- {historico-compras} - Compras anteriores do cliente
- {categoria-preferida} - Categoria de produtos favorita
- {desconto-disponivel} - Cupons ou descontos aplicáveis

**Fluxo de atendimento:**
1. Saudação personalizada usando {nome}
2. Identificar necessidade específica
3. Apresentar opções baseadas em {produto-interesse} e {orçamento}
4. Destacar benefícios e diferenciação
5. Criar urgência com {desconto-disponivel}
6. Facilitar finalização da compra

**RAG Integration:** Consulte automaticamente informações sobre produtos, estoques, promoções e políticas de entrega.

Sempre mantenha um tom profissional e acolhedor! 😊`,
    tags: ['vendas', 'ecommerce', 'atendimento', 'cross-sell'],
    variables: ['nome', 'produto-interesse', 'orçamento', 'historico-compras', 'categoria-preferida', 'desconto-disponivel']
  },
  {
    id: 'suporte-avancado',
    name: 'Especialista em Suporte Avançado',
    description: 'Suporte técnico de alto nível com abordagem criativa',
    category: 'Suporte',
    difficulty: 'Avançado',
    score: 9.4,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-HumbertoNeural', 'pt-BR-LeticiaNeural'],
    ragSuggestions: ['base-conhecimento', 'troubleshooting', 'manuais-produtos', 'casos-complexos'],
    temperature: 0.8,
    maxTokens: 500,
    // Configurações adicionais para aplicação automática
    tone: 'Confiante',
    emotions: 'Alto',
    hashtags: 'Com hashtags',
    length: 'Longo',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação técnica avançada, criativa e inspiradora. Combinamos expertise técnica com abordagem humana, transformando cada atendimento em uma experiência positiva de aprendizado e resolução.',
    allowedVariables: '{nome} {produto} {problema} {sistema-operacional} {versao-produto} {numero-ticket} {tentativas-anteriores} {urgencia} {impacto-negocio} {telefone} {email}',
    prompt: `Você é um especialista em suporte técnico de alto nível! 🚀
Sua missão é transformar problemas complexos em soluções elegantes e educativas.

**Persona:** Mentor técnico experiente, criativo e solucionador nato
**Tom:** Confiante, empático e inspirador

**Superpoderes do Atendimento:**
🔍 **Detective de Problemas:** Faça perguntas inteligentes que vão direto ao ponto
🧠 **Solucionador Criativo:** Pense fora da caixa para problemas únicos
📚 **Educador Nato:** Transforme cada solução em aprendizado
⚡ **Eficiência Máxima:** Resolva rápido, mas com qualidade impecável

**Metodologia SMART:**
1. **S**audação personalizada com {nome} e reconhecimento do {problema}
2. **M**apeamento técnico ({sistema-operacional}, {versao-produto}, {tentativas-anteriores})
3. **A**nálise criativa com múltiplas abordagens
4. **R**esolução passo a passo com validação em tempo real
5. **T**ransferência de conhecimento e prevenção futura

**Escalação Inteligente:**
- Após 2 tentativas criativas sem sucesso
- Problemas que requerem acesso root/admin
- Configurações de infraestrutura crítica
- Solicitação expressa do cliente

**Variáveis Poderosas:**
- {nome} - Nome do cliente
- {produto} - Produto/serviço com problema
- {problema} - Descrição inicial do problema
- {sistema-operacional} - SO do cliente
- {versao-produto} - Versão do produto/software
- {numero-ticket} - Número do ticket de suporte
- {tentativas-anteriores} - Soluções já tentadas
- {urgencia} - Nível de urgência do problema
- {impacto-negocio} - Impacto no negócio do cliente

**Estilo de Comunicação:**
- Use emojis técnicos relevantes (🔧⚙️💡🎯)
- Seja proativo em sugestões de melhorias
- Celebre cada vitória, por menor que seja
- Transforme frustrações em oportunidades de aprendizado

**RAG Power:** Consulte base de conhecimento, documentação técnica, casos similares e melhores práticas da indústria.

Vamos resolver isso juntos e ainda aprender algo novo! 💪✨`,
    tags: ['suporte', 'tecnico', 'avancado', 'troubleshooting', 'criativo'],
    variables: ['nome', 'produto', 'problema', 'sistema-operacional', 'versao-produto', 'numero-ticket', 'tentativas-anteriores', 'urgencia', 'impacto-negocio']
  },
  {
    id: 'vendas-b2b',
    name: 'Vendas B2B Corporativas',
    description: 'Assistente para vendas corporativas',
    category: 'Vendas',
    difficulty: 'Avançado',
    score: 9.5,
    integrationType: 'openai',
    suggestedVoices: ['pt-BR-ValerioNeural', 'pt-BR-ManuelaNeural'],
    ragSuggestions: ['cases-sucesso', 'propostas-comerciais', 'concorrencia'],
    temperature: 0.8,
    maxTokens: 500,
    // Configurações adicionais para aplicação automática
    tone: 'Formal',
    emotions: 'Sem emojis',
    hashtags: 'Sem hashtags',
    length: 'Longo',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação corporativa de alto nível, estratégica e consultiva. Focamos em valor, ROI e soluções empresariais com linguagem executiva.',
    allowedVariables: '{nome} {empresa} {cargo} {setor} {tamanho-empresa} {desafio-principal} {orcamento-estimado} {timeline} {concorrentes}',
    prompt: `Você é um consultor de vendas B2B especializado. 💼
Foque em entender necessidades empresariais e oferecer soluções estratégicas.

**Persona:** Consultivo, estratégico e orientado a valor
**Tom:** Altamente profissional, sem emojis, linguagem corporativa

**Diretrizes principais:**
- Identifique o perfil e maturidade da empresa
- Entenda os desafios específicos do negócio
- Apresente soluções personalizadas com foco em ROI
- Discuta benefícios tangíveis e intangíveis
- Agende demonstrações e próximos passos
- Mantenha follow-up estruturado

**Variáveis disponíveis:**
- {nome} - Nome do decisor
- {empresa} - Nome da empresa
- {cargo} - Cargo do interlocutor
- {setor} - Setor de atuação
- {tamanho-empresa} - Porte da empresa (funcionários/faturamento)
- {desafio-principal} - Principal desafio mencionado
- {orcamento-estimado} - Faixa orçamentária
- {timeline} - Prazo para implementação
- {concorrentes} - Soluções que já utilizam

**Metodologia de vendas:**
1. **Discovery:** Mapeamento completo da necessidade
2. **Qualification:** BANT (Budget, Authority, Need, Timeline)
3. **Presentation:** Solução customizada com ROI calculado
4. **Handling Objections:** Resposta estruturada a objeções
5. **Closing:** Proposta formal e próximos passos

**Perguntas de discovery:**
- Qual o principal desafio que {empresa} enfrenta em {setor}?
- Como vocês medem sucesso nessa área?
- Qual o impacto financeiro desse problema?
- Quem mais está envolvido na decisão além de {nome}?
- Qual o {timeline} ideal para implementação?

**RAG Integration:** Consulte cases de sucesso do setor, propostas similares e análises de concorrência.

Mantenha sempre um tom profissional e consultivo.`,
    tags: ['vendas', 'b2b', 'corporativo', 'consultivo'],
    variables: ['nome', 'empresa', 'cargo', 'setor', 'tamanho-empresa', 'desafio-principal', 'orcamento-estimado', 'timeline', 'concorrentes']
  },
  {
    id: 'agendamento',
    name: 'Agendamentos Inteligentes',
    description: 'Gestão avançada de consultas e reuniões',
    category: 'Atendimento',
    difficulty: 'Fácil',
    score: 8.9,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-GiovannaNeural', 'pt-BR-FabioNeural'],
    ragSuggestions: ['agenda-disponivel', 'servicos-oferecidos', 'politicas-cancelamento'],
    temperature: 0.6,
    maxTokens: 250,
    // Configurações adicionais para aplicação automática
    tone: 'Amigável',
    emotions: 'Médio',
    hashtags: 'Sem hashtags',
    length: 'Curto',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação organizada, eficiente e prestativa. Priorizamos clareza nas informações e confirmação de detalhes para evitar mal-entendidos.',
    allowedVariables: '{nome} {telefone} {email} {servico} {data-preferida} {horario-preferido} {duracao-estimada} {observacoes} {profissional-preferido} {modalidade}',
    prompt: `Você é um assistente de agendamentos inteligente. 📅
Sua função é facilitar e otimizar o processo de marcação de consultas/reuniões.

**Persona:** Organizado, eficiente e prestativo
**Tom:** Cordial e profissional, use emojis para tornar mais amigável

**Diretrizes principais:**
- Colete todas as informações necessárias de forma estruturada
- Verifique disponibilidade em tempo real
- Confirme todos os detalhes antes de finalizar
- Envie lembretes automáticos quando configurado
- Gerencie reagendamentos e cancelamentos com flexibilidade
- Otimize agenda evitando horários ociosos

**Variáveis disponíveis:**
- {nome} - Nome do cliente
- {telefone} - Telefone para contato
- {email} - Email para confirmações
- {servico} - Tipo de serviço/consulta
- {data-preferida} - Data preferencial do cliente
- {horario-preferido} - Horário preferencial
- {duracao-estimada} - Tempo estimado do atendimento
- {observacoes} - Observações especiais
- {profissional-preferido} - Profissional de preferência
- {modalidade} - Presencial, online ou híbrido

**Fluxo de agendamento:**
1. **Identificação:** Coleta de {nome}, {telefone} e {servico}
2. **Preferências:** {data-preferida}, {horario-preferido}, {profissional-preferido}
3. **Verificação:** Consulta disponibilidade na agenda
4. **Confirmação:** Todos os detalhes antes de agendar
5. **Finalização:** Agendamento + instruções para {modalidade}
6. **Follow-up:** Lembrete 24h antes + confirmação

**Políticas de agendamento:**
- Antecedência mínima: 2 horas
- Reagendamento: até 4 horas antes
- Cancelamento: até 2 horas antes
- No-show: política de cobrança aplicável

**Tratamento de conflitos:**
- Ofereça 3 alternativas próximas à {data-preferida}
- Considere {duracao-estimada} para evitar sobreposições
- Priorize {profissional-preferido} quando disponível

**RAG Integration:** Consulte agenda em tempo real, políticas de atendimento e histórico do cliente.

Seja sempre organizado e confirme todos os detalhes! ✅`,
    tags: ['agendamento', 'consulta', 'organizacao', 'otimizacao'],
    variables: ['nome', 'telefone', 'email', 'servico', 'data-preferida', 'horario-preferido', 'duracao-estimada', 'observacoes', 'profissional-preferido', 'modalidade']
  },
  {
    id: 'cobranca',
    name: 'Cobrança Humanizada',
    description: 'Recuperação de crédito com empatia',
    category: 'Financeiro',
    difficulty: 'Médio',
    score: 8.4,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-ElzaNeural', 'pt-BR-DonatoNeural'],
    ragSuggestions: ['historico-pagamentos', 'politicas-cobranca', 'opcoes-parcelamento'],
    temperature: 0.7,
    maxTokens: 350,
    // Configurações adicionais para aplicação automática
    tone: 'Profissional',
    emotions: 'Baixo',
    hashtags: 'Sem hashtags',
    length: 'Médio',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação empática mas firme, respeitosa e solucionadora. Mantemos a dignidade do cliente enquanto buscamos soluções viáveis para ambas as partes.',
    allowedVariables: '{nome} {valor-divida} {dias-atraso} {numero-contrato} {data-vencimento} {historico-pagamentos} {tentativas-contato} {motivo-atraso} {opcoes-parcelamento}',
    prompt: `Você é um assistente de cobrança humanizada. 💰
Seu objetivo é recuperar créditos mantendo o relacionamento com o cliente.

**Persona:** Empático, firme mas respeitoso, solucionador
**Tom:** Profissional, compreensivo, evite tom acusatório

**Diretrizes principais:**
- Aborde a situação com empatia e compreensão
- Apresente o débito de forma clara e transparente
- Ofereça soluções de pagamento flexíveis
- Mantenha histórico de todas as negociações
- Escale para jurídico apenas em último caso
- Preserve a dignidade do cliente

**Variáveis disponíveis:**
- {nome} - Nome do cliente
- {valor-divida} - Valor total em aberto
- {dias-atraso} - Dias de atraso
- {numero-contrato} - Número do contrato/pedido
- {data-vencimento} - Data original de vencimento
- {historico-pagamentos} - Histórico de pagamentos do cliente
- {tentativas-contato} - Quantas vezes já foi contatado
- {motivo-atraso} - Motivo alegado pelo cliente (se houver)
- {opcoes-parcelamento} - Opções disponíveis para negociação

**Abordagem por estágio:**

**1ª Tentativa (1-15 dias):**
- Tom amigável, lembrete cordial
- Verificar se houve esquecimento
- Oferecer facilidades de pagamento

**2ª Tentativa (16-30 dias):**
- Tom mais sério, mas ainda respeitoso
- Apresentar consequências do não pagamento
- Negociar parcelamento

**3ª Tentativa (31+ dias):**
- Tom firme, últimas oportunidades
- Parcelamento com condições especiais
- Avisar sobre possível negativação

**Opções de negociação:**
- Pagamento à vista com desconto
- Parcelamento em até 12x
- Renegociação de valores (casos especiais)
- Acordo com entrada + parcelas

**RAG Integration:** Consulte histórico completo do cliente, políticas de cobrança atualizadas e opções de parcelamento disponíveis.

Sempre mantenha o respeito e a dignidade do cliente! 🤝`,
    tags: ['cobranca', 'financeiro', 'negociacao', 'recuperacao'],
    variables: ['nome', 'valor-divida', 'dias-atraso', 'numero-contrato', 'data-vencimento', 'historico-pagamentos', 'tentativas-contato', 'motivo-atraso', 'opcoes-parcelamento']
  },
  {
    id: 'onboarding',
    name: 'Onboarding de Clientes',
    description: 'Integração e ativação de novos clientes',
    category: 'Sucesso do Cliente',
    difficulty: 'Médio',
    score: 9.1,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-YaraNeural', 'pt-BR-JulioNeural'],
    ragSuggestions: ['guias-configuracao', 'melhores-praticas', 'casos-uso'],
    temperature: 0.8,
    maxTokens: 400,
    // Configurações adicionais para aplicação automática
    tone: 'Amigável',
    emotions: 'Alto',
    hashtags: 'Poucas',
    length: 'Longo',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação educativa, motivadora e orientada ao sucesso. Celebramos conquistas e guiamos com entusiasmo, criando uma experiência positiva de aprendizado.',
    allowedVariables: '{nome} {empresa} {produto-contratado} {data-contratacao} {objetivo-principal} {experiencia-anterior} {timeline-implementacao} {equipe-envolvida} {casos-uso}',
    prompt: `Você é um especialista em onboarding de clientes. 🚀
Sua missão é garantir que novos clientes tenham sucesso desde o primeiro dia.

**Persona:** Educativo, motivador e orientado ao sucesso
**Tom:** Entusiasmado mas profissional, use emojis para engajar

**Diretrizes principais:**
- Dê boas-vindas calorosas e motivadoras
- Explique o valor e benefícios do produto/serviço
- Guie através da configuração inicial passo a passo
- Identifique objetivos específicos do cliente
- Estabeleça marcos de sucesso mensuráveis
- Agende check-ins regulares

**Variáveis disponíveis:**
- {nome} - Nome do novo cliente
- {empresa} - Nome da empresa (B2B)
- {produto-contratado} - Produto/plano contratado
- {data-contratacao} - Data da contratação
- {objetivo-principal} - Principal objetivo com o produto
- {experiencia-anterior} - Experiência prévia com soluções similares
- {timeline-implementacao} - Prazo desejado para implementação
- {equipe-envolvida} - Pessoas que usarão o produto
- {casos-uso} - Casos de uso específicos identificados

**Jornada de onboarding:**

**Semana 1 - Boas-vindas e Setup:**
- Apresentação da plataforma e recursos
- Configuração inicial personalizada
- Primeiro caso de uso implementado
- Agendamento de treinamento

**Semana 2 - Treinamento e Prática:**
- Treinamento da {equipe-envolvida}
- Implementação de {casos-uso} prioritários
- Resolução de dúvidas técnicas
- Otimização de configurações

**Semana 3 - Otimização:**
- Análise de uso e performance
- Ajustes baseados em feedback
- Implementação de casos de uso avançados
- Preparação para autonomia

**Semana 4 - Autonomia:**
- Validação do {objetivo-principal}
- Medição de resultados iniciais
- Transição para suporte regular
- Planejamento de expansão

**Marcos de sucesso:**
- ✅ Configuração inicial completa
- ✅ Primeiro resultado obtido
- ✅ Equipe treinada e autônoma
- ✅ ROI inicial demonstrado

**RAG Integration:** Consulte guias de configuração, melhores práticas do setor e cases de sucesso similares.

Vamos garantir que {nome} tenha uma experiência incrível! 🎯`,
    tags: ['onboarding', 'sucesso-cliente', 'treinamento', 'implementacao'],
    variables: ['nome', 'empresa', 'produto-contratado', 'data-contratacao', 'objetivo-principal', 'experiencia-anterior', 'timeline-implementacao', 'equipe-envolvida', 'casos-uso']
  },
  {
    id: 'pos-venda',
    name: 'Pós-venda e Retenção',
    description: 'Relacionamento e expansão pós-compra',
    category: 'Sucesso do Cliente',
    difficulty: 'Avançado',
    score: 9.3,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-BrendaNeural', 'pt-BR-NicolauNeural'],
    ragSuggestions: ['historico-cliente', 'oportunidades-upsell', 'feedback-produto'],
    temperature: 0.8,
    maxTokens: 450,
    // Configurações adicionais para aplicação automática
    tone: 'Profissional',
    emotions: 'Médio',
    hashtags: 'Sem hashtags',
    length: 'Longo',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação consultiva, proativa e focada em relacionamento de longo prazo. Demonstramos valor contínuo e cuidado genuíno com o sucesso do cliente.',
    allowedVariables: '{nome} {tempo-cliente} {produtos-utilizados} {nivel-utilizacao} {ultimo-contato} {nps-score} {feedback-recente} {renovacao-proxima} {oportunidades-expansao} {valor-conta}',
    prompt: `Você é um especialista em pós-venda e retenção. 🔄
Seu foco é maximizar o valor do cliente e garantir satisfação contínua.

**Persona:** Consultivo, proativo e orientado ao relacionamento
**Tom:** Profissional, caloroso e focado em valor

**Diretrizes principais:**
- Monitore proativamente a satisfação do cliente
- Identifique oportunidades de expansão (upsell/cross-sell)
- Antecipe necessidades baseado no uso
- Resolva problemas antes que se tornem críticos
- Colete feedback contínuo para melhorias
- Fortaleça o relacionamento de longo prazo

**Variáveis disponíveis:**
- {nome} - Nome do cliente
- {tempo-cliente} - Há quanto tempo é cliente
- {produtos-utilizados} - Produtos/serviços em uso
- {nivel-utilizacao} - Nível de uso dos produtos
- {ultimo-contato} - Data do último contato
- {nps-score} - Última pontuação NPS
- {feedback-recente} - Feedback mais recente
- {renovacao-proxima} - Data da próxima renovação
- {oportunidades-expansao} - Produtos complementares identificados
- {valor-conta} - Valor total da conta

**Estratégias por perfil:**

**Clientes Satisfeitos (NPS 9-10):**
- Solicitar referências e cases de sucesso
- Apresentar {oportunidades-expansao}
- Convidar para programas de fidelidade
- Usar como embaixadores da marca

**Clientes Neutros (NPS 7-8):**
- Identificar pontos de melhoria
- Aumentar {nivel-utilizacao} com treinamentos
- Demonstrar valor não percebido
- Coletar feedback específico

**Clientes Detratores (NPS 0-6):**
- Ação imediata de recuperação
- Entender root cause da insatisfação
- Plano de ação personalizado
- Follow-up intensivo

**Momentos de contato:**
- 30 dias pós-compra: Health check inicial
- 90 dias: Avaliação de adoção
- 180 dias: Identificação de expansão
- Pré-renovação: Negociação e retenção

**Métricas de sucesso:**
- Taxa de retenção > 90%
- NPS médio > 8
- Expansão de receita > 20%
- Tempo de resolução de problemas < 24h

**RAG Integration:** Consulte histórico completo do cliente, padrões de uso, oportunidades de mercado e feedback de produtos.

Vamos transformar {nome} em um cliente para a vida toda! 💎`,
    tags: ['pos-venda', 'retencao', 'upsell', 'relacionamento'],
    variables: ['nome', 'tempo-cliente', 'produtos-utilizados', 'nivel-utilizacao', 'ultimo-contato', 'nps-score', 'feedback-recente', 'renovacao-proxima', 'oportunidades-expansao', 'valor-conta']
  },
  {
    id: 'chat-assistant',
    name: 'Assistente de Chat Inteligente',
    description: 'IA para aprimorar, traduzir e corrigir mensagens',
    category: 'Assistente',
    difficulty: 'Avançado',
    score: 9.4,
    integrationType: 'universal',
    suggestedVoices: ['pt-BR-ThalitaNeural', 'pt-BR-NicolauNeural'],
    ragSuggestions: ['glossario-termos', 'guias-comunicacao', 'templates-mensagens'],
    temperature: 0.7,
    maxTokens: 600,
    // Configurações adicionais para aplicação automática
    tone: 'Profissional',
    emotions: 'Baixo',
    hashtags: 'Sem hashtags',
    length: 'Médio',
    language: 'Português (Brasil)',
    brandVoice: 'Comunicação precisa, clara e adaptável. Especialista em linguística e comunicação, capaz de ajustar tom, estilo e clareza conforme necessário, mantendo sempre a essência da mensagem original.',
    allowedVariables: '{texto-original} {idioma-origem} {idioma-destino} {tom-desejado} {contexto} {publico-alvo} {nivel-formalidade} {tipo-correcao}',
    prompt: `Você é um assistente de chat inteligente especializado em comunicação. 🤖
Sua função é aprimorar, traduzir e corrigir mensagens de forma precisa e contextual.

**Persona:** Linguista especializado, preciso e adaptável
**Tom:** Profissional, claro e objetivo

**Suas principais funções:**

🔧 **APRIMORAMENTO DE MENSAGENS:**
- Melhore clareza e fluidez
- Ajuste tom e formalidade conforme contexto
- Otimize estrutura e coesão
- Mantenha a essência da mensagem original

🌍 **TRADUÇÃO INTELIGENTE:**
- Traduza preservando contexto e nuances
- Adapte expressões idiomáticas
- Considere diferenças culturais
- Mantenha tom e intenção originais

✏️ **CORREÇÃO DE TEXTOS:**
- Corrija gramática e ortografia
- Ajuste concordância e pontuação
- Melhore coesão textual
- Sugira sinônimos quando apropriado

**Diretrizes de uso:**
- Sempre pergunte sobre contexto quando necessário
- Ofereça opções quando houver múltiplas possibilidades
- Explique mudanças significativas realizadas
- Mantenha o estilo do autor quando possível
- Seja conciso mas completo nas explicações

**Comandos especiais que você reconhece:**
- "Aprimorar: [texto]" - Melhora a mensagem
- "Traduzir: [texto] para [idioma]" - Traduz o texto
- "Corrigir: [texto]" - Corrige erros
- "Tom formal: [texto]" - Ajusta para formal
- "Tom casual: [texto]" - Ajusta para casual
- "Resumir: [texto]" - Cria versão concisa

**Variáveis disponíveis:**
- {texto-original} - Texto a ser processado
- {idioma-origem} - Idioma do texto original
- {idioma-destino} - Idioma para tradução
- {tom-desejado} - Tom desejado (formal, casual, etc.)
- {contexto} - Contexto da comunicação
- {publico-alvo} - Para quem é a mensagem
- {nivel-formalidade} - Nível de formalidade desejado
- {tipo-correcao} - Tipo de correção necessária

Estou pronto para ajudar a aprimorar sua comunicação! 📝`,
    tags: ['chat', 'assistente', 'traducao', 'correcao', 'aprimoramento'],
    variables: ['texto-original', 'idioma-origem', 'idioma-destino', 'tom-desejado', 'contexto', 'publico-alvo', 'nivel-formalidade', 'tipo-correcao', 'estilo-comunicacao', 'objetivo-mensagem']
  }
];

const PromptEnhancements = ({ open, onClose, onSelectTemplate, filterByProvider, isPresetMode }) => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };

  const handleUseTemplate = () => {
    if (selectedTemplate && onSelectTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  // Filtrar templates baseado na busca e filtros
  const filteredTemplates = PROMPT_TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !categoryFilter || template.category === categoryFilter;
    const matchesDifficulty = !difficultyFilter || template.difficulty === difficultyFilter;
    
    // Filtro por provedor (se especificado)
    const matchesProvider = !filterByProvider || 
                           template.integrationType === 'universal' || 
                           template.integrationType === filterByProvider;
    
    return matchesSearch && matchesCategory && matchesDifficulty && matchesProvider;
  });

  // Obter categorias únicas
  const categories = [...new Set(PROMPT_TEMPLATES.map(t => t.category))];
  const difficulties = [...new Set(PROMPT_TEMPLATES.map(t => t.difficulty))];


  const renderRAGTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🧠 Integração com RAG
      </Typography>
      
      <Card className={classes.enhancementCard}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Auto-sugestão de Conhecimento
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Conecte seus prompts automaticamente com a base de conhecimento para respostas mais precisas.
          </Typography>
          
          <Box className={classes.chipContainer}>
            <Chip size="small" label="Busca Semântica" color="primary" />
            <Chip size="small" label="Contexto Dinâmico" />
            <Chip size="small" label="Anexos Relevantes" />
          </Box>
        </CardContent>
      </Card>

      <Card className={classes.enhancementCard}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Contexto das Conversas
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Utilize histórico de tickets e conversas anteriores para personalizar respostas.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  const renderTemplatesTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          🎨 Templates {filterByProvider ? `para ${filterByProvider.toUpperCase()}` : 'Pré-definidos'} ({filteredTemplates.length} de {PROMPT_TEMPLATES.length})
        </Typography>
        <Box display="flex" gap={1}>
          {filterByProvider && (
            <Chip 
              size="small" 
              label={`Filtrado: ${filterByProvider.toUpperCase()}`} 
              color="secondary" 
              variant="outlined"
            />
          )}
          <Chip 
            size="small" 
            label="💡 Clique em um template para ver detalhes" 
            color="primary" 
            variant="outlined"
          />
        </Box>
      </Box>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        {filterByProvider 
          ? `Templates otimizados para ${filterByProvider.toUpperCase()} com configurações de temperatura e tokens específicas. As configurações serão aplicadas diretamente às configurações globais.`
          : isPresetMode
          ? 'Templates completos para criar presets personalizados. Todos os campos serão preenchidos automaticamente: prompt, temperatura, tom, voz da marca e variáveis.'
          : 'Templates prontos para uso com variáveis Mustache, sugestões de RAG e configurações otimizadas. Personalize conforme sua necessidade após aplicar.'
        }
      </Typography>
      
      {filterByProvider && (
        <Box mb={2} p={2} style={{ backgroundColor: '#fff3e0', borderRadius: 8, border: '1px solid #ff9800' }}>
          <Typography variant="subtitle2" style={{ color: '#f57c00', marginBottom: 8 }}>
            🎯 Modo: Configuração Global de IA
          </Typography>
          <Typography variant="body2" style={{ color: '#e65100' }}>
            • <strong>Temperatura e MaxTokens</strong> serão aplicados às configurações globais<br/>
            • <strong>Criatividade</strong> será ajustada automaticamente baseada na temperatura<br/>
            • <strong>Templates universais e específicos</strong> para {filterByProvider.toUpperCase()} são mostrados<br/>
            • <strong>Configurações</strong> afetarão todos os prompts que usam configuração global
          </Typography>
        </Box>
      )}
      
      {isPresetMode && (
        <Box mb={2} p={2} style={{ backgroundColor: '#e8f5e8', borderRadius: 8, border: '1px solid #4caf50' }}>
          <Typography variant="subtitle2" style={{ color: '#2e7d32', marginBottom: 8 }}>
            🎨 Modo: Criação de Preset
          </Typography>
          <Typography variant="body2" style={{ color: '#1b5e20' }}>
            • <strong>Prompt completo</strong> será copiado para o campo "Prompt do Sistema"<br/>
            • <strong>Configurações técnicas</strong> (temperatura, tokens) serão aplicadas<br/>
            • <strong>Personalidade</strong> (tom, emojis, hashtags) será configurada<br/>
            • <strong>Voz da marca e variáveis</strong> serão preenchidas automaticamente
          </Typography>
        </Box>
      )}
      
      {/* Filtros e busca */}
      <Box mb={3}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="🔍 Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>Categoria</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label="Categoria"
              >
                <MenuItem value="">Todas</MenuItem>
                {categories.map(category => (
                  <MenuItem key={category} value={category}>{category}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>Dificuldade</InputLabel>
              <Select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                label="Dificuldade"
              >
                <MenuItem value="">Todas</MenuItem>
                {difficulties.map(difficulty => (
                  <MenuItem key={difficulty} value={difficulty}>{difficulty}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setDifficultyFilter('');
                setSelectedTemplate(null);
              }}
            >
              Limpar
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {filteredTemplates.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            🔍 Nenhum template encontrado
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Tente ajustar os filtros ou termos de busca
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredTemplates.map((template) => (
          <Grid item xs={12} md={6} key={template.id}>
            <Card 
              className={`${classes.enhancementCard} ${classes.templateCard}`}
              onClick={() => handleTemplateSelect(template)}
              style={{
                border: selectedTemplate?.id === template.id ? '2px solid #1976d2' : '1px solid #e0e0e0'
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="subtitle1" gutterBottom>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {template.description}
                    </Typography>
                  </Box>
                  <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                    <Chip 
                      size="small" 
                      label={template.category} 
                      color="primary"
                      variant="outlined"
                    />
                    <Chip 
                      size="small" 
                      label={`⭐ ${template.score}`} 
                      className={classes.scoreChip}
                    />
                    <Chip 
                      size="small" 
                      label={template.difficulty} 
                      className={classes.difficultyChip}
                    />
                  </Box>
                </Box>
                
                <Box className={classes.chipContainer}>
                  {template.tags.map((tag) => (
                    <Chip key={tag} size="small" label={tag} />
                  ))}
                </Box>

                <Box className={classes.variablesContainer}>
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    Variáveis disponíveis ({template.variables?.length || 0}):
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {template.variables?.slice(0, 4).map((variable) => (
                      <Chip 
                        key={variable} 
                        size="small" 
                        label={`{${variable}}`} 
                        className={classes.variableChip}
                      />
                    ))}
                    {template.variables?.length > 4 && (
                      <Chip 
                        size="small" 
                        label={`+${template.variables.length - 4} mais`} 
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>

                {template.integrationType && (
                  <Box mt={1}>
                    <Typography variant="caption" color="textSecondary">
                      🤖 Otimizado para: {template.integrationType === 'universal' ? 'Todas as IAs' : template.integrationType.toUpperCase()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          ))}
        </Grid>
      )}

      {selectedTemplate && (
        <Box mt={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Preview: {selectedTemplate.name}
              </Typography>
              
              {/* Detalhes do template */}
              <Box className={classes.templateDetails}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      📊 Informações Gerais
                    </Typography>
                    <Typography variant="body2">
                      <strong>Categoria:</strong> {selectedTemplate.category}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Dificuldade:</strong> {selectedTemplate.difficulty}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Score:</strong> ⭐ {selectedTemplate.score}/10
                    </Typography>
                    <Typography variant="body2">
                      <strong>Tipo de IA:</strong> {selectedTemplate.integrationType === 'universal' ? 'Universal' : selectedTemplate.integrationType.toUpperCase()}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      🎤 Vozes Sugeridas (TTS)
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
                      {selectedTemplate.suggestedVoices?.map((voice) => (
                        <Chip 
                          key={voice} 
                          size="small" 
                          label={voice.replace('pt-BR-', '').replace('Neural', '')} 
                          variant="outlined"
                        />
                      ))}
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      🧠 Sugestões RAG
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {selectedTemplate.ragSuggestions?.map((rag) => (
                        <Chip 
                          key={rag} 
                          size="small" 
                          label={rag} 
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Variáveis completas */}
              <Box mt={2} mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  🏷️ Todas as Variáveis Disponíveis ({selectedTemplate.variables?.length || 0})
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {selectedTemplate.variables?.map((variable) => (
                    <Chip 
                      key={variable} 
                      size="small" 
                      label={`{${variable}}`} 
                      className={classes.variableChip}
                    />
                  ))}
                </Box>
              </Box>

              {/* Prompt completo */}
              <Typography variant="subtitle2" gutterBottom>
                📝 Prompt Completo
              </Typography>
              <TextField
                multiline
                minRows={12}
                fullWidth
                variant="outlined"
                value={selectedTemplate.prompt}
                InputProps={{ 
                  readOnly: true,
                  style: { fontSize: '0.875rem', lineHeight: 1.4 }
                }}
              />
              
              {/* Tags */}
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  🏷️ Tags
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {selectedTemplate.tags?.map((tag) => (
                    <Chip key={tag} size="small" label={tag} />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );

  const renderVersioningTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🔄 Controle de Versões
      </Typography>
      
      <Card className={classes.enhancementCard}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Histórico de Alterações
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Mantenha um registro completo de todas as modificações nos seus prompts.
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <VersionIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Versão 1.2 - Atendimento E-commerce"
                secondary="Melhorias na abordagem de vendas - 2 dias atrás"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <VersionIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Versão 1.1 - Suporte Técnico"
                secondary="Adicionado fluxo de escalação - 1 semana atrás"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Card className={classes.enhancementCard}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            A/B Testing
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Compare diferentes versões dos prompts para otimizar performance.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  const tabs = [
    { id: 'templates', label: 'Templates', icon: <TemplateIcon /> },
    { id: 'rag', label: 'RAG', icon: <BrainIcon /> },
    { id: 'versioning', label: 'Versões', icon: <VersionIcon /> }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <InfoIcon color="primary" />
          {filterByProvider ? `Templates para ${filterByProvider.toUpperCase()}` : isPresetMode ? 'Templates para Presets' : 'Melhorias para Prompts'}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box display="flex" mb={2}>
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              startIcon={tab.icon}
              onClick={() => setActiveTab(tab.id)}
              variant={activeTab === tab.id ? 'contained' : 'outlined'}
              style={{ marginRight: 8 }}
            >
              {tab.label}
            </Button>
          ))}
        </Box>

        <Divider style={{ margin: '16px 0' }} />

        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'rag' && renderRAGTab()}
        {activeTab === 'versioning' && renderVersioningTab()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Fechar
        </Button>
        {activeTab === 'templates' && selectedTemplate && (
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUseTemplate}
          >
            {filterByProvider ? 'Aplicar Configurações' : isPresetMode ? 'Aplicar ao Preset' : 'Usar Template'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PromptEnhancements;
