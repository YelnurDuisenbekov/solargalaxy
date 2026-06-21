import { z } from 'zod';

export const PHONE_REGEX = /^\+7 \d{3} \d{3} \d{4}$/;

export const FIELD_LABELS = {
  fullName: 'ФИО',
  phone: 'Телефон',
  city: 'Город',
  objectType: 'Тип объекта',
  systemType: 'Тип системы',
  capacityKw: 'Мощность',
  source: 'Источник',
  notes: 'Примечание',
  assigneeId: 'Менеджер',
  status: 'Статус',
};

const zodMessages = {
  fullName: {
    too_small: 'минимум 2 символа',
  },
  phone: {
    invalid_string: 'формат +7 XXX XXX XXXX',
  },
  city: {
    too_small: 'укажите город',
  },
  capacityKw: {
    invalid_type: 'укажите число',
    too_small: 'должно быть больше 0',
  },
};

function issueText(path, issue) {
  const key = path[0];
  const label = FIELD_LABELS[key] || key;
  const custom = zodMessages[key]?.[issue.code];
  if (custom) return `${label}: ${custom}`;
  if (issue.message) return `${label}: ${issue.message}`;
  return `${label}: неверное значение`;
}

export function formatZodError(error) {
  const fields = {};
  for (const issue of error.errors) {
    const key = issue.path[0] || 'form';
    if (!fields[key]) fields[key] = issueText(issue.path, issue);
  }
  const messages = Object.values(fields);
  return {
    error: messages.length === 1 ? messages[0] : 'Исправьте ошибки в форме',
    fields,
  };
}

export const phoneSchema = z
  .string({ required_error: 'укажите телефон' })
  .regex(PHONE_REGEX, 'формат +7 XXX XXX XXXX');

export const citySchema = z
  .string({ required_error: 'выберите город' })
  .min(2, 'укажите город');

export const objectTypeEnum = z.enum(['HOUSE', 'OFFICE', 'FARM', 'INDUSTRIAL', 'OTHER']);

export const systemTypeEnum = z.enum(['ON_GRID', 'OFF_GRID', 'HYBRID']);

export const leadCreateSchema = z.object({
  fullName: z.string({ required_error: 'укажите ФИО' }).min(2, 'минимум 2 символа'),
  phone: phoneSchema,
  city: citySchema,
  objectType: objectTypeEnum.optional(),
  systemType: systemTypeEnum.optional(),
  capacityKw: z.number().positive('должно быть больше 0').optional().nullable(),
  source: z.string().optional(),
  notes: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export const leadPatchSchema = leadCreateSchema.partial().extend({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'SURVEY', 'LOST']).optional(),
  address: z.string().trim().min(3).optional().nullable(),
  surveyAt: z.string().datetime().optional().nullable(),
  contactedAt: z.string().datetime().optional().nullable(),
});
