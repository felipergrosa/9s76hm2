import React, { memo } from "react";
import { Trash2, Edit, Lock, Unlock, CheckCircle, Ban } from "lucide-react";
import { WhatsApp } from "@material-ui/icons";
import { Tooltip } from "@material-ui/core";
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
  CustomTooltipProps
}) => {
  return (
    <div className="w-full bg-white dark:bg-gray-800 shadow rounded-lg p-3 flex flex-col gap-3">
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600 dark:text-gray-300">{formatPhoneNumber(contact.number)}</span>
          {!!contact.isWhatsappValid ? (
            <Tooltip {...CustomTooltipProps} title="WhatsApp válido">
              <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
            </Tooltip>
          ) : (
            <Tooltip {...CustomTooltipProps} title="WhatsApp inválido">
              <Ban className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Tooltip>
          )}
        </div>
        
        {/* Tags */}
        <div className="flex justify-end gap-1">
          {contact.tags && contact.tags.slice(0, 3).map((tag) => (
            <Tooltip {...CustomTooltipProps} title={tag.name} key={tag.id}>
              <span
                className="inline-block w-[8px] h-[8px] rounded-full"
                style={{ backgroundColor: tag.color || '#9CA3AF' }}
              ></span>
            </Tooltip>
          ))}
          {contact.tags && contact.tags.length > 3 && (
            <Tooltip {...CustomTooltipProps} title={contact.tags.slice(3).map(t => t.name).join(", ")}>
              <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none">
                +{contact.tags.length - 3}
              </span>
            </Tooltip>
          )}
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
            <button onClick={() => onSendMessage(contact)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
              <WhatsApp className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title="Editar contato">
            <button onClick={() => onEdit(contact.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              <Edit className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title={contact.active ? "Bloquear contato" : "Desbloquear contato"}>
            <button 
              onClick={() => contact.active ? onBlock(contact) : onUnblock(contact)} 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {contact.active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title="Deletar contato">
            <button onClick={() => onDelete(contact)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

// Nome de exibição para debugging
ContactCard.displayName = 'ContactCard';

export default ContactCard;
