import { makeStyles } from "@material-ui/styles";
import React from "react";
import { Tooltip } from "@material-ui/core";

const useStyles = makeStyles(theme => ({
    tag: {
        padding: "1px 5px",
        borderRadius: "4px",
        fontSize: "0.7em",
        fontWeight: "bold",
        color: "#FFF",
        marginRight: "4px",
        whiteSpace: "nowrap"
    }
}));

const ContactTag = ({ tag, tooltipTitle }) => {
    const classes = useStyles();

    return (
        <Tooltip title={tooltipTitle || tag.name} arrow>
            <div className={classes.tag} style={{ backgroundColor: tag.color, marginTop: '2px' }}>
               {tag.name.toUpperCase()}
            </div>
        </Tooltip>
    )
}

export default ContactTag;
