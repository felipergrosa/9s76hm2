import DripSequenceEnrollment from "../../models/DripSequenceEnrollment";
import Contact from "../../models/Contact";

const ListEnrollmentsService = async (
  dripSequenceId: string | number
): Promise<DripSequenceEnrollment[]> => {
  return DripSequenceEnrollment.findAll({
    where: { dripSequenceId },
    include: [{ model: Contact, attributes: ["id", "name", "number"] }],
    order: [["createdAt", "DESC"]],
    limit: 200
  });
};

export default ListEnrollmentsService;
