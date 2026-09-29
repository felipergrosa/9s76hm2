import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
import DripSequenceEnrollment from "../../models/DripSequenceEnrollment";

interface Request {
  companyId: number;
  contactId: number;
  tagId: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

// Mesma regra do DripSequenceQueue.clampToSendWindow — duplicada aqui para não
// importar o módulo da fila (que instancia Bull/Redis no carregamento)
const clampToSendWindow = (
  date: Date,
  windowStart?: string | null,
  windowEnd?: string | null
): Date => {
  if (!windowStart || !windowEnd) return date;
  const [sh, sm] = windowStart.split(":").map(Number);
  const [eh, em] = windowEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return date;
  const start = new Date(date); start.setHours(sh, sm, 0, 0);
  const end = new Date(date); end.setHours(eh, em, 0, 0);
  if (date < start) return start;
  if (date > end) {
    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    return next;
  }
  return date;
};

/**
 * Inscreve o contato em qualquer sequência de drip ativa vinculada à tag recém-aplicada.
 * Chamado pelo hook @AfterCreate de ContactTag — cobre qualquer caminho que aplique a tag
 * (importação, regra automática, IA, ação manual), sem precisar alterar os ~16 pontos do
 * código que hoje criam ContactTag.
 */
const EnrollContactInDripSequencesService = async ({
  companyId,
  contactId,
  tagId
}: Request): Promise<void> => {
  const sequences = await DripSequence.findAll({
    where: { companyId, tagId, active: true }
  });

  for (const sequence of sequences) {
    const [enrollment, created] = await DripSequenceEnrollment.findOrCreate({
      where: { dripSequenceId: sequence.id, contactId },
      defaults: {
        dripSequenceId: sequence.id,
        contactId,
        companyId,
        currentStepIndex: 0,
        status: "active",
        enrolledAt: new Date()
      } as any
    });

    if (!created) {
      continue;
    }

    const firstStep = await DripSequenceStep.findOne({
      where: { dripSequenceId: sequence.id },
      order: [["order", "ASC"]]
    });

    if (!firstStep) {
      await enrollment.update({ status: "completed" });
      continue;
    }

    await enrollment.update({
      nextSendAt: clampToSendWindow(
        new Date(
          Date.now() +
            firstStep.delayDays * MS_PER_DAY +
            (firstStep.delayMinutes || 0) * MS_PER_MINUTE
        ),
        sequence.sendWindowStart,
        sequence.sendWindowEnd
      )
    });
  }
};

export default EnrollContactInDripSequencesService;
