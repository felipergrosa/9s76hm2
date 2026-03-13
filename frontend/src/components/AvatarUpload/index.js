import React, { useState, useEffect } from 'react';
import Avatar from '@material-ui/core/Avatar';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import PhotoCameraIcon from '@material-ui/icons/PhotoCamera';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';

const useStyles = makeStyles((theme) => ({
  avatar: {
    width: 130,
    height: 130,
    marginBottom: theme.spacing(1),
    cursor: 'pointer',
    borderRadius: '50%',
    border: '1px solid #d0d7de',
    boxShadow: '0 0 0 2px #fff, 0 4px 14px rgba(0,0,0,0.08)',
    transition: 'transform 120ms ease',
    '&:hover': {
      transform: 'scale(1.02)',
    },
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
  modalImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    maxHeight: '80vh',
  },
}));

const AvatarUploader = ({ setAvatar, avatar, companyId, onRemove }) => {
  const classes = useStyles();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [openPreview, setOpenPreview] = useState(false);

  useEffect(() => {
    if (avatar && !selectedFile) {
      setPreviewImage(null);
    }
  }, [avatar, selectedFile]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setAvatar(file);

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const currentSrc = !previewImage && avatar
    ? `${process.env.REACT_APP_BACKEND_URL}/public/company${companyId}/${avatar}?v=${new Date().getTime()}`
    : previewImage || `${process.env.REACT_APP_BACKEND_URL}/public/app/noimage.png`;

  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Avatar
        key={avatar || previewImage || 'default'}
        src={currentSrc}
        alt="Avatar do usuário"
        className={classes.avatar}
        onClick={() => setOpenPreview(true)}
      />

      <input
        accept="image/*"
        type="file"
        id="avatar-upload"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Box className={classes.actions}>
        <Tooltip title="Trocar avatar" arrow>
          <label htmlFor="avatar-upload" style={{ margin: 0 }}>
            <IconButton color="primary" component="span" size="small">
              <PhotoCameraIcon fontSize="small" />
            </IconButton>
          </label>
        </Tooltip>

        <Tooltip title="Ver maior" arrow>
          <IconButton color="default" size="small" onClick={() => setOpenPreview(true)}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {avatar && (
          <Tooltip title="Remover" arrow>
            <IconButton
              color="secondary"
              size="small"
              onClick={() => {
                setSelectedFile(null);
                setPreviewImage(null);
                setAvatar(null);
                if (onRemove) onRemove();
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="sm" fullWidth>
        <DialogContent>
          <img src={currentSrc} alt="Pré-visualização do avatar" className={classes.modalImage} />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AvatarUploader;
