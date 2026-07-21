import { COMPLAINT_STATUS_ORDER } from '../../src/modules/complaints/complaints.schema';

describe('Complaint Status Order', () => {

  it('urutan status sesuai dengan flow yang benar', () => {
    expect(COMPLAINT_STATUS_ORDER).toEqual([
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
    ]);
  });

  it('index OPEN lebih kecil dari semua status lain', () => {
    const openIndex = COMPLAINT_STATUS_ORDER.indexOf('OPEN');
    expect(openIndex).toBe(0);
    expect(openIndex).toBeLessThan(COMPLAINT_STATUS_ORDER.indexOf('IN_PROGRESS'));
    expect(openIndex).toBeLessThan(COMPLAINT_STATUS_ORDER.indexOf('RESOLVED'));
    expect(openIndex).toBeLessThan(COMPLAINT_STATUS_ORDER.indexOf('CLOSED'));
  });

  it('CLOSED adalah status terakhir', () => {
    const closedIndex = COMPLAINT_STATUS_ORDER.indexOf('CLOSED');
    expect(closedIndex).toBe(COMPLAINT_STATUS_ORDER.length - 1);
  });

  function canTransition(from: string, to: string): boolean {
    const fromIndex = COMPLAINT_STATUS_ORDER.indexOf(from as typeof COMPLAINT_STATUS_ORDER[number]);
    const toIndex = COMPLAINT_STATUS_ORDER.indexOf(to as typeof COMPLAINT_STATUS_ORDER[number]);
    return toIndex > fromIndex;
  }

  it('bisa maju dari OPEN ke IN_PROGRESS', () => {
    expect(canTransition('OPEN', 'IN_PROGRESS')).toBe(true);
  });

  it('bisa lompat dari OPEN langsung ke RESOLVED', () => {
    expect(canTransition('OPEN', 'RESOLVED')).toBe(true);
  });

  it('tidak bisa mundur dari RESOLVED ke IN_PROGRESS', () => {
    expect(canTransition('RESOLVED', 'IN_PROGRESS')).toBe(false);
  });

  it('tidak bisa mundur dari CLOSED ke status manapun', () => {
    expect(canTransition('CLOSED', 'OPEN')).toBe(false);
    expect(canTransition('CLOSED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('CLOSED', 'RESOLVED')).toBe(false);
  });
});