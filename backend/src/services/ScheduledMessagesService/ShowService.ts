import ScheduledMessages from "../../models/ScheduledMessages";
import AppError from "../../errors/AppError";

const ScheduleService = async (
  id: string | number,
  companyId: number
): Promise<ScheduledMessages> => {
  const schedule = await ScheduledMessages.findOne({
    where: { id, companyId }
  });

  if (!schedule) {
    throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
  }

  return schedule;
};

export default ScheduleService;
