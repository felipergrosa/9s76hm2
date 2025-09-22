import React, { memo, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import ContactCard from "../ContactCard";

const ROW_HEIGHT = 86; // altura aproximada do card em px

const VirtualizedContactListMobile = ({
  contacts,
  onEdit,
  onSendMessage,
  onDelete,
  onBlock,
  onUnblock,
  formatPhoneNumber,
  CustomTooltipProps,
  height = 520,
}) => {
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const itemData = useMemo(() => ({
    contacts: safeContacts,
    onEdit,
    onSendMessage,
    onDelete,
    onBlock,
    onUnblock,
    formatPhoneNumber,
    CustomTooltipProps,
  }), [contacts, onEdit, onSendMessage, onDelete, onBlock, onUnblock, formatPhoneNumber, CustomTooltipProps]);

  const Row = ({ index, style }) => {
    const contact = itemData.contacts[index];
    return (
      <div style={style}>
        <ContactCard
          contact={contact}
          onEdit={itemData.onEdit}
          onSendMessage={itemData.onSendMessage}
          onDelete={itemData.onDelete}
          onBlock={itemData.onBlock}
          onUnblock={itemData.onUnblock}
          formatPhoneNumber={itemData.formatPhoneNumber}
          CustomTooltipProps={itemData.CustomTooltipProps}
        />
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

export default memo(VirtualizedContactListMobile);
