import { RoomsService } from '../../src/modules/rooms/rooms.service';
import { ALLOWED_TRANSITIONS } from '../../src/modules/rooms/rooms.schema';
import { RoomStatus } from '@prisma/client';

describe('State Machine Transitions', () => {

  it('AVAILABLE bisa ke RESERVED dan OCCUPIED', () => {
    expect(ALLOWED_TRANSITIONS['AVAILABLE']).toContain('RESERVED');
    expect(ALLOWED_TRANSITIONS['AVAILABLE']).toContain('OCCUPIED');
  });

  it('OCCUPIED hanya bisa ke NEEDS_MAINTENANCE', () => {
    expect(ALLOWED_TRANSITIONS['OCCUPIED']).toEqual(['NEEDS_MAINTENANCE']);
    expect(ALLOWED_TRANSITIONS['OCCUPIED']).not.toContain('AVAILABLE');
  });

  it('NEEDS_MAINTENANCE hanya bisa ke AVAILABLE', () => {
    expect(ALLOWED_TRANSITIONS['NEEDS_MAINTENANCE']).toEqual(['AVAILABLE']);
  });

  it('RESERVED bisa ke OCCUPIED dan AVAILABLE', () => {
    expect(ALLOWED_TRANSITIONS['RESERVED']).toContain('OCCUPIED');
    expect(ALLOWED_TRANSITIONS['RESERVED']).toContain('AVAILABLE');
  });

  it('semua status punya allowed transitions yang terdefinisi', () => {
    const allStatuses: RoomStatus[] = [
      'AVAILABLE', 'RESERVED', 'OCCUPIED', 'NEEDS_MAINTENANCE'
    ];
    allStatuses.forEach(status => {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
    });
  });
});