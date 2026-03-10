import { useState, useEffect, useRef, useCallback } from 'react';

const useTextSelection = (inputRef) => {
  const [selection, setSelection] = useState({
    text: '',
    start: 0,
    end: 0,
    isVisible: false
  });

  const updateSelection = useCallback(() => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selectedText = input.value.substring(start, end);
    
    setSelection({
      text: selectedText,
      start,
      end,
      isVisible: start !== end && selectedText.trim().length > 0
    });
  }, [inputRef]);

  const clearSelection = useCallback(() => {
    setSelection({
      text: '',
      start: 0,
      end: 0,
      isVisible: false
    });
  }, []);

  return {
    selection,
    updateSelection,
    clearSelection
  };
};

export default useTextSelection;
