import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
import DripSequenceEnrollment from "../../models/DripSequenceEnrollment";

interface Request {
  companyId: number;
  contactId: number;
  tagId: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
      nextSendAt: new Date(Date.now() + firstStep.delayDays * MS_PER_DAY)
    });
  }
};

export default EnrollContactInDripSequencesService;
