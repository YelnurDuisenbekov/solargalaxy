import { OBJECT_TYPE, SYSTEM_TYPE } from './crmLabels';
import { SYSTEM_TYPE_HINTS } from './leadValidation';
import { formatProposalWhatsAppMessage } from './proposalWhatsApp';

/** Номер для WhatsApp: 77001234567 */
export function phoneToWaDigits(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return null;
}

function systemTypeLines(lead) {
  if (!lead.systemType) return [];
  const label = SYSTEM_TYPE[lead.systemType] || lead.systemType;
  const hint = SYSTEM_TYPE_HINTS[lead.systemType];
  const lines = [`Тип системы: ${label}`];
  if (hint) lines.push(hint);
  return lines;
}

/** Блок «По вашей заявке» для клиента (WhatsApp) */
function buildClientLeadDetails(lead) {
  const lines = [];
  if (lead.city) lines.push(`🏘️Город: ${lead.city}`);
  if (lead.objectType) lines.push(`📄Тип объекта: ${OBJECT_TYPE[lead.objectType] || lead.objectType}`);
  if (lead.systemType) {
    const label = SYSTEM_TYPE[lead.systemType] || lead.systemType;
    lines.push(`🪫Тип системы: ${label}`);
    const hint = SYSTEM_TYPE_HINTS[lead.systemType];
    if (hint) lines.push(hint);
  }
  if (lead.capacityKw) lines.push(`⚡Мощность: ${lead.capacityKw} кВт`);
  if (lead.notes) lines.push(`💬Комментарий: ${lead.notes}`);
  return lines;
}

function buildLeadDetails(lead, { includeClient = false, includeSource = false } = {}) {
  const lines = [];
  if (includeClient) {
    lines.push(`Клиент: ${lead.fullName}`, `Телефон клиента: ${lead.phone}`);
  }
  if (lead.city) lines.push(`Город: ${lead.city}`);
  if (lead.objectType) lines.push(`Тип объекта: ${OBJECT_TYPE[lead.objectType] || lead.objectType}`);
  lines.push(...systemTypeLines(lead));
  if (lead.capacityKw) lines.push(`Мощность: ${lead.capacityKw} кВт`);
  if (includeSource && lead.source) lines.push(`Источник: ${lead.source}`);
  if (lead.notes) lines.push(`Комментарий: ${lead.notes}`);
  return lines;
}

function buildHandoffMessage(lead, managerName) {
  const details = buildLeadDetails(lead, { includeClient: true, includeSource: true }).join('\n');
  return [
    'Senergy — лид для обработки',
    '',
    details,
    '',
    `Менеджер: ${managerName}`,
    '',
    'Свяжитесь с клиентом в WhatsApp или по телефону.',
  ].join('\n');
}

function buildClientMessage(lead, managerName, proposal = null) {
  const withProposal = formatProposalWhatsAppMessage(lead, managerName, proposal);
  if (withProposal) return withProposal;

  const firstName = lead.fullName.trim().split(/\s+/)[0];
  const details = buildClientLeadDetails(lead).join('\n');
  return [
    `Здравствуйте, ${firstName}!`,
    '',
    `Меня зовут ${managerName}, менеджер по продажам SENERGY.`,
    '',
    'По вашей заявке:',
    details,
    '',
    'Готов ответить на ваши вопросы и подготовить расчёт. Когда вам удобно созвониться?',
  ].join('\n');
}

function buildQualifiedFollowUpMessage(lead, managerName, proposal = null) {
  const withProposal = formatProposalWhatsAppMessage(lead, managerName, proposal);
  if (withProposal) return withProposal;

  const firstName = lead.fullName.trim().split(/\s+/)[0];
  return [
    `Здравствуйте, ${firstName}!`,
    '',
    `Это ${managerName}, менеджер по продажам SENERGY.`,
    '',
    'Вы интересовались солнечной станцией — готов обсудить детали, ответить на вопросы и подготовить расчёт.',
    'Когда вам удобно созвониться?',
  ].join('\n');
}

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function buildWhatsAppTargets(digits, text) {
  const encoded = encodeURIComponent(text);
  return {
    app: `whatsapp://send?phone=${digits}&text=${encoded}`,
    web: `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`,
    mobile: `https://wa.me/${digits}?text=${encoded}`,
  };
}

/**
 * На ПК — whatsapp:// открывает установленное приложение WhatsApp.
 * CRM остаётся в браузере, без новых вкладок.
 */
export function openWhatsAppChat(targets) {
  if (isMobileDevice()) {
    window.location.assign(targets.mobile);
    return;
  }

  const link = document.createElement('a');
  link.href = targets.app;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Директор/админ → WhatsApp менеджера с карточкой лида.
 * Менеджер-ответственный → WhatsApp клиента с приветствием.
 */
export function getLeadWhatsAppAction(lead, currentUser, proposal = null) {
  const manager = lead.assignee;
  const isHandoff = manager && currentUser && manager.id !== currentUser.id;

  if (isHandoff) {
    if (!manager.phone) {
      return { error: `У менеджера «${manager.fullName}» не указан телефон. Добавьте в профиле пользователя.` };
    }
    const digits = phoneToWaDigits(manager.phone);
    if (!digits) return { error: 'Некорректный телефон менеджера' };
    const text = buildHandoffMessage(lead, manager.fullName);
    return {
      targets: buildWhatsAppTargets(digits, text),
      label: 'WhatsApp менеджеру',
      title: `Передать лид менеджеру ${manager.fullName}`,
      marksContact: false,
    };
  }

  if (!lead.phone) return { error: 'У лида не указан телефон' };
  const digits = phoneToWaDigits(lead.phone);
  if (!digits) return { error: 'Некорректный телефон клиента. Формат: +7 XXX XXX XXXX' };

  const managerName = manager?.fullName || currentUser?.fullName || 'Менеджер Senergy';
  const text = buildClientMessage(lead, managerName, proposal);
  return {
    targets: buildWhatsAppTargets(digits, text),
    label: 'WhatsApp',
    title: 'Написать клиенту в WhatsApp',
    marksContact: true,
  };
}

/** Авто-напоминание через сутки после «Заинтересован» */
export function getLeadWhatsAppFollowUpAction(lead, currentUser, proposal = null) {
  if (!lead.phone) return { error: 'У лида не указан телефон' };
  const digits = phoneToWaDigits(lead.phone);
  if (!digits) return { error: 'Некорректный телефон клиента' };

  const managerName = lead.assignee?.fullName || currentUser?.fullName || 'Менеджер Senergy';
  const text = buildQualifiedFollowUpMessage(lead, managerName, proposal);
  return {
    targets: buildWhatsAppTargets(digits, text),
    label: 'WhatsApp',
    title: 'Авто-напоминание клиенту (сутки после «Заинтересован»)',
    marksContact: false,
  };
}

/** Подгрузить КП лида для WhatsApp (если есть мощность). */
export async function resolveLeadProposal(lead) {
  if (!lead?.capacityKw) return null;
  if (lead.proposalItems?.length) {
    return { proposalItems: lead.proposalItems, proposalAmount: lead.proposalAmount };
  }
  try {
    const { crmApi } = await import('../api');
    return await crmApi.getLeadProposal(lead.id);
  } catch {
    return null;
  }
}

/** Открыть WhatsApp с шаблоном (первый контакт или follow-up) */
export async function openLeadWhatsApp(lead, user, { kind = 'initial', proposal = null } = {}) {
  let prop = proposal;
  if (!prop && lead.capacityKw) {
    prop = await resolveLeadProposal(lead);
  }
  const action = kind === 'followup'
    ? getLeadWhatsAppFollowUpAction(lead, user, prop)
    : getLeadWhatsAppAction(lead, user, prop);
  if (!action.targets) return action;
  openWhatsAppChat(action.targets);
  return { ...action, opened: true };
}
