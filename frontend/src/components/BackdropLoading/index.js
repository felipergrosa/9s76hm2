import React from "react";

import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
	backdrop: {
		zIndex: theme.zIndex.drawer + 1,
		color: "#fff",
		// Correção: remover aria-hidden quando há elementos focados
		'&[aria-hidden="true"]': {
			'&:focus-within': {
				'aria-hidden': 'false',
			},
		},
	},
}));

const BackdropLoading = () => {
	const classes = useStyles();
	return (
		<Backdrop 
			className={classes.backdrop} 
			open={true}
			// Correção: não usar aria-hidden para evitar conflito com elementos focados
			aria-hidden="false"
			role="dialog"
			aria-modal="true"
			aria-label="Carregando"
		>
			<CircularProgress color="inherit" />
		</Backdrop>
	);
};

export default BackdropLoading;
