/**
 * FACADE de compatibilidade.
 *
 * A implementação dos middlewares de autorização foi extraída para
 * modules/permissions/guards.ts. Este arquivo apenas re-exporta os
 * símbolos para manter intactos os imports existentes.
 */
export * from "../modules/permissions/guards";
export { default } from "../modules/permissions/guards";
