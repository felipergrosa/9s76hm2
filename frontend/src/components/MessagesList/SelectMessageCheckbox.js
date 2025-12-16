import React, { useContext, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";

const useStyles = makeStyles((theme) => ({
  customCheckbox: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid #8696a0",
    backgroundColor: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    "&:hover": {
      borderColor: "#00a884",
    },
  },
  customCheckboxChecked: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#00a884",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  },
  checkIcon: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
}));

const SelectMessageCheckbox = ({ message, onSelectionChange }) => {
  const classes = useStyles();
  const [isChecked, setIsChecked] = React.useState(false);
  const {
    showSelectMessageCheckbox,
    setSelectedMessages,
    selectedMessages,
  } = useContext(ForwardMessageContext);

  // Reset quando o modo de seleção é desativado
  useEffect(() => {
    if (!showSelectMessageCheckbox) {
      setIsChecked(false);
    }
  }, [showSelectMessageCheckbox]);

  // Sincroniza com a lista de mensagens selecionadas
  useEffect(() => {
    const isInList = selectedMessages.some((m) => m.id === message.id);
    setIsChecked(isInList);
  }, [selectedMessages, message.id]);

  const handleSelectMessage = (e) => {
    e.stopPropagation();
    const list = [...selectedMessages];
    const newChecked = !isChecked;
    
    if (newChecked) {
      list.push(message);
    } else {
      const index = list.findIndex((m) => m.id === message.id);
      if (index > -1) {
        list.splice(index, 1);
      }
    }
    setIsChecked(newChecked);
    setSelectedMessages(list);
    
    // Notifica o componente pai sobre a mudança de seleção
    if (onSelectionChange) {
      onSelectionChange(newChecked);
    }
  };

  if (showSelectMessageCheckbox) {
    return (
      <div onClick={handleSelectMessage} style={{ cursor: 'pointer' }}>
        <div className={isChecked ? classes.customCheckboxChecked : classes.customCheckbox}>
          {isChecked && <span className={classes.checkIcon}>✓</span>}
        </div>
      </div>
    );
  } else {
    return null;
  }
};

export { SelectMessageCheckbox };
export default SelectMessageCheckbox;