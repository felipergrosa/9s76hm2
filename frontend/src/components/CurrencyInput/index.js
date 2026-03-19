import React, { useState, useEffect, useCallback } from 'react';
import { InputBase } from '@material-ui/core';

// Componente de input com máscara automática de moeda R$
// Aceita apenas números e formata como R$ XX.XXX,XX automaticamente
const CurrencyInput = ({ 
  value, 
  onChange, 
  onBlur, 
  max,
  autoFocus = false,
  style = {},
  placeholder = 'R$ 0,00'
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [numericValue, setNumericValue] = useState(0);

  // Formata número para moeda brasileira
  const formatCurrency = useCallback((num) => {
    if (num === 0 || num === null || num === undefined || isNaN(num)) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }, []);

  // Extrai apenas números da string e converte para valor
  const parseInput = useCallback((input) => {
    const numbers = String(input).replace(/\D/g, '');
    if (!numbers) return 0;
    // Divide por 100 para considerar centavos
    return parseInt(numbers, 10) / 100;
  }, []);

  // Inicializa com o valor recebido
  useEffect(() => {
    const num = parseFloat(value) || 0;
    setNumericValue(num);
    setDisplayValue(formatCurrency(num));
  }, [value, formatCurrency]);

  const handleChange = (e) => {
    const rawInput = e.target.value;
    const numValue = parseInput(rawInput);
    
    // Aplica limite máximo se definido
    const finalValue = max && numValue > max ? max : numValue;
    
    setNumericValue(finalValue);
    setDisplayValue(formatCurrency(finalValue));
    
    if (onChange) {
      onChange(finalValue);
    }
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur(numericValue);
    }
  };

  const handleKeyDown = (e) => {
    // Enter confirma, Escape cancela
    if (e.key === 'Enter') {
      if (onBlur) {
        onBlur(numericValue);
      }
    } else if (e.key === 'Escape') {
      // Restaura valor original
      const originalNum = parseFloat(value) || 0;
      setNumericValue(originalNum);
      setDisplayValue(formatCurrency(originalNum));
      if (onBlur) {
        onBlur(originalNum);
      }
    }
  };

  return (
    <InputBase
      autoFocus={autoFocus}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={style}
      type="text"
      inputProps={{
        inputMode: 'numeric',
        autoComplete: 'off'
      }}
    />
  );
};

export default CurrencyInput;
