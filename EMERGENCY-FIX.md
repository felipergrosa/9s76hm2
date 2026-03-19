# 🔧 EMERGÊNCIA: CORREÇÃO DE CRASH DO BACKEND

## PROBLEMAS RESOLVIDOS:
1. ✅ Memory leak no contacts.upsert (loop infinito)
2. ✅ Pasta de volume criada: /opt/whaticket-data/public/company1
3. ✅ Aumento de memória: 6GB RAM, 3GB Node heap
4. ✅ Rate limiting: 30 segundos cooldown entre processamentos
5. ✅ Processamento em batches de 50 contatos

## COMO APLICAR AS CORREÇÕES:

### 1. No Portainer (Produção):
```bash
# Acesse o Portainer do seu servidor
# Vá para Stacks > whaticket > Editor
# Cole o conteúdo atualizado do stack.portainer.yml
# Clique em "Update the stack"
```

### 2. Via CLI (se tiver acesso):
```bash
# Fazer deploy da stack atualizada
docker stack deploy -c frontend/stack.portainer.yml whaticket

# Verificar status
docker service ls | grep whaticket
docker service logs whaticket_whaticketback --follow
```

### 3. Aguardar estabilização:
- Backend deve subir em 2-3 minutos
- Verificar logs: não deve mais mostrar "JavaScript heap out of memory"
- Arquivo contactJson.txt deve ser criado sem erros

## MONITORAMENTO:

### Logs esperados após correção:
```
[contacts.upsert] Processando 150 contatos (batch 1/3)
[contacts.upsert] Rate limiting active - ignorando 500 contatos
contactJson.txt atualizado com 150 contatos
```

### Logs problemáticos (que NÃO devem mais aparecer):
```
FATAL ERROR: Ineffective mark-compacts near heap limit
Failed to write contactJson.txt: ENOENT: no such file or directory
```

## SE PERSISTIR:

### 1. Limpar dados corrompidos:
```bash
# Remover arquivo problemático se existir
rm -f /opt/whaticket-data/public/company1/contactJson.txt

# Limpar cache do Redis se necessário
docker exec redis redis-cli FLUSHDB
```

### 2. Reset manual do backend:
```bash
# Forçar recriação do serviço
docker service update --force whaticket_whaticketback
```

### 3. Verificar recursos:
```bash
# Verificar uso de memória
docker stats

# Verificar espaço em disco
df -h /opt/whaticket-data
```

## PREVENÇÃO FUTURA:

1. **Monitoramento**: Configurar alertas para uso de memória > 80%
2. **Backups**: Backup automático da pasta /opt/whaticket-data
3. **Logs**: Configurar log rotation para não encher o disco
4. **Health checks**: Adicionar health check no container backend

## CONTATO DE EMERGÊNCIA:
Se o backend não subir após as correções, verificar:
- Recursos disponíveis no nó do Swarm
- Permissões da pasta /opt/whaticket-data
- Conflitos de porta ou rede
- Logs detalhados: `docker service logs whaticket_whaticketback --tail 100`
