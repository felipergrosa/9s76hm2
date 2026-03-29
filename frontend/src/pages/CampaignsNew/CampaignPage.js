import React from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import CampaignModal from "../../components/CampaignModal";

const useStyles = makeStyles((theme) => ({
  pageContainer: {
    width: "100%",
    height: "100%",
  },
  // CSS para transformar Dialog em conteúdo normal da página
  '@global': {
    '& .MuiDialog-root': {
      position: 'relative !important',
    },
    '& .MuiBackdrop-root': {
      display: 'none !important',
    },
    '& .MuiDialog-container': {
      height: 'auto !important',
      width: '100% !important',
      alignItems: 'flex-start !important',
    },
    '& .MuiDialog-paper': {
      margin: '0 !important',
      maxHeight: 'none !important',
      height: 'auto !important',
      maxWidth: '100% !important',
      width: '100% !important',
      borderRadius: '8px !important',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15) !important',
      backgroundColor: 'white !important',
    },
    '& .MuiDialog-paperScrollPaper': {
      maxHeight: 'none !important',
    },
    '& .MuiDialogTitle-root': {
      padding: '16px 24px 8px 24px !important',
      backgroundColor: 'white !important',
      borderBottom: '1px solid #e0e0e0 !important',
    },
    '& .MuiDialogContent-root': {
      padding: '0 24px 24px 24px !important',
    },
    '& .MuiDialogActions-root': {
      padding: '16px 24px !important',
      backgroundColor: 'white !important',
      borderTop: '1px solid #e0e0e0 !important',
    }
  }
}));

const CampaignPage = ({ onSaved, onClose }) => {
  const classes = useStyles();

  const handleCampaignSaved = () => {
    toast.success("Campanha salva com sucesso!");
    if (onSaved) onSaved();
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <div className={classes.pageContainer}>
      <div className={classes.content}>
        <CampaignModal
          open={true}
          onClose={handleClose}
          onSaved={handleCampaignSaved}
          resetPagination={() => {}}
          campaignId={null}
        />
      </div>
    </div>
  );
};

export default CampaignPage;
