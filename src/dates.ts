export interface IsoWeekInfo {
  isoYear: number;
  week: number;
  label: string;
}

export function getIsoWeekInfo(date = new Date()): IsoWeekInfo {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return {
    isoYear,
    week,
    label: `${isoYear}-W${String(week).padStart(2, "0")}`,
  };
}

export function getExecutionWeekFolder(date = new Date()): string {
  return `01_Execution/${getIsoWeekInfo(date).label}`;
}

export function getDailyNotePath(date = new Date()): string {
  return `${getExecutionWeekFolder(date)}/${formatDateKey(date)}.md`;
}

export function formatDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
