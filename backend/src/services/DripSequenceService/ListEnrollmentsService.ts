import DripSequenceEnrollment from "../../models/DripSequenceEnrollment";
import Contact from "../../models/Contact";

const ListEnrollmentsService = async (
  dripSequenceId: string | number,
  companyId: number
): Promise<DripSequenceEnrollment[]> => {
  // N2 (IDOR): inscrições restritas ao tenant autenticado
  return DripSequenceEnrollment.findAll({
    where: { dripSequenceId, companyId },
    include: [{ model: Contact, attributes: ["id", "name", "number"] }],
    order: [["createdAt", "DESC"]],
    limit: 200
  });
};

export default ListEnrollmentsService;
