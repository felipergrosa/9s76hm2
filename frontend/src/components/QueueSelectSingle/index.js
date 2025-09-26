import React, { useEffect, useState } from "react";
import { Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles(theme => ({
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
}));

const QueueSelectSingle = ({ selectedQueueId, onChange, label }) => {
    const classes = useStyles();
    const [queues, setQueues] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/queue");
                setQueues(data);
                // Debug removido - funcionando corretamente
            } catch (err) {
                toastError(`QUEUESELETSINGLE >>> ${err}`);
            }
        })();
    }, []);

    // Verificar se o selectedQueueId existe nas filas quando ambos estão disponíveis
    useEffect(() => {
        if (selectedQueueId && queues.length > 0) {
            const queueExists = queues.some(queue => queue.id === selectedQueueId);
            if (!queueExists) {
                console.warn(`Fila ID ${selectedQueueId} não encontrada nas filas disponíveis`);
                // Resetar para valor vazio se a fila não existir
                if (onChange) onChange("");
            }
        }
    }, [selectedQueueId, queues, onChange]);

    const labelText = label || i18n.t("queueSelect.inputLabel");

    return (
        <div style={{ marginTop: 6 }}>
            <FormControl
                variant="outlined"
                className={classes.formControl}
                margin="dense"
                fullWidth
            >
                <div>
                    <Typography>
                        {labelText}
                    </Typography>
                    {typeof onChange === "function" ? (
                        <Select
                            label={labelText}
                            labelId="queue-selection-label"
                            id="queue-selection"
                            fullWidth
                            value={
                                selectedQueueId && queues.some(q => q.id === selectedQueueId) 
                                    ? selectedQueueId 
                                    : ""
                            }
                            onChange={e => onChange(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Selecione uma fila</em>
                            </MenuItem>
                            {queues.map(queue => (
                                <MenuItem key={queue.id} value={queue.id}>
                                    {queue.name}
                                </MenuItem>
                            ))}
                        </Select>
                    ) : (
                        <Field
                            as={Select}
                            label={labelText}
                            name="queueId"
                            labelId="queue-selection-label"
                            id="queue-selection"
                            fullWidth
                        >
                            <MenuItem value="">
                                <em>Selecione uma fila</em>
                            </MenuItem>
                            {queues.map(queue => (
                                <MenuItem key={queue.id} value={queue.id}>
                                    {queue.name}
                                </MenuItem>
                            ))}
                        </Field>
                    )}
                </div>
            </FormControl>
        </div>
    );
};

export default QueueSelectSingle;
