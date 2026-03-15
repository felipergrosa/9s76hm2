import { useState, useCallback } from 'react';
// OTIMIZAÇÃO: ACCENT_MAP básico inline para evitar chunk de 22s
// import { autoCorrectText } from '../hooks/useSpellChecker';
const ACCENT_MAP_BASIC = {
  'nao': 'não', 'sim': 'sim', 'esta': 'está', 'tambem': 'também', 'ja': 'já',
  'voce': 'você', 'voces': 'vocês', 'nos': 'nós', 'sao': 'são', 'entao': 'então',
  'ate': 'até', 'apos': 'após', 'so': 'só', 'mae': 'mãe', 'mes': 'mês',
  'pais': 'país', 'numero': 'número', 'informacao': 'informação', 'solucao': 'solução',
  'duvida': 'dúvida', 'endereco': 'endereço', 'servico': 'serviço', 'preco': 'preço',
  'proximo': 'próximo', 'ultimo': 'último', 'necessario': 'necessário', 'possivel': 'possível',
  'amanha': 'amanhã', 'ola': 'olá', 'vc': 'você', 'vcs': 'vocês', 'pq': 'porque',
  'tb': 'também', 'tbm': 'também', 'td': 'tudo', 'hj': 'hoje', 'msg': 'mensagem',
};
const autoCorrectTextBasic = (text) => {
  if (!text) return text;
  const words = text.split(/(\s+)/);
  return words.map(word => {
    if (/^\s+$/.test(word)) return word;
    const lower = word.toLowerCase();
    const cleanWord = lower.replace(/[.,!?;:]+$/, '');
    const punctuation = lower.slice(cleanWord.length);
    if (ACCENT_MAP_BASIC[cleanWord]) {
      let correction = ACCENT_MAP_BASIC[cleanWord];
      if (word[0] === word[0].toUpperCase()) {
        correction = correction.charAt(0).toUpperCase() + correction.slice(1);
      }
      return correction + punctuation;
    }
    return word;
  }).join('');
};

/**
 * Hook para aplicar correção automática de acentuação em inputs
 * 
 * Uso:
 * const { value, onChange, onBlur } = useAutoCorrect(initialValue);
 * 
 * <TextField value={value} onChange={onChange} onBlur={onBlur} />
 */
export const useAutoCorrect = (initialValue = '', options = {}) => {
  const { 
    enabled = true, 
    triggerOnBlur = true,
    triggerOnChange = false 
  } = options;
  
  const [value, setValue] = useState(initialValue);
  
  const applyCorrection = useCallback((text) => {
    if (!enabled || !text) return text;
    return autoCorrectTextBasic(text);
  }, [enabled]);
  
  const onChange = useCallback((e) => {
    let newValue = e.target ? e.target.value : e;
    
    // Se triggerOnChange está habilitado, corrige em tempo real
    if (triggerOnChange && enabled) {
      const lastChar = newValue.slice(-1);
      const triggerChars = [' ', '.', ',', ';', ':', '!', '?', '\n'];
      
      if (newValue.length > 1 && triggerChars.includes(lastChar)) {
        newValue = autoCorrectTextBasic(newValue);
      }
    }
    
    setValue(newValue);
  }, [enabled, triggerOnChange]);
  
  const onBlur = useCallback(() => {
    if (triggerOnBlur && enabled) {
      setValue(prev => applyCorrection(prev));
    }
  }, [applyCorrection, triggerOnBlur, enabled]);
  
  const setCorrectedValue = useCallback((newValue) => {
    setValue(applyCorrection(newValue));
  }, [applyCorrection]);
  
  return {
    value,
    setValue,
    setCorrectedValue,
    onChange,
    onBlur,
    applyCorrection
  };
};

/**
 * Wrapper para usar com Formik
 * 
 * Uso:
 * const autoCorrect = useAutoCorrectFormik(field.value, field.onChange);
 * 
 * <TextField {...autoCorrect} />
 */
export const useAutoCorrectFormik = (fieldValue, fieldOnChange, options = {}) => {
  const { enabled = true } = options;
  
  const handleChange = useCallback((e) => {
    let newValue = e.target.value;
    
    if (enabled) {
      const lastChar = newValue.slice(-1);
      const triggerChars = [' ', '.', ',', ';', ':', '!', '?', '\n'];
      
      if (newValue.length > 1 && triggerChars.includes(lastChar)) {
        newValue = autoCorrectTextBasic(newValue);
      }
    }
    
    // Chama o onChange original do Formik
    fieldOnChange({
      target: {
        name: e.target.name,
        value: newValue
      }
    });
  }, [enabled, fieldOnChange]);
  
  const handleBlur = useCallback((e) => {
    if (enabled) {
      const corrected = autoCorrectTextBasic(fieldValue);
      if (corrected !== fieldValue) {
        fieldOnChange({
          target: {
            name: e.target.name,
            value: corrected
          }
        });
      }
    }
  }, [enabled, fieldValue, fieldOnChange]);
  
  return {
    value: fieldValue,
    onChange: handleChange,
    onBlur: handleBlur
  };
};

/**
 * Função utilitária para corrigir texto diretamente
 */
export const correctText = (text) => {
  return autoCorrectTextBasic(text);
};

export default useAutoCorrect;
