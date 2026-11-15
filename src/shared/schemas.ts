import { z } from 'zod';

/* ── Enums ─────────────────────────────────────────────────────── */

export const SlotEnum = z.enum(['morning', 'afternoon', 'evening', 'night']);
export type Slot = z.infer<typeof SlotEnum>;

export const RoleEnum = z.enum(['elder', 'family', 'caretaker']);
export type Role = z.infer<typeof RoleEnum>;

export const PillColorEnum = z.enum([
  'white',
  'yellow',
  'pink',
  'orange',
  'blue',
  'green',
  'red',
  'brown',
]);
export type PillColor = z.infer<typeof PillColorEnum>;

export const PillShapeEnum = z.enum([
  'round',
  'oval',
  'capsule',
  'liquid',
  'drops',
  'inhaler',
  'injection',
]);
export type PillShape = z.infer<typeof PillShapeEnum>;

export const FoodInstructionEnum = z.enum(['before_food', 'after_food', 'with_food', 'any']);
export type FoodInstruction = z.infer<typeof FoodInstructionEnum>;

export const MedicineStatusEnum = z.enum(['proposed', 'active', 'stopped']);
export type MedicineStatus = z.infer<typeof MedicineStatusEnum>;

export const EventStatusEnum = z.enum(['pending', 'taken', 'taken_late', 'skipped', 'missed']);
export type EventStatus = z.infer<typeof EventStatusEnum>;

export const ProposalTypeEnum = z.enum([
  'add_medicine',
  'change_medicine',
  'stop_medicine',
  'change_anchor',
]);
export type ProposalType = z.infer<typeof ProposalTypeEnum>;

export const ProposalStatusEnum = z.enum(['pending', 'approved', 'declined']);
export type ProposalStatus = z.infer<typeof ProposalStatusEnum>;

export const RoutineTypeEnum = z.enum(['bp_check', 'sugar_check', 'walk', 'exercise', 'custom']);
export type RoutineType = z.infer<typeof RoutineTypeEnum>;

export const OutboxStatusEnum = z.enum(['sent', 'logged', 'failed']);
export type OutboxStatus = z.infer<typeof OutboxStatusEnum>;

export const ReminderKindEnum = z.enum([
  'dose_upcoming',
  'dose_missed',
  'dose_missed_escalation',
  'appointment_upcoming',
  'refill_low',
  'sos',
]);
export type ReminderKind = z.infer<typeof ReminderKindEnum>;

export const LanguageEnum = z.enum(['en', 'hi']);
export type Language = z.infer<typeof LanguageEnum>;

export const DayOfWeekEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type DayOfWeek = z.infer<typeof DayOfWeekEnum>;

/* ── Reusable sub-schemas ──────────────────────────────────────── */

const TimeString = z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm');

export const AnchorsSchema = z.object({
  breakfast: TimeString,
  lunch: TimeString,
  evening: TimeString,
  dinner: TimeString,
});
export type Anchors = z.infer<typeof AnchorsSchema>;

export const NotifyPrefsSchema = z.object({
  upcoming: z.boolean().default(true),
  missed: z.boolean().default(true),
  appointments: z.boolean().default(true),
  refill: z.boolean().default(true),
});
export type NotifyPrefs = z.infer<typeof NotifyPrefsSchema>;

/* ── Domain schemas ────────────────────────────────────────────── */

export const CircleSchema = z.object({
  id: z.string(),
  elderName: z.string().min(1).max(100),
  preferredName: z.string().min(1).max(50),
  language: LanguageEnum,
  timezone: z.string().min(1),
  anchors: AnchorsSchema,
  windowBeforeMin: z.number().int().nonnegative().default(30),
  windowAfterMin: z.number().int().nonnegative().default(120),
  escalationAfterMin: z.number().int().nonnegative().default(60),
  circleCodeHash: z.string(),
  createdAt: z.string(),
});
export type Circle = z.infer<typeof CircleSchema>;

export const MemberSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  name: z.string().min(1).max(100),
  role: RoleEnum,
  email: z.string().email().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  pinHash: z.string(),
  pinSalt: z.string(),
  failedAttempts: z.number().int().nonnegative().default(0),
  lockedUntil: z.string().nullable().optional(),
  isOrganizer: z.boolean().default(false),
  notify: NotifyPrefsSchema,
  createdAt: z.string(),
  removedAt: z.string().nullable().optional(),
});
export type Member = z.infer<typeof MemberSchema>;

export const InviteSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  codeHash: z.string(),
  role: z.enum(['family', 'caretaker']),
  expiresAt: z.string(),
  usedAt: z.string().nullable().optional(),
  createdBy: z.string(),
});
export type Invite = z.infer<typeof InviteSchema>;

export const MedicineSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  name: z.string().min(1).max(200),
  strength: z.string().max(50).optional(),
  purpose: z.string().max(500).optional(),
  pillColor: PillColorEnum,
  pillShape: PillShapeEnum,
  foodInstruction: FoodInstructionEnum,
  slots: z.array(SlotEnum).min(1),
  dosePerSlot: z.number().int().positive().default(1),
  daysOfWeek: z
    .array(DayOfWeekEnum)
    .min(1)
    .default(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  stockCount: z.number().int().nonnegative().optional(),
  refillThreshold: z.number().int().nonnegative().optional(),
  status: MedicineStatusEnum.default('proposed'),
  explanation: z.string().optional(),
  createdAt: z.string(),
});
export type Medicine = z.infer<typeof MedicineSchema>;

export const RoutineSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  type: RoutineTypeEnum,
  label: z.string().min(1).max(200),
  slot: SlotEnum,
  daysOfWeek: z
    .array(DayOfWeekEnum)
    .min(1)
    .default(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  needsReading: z.boolean().default(false),
  status: MedicineStatusEnum.default('active'),
  createdAt: z.string(),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const ProposalSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  type: ProposalTypeEnum,
  payload: z.record(z.string(), z.unknown()),
  proposedBy: z.string(),
  status: ProposalStatusEnum.default('pending'),
  decidedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const EventSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  date: z.string(),
  slot: SlotEnum,
  itemType: z.enum(['medicine', 'routine']),
  itemId: z.string(),
  status: EventStatusEnum,
  actorId: z.string().optional(),
  reason: z.string().optional(),
  reading: z.string().optional(),
  at: z.string(),
});
export type ScheduleEvent = z.infer<typeof EventSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  doctorName: z.string().min(1).max(200),
  specialty: z.string().max(100).optional(),
  place: z.string().max(300).optional(),
  startsAt: z.string(),
  notes: z.string().max(1000).optional(),
  questions: z.array(z.string()).default([]),
  status: z.enum(['upcoming', 'completed', 'cancelled']).default('upcoming'),
  createdAt: z.string(),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  circleId: z.string(),
  actorId: z.string(),
  actorRole: RoleEnum,
  action: z.string(),
  target: z.string().optional(),
  summary: z.string(),
  at: z.string(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const OutboxSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  kind: ReminderKindEnum,
  dedupeKey: z.string(),
  status: OutboxStatusEnum,
  at: z.string(),
});
export type OutboxEntry = z.infer<typeof OutboxSchema>;

export const VisitLinkSchema = z.object({
  id: z.string(),
  circleId: z.string(),
  tokenHash: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable().optional(),
  createdBy: z.string(),
});
export type VisitLink = z.infer<typeof VisitLinkSchema>;

/* ── Request/input schemas ─────────────────────────────────────── */

export const CreateCircleInput = z
  .object({
    elderName: z.string().min(1).max(100),
    preferredName: z.string().min(1).max(50),
    language: LanguageEnum.default('hi'),
    timezone: z.string().min(1).default('Asia/Kolkata'),
    anchors: AnchorsSchema.default({
      breakfast: '08:00',
      lunch: '13:00',
      evening: '18:00',
      dinner: '20:30',
    }),
    organizerName: z.string().min(1).max(100),
    organizerEmail: z.string().email().optional(),
    organizerPin: z.string().regex(/^\d{6}$/, 'Family PIN must be 6 digits'),
    elderPin: z.string().regex(/^\d{4}$/, 'Elder PIN must be 4 digits'),
  })
  .strict();

export const LookupInput = z
  .object({
    circleCode: z.string().min(1).max(10),
  })
  .strict();

export const SignInInput = z
  .object({
    circleId: z.string().min(1),
    memberId: z.string().min(1),
    pin: z.string().min(4).max(6),
  })
  .strict();

export const CreateInviteInput = z
  .object({
    role: z.enum(['family', 'caretaker']),
  })
  .strict();

export const AcceptInviteInput = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    pin: z.string().regex(/^\d{6}$/, 'PIN must be 6 digits'),
  })
  .strict();

export const ResetPinInput = z
  .object({
    newPin: z.string().min(4).max(6),
  })
  .strict();

export const CreateEventInput = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: SlotEnum,
    itemType: z.enum(['medicine', 'routine']),
    itemId: z.string().min(1),
    status: z.enum(['taken', 'taken_late', 'skipped']),
    reason: z.string().max(500).optional(),
    reading: z.string().max(100).optional(),
  })
  .strict();
