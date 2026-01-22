import React, { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, makeStyles } from "@material-ui/core";
import { Close as CloseIcon } from "@material-ui/icons";
import { ColorBox } from "material-ui-color";


const useStyles = makeStyles((theme) => ({
    btnWrapper: {
        position: "relative",
    },
}));

const ColorBoxModal = ({ onChange, currentColor, handleClose, open }) => {

    const classes = useStyles();
    const [selectedColor, setSelectedColor] = useState(currentColor);

    useEffect(() => {
        setSelectedColor(currentColor);
    }, [currentColor]);

    const handleOk = () => {
        onChange(selectedColor);
        handleClose();
    };

    return (

        <Dialog open={open} onClose={handleClose}>

            <DialogTitle>Escolha uma cor</DialogTitle>
            <DialogContent>
                <ColorBox
                    disableAlpha={true}
                    hslGradient={false}
                    style={{ margin: '20px auto 0' }}
                    value={selectedColor}
                    onChange={setSelectedColor} />
            </DialogContent>

            <DialogActions>

                <Button
                    onClick={handleClose}
                    variant="contained"
                    startIcon={<CloseIcon />}
                    style={{
                        background: 'linear-gradient(145deg, rgba(150, 150, 150, 0.95), rgba(100, 100, 100, 0.9))',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '8px',
                    }}
                >
                    Cancelar
                </Button>
                <Button
                    color="primary"
                    variant="contained"
                    className={classes.btnWrapper}
                    onClick={handleOk} >
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    )
}
export default ColorBoxModal;