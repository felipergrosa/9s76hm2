import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import {
    Formik,
    Form,
    Field,
    FieldArray
} from "formik";
import { toast } from "react-toastify";

import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    makeStyles,
    TextField
} from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import MediaPreview from "../MediaPreview";
import MediaViewerModal from "../MediaViewerModal";

import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4
    },
    multFieldLine: {
        display: "flex",
        "& > *:not(:last-child)": {
            marginRight: theme.spacing(1),
        },
    },
    textField: {
        marginRight: theme.spacing(1),
        flex: 1,
    },

    extraAttr: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },

    btnWrapper: {
        position: "relative",
    },

    buttonProgress: {
        color: green[500],
        position: "absolute",
        top: "50%",
        left: "50%",
        marginTop: -12,
        marginLeft: -12,
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 2000,
    },
    colorAdorment: {
        width: 20,
        height: 20,
    },
}));

const FileListSchema = Yup.object().shape({
    name: Yup.string()
        .min(3, "nome muito curto")
        .required("Obrigatório"),
    message: Yup.string()
});

const FilesModal = ({ open, onClose, fileListId, reload }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);

    const [selectedFileNames, setSelectedFileNames] = useState([]);
    const [mediaViewerModalOpen, setMediaViewerModalOpen] = useState(false);
    const [viewingMedia, setViewingMedia] = useState(null);

    const initialState = {
        name: "",
        message: "",
        options: [],
    };

    const [fileList, setFileList] = useState(initialState);

    useEffect(() => {
        try {
            (async () => {
                if (!fileListId) return;

                const { data } = await api.get(`/files/${fileListId}`);
                setFileList(data);
            })()
        } catch (err) {
            toastError(err);
        }
    }, [fileListId, open]);

    const handleClose = () => {
        setFileList(initialState);
        onClose();
    };

    const handleSaveFileList = async (values) => {
        const formData = new FormData();

        // Adiciona os campos de texto
        formData.append('name', values.name);
        formData.append('message', values.message || "");
        formData.append('userId', user.id);

        // Adiciona os arquivos e seus nomes correspondentes
        let fileIndex = 0;
        values.options.forEach((option, index) => {
            if (option.file) {
                formData.append('files', option.file);
                formData.append(`option_${index}_name`, option.name || "");
                formData.append(`option_${index}_file_index`, fileIndex);
                fileIndex++;
            } else if (option.id) {
                // Para arquivos existentes, envia o ID e o nome
                formData.append(`option_${index}_id`, option.id);
                formData.append(`option_${index}_name`, option.name || "");
            }
        });

        try {
            if (fileListId) {
                await api.put(`/files/${fileListId}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
            } else {
                await api.post('/files', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }
            toast.success(i18n.t("fileModal.success"));
            if (typeof reload === 'function') {
                reload();
            }
            handleClose();
        } catch (err) {
            toastError(err);
        }
    };

    return (
        <div className={classes.root}>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
                scroll="paper">
                <DialogTitle id="form-dialog-title">
                    {(fileListId ? `${i18n.t("fileModal.title.edit")}` : `${i18n.t("fileModal.title.add")}`)}
                </DialogTitle>
                <Formik
                    initialValues={fileList}
                    enableReinitialize={true}
                    validationSchema={FileListSchema}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSaveFileList(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting, values, setFieldValue }) => (
                        <Form>
                            <DialogContent dividers>
                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("fileModal.form.name")}
                                        name="name"
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                    />
                                </div>
                                <br />
                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("fileModal.form.message")}
                                        placeholder="Descrição opcional da Arquivos..."
                                        type="message"
                                        multiline
                                        minRows={3}
                                        fullWidth
                                        name="message"
                                        error={
                                            touched.message && Boolean(errors.message)
                                        }
                                        helperText={
                                            touched.message && errors.message
                                        }
                                        variant="outlined"
                                        margin="dense"
                                    />
                                </div>
                                <Typography
                                    style={{ marginBottom: 8, marginTop: 12 }}
                                    variant="subtitle1"
                                >
                                    {i18n.t("fileModal.form.fileOptions")}
                                </Typography>
                                <Typography
                                    style={{ marginBottom: 16, fontSize: '0.875rem', color: '#666' }}
                                    variant="body2"
                                >
                                    📎 Formatos suportados: Imagens (JPG, PNG, GIF, WebP), Áudio (MP3, WAV, OGG, AAC), Vídeo (MP4, WebM), Documentos (PDF, TXT)
                                    <br />💡 Clique no ícone 📎 para selecionar um arquivo e digite um nome descritivo para cada item.
                                </Typography>

                                <FieldArray name="options">
                                    {({ push, remove }) => (
                                        <>
                                            {values.options &&
                                                values.options.length > 0 &&
                                                values.options.map((info, index) => (
                                                    <Grid container spacing={2} key={`${index}-info`} alignItems="center" style={{ marginBottom: '10px' }}>
                                                        <Grid item xs={12} sm={3} md={2}>
                                                            <MediaPreview
                                                                url={info.url || info.previewUrl}
                                                                mediaType={info.mediaType || info.file?.type}
                                                                name={info.name || info.path || selectedFileNames[index]}
                                                                fileSize={info.file?.size}
                                                                createdAt={info.createdAt}
                                                                onClick={() => {
                                                                    const media = {
                                                                        url: info.url || info.previewUrl,
                                                                        mediaType: info.mediaType || info.file?.type,
                                                                        name: info.name || info.path || selectedFileNames[index]
                                                                    };
                                                                    const isViewable = ['image/', 'audio/', 'video/', 'application/pdf', 'text/plain'].some(prefix => media.mediaType?.startsWith(prefix));
                                                                    
                                                                    if (isViewable && media.url) {
                                                                        setViewingMedia(media);
                                                                        setMediaViewerModalOpen(true);
                                                                    } else if (media.url) {
                                                                        window.open(media.url, '_blank');
                                                                    }
                                                                }}
                                                            />
                                                        </Grid>
                                                        <Grid item xs={12} sm={7} md={9}>
                                                            <Field
                                                                as={TextField}
                                                                label={i18n.t("fileModal.form.extraName")}
                                                                placeholder="Ex: Documento de identidade, Foto do produto, Manual de instruções..."
                                                                name={`options[${index}].name`}
                                                                variant="outlined"
                                                                margin="dense"
                                                                multiline
                                                                fullWidth
                                                                minRows={2}
                                                                className={classes.textField}
                                                            />
                                                        </Grid>
                                                        <Grid item xs={12} sm={2} md={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
                                                            <input
                                                                type="file"
                                                                onChange={(e) => {
                                                                    const selectedFile = e.target.files[0];
                                                                    
                                                                    if (selectedFile) {
                                                                        // Validação de tipo de arquivo
                                                                        const allowedTypes = [
                                                                            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                                                                            'application/pdf', 'text/plain',
                                                                            'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/mp4',
                                                                            'video/mp4', 'video/webm', 'video/quicktime'
                                                                        ];
                                                                        
                                                                        if (!allowedTypes.includes(selectedFile.type)) {
                                                                            toast.error(`Tipo de arquivo não suportado: ${selectedFile.type}`);
                                                                            return;
                                                                        }
                                                                        
                                                                        // Validação de tamanho (50MB)
                                                                        if (selectedFile.size > 50 * 1024 * 1024) {
                                                                            toast.error('Arquivo muito grande. Limite: 50MB');
                                                                            return;
                                                                        }
                                                                        
                                                                        // Salva o arquivo no Formik
                                                                        setFieldValue(`options[${index}].file`, selectedFile);
                                                                        setFieldValue(`options[${index}].previewUrl`, URL.createObjectURL(selectedFile));
                                                                        setFieldValue(`options[${index}].mediaType`, selectedFile.type);
                                                                        
                                                                        // Atualiza nome exibido
                                                                        const updatedFileNames = [...selectedFileNames];
                                                                        updatedFileNames[index] = selectedFile.name;
                                                                        setSelectedFileNames(updatedFileNames);
                                                                        
                                                                        // Auto-preenche nome se estiver vazio
                                                                        if (!values.options[index]?.name) {
                                                                            setFieldValue(`options[${index}].name`, selectedFile.name);
                                                                        }
                                                                        
                                                                        toast.success(`Arquivo "${selectedFile.name}" adicionado com sucesso!`);
                                                                    }
                                                                }}
                                                                style={{ display: 'none' }}
                                                                name={`options[${index}].file`}
                                                                id={`file-upload-${index}`}
                                                                accept="image/*,audio/*,video/*,application/pdf,text/plain"
                                                            />
                                                            <label htmlFor={`file-upload-${index}`}>
                                                                <IconButton 
                                                                    component="span" 
                                                                    color={info.file || info.url ? 'primary' : 'default'}
                                                                    title="Selecionar arquivo"
                                                                >
                                                                    <AttachFileIcon />
                                                                </IconButton>
                                                            </label>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    // Limpa preview URL se existir
                                                                    if (info.previewUrl) {
                                                                        URL.revokeObjectURL(info.previewUrl);
                                                                    }
                                                                    remove(index);
                                                                    // Remove do array de nomes também
                                                                    const updatedFileNames = [...selectedFileNames];
                                                                    updatedFileNames.splice(index, 1);
                                                                    setSelectedFileNames(updatedFileNames);
                                                                }}
                                                                title="Remover item"
                                                                color="secondary"
                                                            >
                                                                <DeleteOutlineIcon />
                                                            </IconButton>
                                                        </Grid>
                                                    </Grid>

                                                ))}
                                            <div className={classes.extraAttr}>
                                                <Button
                                                    style={{ flex: 1, marginTop: 8 }}
                                                    variant="outlined"
                                                    color="primary"
                                                    onClick={() => {
                                                        push({ name: "", path: "", mediaType: "" });
                                                        setSelectedFileNames([...selectedFileNames, ""]);
                                                    }}
                                                >
                                                    {`+ ${i18n.t("fileModal.buttons.fileOptions")}`}
                                                </Button>
                                            </div>
                                            
                                            {values.options.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                                    <AttachFileIcon style={{ fontSize: '3rem', marginBottom: '16px' }} />
                                                    <Typography variant="body1">
                                                        Nenhum arquivo adicionado ainda
                                                    </Typography>
                                                    <Typography variant="body2" style={{ marginTop: '8px' }}>
                                                        Clique em "+ ADICIONAR ARQUIVO" para começar
                                                    </Typography>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </FieldArray>
                            </DialogContent>
                            {viewingMedia && (
                                <MediaViewerModal
                                    open={mediaViewerModalOpen}
                                    onClose={() => setMediaViewerModalOpen(false)}
                                    url={viewingMedia.url}
                                    mediaType={viewingMedia.mediaType}
                                    name={viewingMedia.name}
                                />
                            )}
                            <DialogActions>
                                <Button
                                    onClick={handleClose}
                                    color="secondary"
                                    disabled={isSubmitting}
                                    variant="outlined"
                                >
                                    {i18n.t("fileModal.buttons.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    disabled={isSubmitting}
                                    variant="contained"
                                    className={classes.btnWrapper}
                                >
                                    {fileListId
                                        ? `${i18n.t("fileModal.buttons.okEdit")}`
                                        : `${i18n.t("fileModal.buttons.okAdd")}`}
                                    {isSubmitting && (
                                        <CircularProgress
                                            size={24}
                                            className={classes.buttonProgress}
                                        />
                                    )}
                                </Button>
                            </DialogActions>
                        </Form>
                    )}
                </Formik>
            </Dialog>
        </div>
    );
};

export default FilesModal;