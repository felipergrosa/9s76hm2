import React, { useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import QuickMessagesPanel from "../../components/QuickMessagesPanel";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles,
    backgroundColor: theme.palette.background.default,
  },
}));

const Quickemessages = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("quickMessages.title")}</Title>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
      >
        <QuickMessagesPanel showHeader={true} />
      </Paper>
    </MainContainer>
  );
};

export default Quickemessages;