/**
 * FACADE de compatibilidade.
 *
 * A implementação foi extraída para o módulo dedicado:
 *   - modules/permissions/catalog.ts  → catálogo de permissões e metadados
 *   - modules/permissions/resolver.ts → resolução de permissões (perfil/flags + Roles)
 *
 * Este arquivo apenas re-exporta os símbolos para manter intactos os
 * centenas de imports existentes que apontam para helpers/PermissionAdapter.
 */
export * from "../modules/permissions/catalog";
export * from "../modules/permissions/resolver";
