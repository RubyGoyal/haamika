import type {
  Circle,
  Member,
  Medicine,
  Routine,
  Proposal,
  Appointment,
} from '../../shared/types.js';
import { hashPin } from '../services/pin.js';

export const DEMO_CIRCLE_CODE = 'AMMA-4729';
export const DEMO_CIRCLE_ID = 'demo-circle-kamla-devi';
export const DEMO_ELDER_ID = 'demo-member-kamla';
export const DEMO_FAMILY_ID = 'demo-member-rohan';
export const DEMO_CARETAKER_ID = 'demo-member-sunita';
export const MED_CALCIUM_ID = 'med-calcium-pending';

export function createDemoCircle(codeHash: string, nowIso: string): Circle {
  return {
    id: DEMO_CIRCLE_ID,
    elderName: 'Kamla Devi',
    preferredName: 'Amma',
    language: 'hi',
    timezone: 'Asia/Kolkata',
    anchors: {
      breakfast: '08:00',
      lunch: '13:00',
      evening: '18:00',
      dinner: '20:30',
    },
    windowBeforeMin: 30,
    windowAfterMin: 120,
    escalationAfterMin: 60,
    circleCodeHash: codeHash,
    createdAt: nowIso,
  };
}

export async function createDemoMembers(circleId: string, nowIso: string): Promise<Member[]> {
  const [elderPin, familyPin, caretakerPin] = await Promise.all([
    hashPin('2580'),
    hashPin('135790'),
    hashPin('246802'),
  ]);

  return [
    {
      id: DEMO_ELDER_ID,
      circleId,
      name: 'Kamla Devi',
      role: 'elder',
      pinHash: elderPin.hash,
      pinSalt: elderPin.salt,
      failedAttempts: 0,
      lockedUntil: null,
      isOrganizer: false,
      notify: { upcoming: true, missed: true, appointments: true, refill: true },
      createdAt: nowIso,
    },
    {
      id: DEMO_FAMILY_ID,
      circleId,
      name: 'Rohan',
      role: 'family',
      email: 'rohan@example.com',
      timezone: 'America/Toronto',
      pinHash: familyPin.hash,
      pinSalt: familyPin.salt,
      failedAttempts: 0,
      lockedUntil: null,
      isOrganizer: true,
      notify: { upcoming: false, missed: true, appointments: true, refill: true },
      createdAt: nowIso,
    },
    {
      id: DEMO_CARETAKER_ID,
      circleId,
      name: 'Sunita',
      role: 'caretaker',
      pinHash: caretakerPin.hash,
      pinSalt: caretakerPin.salt,
      failedAttempts: 0,
      lockedUntil: null,
      isOrganizer: false,
      notify: { upcoming: true, missed: true, appointments: true, refill: true },
      createdAt: nowIso,
    },
  ];
}

const ALL_DAYS: Medicine['daysOfWeek'] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function createCardioMeds(circleId: string, nowIso: string): Medicine[] {
  return [
    {
      id: 'med-amlodipine',
      circleId,
      name: 'Amlodipine',
      strength: '5 mg',
      purpose: 'Blood pressure control',
      pillColor: 'white',
      pillShape: 'round',
      foodInstruction: 'after_food',
      slots: ['morning'],
      dosePerSlot: 1,
      daysOfWeek: ALL_DAYS,
      stockCount: 28,
      refillThreshold: 7,
      status: 'active',
      createdAt: nowIso,
    },
    {
      id: 'med-metformin',
      circleId,
      name: 'Metformin',
      strength: '500 mg',
      purpose: 'Blood sugar management',
      pillColor: 'white',
      pillShape: 'oval',
      foodInstruction: 'after_food',
      slots: ['morning', 'night'],
      dosePerSlot: 1,
      daysOfWeek: ALL_DAYS,
      stockCount: 52,
      refillThreshold: 14,
      status: 'active',
      createdAt: nowIso,
    },
  ];
}

function createOtherMeds(circleId: string, nowIso: string): Medicine[] {
  return [
    {
      id: 'med-atorvastatin',
      circleId,
      name: 'Atorvastatin',
      strength: '10 mg',
      purpose: 'Cholesterol control',
      pillColor: 'brown',
      pillShape: 'oval',
      foodInstruction: 'after_food',
      slots: ['night'],
      dosePerSlot: 1,
      daysOfWeek: ALL_DAYS,
      stockCount: 20,
      refillThreshold: 7,
      status: 'active',
      createdAt: nowIso,
    },
    {
      id: 'med-pantoprazole',
      circleId,
      name: 'Pantoprazole',
      strength: '40 mg',
      purpose: 'Acidity relief',
      pillColor: 'yellow',
      pillShape: 'capsule',
      foodInstruction: 'before_food',
      slots: ['morning'],
      dosePerSlot: 1,
      daysOfWeek: ALL_DAYS,
      stockCount: 14,
      refillThreshold: 5,
      status: 'active',
      createdAt: nowIso,
    },
  ];
}

export function createDemoMedicines(circleId: string, nowIso: string): Medicine[] {
  return [...createCardioMeds(circleId, nowIso), ...createOtherMeds(circleId, nowIso)];
}

export function createDemoRoutines(circleId: string, nowIso: string): Routine[] {
  return [
    {
      id: 'routine-bp',
      circleId,
      type: 'bp_check',
      label: 'Morning BP Check',
      slot: 'morning',
      daysOfWeek: ALL_DAYS,
      needsReading: true,
      status: 'active',
      createdAt: nowIso,
    },
    {
      id: 'routine-walk',
      circleId,
      type: 'walk',
      label: 'Evening Walk in Park',
      slot: 'evening',
      daysOfWeek: ALL_DAYS,
      needsReading: false,
      status: 'active',
      createdAt: nowIso,
    },
  ];
}

export function createDemoProposal(
  circleId: string,
  nowIso: string,
): { med: Medicine; proposal: Proposal } {
  const med: Medicine = {
    id: MED_CALCIUM_ID,
    circleId,
    name: 'Calcium + Vitamin D3',
    strength: '500 mg',
    purpose: 'Bone health',
    pillColor: 'pink',
    pillShape: 'round',
    foodInstruction: 'after_food',
    slots: ['afternoon'],
    dosePerSlot: 1,
    daysOfWeek: ALL_DAYS,
    stockCount: 30,
    status: 'proposed',
    createdAt: nowIso,
  };
  const proposal: Proposal = {
    id: 'demo-proposal-calcium',
    circleId,
    type: 'add_medicine',
    payload: {
      medicineId: MED_CALCIUM_ID,
      medicineName: 'Calcium + Vitamin D3',
      strength: '500 mg',
      purpose: 'Bone health',
      slots: ['afternoon'],
    },
    proposedBy: DEMO_FAMILY_ID,
    status: 'pending',
    createdAt: nowIso,
  };
  return { med, proposal };
}

export function createDemoAppointments(
  circleId: string,
  starts1: string,
  starts2: string,
  nowIso: string,
): Appointment[] {
  return [
    {
      id: 'demo-appt-1',
      circleId,
      doctorName: 'Dr. Mehta',
      specialty: 'Cardiology',
      place: 'Max Healthcare, Saket, Delhi',
      startsAt: starts1,
      notes: 'Routine blood pressure review and ECG check.',
      questions: [
        'Is the current Amlodipine dose right?',
        'Why do I feel light-headed in the evening?',
      ],
      status: 'upcoming',
      createdAt: nowIso,
    },
    {
      id: 'demo-appt-2',
      circleId,
      doctorName: 'Dr. Iyer',
      specialty: 'Endocrinology & Diabetes',
      place: 'Apollo Clinic, Connaught Place, Delhi',
      startsAt: starts2,
      notes: 'HbA1c quarterly review.',
      questions: ['Can I take Metformin after breakfast?'],
      status: 'upcoming',
      createdAt: nowIso,
    },
  ];
}
