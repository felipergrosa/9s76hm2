import React, { useState, useRef, useContext } from "react";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import { makeStyles } from "@material-ui/core/styles";
import { Volume2, Volume1 } from "lucide-react";
import ColorModeContext from "../../layout/themeContext";

import { Grid, Slider, Tooltip } from "@material-ui/core";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
    tabContainer: {
        padding: theme.spacing(2),
    },
    popoverPaper: {
        width: "100%",
        maxWidth: 350,
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(1),
        [theme.breakpoints.down("sm")]: {
            maxWidth: 270,
        },
    },
    noShadow: {
        boxShadow: "none !important",
    },
    icons: {
        color: "#fff",
    },
    customBadge: {
        backgroundColor: "#f44336",
        color: "#fff",
    },
}));

const NotificationsVolume = ({ volume, setVolume }) => {
    const classes = useStyles();
    const { colorMode } = useContext(ColorModeContext);
    const { viewMode } = colorMode;

    const anchorEl = useRef();
    const [isOpen, setIsOpen] = useState(false);

    const handleClick = () => {
        setIsOpen((prevState) => !prevState);
    };

    const handleClickAway = () => {
        setIsOpen(false);
    };

    const handleVolumeChange = (value) => {
        setVolume(value);
        localStorage.setItem("volume", value);
    };

    return (
        <>
            <Tooltip title={i18n.t("dashboard.buttons.volume")} arrow>
                <IconButton
                    onClick={handleClick}
                    ref={anchorEl}
                    aria-label="Open Notifications"
                    style={{ padding: 8, color: viewMode === "modern" ? "var(--text)" : "white" }}
                >
                    <Volume2 />
                </IconButton>
            </Tooltip>
            <Popover
                disableScrollLock
                open={isOpen}
                anchorEl={anchorEl.current}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                classes={{ paper: classes.popoverPaper }}
                onClose={handleClickAway}
            >
                <List dense className={classes.tabContainer}>
                    <Grid container spacing={2}>
                        <Grid item>
                            <Volume1 />
                        </Grid>
                        <Grid item xs>
                            <Slider
                                value={Number(volume)}
                                aria-labelledby="continuous-slider"
                                step={0.1}
                                min={0}
                                max={1}
                                onChange={(e, value) =>
                                    handleVolumeChange(value)
                                }
                            />
                        </Grid>
                        <Grid item>
                            <Volume2 />
                        </Grid>
                    </Grid>
                </List>
            </Popover>
        </>
    );
};


export default NotificationsVolume;
