export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatHours(value: number): string {
  return `${value.toFixed(1)} hrs`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Returns the start of the current retainer period based on renewal day.
 * e.g. renewalDay=15: if today is Mar 20, period started Mar 15.
 * If today is Mar 10, period started Feb 15.
 */
export function getRetainerPeriodStart(renewalDay: number, now = new Date()): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  if (today >= renewalDay) {
    return new Date(year, month, renewalDay);
  }
  // Before renewal day this month — period started last month
  return new Date(year, month - 1, renewalDay);
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const csv = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}
