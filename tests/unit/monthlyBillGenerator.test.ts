describe('Monthly Bill Generator — Target Month Calculation', () => {

  function getTargetMonth(currentDate: Date): { month: number; year: number } {
    const nextMonth = currentDate.getMonth() + 2;
    const targetMonth = nextMonth > 12 ? nextMonth - 12 : nextMonth;
    const targetYear = nextMonth > 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
    return { month: targetMonth, year: targetYear };
  }

  it('generate untuk bulan depan dalam tahun yang sama', () => {
    const result = getTargetMonth(new Date('2026-03-25'));
    expect(result.month).toBe(4);
    expect(result.year).toBe(2026);
  });

  it('generate untuk Januari tahun depan saat ini Desember', () => {
    const result = getTargetMonth(new Date('2026-12-25'));
    expect(result.month).toBe(1);
    expect(result.year).toBe(2027);
  });

  it('generate untuk November saat ini Oktober', () => {
    const result = getTargetMonth(new Date('2026-10-25'));
    expect(result.month).toBe(11);
    expect(result.year).toBe(2026);
  });
});