const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('🔧 Aplicando modificações no QueueModal...');
console.log('📂 Caminho do arquivo:', filePath);


// Ler arquivo
let content = fs.readFileSync(filePath, 'utf8');
console.log('📄 Conteúdo inicial (primeiros 500 chars):');
console.log(content.substring(0, 500));
console.log('----------------------------------------');
const originalContent = content;

// PASSO 1: Adicionar import (após ColorBoxModal)
const importTarget = 'import ColorBoxModal from "../ColorBoxModal";\n// import { ColorBox } from "material-ui-color";';
const importReplacement = 'import ColorBoxModal from "../ColorBoxModal";\nimport useRAGCollections from "../../hooks/useRAGCollections";\n// import { ColorBox } from "material-ui-color";';

if (!content.includes('useRAGCollections')) {
  content = content.replace(importTarget, importReplacement);
  console.log('✅ Passo 1: Import adicionado');
} else {
  console.log('⏭️  Passo 1: Import já existe');
}

// PASSO 2: Instanciar hook (após isMounted)
const hookTarget = '  const isMounted = useRef(true);';
const hookReplacement = '  const isMounted = useRef(true);\n  const { collections: ragCollections, loading: ragLoading } = useRAGCollections();';

if (!content.includes('ragCollections')) {
  content = content.replace(hookTarget, hookReplacement);
  console.log('✅ Passo 2: Hook instanciado');
} else {
  console.log('⏭️  Passo 2: Hook já instanciado');
}

// PASSO 3: Substituir campo TextField por Select
// Buscar o Grid que contém "Coleção RAG"
const fieldRegex = /<Grid item xs={12}>[\s\S]*?name="ragCollection"[\s\S]*?<\/Grid>/;

const fieldReplacement = `<Grid item xs={12}>
                    <FormControl variant="outlined" margin="dense" fullWidth>
                      <InputLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          Coleção RAG
                          <Tooltip title="Base de conhecimento que a IA usará para responder perguntas. Selecione uma coleção ou deixe vazio para desativar o bot inteligente." arrow>
                            <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                          </Tooltip>
                        </div>
                      </InputLabel>
                      <Field
                        as={Select}
                        label="Coleção RAG"
                        name="ragCollection"
                        value={values.ragCollection || ""}
                        disabled={ragLoading}
                      >
                        <MenuItem value="">
                          <em>Nenhuma (Bot desativado)</em>
                        </MenuItem>
                        {ragCollections.map((coll) => (
                          <MenuItem key={coll.id} value={coll.name}>
                            {coll.label}
                          </MenuItem>
                        ))}
                      </Field>
                    </FormControl>
                    
                    {ragLoading && (
                      <Typography variant="caption" color="textSecondary" style={{ display: 'block', marginTop: 4 }}>
                        Carregando coleções disponíveis...
                      </Typography>
                    )}
                    
                    {values.ragCollection && (
                      <Box mt={1} p={1.5} bgcolor="#f5f5f5" borderRadius={1}>
                        <Typography variant="caption" color="textSecondary">
                          ✅ Bot ativado com coleção: <strong>{values.ragCollection}</strong>
                        </Typography>
                      </Box>
                    )}
                  </Grid>`;

if (content.match(fieldRegex)) {
  content = content.replace(fieldRegex, fieldReplacement);
  console.log('✅ Passo 3: Campo TextField substituído por Select');
} else {
  console.log('⚠️  Passo 3: Campo não encontrado - pode já estar modificado');
}

//  Salvar apenas se houve mudanças
if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ SUCESSO! Arquivo modificado com 3 passos aplicados.');
  console.log('\n📋 Próximos passos:');
  console.log('1. Testar o modal de fila');
  console.log('2. Verificar se o dropdown aparece');
  console.log('3. Testar seleção e salvamento');
} else {
  console.log('\n⏭️  Nenhuma modificação necessária - arquivo já está atualizado!');
}
