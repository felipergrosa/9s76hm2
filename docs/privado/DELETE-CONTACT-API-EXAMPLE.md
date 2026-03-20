# Exemplo de requisição DELETE para excluir contato via API

## Endpoint
DELETE /api/contacts/:id

## Headers
Authorization: Bearer <COMPANY_TOKEN>
Content-Type: application/json

## Parâmetros
- Path: `id` (string) - ID do contato a ser excluído
- Query/Body: `companyId` (number) - ID da empresa

## Exemplo com curl
```bash
# Excluir contato ID 123 da empresa 1
curl -X DELETE \
  http://localhost:8080/api/contacts/123?companyId=1 \
  -H "Authorization: Bearer qsFj2s8e2XY85oHcNMAvEw" \
  -H "Content-Type: application/json"
```

## Exemplo com companyId no body
```bash
curl -X DELETE \
  http://localhost:8080/api/contacts/123 \
  -H "Authorization: Bearer qsFj2s8e2XY85oHcNMAvEw" \
  -H "Content-Type: application/json" \
  -d '{"companyId": 1}'
```

## Resposta de sucesso
```json
{
  "message": "Contact deleted"
}
```

## Resposta de erro
```json
{
  "error": "Não é possível excluir registro de outra empresa"
}
```

## Notas
- O endpoint usa o middleware `isAuthCompany` que valida o `COMPANY_TOKEN`
- O `companyId` é obrigatório e pode ser enviado como query parameter ou no body
- A exclusão é permitida apenas para contatos da mesma empresa
- Não há restrição de carteira para exclusão via API (bypassWalletRestriction=true)
