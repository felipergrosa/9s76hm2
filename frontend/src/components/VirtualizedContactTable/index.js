import React, { memo, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { Tooltip } from "@material-ui/core";
import { WhatsApp } from "@material-ui/icons";
import { Trash2, Edit, Lock, Unlock, CheckCircle, Ban } from "lucide-react";
import LazyContactAvatar from "../LazyContactAvatar";

// Altura aproximada da linha (ajuste se necessário para casar com a tabela)
const ROW_HEIGHT = 56;

const VirtualizedContactTable = ({
  contacts,
  selectedContactIds,
  onToggleSelect,
  onEdit,
  onSendMessage,
  onDelete,
  onBlock,
  onUnblock,
  formatPhoneNumber,
  CustomTooltipProps,
  height = 560,
}) => {
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const itemData = useMemo(() => ({
    contacts: safeContacts,
    selectedContactIds,
    onToggleSelect,
    onEdit,
    onSendMessage,
    onDelete,
    onBlock,
    onUnblock,
    formatPhoneNumber,
    CustomTooltipProps,
  }), [
    contacts,
    selectedContactIds,
    onToggleSelect,
    onEdit,
    onSendMessage,
    onDelete,
    onBlock,
    onUnblock,
    formatPhoneNumber,
    CustomTooltipProps,
  ]);

  const Row = ({ index, style }) => {
    const contact = itemData.contacts[index];
    const isSelected = itemData.selectedContactIds.includes(contact.id);

    return (
      <div style={style} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
        <div className="grid grid-cols-[48px_360px_120px_120px_120px_110px_120px] items-center">
          {/* Checkbox */}
          <div className="w-[48px] p-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => itemData.onToggleSelect(contact.id)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Nome + Avatar */}
          <div className="pl-0 pr-3 py-3 flex items-center gap-3 w-[360px] max-w-[360px] overflow-hidden text-ellipsis">
            <Tooltip {...itemData.CustomTooltipProps} title={contact.name}>
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 flex-shrink-0 overflow-hidden">
                <LazyContactAvatar contact={contact} style={{ width: "40px", height: "40px" }} />
              </div>
            </Tooltip>
            <Tooltip {...itemData.CustomTooltipProps} title={contact.name}>
              <span className="truncate text-gray-900 dark:text-white font-medium">{contact.name}</span>
            </Tooltip>
          </div>

          {/* Telefone + Validação */}
          <div className="pl-3 pr-3 py-3 w-[120px]">
            <div className="flex items-center gap-2 text-[16px] leading-tight">
              <span className="flex-1 min-w-4 truncate text-[16px] leading-tight text-gray-800 dark:text-gray-100">{itemData.formatPhoneNumber(contact.number)}</span>
              {!!contact.isWhatsappValid ? (
                <Tooltip {...itemData.CustomTooltipProps} title={`WhatsApp válido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ''}`}>
                  <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0" />
                </Tooltip>
              ) : (
                <Tooltip {...itemData.CustomTooltipProps} title={`WhatsApp inválido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ''}`}>
                  <Ban className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </Tooltip>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="hidden lg:block pl-1 pr-1 py-3 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
            <Tooltip {...itemData.CustomTooltipProps} title={contact.email}>
              <span className="truncate block max-w-full text-xs">{contact.email}</span>
            </Tooltip>
          </div>

          {/* Cidade */}
          <div className="pl-3 pr-3 py-3 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
            <Tooltip {...itemData.CustomTooltipProps} title={contact.city}>
              <span className="truncate">{contact.city}</span>
            </Tooltip>
          </div>

          {/* Tags (bolinhas) */}
          <div className="text-center pl-1 pr-1 py-1 w-[120px]">
            <div className="flex justify-center gap-1">
              {contact.tags && contact.tags.slice(0, 4).map((tag) => (
                <Tooltip {...itemData.CustomTooltipProps} title={tag.name} key={tag.id}>
                  <span className="inline-block w-[10px] h-[10px] rounded-full" style={{ backgroundColor: tag.color || '#9CA3AF' }} />
                </Tooltip>
              ))}
              {contact.tags && contact.tags.length > 4 && (
                <Tooltip {...itemData.CustomTooltipProps} title={contact.tags.slice(4).map(t => t.name).join(', ')}>
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none">
                    +{contact.tags.length - 4}
                  </span>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="pl-3 pr-3 py-3 text-center w-[110px]">
            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
              contact.situation === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : contact.situation === 'Inativo' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              : contact.situation === 'Suspenso' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              : 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
            }`}>
              {contact.situation || (contact.active ? 'Ativo' : 'Inativo')}
            </span>
          </div>

          {/* Ações */}
          <div className="pl-3 pr-3 py-3 text-center w-[120px]">
            <div className="flex items-center justify-center gap-1.5">
              <Tooltip {...itemData.CustomTooltipProps} title="Enviar mensagem pelo WhatsApp">
                <button onClick={() => itemData.onSendMessage(contact)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
                  <WhatsApp className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip {...itemData.CustomTooltipProps} title="Editar contato">
                <button onClick={() => itemData.onEdit(contact.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  <Edit className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip {...itemData.CustomTooltipProps} title={contact.active ? "Bloquear contato" : "Desbloquear contato"}>
                <button
                  onClick={() => contact.active ? itemData.onBlock(contact) : itemData.onUnblock(contact)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {contact.active ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>
              </Tooltip>
              <Tooltip {...itemData.CustomTooltipProps} title="Deletar contato">
                <button onClick={() => itemData.onDelete(contact)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                  <Trash2 className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <List
      height={height}
      width={"100%"}
      itemCount={safeContacts.length}
      itemSize={ROW_HEIGHT}
      style={{ overflowX: "hidden" }}
    >
      {Row}
    </List>
  );
};

export default memo(VirtualizedContactTable);
