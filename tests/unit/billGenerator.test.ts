import { generateBillsForContract } from '../../src/utils/billGenerator';

describe('generateBillsForContract', () => {

  it('generate 12 bills untuk kontrak 1 tahun penuh', () => {
    const bills = generateBillsForContract({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      propertyId: 'property-1',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-06-30'),
      billingDate: 1,
      monthlyRent: 1200000,
      additionalCharges: [],
    });

    expect(bills).toHaveLength(12);
    expect(bills[0].periodMonth).toBe(7);
    expect(bills[0].periodYear).toBe(2026);
    expect(bills[11].periodMonth).toBe(6);
    expect(bills[11].periodYear).toBe(2027);
  });

  it('generate bills dengan total amount yang benar termasuk additional charges', () => {
    const bills = generateBillsForContract({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      propertyId: 'property-1',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      billingDate: 1,
      monthlyRent: 1200000,
      additionalCharges: [
        { name: 'Air', amount: 25000 },
        { name: 'Listrik', amount: 50000 },
      ],
    });

    expect(bills).toHaveLength(1);
    expect(bills[0].totalAmount).toBe(1275000); // 1200000 + 25000 + 50000
    expect(bills[0].baseRent).toBe(1200000);
  });

  it('generate bill tunggal jika start dan end di bulan yang sama', () => {
    const bills = generateBillsForContract({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      propertyId: 'property-1',
      startDate: new Date('2026-07-05'),
      endDate: new Date('2026-07-25'),
      billingDate: 1,
      monthlyRent: 1200000,
      additionalCharges: [],
    });

    expect(bills).toHaveLength(1);
  });

  it('due date sesuai dengan billingDate yang ditentukan', () => {
    const bills = generateBillsForContract({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      propertyId: 'property-1',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-09-30'),
      billingDate: 15,
      monthlyRent: 1000000,
      additionalCharges: [],
    });

    bills.forEach((bill) => {
      expect(bill.dueDate.getDate()).toBe(15);
    });
  });

  it('kontrak yang melewati pergantian tahun tetap dihitung benar', () => {
    const bills = generateBillsForContract({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      propertyId: 'property-1',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2027-02-28'),
      billingDate: 1,
      monthlyRent: 1000000,
      additionalCharges: [],
    });

    expect(bills).toHaveLength(4); // Nov, Des, Jan, Feb
    expect(bills[0].periodYear).toBe(2026);
    expect(bills[2].periodYear).toBe(2027);
    expect(bills[2].periodMonth).toBe(1);
  });

  it('status semua bill yang baru dibuat adalah UNPAID', () => {
    const bills = generateBillsForContract({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      propertyId: 'property-1',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-09-30'),
      billingDate: 1,
      monthlyRent: 1000000,
      additionalCharges: [],
    });

    bills.forEach((bill) => {
      expect(bill.status).toBe('UNPAID');
    });
  });
});