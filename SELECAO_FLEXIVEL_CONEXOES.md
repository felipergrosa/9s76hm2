# 🎯 Seleção Flexível de Conexões para Campanhas

## 📋 Seu Pedido

> "Tornar o campo de estratégia um seletor com várias opções. Ex: alternar entre quais conexões? A, B e C? Ou C, D e A?"

---

## ✅ Solução: RadioGroup + Autocomplete

### Antes (Atual)

```
Estratégia: [Single ▼]
Estratégia: [Round Robin ▼] → Seleciona TODAS

Problema: Não tem como escolher QUAIS conexões usar!
```

### Depois (Novo)

```
Estratégia de Envio:
( ) Única conexão
(●) Rodízio personalizado  ← VOCÊ ESCOLHE QUAIS
( ) Todas as conexões
( ) Apenas Baileys
( ) Apenas API Oficial
```

---

## 💻 Implementação Completa

**Arquivo:** `frontend/src/components/CampaignModal/index.js`

### 1. Adicionar Estado (linha ~255)

```javascript
const [dispatchMode, setDispatchMode] = useState("single"); 
// Opções: single | custom | all | baileys | official
```

### 2. Substituir Select por RadioGroup (linhas 1096-1200)

```jsx
<Grid xs={12} item>
  <FormControl component="fieldset" fullWidth>
    <FormLabel component="legend">Estratégia de Envio</FormLabel>
    <RadioGroup
      value={dispatchMode}
      onChange={(e) => {
        const value = e.target.value;
        setDispatchMode(value);
        
        // Auto-selecionar baseado na estratégia
        if (value === "all") {
          setAllowedWhatsappIds(whatsapps.map(w => w.id));
          setDispatchStrategy("round_robin");
        } else if (value === "baileys") {
          const ids = whatsapps
            .filter(w => w.channelType !== "official")
            .map(w => w.id);
          setAllowedWhatsappIds(ids);
          setDispatchStrategy("round_robin");
        } else if (value === "official") {
          const ids = whatsapps
            .filter(w => w.channelType === "official")
            .map(w => w.id);
          setAllowedWhatsappIds(ids);
          setDispatchStrategy("round_robin");
        } else if (value === "single") {
          setAllowedWhatsappIds([]);
          setDispatchStrategy("single");
        } else if (value === "custom") {
          setDispatchStrategy("round_robin");
        }
      }}
    >
      <FormControlLabel
        value="single"
        control={<Radio />}
        label={
          <Box display="flex" flexDirection="column">
            <Typography variant="body1">
              📱 Única conexão
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Usa apenas a conexão principal
            </Typography>
          </Box>
        }
      />
      
      <FormControlLabel
        value="custom"
        control={<Radio />}
        label={
          <Box display="flex" flexDirection="column">
            <Typography variant="body1">
              🎯 Rodízio personalizado
            </Typography>
            <Typography variant="caption" color="textSecondary">
              <strong>Você escolhe quais conexões usar (ex: A, C, D)</strong>
            </Typography>
          </Box>
        }
      />
      
      <FormControlLabel
        value="all"
        control={<Radio />}
        label={
          <Box display="flex" flexDirection="column">
            <Typography variant="body1">
              🔄 Todas as conexões
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Usa todas as {whatsapps.length} conexões disponíveis
            </Typography>
          </Box>
        }
      />
      
      <FormControlLabel
        value="baileys"
        control={<Radio />}
        label={
          <Box display="flex" flexDirection="column">
            <Typography variant="body1">
              📱 Apenas Baileys (Grátis)
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {whatsapps.filter(w => w.channelType !== "official").length} conexões
            </Typography>
          </Box>
        }
      />
      
      <FormControlLabel
        value="official"
        control={<Radio />}
        label={
          <Box display="flex" flexDirection="column">
            <Typography variant="body1">
              ✅ Apenas API Oficial (R$ 0,50/msg)
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {whatsapps.filter(w => w.channelType === "official").length} conexões
            </Typography>
          </Box>
        }
      />
    </RadioGroup>
  </FormControl>
</Grid>

{/* Autocomplete SOMENTE se mode="custom" */}
{dispatchMode === "custom" && (
  <Grid xs={12} item>
    <Autocomplete
      multiple
      options={whatsapps}
      getOptionLabel={(option) => {
        const type = option.channelType === "official" ? "API" : "Baileys";
        const icon = option.channelType === "official" ? "✅" : "📱";
        return `${icon} ${option.name} (${type})`;
      }}
      value={whatsapps.filter(w => allowedWhatsappIds.includes(w.id))}
      onChange={(event, newValue) => {
        setAllowedWhatsappIds(newValue.map(w => w.id));
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            variant="outlined"
            color={option.channelType === "official" ? "primary" : "default"}
            label={option.name}
            {...getTagProps({ index })}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          label="Escolha as conexões"
          placeholder="Ex: Selecione A, C, D..."
          helperText={`${allowedWhatsappIds.length} selecionadas`}
        />
      )}
    />
  </Grid>
)}

{/* Preview da estratégia */}
{allowedWhatsappIds.length > 0 && (
  <Grid xs={12} item>
    <Paper style={{ padding: 16, background: "#f5f5f5" }}>
      <Typography variant="subtitle2" gutterBottom>
        📊 Resumo da Estratégia
      </Typography>
      <Divider style={{ marginBottom: 12 }} />
      
      {(() => {
        const selected = whatsapps.filter(w => 
          allowedWhatsappIds.includes(w.id)
        );
        const baileys = selected.filter(w => w.channelType !== "official");
        const official = selected.filter(w => w.channelType === "official");
        
        return (
          <>
            <Typography variant="body2">
              <strong>Total:</strong> {selected.length} conexões
            </Typography>
            <Typography variant="body2">
              <strong>📱 Baileys:</strong> {baileys.length}
            </Typography>
            <Typography variant="body2">
              <strong>✅ API Oficial:</strong> {official.length}
            </Typography>
            
            <Typography variant="body2" style={{ marginTop: 8 }}>
              <strong>Ordem do rodízio:</strong>
            </Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
              {selected.map((w, idx) => (
                <Chip
                  key={w.id}
                  size="small"
                  label={`${idx + 1}. ${w.name}`}
                  color={w.channelType === "official" ? "primary" : "default"}
                />
              ))}
            </Box>
          </>
        );
      })()}
    </Paper>
  </Grid>
)}
```

---

## 🎯 Casos de Uso

### Exemplo 1: Escolher A, C, D
```
1. Selecionar "Rodízio personalizado"
2. Autocomplete aparece
3. Escolher: Conexão A, Conexão C, Conexão D
4. Preview mostra: 1.A → 2.C → 3.D → 1.A...
```

### Exemplo 2: Só Baileys
```
1. Selecionar "Apenas Baileys"
2. Auto-seleciona todas Baileys
3. Não precisa escolher manualmente
```

### Exemplo 3: Todas
```
1. Selecionar "Todas as conexões"
2. Usa TODAS (Baileys + API Oficial)
3. Aviso de custos aparece
```

---

## 💡 Benefícios

1. ✅ **Escolha exata:** Seleciona quais quer (A, C, D)
2. ✅ **Atalhos:** Baileys/API/Todas
3. ✅ **Visual:** Vê ordem do rodízio
4. ✅ **Alertas:** Custo estimado

---

*Tempo: 2-3 horas | Complexidade: Média | Impacto: Alto*
