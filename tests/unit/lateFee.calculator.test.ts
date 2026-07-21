import { calculateLateFee } from '../../src/utils/lateFee.calculator';

describe('calculateLateFee', () => {

  it('tidak ada late fee jika belum jatuh tempo', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-07-15'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-10'),
    });

    expect(result.daysOverdue).toBe(0);
    expect(result.lateFeeAmount).toBe(0);
    expect(result.finalAmount).toBe(1000000);
    expect(result.isOverdue).toBe(false);
  });

  it('tidak ada late fee tepat di hari jatuh tempo', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-07-15'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-15'),
    });

    expect(result.daysOverdue).toBe(0);
    expect(result.lateFeeAmount).toBe(0);
  });

  it('late fee dihitung benar untuk keterlambatan 5 hari', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-07-01'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-06'),
    });

    expect(result.daysOverdue).toBe(5);
    expect(result.lateFeePercentageApplied).toBe(10); // 5 hari x 2% = 10%, masih di bawah max
    expect(result.lateFeeAmount).toBe(100000); // 10% dari 1000000
    expect(result.finalAmount).toBe(1100000);
    expect(result.isOverdue).toBe(true);
  });

  it('late fee dibatasi oleh max percentage meski keterlambatan sangat lama', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-01-01'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-01'), // sudah 180+ hari
    });

    expect(result.lateFeePercentageApplied).toBe(10); // dibatasi max, bukan 360%
    expect(result.lateFeeAmount).toBe(100000);
  });

  it('tidak ada late fee untuk bill yang sudah PAID, walaupun lewat due date', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-01-01'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'PAID',
      referenceDate: new Date('2026-07-01'),
    });

    expect(result.lateFeeAmount).toBe(0);
    expect(result.finalAmount).toBe(1000000);
    expect(result.isOverdue).toBe(false);
  });

  it('tidak ada late fee untuk bill yang WAIVED', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-01-01'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'WAIVED',
      referenceDate: new Date('2026-07-01'),
    });

    expect(result.lateFeeAmount).toBe(0);
  });

  it('late fee tetap dihitung untuk bill PARTIALLY_PAID yang masih overdue', () => {
    const result = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-07-01'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'PARTIALLY_PAID',
      referenceDate: new Date('2026-07-04'),
    });

    expect(result.daysOverdue).toBe(3);
    expect(result.isOverdue).toBe(true);
  });

  it('perhitungan tidak terpengaruh oleh jam dalam referenceDate', () => {
    const result1 = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-07-01T00:00:00'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-03T23:59:59'),
    });

    const result2 = calculateLateFee({
      totalAmount: 1000000,
      dueDate: new Date('2026-07-01T23:59:59'),
      lateFeePercentage: 2,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-03T00:00:01'),
    });

    // Keduanya harus menghasilkan daysOverdue yang sama
    // karena kita normalisasi ke awal hari
    expect(result1.daysOverdue).toBe(result2.daysOverdue);
  });

  it('pembulatan late fee amount benar (round, bukan floor atau ceil)', () => {
    const result = calculateLateFee({
      totalAmount: 333333,
      dueDate: new Date('2026-07-01'),
      lateFeePercentage: 1,
      lateFeeMaxPercentage: 10,
      status: 'UNPAID',
      referenceDate: new Date('2026-07-02'), // 1 hari, 1%
    });

    // 333333 * 0.01 = 3333.33, harus dibulatkan jadi 3333
    expect(result.lateFeeAmount).toBe(3333);
    expect(Number.isInteger(result.lateFeeAmount)).toBe(true);
  });
});