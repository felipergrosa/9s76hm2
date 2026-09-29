import React, { useEffect, useState } from "react";
import {
	Grid,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	FormControlLabel,
	Checkbox,
} from "@material-ui/core";
import api from "../../services/api";

/**
 * Renderiza os campos customizados configurados em /admin-custom-fields.
 *
 * Os valores ficam no array Formik `extraInfo` no formato
 * { name: config.key, value, type, options } — o backend valida por tipo
 * e o match config<->valor é feito por `name === config.key`.
 * Entradas legadas de extraInfo (sem config correspondente) são preservadas
 * porque permanecem no array mesmo sem serem renderizadas.
 */
export default function CustomFieldsInputs({
	entityType = "lead",
	values,
	setFieldValue,
	onLoadConfigs,
}) {
	const [configs, setConfigs] = useState([]);

	useEffect(() => {
		let mounted = true;
		api
			.get(`/custom-field-configs?entityType=${entityType}`)
			.then(({ data }) => {
				if (!mounted) return;
				const list = Array.isArray(data) ? data : [];
				setConfigs(list);
				if (onLoadConfigs) onLoadConfigs(list);
			})
			.catch(() => {
				if (!mounted) return;
				setConfigs([]);
				if (onLoadConfigs) onLoadConfigs([]);
			});
		return () => {
			mounted = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entityType]);

	const getEntry = (cfg) =>
		(Array.isArray(values.extraInfo) ? values.extraInfo : []).find(
			(e) => e.name === cfg.key
		);

	const setValue = (cfg, value) => {
		const current = Array.isArray(values.extraInfo) ? values.extraInfo : [];
		const idx = current.findIndex((e) => e.name === cfg.key);
		const entry = {
			name: cfg.key,
			value,
			type: cfg.type,
			options: cfg.options,
		};
		if (idx === -1) {
			setFieldValue("extraInfo", [...current, entry]);
		} else {
			const next = [...current];
			next[idx] = { ...next[idx], ...entry };
			setFieldValue("extraInfo", next);
		}
	};

	const renderField = (cfg) => {
		const entry = getEntry(cfg);
		const value = entry ? entry.value : "";
		const label = cfg.required ? `${cfg.label} *` : cfg.label;

		switch (cfg.type) {
			case "number":
				return (
					<TextField
						label={label}
						type="number"
						variant="outlined"
						margin="dense"
						fullWidth
						value={value ?? ""}
						onChange={(e) => setValue(cfg, e.target.value)}
					/>
				);
			case "date":
				return (
					<TextField
						label={label}
						type="date"
						variant="outlined"
						margin="dense"
						fullWidth
						InputLabelProps={{ shrink: true }}
						value={value ?? ""}
						onChange={(e) => setValue(cfg, e.target.value)}
					/>
				);
			case "boolean":
				return (
					<FormControlLabel
						control={
							<Checkbox
								color="primary"
								checked={String(value) === "true"}
								onChange={(e) => setValue(cfg, e.target.checked ? "true" : "false")}
							/>
						}
						label={label}
						style={{ marginTop: 8 }}
					/>
				);
			case "select":
				return (
					<FormControl variant="outlined" margin="dense" fullWidth>
						<InputLabel>{label}</InputLabel>
						<Select
							value={value || ""}
							onChange={(e) => setValue(cfg, e.target.value)}
							label={label}
						>
							<MenuItem value="">
								<em>—</em>
							</MenuItem>
							{(Array.isArray(cfg.options) ? cfg.options : []).map((opt) => (
								<MenuItem key={opt} value={opt}>
									{opt}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				);
			default:
				return (
					<TextField
						label={label}
						variant="outlined"
						margin="dense"
						fullWidth
						value={value ?? ""}
						onChange={(e) => setValue(cfg, e.target.value)}
					/>
				);
		}
	};

	if (!configs.length) return null;

	return (
		<Grid container spacing={1}>
			{configs.map((cfg) => (
				<Grid item xs={12} md={6} key={cfg.id}>
					{renderField(cfg)}
				</Grid>
			))}
		</Grid>
	);
}
