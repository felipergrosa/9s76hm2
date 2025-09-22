import React, { memo } from "react";
import { 
  Trash2, 
  Edit, 
  Lock, 
  Unlock, 
  CheckCircle, 
  Ban
} from "lucide-react";
import { WhatsApp } from "@material-ui/icons";
import { Tooltip } from "@material-ui/core";
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
          onClick={(e) => onToggleSelect(contact.id, rowIndex, e)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" 
        />
      </td>
      <td className="pl-0 pr-3 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-white flex items-center gap-3 w-[360px] lg:w-[360px] max-w-[360px] lg:max-w-[360px] overflow-hidden text-ellipsis">
        <Tooltip {...CustomTooltipProps} title={contact.name}>
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 flex-shrink-0 overflow-hidden">
            <LazyContactAvatar 
              contact={contact}
              style={{ width: "40px", height: "40px" }}
            />
          </div>
        </Tooltip>
        <Tooltip {...CustomTooltipProps} title={contact.name}>
          <span className="truncate">
            {contact.name}
          </span>
        </Tooltip>
      </td>
      <td className="pl-3 pr-3 py-3 whitespace-nowrap w-[120px]">
        <div className="flex items-center gap-2 text-[16px] leading-tight">
          <span className="flex-1 min-w-4 truncate text-[16px] leading-tight text-gray-800 dark:text-gray-100">{formatPhoneNumber(contact.number)}</span>
          {!!contact.isWhatsappValid ? (
            <Tooltip {...CustomTooltipProps} title={`WhatsApp válido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
              <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0" />
            </Tooltip>
          ) : (
            <Tooltip {...CustomTooltipProps} title={`WhatsApp inválido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
              <Ban className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </Tooltip>
          )}
        </div>
      </td>
      <td className="hidden lg:table-cell pl-1 pr-1 py-3 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
        <Tooltip {...CustomTooltipProps} title={contact.email}>
          <span className="truncate block max-w-full text-xs">{contact.email}</span>
        </Tooltip>
      </td>
      <td className="pl-3 pr-3 py-3 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
        <Tooltip {...CustomTooltipProps} title={contact.city}>
          <span className="truncate">{contact.city}</span>
        </Tooltip>
      </td>
      <td className="text-center pl-1 pr-1 py-1 max-w-[50px]">
        <div className="flex justify-center gap-1">
          {contact.tags && contact.tags.slice(0, 4).map((tag) => (
            <Tooltip {...CustomTooltipProps} title={tag.name} key={tag.id}>
              <span
                className="inline-block w-[10px] h-[10px] rounded-full"
                style={{ backgroundColor: tag.color || '#9CA3AF' }}
              ></span>
            </Tooltip>
          ))}
          {contact.tags && contact.tags.length > 4 && (
            <Tooltip {...CustomTooltipProps} title={contact.tags.slice(4).map(t => t.name).join(", ")}>
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none">
                +{contact.tags.length - 4}
              </span>
            </Tooltip>
          )}
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
      <td className="pl-3 pr-3 py-3 text-center w-[120px]">
        <div className="flex items-center justify-center gap-1.5">
          <Tooltip {...CustomTooltipProps} title="Enviar mensagem pelo WhatsApp">
            <button onClick={() => onSendMessage(contact)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
              <WhatsApp className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title="Editar contato">
            <button onClick={() => onEdit(contact.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              <Edit className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title={contact.active ? "Bloquear contato" : "Desbloquear contato"}>
            <button 
              onClick={() => contact.active ? onBlock(contact) : onUnblock(contact)} 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {contact.active ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </button>
          </Tooltip>
          <Tooltip {...CustomTooltipProps} title="Deletar contato">
            <button onClick={() => onDelete(contact)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
              <Trash2 className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
});

// Nome de exibição para debugging
ContactRow.displayName = 'ContactRow';

export default ContactRow;
