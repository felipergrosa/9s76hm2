/**
 * ============================================================================
 * BULL QUEUE GLOBAL - Sistema de Jobs e Event-Driven Architecture
 * ============================================================================
 * 
 * Local: src/queue/
 * 
 * ARQUITETURA:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                           BULL QUEUE GLOBAL                                │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐ │
 * │  │  EventTrigger   │─────▶│  BullScheduler  │─────▶│   Bull Queue        │ │
 * │  │  (src/queue/)   │      │  (src/queue/)   │      │   (Redis)           │ │
 * │  └─────────────────┘      └─────────────────┘      └─────────────────────┘ │
 * │           │                                                        │        │
 * │           │                                                        │        │
 * │           ▼                                                        ▼        │
 * │  ┌─────────────────┐                                      ┌────────────────┐ │
 * │  │  Model Hooks    │                                      │  Job Handlers  │ │
 * │  │  (afterCreate)  │                                      │  (src/jobs/)   │ │
 * │  └─────────────────┘                                      └────────────────┘ │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * FLUXO DE TRABALHO:
 * 
 * 1. EVENTO OCORRE (ex: Contato criado)
 *    └─▶ Modelo dispara hook afterCreate
 * 
  * 2. EVENT TRIGGER CAPTURA
 *    └─▶ EventTrigger.emitContactCreated(contact)
 *    └─▶ Callbacks registrados são executados
 * 
 * 3. JOB É AGENDADO
 *    └─▶ BullScheduler.schedule('TagRules', data, options)
 *    └─▶ Job salvo no Redis com delay/configurações
 * 
 * 4. EXECUÇÃO
 *    └─▶ Quando tempo chega, Bull processa
 *    └─▶ Handler em src/jobs/ é chamado
 * 
 * ============================================================================
 * 
 * COMO CRIAR UM NOVO JOB:
 * 
 * Passo 1: Criar o Job Handler
 * --------------------------------
 * Arquivo: src/jobs/MeuNovoJob.ts
 * 
 * ```typescript
 * export default {
 *   key: `${process.env.DB_NAME}-MeuNovoJob`,
 *   
 *   async handle({ data }) {
 *     const { param1, param2 } = data || {};
 *     
 *     // Validação
 *     if (!param1) {
 *       throw new Error("param1 obrigatório");
 *     }
 *     
 *     // Lógica do job
 *     console.log(`Processando ${param1}`);
 *     
 *     // Retorno opcional
 *     return { success: true };
 *   }
 * };
 * ```
 * 
 * Passo 2: Exportar no index
 * --------------------------------
 * Arquivo: src/jobs/index.ts
 * 
 * ```typescript
 * export { default as MeuNovoJob } from './MeuNovoJob';
 * ```
 * 
 * Passo 3: Registrar Event Trigger (opcional)
 * --------------------------------
 * Arquivo: src/queue/EventTrigger.ts ou hook do modelo
 * 
 * ```typescript
 * // Quando contato é criado, agenda job
 * EventTrigger.onContactCreated(async (contact) => {
 *   await BullScheduler.schedule('MeuNovoJob', {
 *     contactId: contact.id
 *   }, {
 *     delay: 5000, // 5 segundos depois
 *     jobId: `meu-job-${contact.id}` // único
 *   });
 * });
 * ```
 * 
 * Passo 4: Ou agendar manualmente
 * --------------------------------
 * ```typescript
 * import { BullScheduler } from "./queue/BullScheduler";
 * 
 * // Imediato
 * await BullScheduler.schedule('MeuNovoJob', { id: 123 });
 * 
 * // Com delay
 * await BullScheduler.schedule('MeuNovoJob', { id: 123 }, {
 *   delay: 3600000 // 1 hora
 * });
 * 
 * // Recorrente (substitui cron)
 * await BullScheduler.scheduleRecurring('MeuNovoJob', {}, '0 2 * * *');
 * ```
 * 
 * ============================================================================
 * 
 * MIGRAÇÃO DE CRON PARA BULL:
 * 
 * ANTES (cron - polling constante):
 * ```typescript
 * cron.schedule('* * * * *', async () => {
 *   const items = await Model.findAll({ where: { status: 'pending' } });
 *   for (const item of items) {
 *     await process(item);
 *   }
 * });
 * ```
 * 
 * DEPOIS (Bull - event-driven):
 * ```typescript
 * // No hook do modelo
 * Model.afterCreate(async (instance) => {
 *   await BullScheduler.schedule('ProcessItem', {
 *     id: instance.id
 *   }, {
 *     delay: 60000, // 1 min depois
 *     jobId: `process-${instance.id}`
 *   });
 * });
 * ```
 * 
 * VANTAGENS:
 * ✓ Sem polling no banco
 * ✓ Escalável (milhares de jobs)
 * ✓ Persistente (sobrevive restart)
 * ✓ Retry automático
 * ✓ Deduplicação via jobId
 * 
 * ============================================================================
 * 
 * BOAS PRÁTICAS:
 * 
 * 1. SEMPRE use jobId para jobs que não devem duplicar
 *    jobId: `operation-${entityId}`
 * 
 * 2. SEMPRE valide dados no início do handler
 *    if (!requiredField) throw new Error("...");
 * 
 * 3. SEMPRE use try/catch e logue erros
 * 
 * 4. NUNCA faça operações bloqueantes longas sem timeout
 * 
 * 5. PARA jobs recorrentes, prefira scheduleRecurring em vez de cron
 * 
 * 6. USE delay com moderação - jobs muito distantes ocupam memória Redis
 * 
 * ============================================================================
 * 
 * REFERÊNCIA RÁPIDA:
 * 
 * BullScheduler.schedule(name, data, options)
 *   - delay: ms antes de executar
 *   - jobId: string única (evita duplicatas)
 *   - attempts: número de retries (padrão: 3)
 *   - priority: 1-10 (menor = mais prioritário)
 * 
 * BullScheduler.scheduleRecurring(name, data, cron)
 *   - cron: expressão cron padrão
 * 
 * BullScheduler.cancel(name, jobId)
 *   - Cancela job agendado
 * 
 * BullScheduler.reschedule(name, jobId, data, options)
 *   - Remove anterior e agenda novo
 * 
 * EventTrigger.onContactCreated(callback)
 * EventTrigger.onContactUpdated(callback)
 * EventTrigger.onTicketCreated(callback)
 * EventTrigger.onTicketUpdated(callback)
 * EventTrigger.onTicketMessaged(callback)
 * EventTrigger.onMessageCreated(callback)
 * EventTrigger.onLidMappingSaved(callback)
 * EventTrigger.onSessionDisconnected(callback)
 * EventTrigger.onSessionReconnected(callback)
 * 
 * ============================================================================
 */

export {};
