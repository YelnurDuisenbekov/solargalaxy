import { OBJECT_TYPE, SYSTEM_TYPE } from './crmLabels';
import { formatNum } from './format';

/** Разбирает строку калькулятора из lead.notes (формат PublicLeadForm). */
export function parseLeadCalculatorNotes(notes) {
  if (!notes?.trim()) return { calcItems: [], clientComment: '' };

  const lines = notes.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = lines[0] || '';
  const looksLikeCalc = first.includes('Тариф:') || first.includes('·');

  const calcItems = looksLikeCalc
    ? first.split('·').map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      return {
        label: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
      };
    }).filter(Boolean)
    : [];

  const clientComment = looksLikeCalc ? lines.slice(1).join('\n').trim() : notes.trim();

  return { calcItems, clientComment };
}

/** Поля заявки с сайта для отображения в карточке проекта. */
export function getLeadWebsiteInfo(lead) {
  if (!lead) return [];

  const { calcItems, clientComment } = parseLeadCalculatorNotes(lead.notes);

  const items = [
    { label: 'Источник', value: lead.source || 'Сайт' },
    lead.createdAt && {
      label: 'Дата заявки',
      value: new Date(lead.createdAt).toLocaleString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    },
    lead.fullName && { label: 'ФИО', value: lead.fullName },
    lead.phone && { label: 'Телефон', value: lead.phone },
    lead.email && { label: 'Email', value: lead.email },
    lead.city && { label: 'Город', value: lead.city },
    lead.address && { label: 'Адрес', value: lead.address },
    lead.objectType && { label: 'Тип объекта', value: OBJECT_TYPE[lead.objectType] || lead.objectType },
    lead.systemType && { label: 'Тип системы', value: SYSTEM_TYPE[lead.systemType] || lead.systemType },
    lead.capacityKw != null && {
      label: 'Запрошенная мощность',
      value: `${formatNum(lead.capacityKw)} кВт`,
    },
    ...calcItems.map((c) => ({ label: c.label, value: c.value })),
    clientComment && { label: 'Комментарий клиента', value: clientComment, multiline: true },
  ].filter(Boolean);

  return items;
}

export function projectLeadSource(project) {
  return project?.lead || project?.deal?.lead || null;
}
