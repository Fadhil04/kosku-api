describe('Payment Score Calculator', () => {

  function calculatePaymentScore(data: {
    totalBills: number;
    paidOnTime: number;
    paidLate: number;
    totalDaysLate: number;
    unpaid: number;
  }): number {
    if (data.totalBills === 0) return 100;

    const settledBills = data.paidOnTime + data.paidLate;
    const settledRate = settledBills / data.totalBills;
    const onTimeRate = settledBills > 0 ? data.paidOnTime / settledBills : 0;
    const avgDaysLate =
      data.paidLate > 0 ? data.totalDaysLate / data.paidLate : 0;

    const latePenalty = Math.min(avgDaysLate / 30, 1);
    const score = settledRate * 60 + onTimeRate * 30 + (1 - latePenalty) * 10;

    return Math.round(score);
  }

  it('tenant sempurna dapat score 100', () => {
    const score = calculatePaymentScore({
      totalBills: 6,
      paidOnTime: 6,
      paidLate: 0,
      totalDaysLate: 0,
      unpaid: 0,
    });
    expect(score).toBe(100);
  });

  it('tenant tanpa tagihan sama sekali dapat score 100', () => {
    const score = calculatePaymentScore({
      totalBills: 0,
      paidOnTime: 0,
      paidLate: 0,
      totalDaysLate: 0,
      unpaid: 0,
    });
    expect(score).toBe(100);
  });

  it('tenant yang tidak pernah bayar dapat score rendah', () => {
    const score = calculatePaymentScore({
      totalBills: 6,
      paidOnTime: 0,
      paidLate: 0,
      totalDaysLate: 0,
      unpaid: 6,
    });
    expect(score).toBeLessThan(20);
  });

  it('tenant yang bayar semua tapi selalu terlambat dapat score menengah', () => {
    const score = calculatePaymentScore({
      totalBills: 6,
      paidOnTime: 0,
      paidLate: 6,
      totalDaysLate: 60, // rata-rata 10 hari terlambat
      unpaid: 0,
    });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(75);
  });

  it('tenant yang bayar tepat waktu dapat score lebih tinggi dari yang terlambat', () => {
    const onTimeScore = calculatePaymentScore({
      totalBills: 6,
      paidOnTime: 6,
      paidLate: 0,
      totalDaysLate: 0,
      unpaid: 0,
    });

    const lateScore = calculatePaymentScore({
      totalBills: 6,
      paidOnTime: 0,
      paidLate: 6,
      totalDaysLate: 18, // rata-rata 3 hari
      unpaid: 0,
    });

    expect(onTimeScore).toBeGreaterThan(lateScore);
  });

  it('score selalu dalam range 0-100', () => {
    const testCases = [
      { totalBills: 1, paidOnTime: 0, paidLate: 0, totalDaysLate: 0, unpaid: 1 },
      { totalBills: 10, paidOnTime: 5, paidLate: 5, totalDaysLate: 300, unpaid: 0 },
      { totalBills: 3, paidOnTime: 3, paidLate: 0, totalDaysLate: 0, unpaid: 0 },
    ];

    testCases.forEach((tc) => {
      const score = calculatePaymentScore(tc);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});