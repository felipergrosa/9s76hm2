import { useState, useEffect, useCallback, useRef } from 'react';
import Typo from 'typo-js';

// ============================================================
// LANGUAGETOOL API - Verificação Gramatical
// ============================================================
const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check';

// Cache de resultados do LanguageTool para evitar requisições repetidas
const grammarCache = new Map();

// Verificar gramática usando API do LanguageTool
export const checkGrammar = async (text) => {
  if (!text || text.length < 5) return [];
  
  // Verificar cache
  const cacheKey = text.trim();
  if (grammarCache.has(cacheKey)) {
    return grammarCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(LANGUAGETOOL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        language: 'pt-BR',
        enabledOnly: 'false',
      }),
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    // Mapear erros do LanguageTool para formato interno
    const errors = (data.matches || []).map(match => ({
      word: text.substring(match.offset, match.offset + match.length),
      start: match.offset,
      end: match.offset + match.length,
      message: match.message,
      shortMessage: match.shortMessage || match.rule?.description || 'Erro gramatical',
      suggestions: (match.replacements || []).slice(0, 5).map(r => r.value),
      type: match.rule?.issueType || 'grammar', // 'grammar', 'typographical', 'style', etc.
      ruleId: match.rule?.id,
    }));
    
    // Salvar no cache (máximo 100 entradas)
    if (grammarCache.size > 100) {
      const firstKey = grammarCache.keys().next().value;
      grammarCache.delete(firstKey);
    }
    grammarCache.set(cacheKey, errors);
    
    return errors;
  } catch (error) {
    return [];
  }
};

// ============================================================
// TYPO.JS - Corretor Ortográfico
// ============================================================

// Instância global do Typo.js com dicionário completo
let typoInstance = null;
let loadingPromise = null;

// Carregar dicionário completo PT-BR do Hunspell
const loadFullDictionary = async () => {
  if (typoInstance) return typoInstance;
  if (loadingPromise) return loadingPromise;
  
  loadingPromise = (async () => {
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionaries/pt-BR.aff'),
        fetch('/dictionaries/pt-BR.dic')
      ]);
      
      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error('Falha ao carregar arquivos de dicionário');
      }
      
      const affData = await affResponse.text();
      const dicData = await dicResponse.text();
      
      typoInstance = new Typo('pt-BR', affData, dicData, {
        platform: 'any'
      });
      
      return typoInstance;
    } catch (error) {
      return null;
    }
  })();
  
  return loadingPromise;
};

// Dicionário PT-BR embutido (fallback - palavras mais comuns)
const BASIC_PT_BR_WORDS = new Set([
  // Artigos e preposições
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
  'em', 'na', 'no', 'nas', 'nos', 'para', 'pra', 'por', 'pela', 'pelo', 'pelas', 'pelos',
  'com', 'sem', 'sob', 'sobre', 'entre', 'até', 'após', 'desde', 'durante', 'perante',
  // Pronomes
  'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'você', 'vocês',
  'me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes', 'mim', 'ti', 'si',
  'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas',
  'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas',
  'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo',
  'que', 'qual', 'quais', 'quem', 'onde', 'quando', 'como', 'quanto', 'quantos',
  // Verbos comuns (com acentos)
  'ser', 'estar', 'ter', 'haver', 'fazer', 'poder', 'querer', 'dizer', 'ir', 'ver',
  'vir', 'dar', 'saber', 'ficar', 'deixar', 'passar', 'parecer', 'chegar', 'começar',
  'é', 'são', 'está', 'estão', 'estava', 'estavam', 'estive', 'esteve',
  'foi', 'eram', 'era', 'seria', 'tem', 'tinha', 'tinham', 'tive', 'teve',
  'faz', 'fazendo', 'feito', 'fez', 'pode', 'podem', 'pôde', 'quer', 'querem', 'disse', 'diz',
  'vai', 'vão', 'veio', 'vem', 'vêm', 'deu', 'dão', 'sei', 'sabe', 'sabem',
  'fica', 'ficam', 'ficou', 'deixa', 'deixou', 'passou', 'passa', 'parece',
  'chegou', 'chega', 'começou', 'começa', 'precisa', 'precisam', 'gosta', 'gostam',
  // Advérbios (com acentos)
  'não', 'sim', 'também', 'já', 'ainda', 'sempre', 'nunca', 'jamais', 'talvez',
  'aqui', 'ali', 'lá', 'cá', 'aí', 'onde', 'aonde', 'bem', 'mal', 'muito',
  'pouco', 'mais', 'menos', 'bastante', 'demais', 'tão', 'tanto', 'quase',
  'apenas', 'somente', 'só', 'mesmo', 'inclusive', 'principalmente', 'geralmente',
  'hoje', 'ontem', 'amanhã', 'agora', 'antes', 'depois', 'logo', 'cedo', 'tarde',
  // Conjunções
  'e', 'ou', 'mas', 'porém', 'contudo', 'todavia', 'entretanto', 'portanto',
  'porque', 'pois', 'como', 'se', 'embora', 'enquanto', 'quando', 'assim',
  // Substantivos comuns
  'dia', 'dias', 'ano', 'anos', 'mês', 'meses', 'hora', 'horas', 'minuto', 'minutos',
  'tempo', 'vez', 'vezes', 'coisa', 'coisas', 'pessoa', 'pessoas', 'gente',
  'homem', 'mulher', 'criança', 'filho', 'filha', 'pai', 'mãe', 'família',
  'casa', 'trabalho', 'vida', 'mundo', 'país', 'cidade', 'lugar', 'parte',
  'forma', 'modo', 'maneira', 'jeito', 'caso', 'problema', 'questão', 'situação',
  'nome', 'número', 'dados', 'informação', 'mensagem', 'texto', 'palavra',
  'olá', 'oi', 'bom', 'boa', 'obrigado', 'obrigada', 'desculpa', 'desculpe',
  'tudo', 'nada', 'algo', 'alguém', 'ninguém', 'cada', 'todo', 'toda', 'todos', 'todas',
  // Adjetivos comuns
  'bom', 'boa', 'bons', 'boas', 'mau', 'má', 'maus', 'más',
  'grande', 'grandes', 'pequeno', 'pequena', 'novo', 'nova', 'velho', 'velha',
  'primeiro', 'primeira', 'último', 'última', 'próximo', 'próxima',
  'certo', 'certa', 'errado', 'errada', 'correto', 'correta', 'corretos', 'corretas',
  'importante', 'necessário', 'possível', 'impossível', 'diferente', 'igual',
  // Números
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte',
  'cem', 'mil', 'milhão', 'bilhão',
  // Palavras de negócio/atendimento
  'cliente', 'clientes', 'atendimento', 'contato', 'contatos', 'ticket', 'tickets',
  'pedido', 'pedidos', 'produto', 'produtos', 'serviço', 'serviços', 'preço', 'valor',
  'pagamento', 'compra', 'venda', 'entrega', 'prazo', 'data', 'hora', 'endereço',
  'telefone', 'email', 'whatsapp', 'mensagem', 'resposta', 'pergunta', 'dúvida',
  'ajuda', 'suporte', 'problema', 'solução', 'informação', 'informações',
  'aguardar', 'aguarde', 'enviar', 'receber', 'confirmar', 'cancelar', 'alterar',
]);

// Mapeamento de palavras sem acento para palavras com acento (autocorreção)
const ACCENT_MAP = {
  'nao': 'não',
  'esta': 'está',
  'tambem': 'também',
  'ja': 'já',
  'ai': 'aí',
  'la': 'lá',
  'voce': 'você',
  'voces': 'vocês',
  'nos': 'nós',
  'sao': 'são',
  'entao': 'então',
  'ate': 'até',
  'apos': 'após',
  'so': 'só',
  'mae': 'mãe',
  'mes': 'mês',
  'pais': 'país',
  'numero': 'número',
  'informacao': 'informação',
  'informacoes': 'informações',
  'solucao': 'solução',
  'questao': 'questão',
  'situacao': 'situação',
  'obrigadao': 'obrigado',
  'duvida': 'dúvida',
  'endereco': 'endereço',
  'servico': 'serviço',
  'servicos': 'serviços',
  'preco': 'preço',
  'proximo': 'próximo',
  'proxima': 'próxima',
  'ultimo': 'último',
  'ultima': 'última',
  'necessario': 'necessário',
  'possivel': 'possível',
  'impossivel': 'impossível',
  'amanha': 'amanhã',
  'coreto': 'correto',
  'coreta': 'correta',
  'ola': 'olá',
  'obrigadoa': 'obrigado',
  'obrigadoo': 'obrigado',
  'vc': 'você',
  'vcs': 'vocês',
  'pq': 'porque',
  'tb': 'também',
  'tbm': 'também',
  'td': 'tudo',
  'hj': 'hoje',
  'msg': 'mensagem',
  'msn': 'mensagem',
  'qdo': 'quando',
  'qnd': 'quando',
  'oq': 'o que',
  'oque': 'o que',
  'pra': 'para',
  'pro': 'para o',
  'ta': 'está',
  'tao': 'estão',
  'to': 'estou',
  'tou': 'estou',
  // Novas palavras adicionadas
  'minimo': 'mínimo',
  'maximo': 'máximo',
  'atencao': 'atenção',
  'atencoes': 'atenções',
  'agencia': 'agência',
  'agencias': 'agências',
  'contato': 'contato',
  'contatos': 'contatos',
  'cadastro': 'cadastro',
  'cadastros': 'cadastros',
  'registro': 'registro',
  'registros': 'registros',
  'cliente': 'cliente',
  'clientes': 'clientes',
  'pedido': 'pedido',
  'pedidos': 'pedidos',
  'produto': 'produto',
  'produtos': 'produtos',
  'empresa': 'empresa',
  'empresas': 'empresas',
  'usuario': 'usuário',
  'usuarios': 'usuários',
  'senha': 'senha',
  'acesso': 'acesso',
  'sistema': 'sistema',
  'sistemas': 'sistemas',
  'aplicacao': 'aplicação',
  'aplicacoes': 'aplicações',
  'configuracao': 'configuração',
  'configuracoes': 'configurações',
  'funcao': 'função',
  'funcoes': 'funções',
  'opcao': 'opção',
  'opcoes': 'opções',
  'secao': 'seção',
  'secoes': 'seções',
  'sessao': 'sessão',
  'sessaes': 'sessões',
  'versao': 'versão',
  'versoes': 'versões',
  'licenca': 'licença',
  'licencas': 'licenças',
  'renovacao': 'renovação',
  'renovacoes': 'renovações',
  'cancelamento': 'cancelamento',
  'cancelamentos': 'cancelamentos',
  'ativacao': 'ativação',
  'ativacoes': 'ativações',
  'instalacao': 'instalação',
  'instalacoes': 'instalações',
  'atualizacao': 'atualização',
  'atualizacoes': 'atualizações',
  'correcao': 'correção',
  'correcoes': 'correções',
  'manutencao': 'manutenção',
  'manutencoes': 'manutenções',
  'suporte': 'suporte',
  'ajuda': 'ajuda',
  'tutorial': 'tutorial',
  'tutoriais': 'tutoriais',
  'documentacao': 'documentação',
  'especificacao': 'especificação',
  'especificacoes': 'especificações',
  'cotacao': 'cotação',
  'cotacoes': 'cotações',
  'orcamento': 'orçamento',
  'orcamentos': 'orçamentos',
  'faturamento': 'faturamento',
  'faturamentos': 'faturamentos',
  'pagamentos': 'pagamentos',
  'recebimento': 'recebimento',
  'recebimentos': 'recebimentos',
  'vencimento': 'vencimento',
  'vencimentos': 'vencimentos',
  'vencida': 'vencida',
  'vencidas': 'vencidas',
  'vencido': 'vencido',
  'vencidos': 'vencidos',
  'atraso': 'atraso',
  'atrasos': 'atrasos',
  'atrasada': 'atrasada',
  'atrasadas': 'atrasadas',
  'atrasado': 'atrasado',
  'atrasados': 'atrasados',
  'pendencia': 'pendência',
  'pendencias': 'pendências',
  'urgente': 'urgente',
  'urgentes': 'urgentes',
  'prioridade': 'prioridade',
  'prioridades': 'prioridades',
  'importancia': 'importância',
  'importancias': 'importâncias',
  'relevancia': 'relevância',
  'relevancias': 'relevâncias',
  'referencia': 'referência',
  'referencias': 'referências',
  'preferencia': 'preferência',
  'preferencias': 'preferências',
  'diferenca': 'diferença',
  'diferencas': 'diferenças',
  'sequencia': 'sequência',
  'sequencias': 'sequências',
  'frequencia': 'frequência',
  'frequencias': 'frequências',
  'consequencia': 'consequência',
  'consequencias': 'consequências',
  'presenca': 'presença',
  'presencas': 'presenças',
  'ausencia': 'ausência',
  'ausencias': 'ausências',
  'existencia': 'existência',
  'existencias': 'existências',
  'experiencia': 'experiência',
  'experiencias': 'experiências',
  'consciencia': 'consciência',
  'consciencias': 'consciências',
  'ciencia': 'ciência',
  'ciencias': 'ciências',
  'conveniencia': 'conveniência',
  'conveniencias': 'conveniências',
  'excelencia': 'excelência',
  'excelencias': 'excelências',
  'innocencia': 'inocência',
  'innocencias': 'inocências',
  'potencia': 'potência',
  'potencias': 'potências',
  'latencia': 'latência',
  'latencias': 'latências',
  'transparencia': 'transparência',
  'transparencias': 'transparências',
  'violencia': 'violência',
  'violencias': 'violências',
  'eficiencia': 'eficiência',
  'eficiencias': 'eficiências',
  'suficiencia': 'suficiência',
  'suficiencias': 'suficiências',
  'proficiencia': 'proficiência',
  'proficiencias': 'proficiências',
  'coerencia': 'coerência',
  'coerencias': 'coerências',
  'incoerencia': 'incoerência',
  'incoerencias': 'incoerências',
  'adherencia': 'aderência',
  'adherencias': 'aderências',
  'coherencia': 'coerência',
  'coherencias': 'coerências',
  'incoherencia': 'incoerência',
  'incoherencias': 'incoerências',
  'heresia': 'heresia',
  'heresias': 'heresias',
  'admissao': 'admissão',
  'admissaes': 'admissões',
  'comissao': 'comissão',
  'comissaes': 'comissões',
  'demissao': 'demissão',
  'demissaes': 'demissões',
  'discussao': 'discussão',
  'discussaes': 'discussões',
  'expressao': 'expressão',
  'expressaes': 'expressões',
  'impressao': 'impressão',
  'impressaes': 'impressões',
  'opressao': 'opressão',
  'opressaes': 'opressões',
  'repressao': 'repressão',
  'repressaes': 'repressões',
  'supressao': 'supressão',
  'supressaes': 'supressões',
  'compressao': 'compressão',
  'compressaes': 'compressões',
  'depressao': 'depressão',
  'depressaes': 'depressões',
  'profissao': 'profissão',
  'profissaes': 'profissões',
  'permissao': 'permissão',
  'permissaes': 'permissões',
  'transmissao': 'transmissão',
  'transmissaes': 'transmissões',
  'obsessao': 'obsessão',
  'obsessaes': 'obsessões',
  'posse': 'posse',
  'posses': 'posses',
  'possessao': 'posse',
  'possessaes': 'posses',
  'cessao': 'cessão',
  'cessaes': 'cessões',
  'concessao': 'concessão',
  'concessaes': 'concessões',
  'processao': 'processão',
  'processaes': 'processões',
  'sucessao': 'sucessão',
  'sucessaes': 'sucessões',
  'recessao': 'recessão',
  'recessaes': 'recessões',
  'secessao': 'secessão',
  'secessaes': 'secessões',
  'conexao': 'conexão',
  'conexaes': 'conexões',
  'direcao': 'direção',
  'direcaes': 'direções',
  'eleicao': 'eleição',
  'eleicaes': 'eleições',
  'selecao': 'seleção',
  'selecaes': 'seleções',
  'infeccao': 'infecção',
  'infeccaes': 'infecções',
  'confeccao': 'confecção',
  'confeccaes': 'confecções',
  'construcao': 'construção',
  'construcaes': 'construções',
  'producao': 'produção',
  'producaes': 'produções',
  'reducao': 'redução',
  'reducaes': 'reduções',
  'introducao': 'introdução',
  'introducaes': 'introduções',
  'educacao': 'educação',
  'educacoes': 'educações',
  'traducao': 'tradução',
  'traducoes': 'traduções',
  'formacao': 'formação',
  'formacoes': 'formações',
  'informacao': 'informação',
  'informacoes': 'informações',
  'transformacao': 'transformação',
  'transformacoes': 'transformações',
  'conformacao': 'conformação',
  'conformacoes': 'conformações',
  'deformacao': 'deformação',
  'deformacoes': 'deformações',
  'reformacao': 'reformação',
  'reformacoes': 'reformações',
  'uniforme': 'uniforme',
  'uniformes': 'uniformes',
  'conforme': 'conforme',
  'conformes': 'conformes',
  'deforme': 'deforme',
  'deformes': 'deformes',
  'reforme': 'reforme',
  'reformes': 'reformes',
  'informe': 'informe',
  'informes': 'informes',
  'plataforma': 'plataforma',
  'plataformas': 'plataformas',
  'programa': 'programa',
  'programas': 'programas',
  'sistema': 'sistema',
  'sistemas': 'sistemas',
  // Termos corporativos e de atendimento com acentuação frequente
  'negocio': 'negócio',
  'negocios': 'negócios',
  'proposito': 'propósito',
  'propositos': 'propósitos',
  'publico': 'público',
  'publicos': 'públicos',
  'politica': 'política',
  'politicas': 'políticas',
  'logistica': 'logística',
  'logisticas': 'logísticas',
  'financeiro': 'financeiro',
  'financeiros': 'financeiros',
  'financeira': 'financeira',
  'financeiras': 'financeiras',
  'comunicacao': 'comunicação',
  'comunicacoes': 'comunicações',
  'apresentacao': 'apresentação',
  'apresentacoes': 'apresentações',
  'operacao': 'operação',
  'operacoes': 'operações',
  'transacao': 'transação',
  'transacoes': 'transações',
  'condicao': 'condição',
  'condicoes': 'condições',
  'solicitacao': 'solicitação',
  'solicitacoes': 'solicitações',
  'autorizacao': 'autorização',
  'autorizacoes': 'autorizações',
  'avaliacao': 'avaliação',
  'avaliacoes': 'avaliações',
  'relacao': 'relação',
  'relacoes': 'relações',
  'producao': 'produção',
  'producoes': 'produções',
  'redundancia': 'redundância',
  'redundancias': 'redundâncias',
  'experiencia': 'experiência',
  'experiencias': 'experiências',
  'aproveitamento': 'aproveitamento',
  'infraestrutura': 'infraestrutura',
  'transmissao': 'transmissão',
  'transmissaes': 'transmissões',
  'organizacao': 'organização',
  'organizacoes': 'organizações',
  'departamento': 'departamento',
  'departamentos': 'departamentos'
};

// Função para autocorrigir texto (chamada quando usuário digita espaço)
export const autoCorrectText = (text) => {
  if (!text) return text;
  
  const words = text.split(/(\s+)/); // Mantém os espaços
  let corrected = false;
  
  const correctedWords = words.map(word => {
    // Pula espaços
    if (/^\s+$/.test(word)) return word;
    
    const lower = word.toLowerCase();
    // Remove pontuação para verificar
    const cleanWord = lower.replace(/[.,!?;:]+$/, '');
    const punctuation = lower.slice(cleanWord.length);
    
    if (ACCENT_MAP[cleanWord]) {
      corrected = true;
      // Mantém capitalização se a palavra original era capitalizada
      let correction = ACCENT_MAP[cleanWord];
      if (word[0] === word[0].toUpperCase()) {
        correction = correction.charAt(0).toUpperCase() + correction.slice(1);
      }
      return correction + punctuation;
    }
    return word;
  });
  
  return correctedWords.join('');
};

// Função para encontrar palavras erradas no texto (para sublinhado vermelho)
// Usa o dicionário completo do Typo.js quando disponível
export const findMisspelledWords = (text) => {
  if (!text) return [];
  
  const misspelled = [];
  // Regex para encontrar palavras com suas posições
  const wordRegex = /[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+/g;
  let match;
  
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;
    
    // Ignora palavras muito curtas
    if (word.length < 2) continue;
    
    const lower = word.toLowerCase();
    
    // Ignora palavras especiais (URLs, emails, variáveis, comandos)
    if (/\d/.test(word)) continue;
    if (word.includes('@')) continue;
    if (word.startsWith('{') || word.startsWith('/')) continue;
    
    // Se o dicionário completo está carregado, usa ele
    if (typoInstance) {
      if (typoInstance.check(word)) continue;
      
      // Palavra errada - buscar sugestões do Typo.js
      const suggestions = typoInstance.suggest(word).slice(0, 5);
      misspelled.push({ word, start, end, suggestions });
      continue;
    }
    
    // Fallback: usar dicionário básico
    // Verifica se está no dicionário básico
    if (BASIC_PT_BR_WORDS.has(lower)) continue;
    
    // Verifica se precisa de correção de acento
    if (ACCENT_MAP[lower]) {
      const suggestions = [ACCENT_MAP[lower]];
      misspelled.push({ word, start, end, suggestions });
      continue;
    }
    
    // Verifica versão normalizada
    const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (BASIC_PT_BR_WORDS.has(normalized)) continue;
    
    // Palavra não encontrada - buscar sugestões no dicionário básico
    const suggestions = [];
    for (const dictWord of BASIC_PT_BR_WORDS) {
      if (suggestions.length >= 5) break;
      const normalizedDict = dictWord.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (Math.abs(normalizedDict.length - normalized.length) <= 2) {
        let diff = 0;
        const minLen = Math.min(normalizedDict.length, normalized.length);
        for (let i = 0; i < minLen; i++) {
          if (normalizedDict[i] !== normalized[i]) diff++;
        }
        diff += Math.abs(normalizedDict.length - normalized.length);
        if (diff <= 2 && diff > 0) {
          suggestions.push(dictWord);
        }
      }
    }
    
    misspelled.push({ word, start, end, suggestions });
  }
  
  return misspelled;
};

let dictionaryLoaded = false;

// Corretor ortográfico simplificado usando lista de palavras local
const simpleSpellChecker = {
  check: (word) => {
    if (!word || word.length < 2) return true;
    const lower = word.toLowerCase();
    // Palavra está no dicionário
    if (BASIC_PT_BR_WORDS.has(lower)) return true;
    // Palavra sem acento existe no mapa de acentos (é incorreta)
    if (ACCENT_MAP[lower]) return false;
    // Normaliza e verifica
    const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return BASIC_PT_BR_WORDS.has(normalized);
  },
  suggest: (word) => {
    if (!word || word.length < 2) return [];
    const lower = word.toLowerCase();
    const suggestions = [];
    
    // 1. Primeiro, verifica se existe no mapa de acentos (correção direta)
    if (ACCENT_MAP[lower]) {
      suggestions.push(ACCENT_MAP[lower]);
    }
    
    // 2. Busca palavras similares no dicionário
    const normalizedInput = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const dictWord of BASIC_PT_BR_WORDS) {
      if (suggestions.length >= 5) break;
      if (suggestions.includes(dictWord)) continue;
      
      const normalizedDict = dictWord.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Verifica similaridade
      if (Math.abs(normalizedDict.length - normalizedInput.length) <= 2) {
        let diff = 0;
        const minLen = Math.min(normalizedDict.length, normalizedInput.length);
        for (let i = 0; i < minLen; i++) {
          if (normalizedDict[i] !== normalizedInput[i]) diff++;
        }
        diff += Math.abs(normalizedDict.length - normalizedInput.length);
        if (diff <= 2 && diff > 0) {
          suggestions.push(dictWord);
        }
      }
    }
    
    return suggestions.slice(0, 5);
  }
};

const loadDictionary = (callback) => {
  // Usar corretor simplificado local (instantâneo, sem fetch)
  dictionaryLoaded = true;
  callback(simpleSpellChecker);
};

export const useSpellChecker = (enabled = true) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullDictLoaded, setIsFullDictLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const typoRef = useRef(simpleSpellChecker);

  useEffect(() => {
    if (!enabled) return;
    
    // Começa com o dicionário básico (instantâneo)
    typoRef.current = simpleSpellChecker;
    setIsLoaded(true);
    
    // Carrega o dicionário completo em background
    loadFullDictionary().then((fullTypo) => {
      if (fullTypo) {
        typoRef.current = fullTypo;
        setIsFullDictLoaded(true);
      }
    });
  }, [enabled]);

  const checkWord = useCallback((word) => {
    if (!typoRef.current || !word || word.length < 2) {
      return true;
    }

    // Ignorar palavras com números, URLs, emails, códigos
    if (/\d/.test(word)) return true;
    if (/^https?:\/\//.test(word)) return true;
    if (word.includes('@')) return true;
    if (word.startsWith('{') && word.includes('}')) return true; // Variáveis {nome}
    if (word.startsWith('/') && word.length > 1) return true; // Comandos /comando

    const cleanWord = word.replace(/[^\w\u00C0-\u017F]/g, '');
    if (cleanWord.length < 2) return true;

    return typoRef.current.check(cleanWord);
  }, []);

  const getSuggestions = useCallback((word) => {
    if (!typoRef.current || !word || word.length < 2) {
      return [];
    }

    const cleanWord = word.replace(/[^\w\u00C0-\u017F]/g, '');
    if (cleanWord.length < 2) return [];

    const sugs = typoRef.current.suggest(cleanWord);
    return sugs.slice(0, 5); // Máximo 5 sugestões
  }, []);

  const analyzeText = useCallback((text, cursorPos) => {
    if (!enabled || !isLoaded || !text) {
      setSuggestions([]);
      setCurrentWord('');
      return;
    }

    setCursorPosition(cursorPos);

    // Encontrar a palavra atual baseada na posição do cursor
    const textBeforeCursor = text.slice(0, cursorPos);
    const words = textBeforeCursor.split(/[\s\n]+/);
    const lastWord = words[words.length - 1];

    if (!lastWord || lastWord.length < 2) {
      setSuggestions([]);
      setCurrentWord('');
      return;
    }

    setCurrentWord(lastWord);

    const isCorrect = checkWord(lastWord);
    if (isCorrect) {
      setSuggestions([]);
    } else {
      const sugs = getSuggestions(lastWord);
      setSuggestions(sugs);
    }
  }, [enabled, isLoaded, checkWord, getSuggestions]);

  const replaceWord = useCallback((text, newWord, wordToReplace) => {
    const word = wordToReplace || currentWord;
    if (!word) return text;

    // Encontrar a última ocorrência da palavra antes do cursor
    const textBeforeCursor = text.slice(0, cursorPosition);
    const textAfterCursor = text.slice(cursorPosition);

    const lastIndex = textBeforeCursor.lastIndexOf(word);
    if (lastIndex === -1) return text;

    const newText = textBeforeCursor.slice(0, lastIndex) + newWord + textAfterCursor;
    return newText;
  }, [currentWord, cursorPosition]);

  return {
    isLoaded,
    isFullDictLoaded,
    suggestions,
    currentWord,
    checkWord,
    getSuggestions,
    analyzeText,
    replaceWord
  };
};

export default useSpellChecker;
