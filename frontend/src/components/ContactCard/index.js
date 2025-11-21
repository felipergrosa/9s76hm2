import React, { memo, useRef, useCallback, useState } from "react";
import { Unlock, CheckCircle, Ban } from "lucide-react";
import { WhatsApp, Edit as EditIcon, DeleteOutline as DeleteOutlineIcon, Lock as LockIcon } from "@material-ui/icons";
import { Tooltip, IconButton } from "@material-ui/core";
import LazyContactAvatar from "../LazyContactAvatar";

// Componente de card de contato para versão mobile, memoizado para evitar re-renders
const ContactCard = memo(({ 
  contact,
  onEdit,
  onSendMessage,
  onDelete,
  onBlock,
  onUnblock,
  formatPhoneNumber,
  CustomTooltipProps,
  // Seleção mobile
  isSelectionMode = false,
  onLongPressStart,
  onDragSelect,
  onLongPressEnd,
  onTapWhileSelection,
  isSelected = false,
}) => {
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  const clearTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e) => {
    longPressTriggeredRef.current = false;
    setPressing(true);
    clearTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (onLongPressStart) onLongPressStart(contact.id);
    }, 500);
  }, [clearTimer, onLongPressStart, contact?.id]);

  const handleTouchMove = useCallback((e) => {
    if (!isSelectionMode && !longPressTriggeredRef.current) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const wrapper = el.closest && el.closest('[data-contact-id]');
    const id = wrapper && wrapper.getAttribute && wrapper.getAttribute('data-contact-id');
    if (id && onDragSelect) onDragSelect(Number(id));
  }, [isSelectionMode, onDragSelect]);

  const handleTouchEnd = useCallback(() => {
    clearTimer();
    setPressing(false);
    if (longPressTriggeredRef.current) {
      if (onLongPressEnd) onLongPressEnd();
    } else if (isSelectionMode && onTapWhileSelection) {
      // Toque simples durante modo seleção: alterna seleção
      onTapWhileSelection(contact.id);
    }
  }, [clearTimer, onLongPressEnd]);

  const cardClasses = `w-full bg-white dark:bg-gray-800 shadow rounded-lg p-3 flex flex-col gap-3 ${
    isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900' : ''
  } ${pressing ? 'scale-[0.99] transition-transform' : ''}`;

  return (
    <div
      className={cardClasses}
      data-contact-id={contact.id}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 overflow-hidden flex-shrink-0">
          <LazyContactAvatar 
            contact={contact}
            style={{ width: "32px", height: "32px" }}
            className="rounded-full object-cover"
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate" title={contact.name}>
            {contact.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={contact.email}>
            {contact.email}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0 whitespace-nowrap">
          <span className="flex-1 min-w-0 truncate text-xs text-gray-600 dark:text-gray-300">{formatPhoneNumber(contact.number)}</span>
          {!!contact.isWhatsappValid ? (
            <Tooltip {...CustomTooltipProps} title="WhatsApp válido">
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" strokeWidth={2.5} />
              </div>
            </Tooltip>
          ) : (
            <Tooltip {...CustomTooltipProps} title="WhatsApp inválido">
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 p-0.5">
                <Ban className="w-3.5 h-3.5 text-red-600 dark:text-red-400" strokeWidth={2.5} />
              </div>
            </Tooltip>
          )}
        </div>
        
        {/* Tags */}
        <div className="flex justify-end gap-1">
          {(() => {
            // Normaliza as tags para lidar com diferentes formatos da API
            const normalizeTags = (raw) => {
              try {
                let arr = [];
                if (Array.isArray(raw)) {
                  arr = raw;
                } else if (Array.isArray(raw?.tags)) {
                  arr = raw.tags;
                } else if (Array.isArray(raw?.tags?.rows)) {
                  arr = raw.tags.rows;
                } else if (Array.isArray(raw?.rows)) {
                  arr = raw.rows;
                }
                
                if (!arr || arr.length === 0) return [];
                
                return arr.map((t, idx) => {
                  if (!t || typeof t !== 'object') return null;
                  
                  const obj = t;
                  const nested = obj.tag || obj.Tag || obj.Tags || {};
                  
                  const name = obj.name || nested.name || obj.label;
                  if (!name) return null;
                  
                  const color = obj.color || nested.color || obj.hex || '#9CA3AF';
                  
                  // PRIORIDADE: tagId > id > nested.id > idx
                  let id;
                  if (obj.tagId !== undefined && obj.tagId !== null) {
                    id = obj.tagId;
                  } else if (obj.id !== undefined && obj.id !== null) {
                    id = obj.id;
                  } else if (nested.id !== undefined && nested.id !== null) {
                    id = nested.id;
                  } else {
                    id = `tag-${contact.id}-${idx}`;
                  }
                  
                  return { id, name, color };
                }).filter(Boolean);
              } catch (error) {
                return [];
              }
            };
            
            // Função para calcular luminosidade relativa e determinar cor do texto
            const getTextColor = (backgroundColor) => {
              if (!backgroundColor) return '#000000';
              
              // Remove # se existir
              let hex = backgroundColor.replace('#', '');
              
              // Converte hex de 3 dígitos para 6
              if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
              }
              
              // Converte para RGB
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              
              // Calcula luminosidade relativa (fórmula WCAG)
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              
              // Se a cor for clara (luminosidade > 0.5), usa texto preto, senão branco
              return luminance > 0.5 ? '#000000' : '#FFFFFF';
            };

            const rawTags = contact.tags || contact.contactTags || [];
            const tags = normalizeTags(rawTags);
            
            if (!tags || tags.length === 0) {
              return null;
            }
            
            return (
              <>
                {tags.slice(0, 3).map((tag, tagIdx) => {
                  const key = `contact-${contact.id}-tag-${tag.id}-${tagIdx}`;
                  const tagColor = tag.color || '#9CA3AF';
                  const textColor = getTextColor(tagColor);
                  
                  return (
                    <Tooltip {...CustomTooltipProps} title={tag.name} key={key}>
                      <div
                        className="inline-flex items-center px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ 
                          backgroundColor: tagColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          border: `2px solid ${tagColor}`,
                          borderRadius: '9999px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        <span
                          className="text-xs font-semibold truncate"
                          style={{ 
                            color: textColor,
                            fontSize: '0.75rem',
                            lineHeight: '1rem',
                            fontWeight: 600
                          }}
                        >
                          {tag.name}
                        </span>
                      </div>
                    </Tooltip>
                  );
                })}
                {tags.length > 3 && (
                  <Tooltip {...CustomTooltipProps} title={tags.slice(3).map(t => t.name).join(", ")}>
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none">
                      +{tags.length - 3}
                    </span>
                  </Tooltip>
                )}
              </>
            );
          })()}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
          contact.situation === 'Ativo' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
            : contact.situation === 'Inativo' 
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              : contact.situation === 'Suspenso'
                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                : 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
        }`}>
          {contact.situation || (contact.active ? 'Ativo' : 'Inativo')}
        </span>
        
        {/* Ações */}
        <div className="flex items-center gap-2">
          <Tooltip {...CustomTooltipProps} title="Enviar mensagem pelo WhatsApp">
            <IconButton 
              size="small" 
              onClick={() => onSendMessage(contact)}
              style={{ color: "#16a34a" }}
            >
              <WhatsApp />
            </IconButton>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title="Editar contato">
            <IconButton 
              size="small" 
              onClick={() => onEdit(contact.id)}
              style={{ color: "#2563eb" }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title={contact.active ? "Bloquear contato" : "Desbloquear contato"}>
            <IconButton 
              size="small" 
              onClick={() => contact.active ? onBlock(contact) : onUnblock(contact)}
              style={{ color: "#6b7280" }}
            >
              {contact.active ? <LockIcon /> : <Unlock style={{ width: 20, height: 20 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title="Deletar contato">
            <IconButton 
              size="small" 
              onClick={() => onDelete(contact)}
              style={{ color: "#dc2626" }}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

// Nome de exibição para debugging
ContactCard.displayName = 'ContactCard';

export default ContactCard;
