import { useState, useCallback } from 'react';
import { autoCorrectText } from '../hooks/useSpellChecker';

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
    return autoCorrectText(text);
  }, [enabled]);
  
  const onChange = useCallback((e) => {
    let newValue = e.target ? e.target.value : e;
    
    // Se triggerOnChange está habilitado, corrige em tempo real
    if (triggerOnChange && enabled) {
      const lastChar = newValue.slice(-1);
      const triggerChars = [' ', '.', ',', ';', ':', '!', '?', '\n'];
      
      if (newValue.length > 1 && triggerChars.includes(lastChar)) {
        newValue = autoCorrectText(newValue);
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
        newValue = autoCorrectText(newValue);
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
      const corrected = autoCorrectText(fieldValue);
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
  return autoCorrectText(text);
};

export default useAutoCorrect;
