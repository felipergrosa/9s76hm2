import React, { useState, useRef, useEffect } from "react";
import { TextField } from "@material-ui/core";
import FormatToolbar from "../MessageInput/FormatToolbar";

/**
 * FormattedTextField - Componente reutilizável de campo de texto com:
 * - Toolbar de formatação (Negrito, Itálico, Tachado, Código, Listas, Citações)
 * - Corretor ortográfico automático
 * - Atalhos de teclado (Ctrl+B, Ctrl+I)
 * - Suporte a pt-BR
 * 
 * @param {Object} props - Propriedades do componente
 * @param {string} props.value - Valor do campo
 * @param {function} props.onChange - Callback quando o valor muda
 * @param {string} props.placeholder - Placeholder do campo
 * @param {number} props.rows - Número de linhas (padrão: 3)
 * @param {boolean} props.multiline - Se é multilinha (padrão: true)
 * @param {boolean} props.fullWidth - Se ocupa largura total (padrão: true)
 * @param {string} props.variant - Variante do TextField (padrão: "outlined")
 * @param {string} props.margin - Margem do TextField (padrão: "dense")
 * @param {string} props.size - Tamanho do TextField (padrão: "small")
 * @param {boolean} props.disabled - Se está desabilitado
 * @param {Object} props.inputProps - Props adicionais para o input
 * @param {string} props.id - ID do campo
 */
// Auto-correção básica inline (instantânea, sem carregar chunk)
const autoCorrectTextBasic = (text) => {
  if (!text) return text;
  const words = text.split(/(\s+)/);
  return words.map(word => {
    // Apenas espaços ou pontuação, retornar como está
    if (/^\s+$/.test(word) || /^[^\w\u00C0-\u017F]+$/.test(word)) {
      return word;
    }
    
    // Auto-correção básica para português
    const corrections = {
      'nao': 'não',
      'Nao': 'Não',
      'NAO': 'NÃO',
      'e': 'é',
      'E': 'É',
      'a': 'à',
      'A': 'À',
      'o': 'ó',
      'O': 'Ó',
      'assim': 'assim',
      'Assim': 'Assim',
      'mais': 'mais',
      'Mais': 'Mais',
      'pode': 'pode',
      'Pode': 'Pode',
      'ser': 'ser',
      'Ser': 'Ser',
      'que': 'que',
      'Que': 'Que',
      'para': 'para',
      'Para': 'Para',
      'com': 'com',
      'Com': 'Com',
      'uma': 'uma',
      'Uma': 'Uma',
      'tem': 'tem',
      'Tem': 'Tem',
      'muito': 'muito',
      'Muito': 'Muito',
      'bem': 'bem',
      'Bem': 'Bem',
      'tambem': 'também',
      'Tambem': 'Também',
      'TAMBEM': 'TAMBÉM',
      'ja': 'já',
      'Ja': 'Já',
      'JA': 'JÁ',
      'so': 'só',
      'So': 'Só',
      'SO': 'SÓ',
      'voce': 'você',
      'Voce': 'Você',
      'VOCE': 'VOCÊ',
      'esta': 'está',
      'Esta': 'Está',
      'ESTA': 'ESTÁ',
      'ate': 'até',
      'Ate': 'Até',
      'ATE': 'ATÉ',
      'pelo': 'pelo',
      'Pelo': 'Pelo',
      'PELO': 'PELO',
      'pela': 'pela',
      'Pela': 'Pela',
      'PELA': 'PELA',
      'dele': 'dele',
      'Dele': 'Dele',
      'DELE': 'DELE',
      'dela': 'dela',
      'Dela': 'Dela',
      'DELA': 'DELA',
      'neles': 'neles',
      'Neles': 'Neles',
      'NELES': 'NELES',
      'nelas': 'nelas',
      'Nelas': 'Nelas',
      'NELAS': 'NELAS',
      'aqui': 'aqui',
      'Aqui': 'Aqui',
      'AQUI': 'AQUI',
      'ali': 'ali',
      'Ali': 'Ali',
      'ALI': 'ALI',
      'la': 'lá',
      'La': 'Lá',
      'LA': 'LÁ',
      'aonde': 'aonde',
      'Aonde': 'Aonde',
      'AONDE': 'AONDE',
      'onde': 'onde',
      'Onde': 'Onde',
      'ONDE': 'ONDE',
      'quando': 'quando',
      'Quando': 'Quando',
      'QUANDO': 'QUANDO',
      'como': 'como',
      'Como': 'Como',
      'COMO': 'COMO',
      'porque': 'porque',
      'Porque': 'Porque',
      'PORQUE': 'PORQUE',
      'pois': 'pois',
      'Pois': 'Pois',
      'POIS': 'POIS',
      'portanto': 'portanto',
      'Portanto': 'Portanto',
      'PORTANTO': 'PORTANTO',
      'entao': 'então',
      'Entao': 'Então',
      'ENTAO': 'ENTÃO',
      'mas': 'mas',
      'Mas': 'Mas',
      'MAS': 'MAS',
      'porem': 'porém',
      'Porem': 'Porém',
      'POREM': 'PORÉM',
      'todavia': 'todavia',
      'Todavia': 'Todavia',
      'TODAVIA': 'TODAVIA',
      'contudo': 'contudo',
      'Contudo': 'Contudo',
      'CONTUDO': 'CONTUDO',
      'nenhum': 'nenhum',
      'Nenhum': 'Nenhum',
      'NENHUM': 'NENHUM',
      'nenhuma': 'nenhuma',
      'Nenhuma': 'Nenhuma',
      'NENHUMA': 'NENHUMA',
      'ninguem': 'ninguém',
      'Ninguem': 'Ninguém',
      'NINGUEM': 'NINGUÉM',
      'tudo': 'tudo',
      'Tudo': 'Tudo',
      'TUDO': 'TUDO',
      'nada': 'nada',
      'Nada': 'Nada',
      'NADA': 'NADA',
      'nunca': 'nunca',
      'Nunca': 'Nunca',
      'NUNCA': 'NUNCA',
      'jamais': 'jamais',
      'Jamais': 'Jamais',
      'JAMAIS': 'JAMAIS',
      'sempre': 'sempre',
      'Sempre': 'Sempre',
      'SEMPRE': 'SEMPRE',
      'vezes': 'vezes',
      'Vezes': 'Vezes',
      'VEZES': 'VEZES',
      'dia': 'dia',
      'Dia': 'Dia',
      'DIA': 'DIA',
      'dias': 'dias',
      'Dias': 'Dias',
      'DIAS': 'DIAS',
      'noite': 'noite',
      'Noite': 'Noite',
      'NOITE': 'NOITE',
      'noites': 'noites',
      'Noites': 'Noites',
      'NOITES': 'NOITES',
      'manha': 'manhã',
      'Manha': 'Manhã',
      'MANHA': 'MANHÃ',
      'manhas': 'manhãs',
      'Manhas': 'Manhãs',
      'MANHAS': 'MANHÃS',
      'tarde': 'tarde',
      'Tarde': 'Tarde',
      'TARDE': 'TARDE',
      'tardes': 'tardes',
      'Tardes': 'Tardes',
      'TARDES': 'TARDES',
      'hora': 'hora',
      'Hora': 'Hora',
      'HORA': 'HORA',
      'horas': 'horas',
      'Horas': 'Horas',
      'HORAS': 'HORAS',
      'ano': 'ano',
      'Ano': 'Ano',
      'ANO': 'ANO',
      'anos': 'anos',
      'Anos': 'Anos',
      'ANOS': 'ANOS',
      'mes': 'mês',
      'Mes': 'Mês',
      'MES': 'MÊS',
      'meses': 'meses',
      'Meses': 'Meses',
      'MESES': 'MESES',
      'semana': 'semana',
      'Semana': 'Semana',
      'SEMANA': 'SEMANA',
      'semanas': 'semanas',
      'Semanas': 'Semanas',
      'SEMANAS': 'SEMANAS',
      'mesmo': 'mesmo',
      'Mesmo': 'Mesmo',
      'MESMO': 'MESMO',
      'mesma': 'mesma',
      'Mesma': 'Mesma',
      'MESMA': 'MESMA',
      'mesmos': 'mesmos',
      'Mesmos': 'Mesmos',
      'MESMOS': 'MESMOS',
      'mesmas': 'mesmas',
      'Mesmas': 'Mesmas',
      'MESMAS': 'MESMAS',
      'outro': 'outro',
      'Outro': 'Outro',
      'OUTRO': 'OUTRO',
      'outra': 'outra',
      'Outra': 'Outra',
      'OUTRA': 'OUTRA',
      'outros': 'outros',
      'Outros': 'Outros',
      'OUTROS': 'OUTROS',
      'outras': 'outras',
      'Outras': 'Outras',
      'OUTRAS': 'OUTRAS',
      'qual': 'qual',
      'Qual': 'Qual',
      'QUAL': 'QUAL',
      'qualquer': 'qualquer',
      'Qualquer': 'Qualquer',
      'QUALQUER': 'QUALQUER',
      'quais': 'quais',
      'Quais': 'Quais',
      'QUAIS': 'QUAIS',
      'cada': 'cada',
      'Cada': 'Cada',
      'CADA': 'CADA',
      'todos': 'todos',
      'Todos': 'Todos',
      'TODOS': 'TODOS',
      'todas': 'todas',
      'Todas': 'Todas',
      'TODAS': 'TODAS',
      'ambos': 'ambos',
      'Ambos': 'Ambos',
      'AMBOS': 'AMBOS',
      'ambas': 'ambas',
      'Ambas': 'Ambas',
      'AMBAS': 'AMBAS',
      'primeiro': 'primeiro',
      'Primeiro': 'Primeiro',
      'PRIMEIRO': 'PRIMEIRO',
      'primeira': 'primeira',
      'Primeira': 'Primeira',
      'PRIMEIRA': 'PRIMEIRA',
      'ultimos': 'últimos',
      'Ultimos': 'Últimos',
      'ULTIMOS': 'ÚLTIMOS',
      'ultimas': 'últimas',
      'Ultimas': 'Últimas',
      'ULTIMAS': 'ÚLTIMAS',
      'proximo': 'próximo',
      'Proximo': 'Próximo',
      'PROXIMO': 'PRÓXIMO',
      'proxima': 'próxima',
      'Proxima': 'Próxima',
      'PROXIMA': 'PRÓXIMA',
      'ultimo': 'último',
      'Ultimo': 'Último',
      'ULTIMO': 'ÚLTIMO',
      'ultima': 'última',
      'Ultima': 'Última',
      'ULTIMA': 'ÚLTIMA',
      'bom': 'bom',
      'Bom': 'Bom',
      'BOM': 'BOM',
      'boa': 'boa',
      'Boa': 'Boa',
      'BOA': 'BOA',
      'bons': 'bons',
      'Bons': 'Bons',
      'BONS': 'BONS',
      'boas': 'boas',
      'Boas': 'Boas',
      'BOAS': 'BOAS',
      'otimo': 'ótimo',
      'Otimo': 'Ótimo',
      'OTIMO': 'ÓTIMO',
      'otima': 'ótima',
      'Otima': 'Ótima',
      'OTIMA': 'ÓTIMA',
      'otimos': 'ótimos',
      'Otimos': 'Ótimos',
      'OTIMOS': 'ÓTIMOS',
      'otimas': 'ótimas',
      'Otimas': 'Ótimas',
      'OTIMAS': 'ÓTIMAS',
      'ruim': 'ruim',
      'Ruim': 'Ruim',
      'RUIM': 'RUIM',
      'ruins': 'ruins',
      'Ruins': 'Ruins',
      'RUINS': 'RUINS',
      'grande': 'grande',
      'Grande': 'Grande',
      'GRANDE': 'GRANDE',
      'grandes': 'grandes',
      'Grandes': 'Grandes',
      'GRANDES': 'GRANDES',
      'pequeno': 'pequeno',
      'Pequeno': 'Pequeno',
      'PEQUENO': 'PEQUENO',
      'pequena': 'pequena',
      'Pequena': 'Pequena',
      'PEQUENA': 'PEQUENA',
      'pequenos': 'pequenos',
      'Pequenos': 'Pequenos',
      'PEQUENOS': 'PEQUENOS',
      'pequenas': 'pequenas',
      'Pequenas': 'Pequenas',
      'PEQUENAS': 'PEQUENAS',
      'longe': 'longe',
      'Longe': 'Longe',
      'LONGE': 'LONGE',
      'perto': 'perto',
      'Perto': 'Perto',
      'PERTO': 'PERTO',
      'aqui': 'aqui',
      'Aqui': 'Aqui',
      'AQUI': 'AQUI',
      'acola': 'acolá',
      'Acola': 'Acolá',
      'ACOLA': 'ACOLÁ',
      'la': 'lá',
      'La': 'Lá',
      'LA': 'LÁ',
      'ali': 'ali',
      'Ali': 'Ali',
      'ALI': 'ALI',
      'aqui': 'aqui',
      'Aqui': 'Aqui',
      'AQUI': 'AQUI',
      'acola': 'acolá',
      'Acola': 'Acolá',
      'ACOLA': 'ACOLÁ',
      'la': 'lá',
      'La': 'Lá',
      'LA': 'LÁ',
      'ali': 'ali',
      'Ali': 'Ali',
      'ALI': 'ALI',
      'aqui': 'aqui',
      'Aqui': 'Aqui',
      'AQUI': 'AQUI',
      'acola': 'acolá',
      'Acola': 'Acolá',
      'ACOLA': 'ACOLÁ',
      'la': 'lá',
      'La': 'Lá',
      'LA': 'LÁ',
      'ali': 'ali',
      'Ali': 'Ali',
      'ALI': 'ALI',
    };
    
    return corrections[word] || word;
  }).join('');
};

const FormattedTextField = ({
  value = "",
  onChange,
  placeholder = "Digite sua mensagem...",
  rows = 3,
  multiline = true,
  fullWidth = true,
  variant = "outlined",
  margin = "dense",
  size = "small",
  disabled = false,
  inputProps = {},
  id,
  ...otherProps
}) => {
  const [formatToolbar, setFormatToolbar] = useState({ 
    visible: false, 
    position: { x: 0, y: 0 } 
  });
  const [textSelection, setTextSelection] = useState({ 
    start: 0, 
    end: 0, 
    text: '' 
  });
  const inputRef = useRef(null);

  const handleTextSelection = () => {
    if (!inputRef.current || disabled) return;

    const start = inputRef.current.selectionStart;
    const end = inputRef.current.selectionEnd;
    const selectedText = inputRef.current.value.substring(start, end);

    if (selectedText.length > 0) {
      try {
        // Tentar obter retângulo da seleção usando getRangeAt
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectionRect = range.getBoundingClientRect();
          
          // Se tivermos uma seleção válida, usar coordenadas exatas
          if (selectionRect && selectionRect.width > 0) {
            let toolbarX = selectionRect.left + selectionRect.width / 2;
            let toolbarY = selectionRect.top - 10;
            
            // Ajustar horizontalmente para não cortar nas laterais
            const toolbarWidth = 200; // largura aproximada do toolbar
            const viewportWidth = window.innerWidth;
            if (toolbarX < toolbarWidth / 2 + 10) {
              toolbarX = toolbarWidth / 2 + 10;
            }
            if (toolbarX > viewportWidth - toolbarWidth / 2 - 10) {
              toolbarX = viewportWidth - toolbarWidth / 2 - 10;
            }
            
            // Ajustar se o toolbar ficar acima do topo da tela
            const toolbarHeight = 40; // altura aproximada do toolbar
            if (toolbarY < toolbarHeight + 10) {
              // Mostrar abaixo do texto se não tiver espaço acima
              toolbarY = selectionRect.bottom + 10;
            }
            
            setTextSelection({ start, end, text: selectedText });
            setFormatToolbar({
              visible: true,
              position: {
                x: toolbarX,
                y: toolbarY
              }
            });
            return;
          }
        }
        
        // Fallback: calcular posição aproximada
        const inputRect = inputRef.current.getBoundingClientRect();
        const charWidth = 8; // largura aproximada de um caractere
        const lineHeight = 24; // altura aproximada da linha
        
        // Calcular posição aproximada do cursor
        const cursorX = inputRect.left + 10 + (start * charWidth);
        const cursorY = inputRect.top + (start > 0 ? lineHeight : 0);
        
        const fallbackX = cursorX;
        let fallbackY = cursorY - 10;
        
        // Ajustar se o toolbar ficar acima do topo da tela
        const toolbarHeight = 40;
        if (fallbackY < toolbarHeight + 10) {
          fallbackY = cursorY + 30; // Mostrar abaixo
        }
        
        setTextSelection({ start, end, text: selectedText });
        setFormatToolbar({
          visible: true,
          position: {
            x: fallbackX,
            y: fallbackY
          }
        });
      } catch (error) {
        console.error("Erro ao obter seleção:", error);
        // Fallback final: mostrar toolbar acima do input
        const inputRect = inputRef.current.getBoundingClientRect();
        const finalX = inputRect.left + inputRect.width / 2;
        let finalY = inputRect.top - 10;
        
        // Ajustar se o toolbar ficar acima do topo da tela
        const toolbarHeight = 40;
        if (finalY < toolbarHeight + 10) {
          finalY = inputRect.bottom + 10; // Mostrar abaixo do input
        }
        
        setTextSelection({ start, end, text: selectedText });
        setFormatToolbar({
          visible: true,
          position: {
            x: finalX,
            y: finalY
          }
        });
      }
    } else {
      setFormatToolbar({ visible: false, position: { x: 0, y: 0 } });
    }
  };

  const handleApplyFormat = (newText, newStart, newEnd) => {
    if (onChange) {
      onChange({ target: { value: newText } });
    }
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newStart, newEnd);
      }
    }, 0);
  };

  const handleCloseFormatToolbar = () => {
    setFormatToolbar({ visible: false, position: { x: 0, y: 0 } });
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    // Atalhos de teclado
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      handleTextSelection();
    }
  };

  const handleChange = (e) => {
    if (disabled) return;
    
    let newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    // Auto-correção básica quando usuário digita espaços ou pontuação
    const lastChar = newValue.slice(-1);
    const triggerChars = [' ', '.', ',', ';', ':', '!', '?', '\n'];
    
    if (newValue.length > 1 && triggerChars.includes(lastChar)) {
      const originalLength = newValue.length;
      const correctedText = autoCorrectTextBasic(newValue);
      if (correctedText !== newValue) {
        newValue = correctedText;
        // Ajustar posição do cursor se o texto foi corrigido
        const newCursorPos = cursorPos + (correctedText.length - originalLength);
        
        // Chamar onChange com o texto corrigido
        if (onChange) {
          onChange({ target: { value: newValue } });
        }
        
        // Ajustar cursor após a atualização
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
        return;
      }
    }
    
    if (onChange) {
      onChange(e);
    }
  };

  // Fechar toolbar quando o componente é desmontado
  useEffect(() => {
    return () => {
      setFormatToolbar({ visible: false, position: { x: 0, y: 0 } });
    };
  }, []);

  return (
    <>
      <TextField
        id={id}
        fullWidth={fullWidth}
        multiline={multiline}
        rows={rows}
        variant={variant}
        margin={margin}
        size={size}
        value={value}
        onChange={handleChange}
        onSelect={handleTextSelection}
        onMouseUp={handleTextSelection}
        onMouseDown={handleTextSelection}
        onDoubleClick={handleTextSelection}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        inputRef={inputRef}
        inputProps={{
          spellCheck: 'true',
          autoComplete: 'on',
          autoCorrect: 'on',
          autoCapitalize: 'sentences',
          lang: 'pt-BR',
          style: {
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.5'
          },
          ...inputProps
        }}
        {...otherProps}
      />

      {/* Toolbar de Formatação */}
      <FormatToolbar
        visible={formatToolbar.visible}
        position={formatToolbar.position}
        onClose={handleCloseFormatToolbar}
        onFormat={handleApplyFormat}
        inputRef={inputRef}
        selection={textSelection}
      />
    </>
  );
};

export default FormattedTextField;
