import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles, useMediaQuery, useTheme } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManager";
import Ticket from "../../components/Ticket";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		// backgroundColor: "#eee",
		// padding: theme.spacing(4),
		padding: theme.padding,
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},

	chatPapper: {
		// backgroundColor: "red",
		display: "flex",
		height: "100%",
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
	},
	messagessWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		// backgroundColor: "#eee",
		background: theme.palette.tabHeaderBackground,
		display: "flex",
		justifyContent: "space-evenly",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
	},
	logo: {
		logo: theme.logo,
		content: "url(" + (theme.mode === "light" ? theme.calculatedLogoLight() : theme.calculatedLogoDark()) + ")"
	},
}));

const Chat = () => {
	const classes = useStyles();
	const { ticketId } = useParams();
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

	return (
		<div className={`${classes.chatContainer} chat-container`}>
			<div className={`${classes.chatPapper} chat-paper`}>
				<Grid container spacing={0}>
					{/* Em mobile: mostra lista OU ticket. Em desktop: mostra ambos */}
					{(!isMobile || !ticketId) && (
						<Grid item xs={isMobile ? 12 : 4} className={`${classes.contactsWrapper} contacts-wrapper`}>
							<TicketsManager />
						</Grid>
					)}
					{(!isMobile || ticketId) && (
						<Grid item xs={isMobile ? 12 : 8} className={`${classes.messagessWrapper} messages-wrapper`}>
							{ticketId ? (
								<>
									<Ticket />
								</>
							) : (
								<Paper square variant="outlined" className={`${classes.welcomeMsg} welcome-message`}>
									<span>
										<center>
											<img className={classes.logo} width="50%" alt="" />
										</center>
										{i18n.t("chat.noTicketMessage")}
									</span>
								</Paper>
							)}
						</Grid>
					)}
				</Grid>
			</div>
		</div>
	);
};

export default Chat;
