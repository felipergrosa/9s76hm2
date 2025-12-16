import React, { useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";

const useStyles = makeStyles((theme) => ({
  checkboxContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginLeft: -8,
  },
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

const SelectMessageCheckbox = ({ message }) => {
  const classes = useStyles();
  const [isChecked, setIsChecked] = React.useState(false);
  const {
    showSelectMessageCheckbox,
    setSelectedMessages,
    selectedMessages,
  } = useContext(ForwardMessageContext);

  const handleSelectMessage = (e) => {
    e.stopPropagation();
    const list = [...selectedMessages];
    if (!isChecked) {
      setIsChecked(true);
      list.push(message);
    } else {
      const index = list.findIndex((m) => m.id === message.id);
      if (index > -1) {
        list.splice(index, 1);
      }
      setIsChecked(false);
    }
    setSelectedMessages(list);
  };

  if (showSelectMessageCheckbox) {
    return (
      <div className={classes.checkboxContainer} onClick={handleSelectMessage}>
        <div className={isChecked ? classes.customCheckboxChecked : classes.customCheckbox}>
          {isChecked && <span className={classes.checkIcon}>✓</span>}
        </div>
      </div>
    );
  } else {
    return null;
  }
};

export default SelectMessageCheckbox;