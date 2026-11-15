import { z } from 'zod';
import {
  SlotEnum,
  PillColorEnum,
  PillShapeEnum,
  FoodInstructionEnum,
  MedicineStatusEnum,
  RoutineTypeEnum,
  LanguageEnum,
  DayOfWeekEnum,
  AnchorsSchema,
} from './domain.js';

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

export const ProposeMedicineInput = z
  .object({
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
  })
  .strict();
export type ProposeMedicineInputType = z.infer<typeof ProposeMedicineInput>;

export const UpdateMedicineInput = ProposeMedicineInput.partial()
  .extend({
    status: MedicineStatusEnum.optional(),
  })
  .strict();
export type UpdateMedicineInputType = z.infer<typeof UpdateMedicineInput>;

export const CreateRoutineInput = z
  .object({
    type: RoutineTypeEnum,
    label: z.string().min(1).max(200),
    slot: SlotEnum,
    daysOfWeek: z
      .array(DayOfWeekEnum)
      .min(1)
      .default(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    needsReading: z.boolean().default(false),
  })
  .strict();
export type CreateRoutineInputType = z.infer<typeof CreateRoutineInput>;

export const UpdateRoutineInput = CreateRoutineInput.partial().strict();
export type UpdateRoutineInputType = z.infer<typeof UpdateRoutineInput>;

export const DecideProposalInput = z
  .object({
    decision: z.enum(['approved', 'declined']),
  })
  .strict();
export type DecideProposalInputType = z.infer<typeof DecideProposalInput>;

export const BatchDecideProposalsInput = z
  .object({
    decision: z.enum(['approved', 'declined']),
  })
  .strict();

export const CreateAppointmentInput = z
  .object({
    doctorName: z.string().min(1).max(200),
    specialty: z.string().max(100).optional(),
    place: z.string().max(300).optional(),
    startsAt: z.string().min(1),
    notes: z.string().max(1000).optional(),
    questions: z.array(z.string()).default([]),
  })
  .strict();
export type CreateAppointmentInputType = z.infer<typeof CreateAppointmentInput>;

export const UpdateAppointmentInput = CreateAppointmentInput.partial()
  .extend({
    status: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
  })
  .strict();
export type UpdateAppointmentInputType = z.infer<typeof UpdateAppointmentInput>;

export const UpdateSettingsInput = z
  .object({
    anchors: AnchorsSchema.optional(),
    timezone: z.string().min(1).optional(),
    language: LanguageEnum.optional(),
    preferredName: z.string().min(1).max(50).optional(),
  })
  .strict();
export type UpdateSettingsInputType = z.infer<typeof UpdateSettingsInput>;

export const VoiceIntentInput = z
  .object({
    transcript: z.string().min(1).max(1000),
  })
  .strict();
export type VoiceIntentInputType = z.infer<typeof VoiceIntentInput>;
