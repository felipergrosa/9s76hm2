import React, { memo } from "react";
import { 
  CheckCircle, 
  Ban
} from "lucide-react";
import { WhatsApp, Edit as EditIcon, DeleteOutline as DeleteOutlineIcon, Lock as LockIcon } from "@material-ui/icons";
import { Unlock } from "lucide-react";
import { Tooltip, IconButton } from "@material-ui/core";
import LazyContactAvatar from "../LazyContactAvatar";

// Componente de linha de contato memoizado para evitar re-renderizações desnecessárias
const ContactRow = memo(({ 
  contact, 
  selectedContactIds, 
  onToggleSelect, 
  onEdit, 
  onSendMessage, 
  onDelete, 
  onBlock, 
  onUnblock,
  formatPhoneNumber,
  CustomTooltipProps,
  rowStyle,
  rowIndex
}) => {
  
  // Determina se o contato está selecionado
  const isSelected = selectedContactIds.includes(contact.id);

  const rowClasses = `border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${
    isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-gray-800'
  }`;

  return (
    <tr key={contact.id} style={rowStyle} className={rowClasses}>
      <td className="w-[48px] p-4">
        <input type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(contact.id, rowIndex, e)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" 
        />
      </td>
      <td className="pl-0 pr-3 py-3" style={{ width: "300px", minWidth: "300px" }}>
        <div className="flex items-center gap-3 min-w-0" style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
          <Tooltip {...CustomTooltipProps} title={contact.name || "Sem nome"}>
            <div className="flex-shrink-0" style={{ width: "40px", height: "40px", flexShrink: 0 }}>
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 overflow-hidden">
                <LazyContactAvatar 
                  contact={contact}
                  style={{ width: "40px", height: "40px" }}
                />
              </div>
            </div>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title={contact.name || "Sem nome"}>
            <span 
              className="flex-1 min-w-0 truncate font-medium text-gray-900 dark:text-white" 
              style={{ overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {contact.name || "Sem nome"}
            </span>
          </Tooltip>
        </div>
      </td>
      <td className="pl-3 pr-3 py-3" style={{ width: "167px", minWidth: "167px" }}>
        <div className="flex items-center gap-1.5 text-[16px] leading-tight" style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
          <span className="flex-1 min-w-0 truncate text-[16px] leading-tight text-gray-800 dark:text-gray-100" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{formatPhoneNumber(contact.number)}</span>
          {!!contact.isWhatsappValid ? (
            <Tooltip {...CustomTooltipProps} title={`WhatsApp válido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
              <div className="flex-shrink-0" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle className="w-5 h-5" style={{ color: "#16a34a", strokeWidth: 2.5 }} />
              </div>
            </Tooltip>
          ) : (
            <Tooltip {...CustomTooltipProps} title={`WhatsApp inválido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
              <div 
                className="flex-shrink-0" 
                style={{ 
                  width: "20px", 
                  height: "20px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  flexShrink: 0,
                  borderRadius: "50%",
                  backgroundColor: "#fef2f2",
                  padding: "2px"
                }}
              >
                <Ban 
                  className="w-4 h-4" 
                  style={{ 
                    color: "#dc2626", 
                    strokeWidth: 2.5 
                  }} 
                />
              </div>
            </Tooltip>
          )}
        </div>
      </td>
      <td className="hidden lg:table-cell pl-1 pr-1 py-3 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
        {contact.email ? (
          <Tooltip {...CustomTooltipProps} title={contact.email}>
            <span className="truncate block max-w-full text-xs">{contact.email}</span>
          </Tooltip>
        ) : (
          <span className="truncate block max-w-full text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="pl-3 pr-3 py-3 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
        {contact.city ? (
          <Tooltip {...CustomTooltipProps} title={contact.city}>
            <span className="truncate">{contact.city}</span>
          </Tooltip>
        ) : (
          <span className="truncate text-gray-400">-</span>
        )}
      </td>
      <td className="pl-2 pr-2 py-3" style={{ width: "auto", minWidth: "80px", maxWidth: "200px" }}>
        <div className="flex justify-center items-center gap-1 flex-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
          {(() => {
            // Normaliza as tags para lidar com diferentes formatos da API
            const normalizeTags = (raw) => {
              try {
                // Extrai array de tags de diferentes estruturas possíveis
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
                  // Suporta estrutura ContactTag (com contactId, tagId) ou estrutura direta
                  const nested = obj.tag || obj.Tag || obj.Tags || {};
                  
                  // Extrai name: pode estar direto no obj, no nested, ou usar label
                  const name = obj.name || nested.name || obj.label;
                  if (!name) return null; // Ignora tags sem nome
                  
                  // Extrai color: pode estar direto no obj, no nested, ou usar hex
                  const color = obj.color || nested.color || obj.hex || '#9CA3AF';
                  
                  // PRIORIDADE: tagId (estrutura ContactTag) > id > nested.id > idx
                  // tagId é o ID da tag na tabela de tags, que é o que queremos usar como key
                  // IMPORTANTE: tagId tem prioridade sobre id, pois é o ID real da tag
                  let id;
                  if (obj.tagId !== undefined && obj.tagId !== null) {
                    id = obj.tagId; // Usa tagId quando disponível (estrutura ContactTag)
                  } else if (obj.id !== undefined && obj.id !== null) {
                    id = obj.id; // Fallback para id direto
                  } else if (nested.id !== undefined && nested.id !== null) {
                    id = nested.id; // Fallback para id aninhado
                  } else {
                    id = `tag-${contact.id}-${idx}`; // Fallback final
                  }
                  
                  return { id, name, color };
                }).filter(Boolean); // Remove nulls
              } catch (error) {
                return [];
              }
            };
            
            // Tenta normalizar tags de diferentes propriedades possíveis
            const rawTags = contact.tags || contact.contactTags || [];
            const tags = normalizeTags(rawTags);
            
            if (!tags || tags.length === 0) {
              return null;
            }

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

            return (
              <>
                {tags.slice(0, 4).map((tag, tagIdx) => {
                  // Usa tagId como key quando disponível (prioridade), senão usa id normalizado
                  // Combina contact.id com tag.id para garantir unicidade
                  const key = `contact-${contact.id}-tag-${tag.id}-${tagIdx}`;
                  const tagColor = tag.color || '#9CA3AF';
                  const textColor = getTextColor(tagColor);
                  
                  return (
                    <Tooltip {...CustomTooltipProps} title={tag.name} key={key}>
                      <div
                        className="inline-flex items-center px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ 
                          backgroundColor: tagColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          border: `2px solid ${tagColor}`,
                          borderRadius: '9999px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                          maxWidth: '100%'
                        }}
                      >
                        <span
                          className="text-xs font-semibold truncate whitespace-nowrap"
                          style={{ 
                            color: textColor,
                            fontSize: '0.7rem',
                            lineHeight: '1rem',
                            fontWeight: 600,
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {tag.name}
                        </span>
                      </div>
                    </Tooltip>
                  );
                })}
                {tags.length > 4 && (
                  (() => {
                    const remainingTags = tags.slice(4).map(t => t.name).filter(Boolean).join(", ");
                    return remainingTags ? (
                      <Tooltip {...CustomTooltipProps} title={remainingTags}>
                        <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none flex-shrink-0">
                          +{tags.length - 4}
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none flex-shrink-0">
                        +{tags.length - 4}
                      </span>
                    );
                  })()
                )}
              </>
            );
          })()}
        </div>
      </td>
      <td className="pl-3 pr-3 py-3 text-center w-[110px]">
        <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
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
      </td>
      <td align="right" className="pl-3 pr-3 py-3 text-center w-[120px]">
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
      </td>
    </tr>
  );
});

// Nome de exibição para debugging
ContactRow.displayName = 'ContactRow';

export default ContactRow;
