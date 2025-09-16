import React, { useEffect } from "react";

import { Card, IconButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIos from "@material-ui/icons/ArrowBackIos";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		// backgroundColor: "#eee",
		background: theme.palette.total,
		flex: "none",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		height: 68,
		padding: "0 0px 0 20px",
		position: 'relative',
		[theme.breakpoints.down("sm")]: {
			flexWrap: "nowrap",
			alignItems: 'center',
			gap: 4,
			minHeight: 56,
		},
	},
}));

const TicketHeader = ({ loading, children }) => {
	const classes = useStyles();
	const history = useHistory();

	const handleBack = () => {

		history.push("/tickets");
	};

	// useEffect(() => {
	// 	const handleKeyDown = (event) => {
	// 		if (event.key === "Escape") {
	// 			handleBack();
	// 		}
	// 	};
	// 	document.addEventListener("keydown", handleKeyDown);
	// 	return () => {
	// 		document.removeEventListener("keydown", handleKeyDown);
	// 	};
	// }, [history]);

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card
					square
					className={classes.ticketHeader}
				>
					<IconButton color="primary" size="small" edge="start" aria-label="voltar" onClick={handleBack}>
						<ArrowBackIos fontSize="small" />
					</IconButton>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
