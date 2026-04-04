interface WorkShiftWindow {
  startsAt: Date;
  endsAt: Date;
}

const DEFAULT_START_WORK = "00:00";
const DEFAULT_END_WORK = "23:59";

const parseTime = (value?: string): { hours: number; minutes: number } => {
  const safeValue = (value || "").trim() || DEFAULT_START_WORK;
  const [hoursText = "0", minutesText = "0"] = safeValue.split(":");

  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  return {
    hours: Number.isNaN(hours) ? 0 : hours,
    minutes: Number.isNaN(minutes) ? 0 : minutes
  };
};

const buildDateAtTime = (
  referenceDate: Date,
  hours: number,
  minutes: number,
  dayOffset: number = 0
): Date => {
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
};

export const getWorkShiftWindowForReference = (
  referenceDate: Date,
  startWork?: string,
  endWork?: string
): WorkShiftWindow => {
  const safeReferenceDate = new Date(referenceDate);
  const safeStartWork = (startWork || DEFAULT_START_WORK).trim() || DEFAULT_START_WORK;
  const safeEndWork = (endWork || DEFAULT_END_WORK).trim() || DEFAULT_END_WORK;

  const start = parseTime(safeStartWork);
  const end = parseTime(safeEndWork);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const referenceMinutes =
    safeReferenceDate.getHours() * 60 + safeReferenceDate.getMinutes();

  // Mesmo horário de início/fim = plantão contínuo naquele dia.
  if (safeStartWork === safeEndWork) {
    return {
      startsAt: buildDateAtTime(safeReferenceDate, 0, 0),
      endsAt: buildDateAtTime(safeReferenceDate, 23, 59)
    };
  }

  if (startMinutes < endMinutes) {
    return {
      startsAt: buildDateAtTime(safeReferenceDate, start.hours, start.minutes),
      endsAt: buildDateAtTime(safeReferenceDate, end.hours, end.minutes)
    };
  }

  if (referenceMinutes >= startMinutes) {
    return {
      startsAt: buildDateAtTime(safeReferenceDate, start.hours, start.minutes),
      endsAt: buildDateAtTime(safeReferenceDate, end.hours, end.minutes, 1)
    };
  }

  return {
    startsAt: buildDateAtTime(safeReferenceDate, start.hours, start.minutes, -1),
    endsAt: buildDateAtTime(safeReferenceDate, end.hours, end.minutes)
  };
};

export const isWithinWorkShiftWindow = (
  currentDate: Date,
  workShiftWindow: WorkShiftWindow
): boolean => {
  const safeCurrentDate = new Date(currentDate);
  return (
    safeCurrentDate.getTime() >= workShiftWindow.startsAt.getTime() &&
    safeCurrentDate.getTime() <= workShiftWindow.endsAt.getTime()
  );
};

