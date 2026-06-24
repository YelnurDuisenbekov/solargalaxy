import { formatMoney, formatNum } from './format';
import { OBJECT_TYPE, SYSTEM_TYPE } from './crmLabels';

const SEP = '━━━━━━━━━━━━━━';

function lineSum(item) {
  return (item.quantity || 0) * (item.unitPrice || 0);
}

function proposalTotal(proposal) {
  if (proposal?.proposalAmount > 0) return proposal.proposalAmount;
  if (proposal?.amount > 0) return proposal.amount;
  const items = proposal?.proposalItems || proposal?.items || [];
  return items.reduce((s, i) => s + lineSum(i), 0);
}

function formatItemQty(item) {
  const qty = formatNum(item.quantity);
  const unit = item.product?.unit || 'шт';
  return `${qty} ${unit}`;
}

/** КП для WhatsApp — текстовый шаблон от имени Senergy. */
export function formatProposalWhatsAppMessage(lead, managerName, proposal) {
  const items = proposal?.proposalItems || proposal?.items || [];
  const total = proposalTotal(proposal);

  if (!items.length || !lead.capacityKw || total <= 0) return null;

  const firstName = lead.fullName.trim().split(/\s+/)[0];
  const objectLabel = lead.objectType ? OBJECT_TYPE[lead.objectType] : null;
  const systemLabel = lead.systemType ? SYSTEM_TYPE[lead.systemType] : null;

  const lines = [
    `Здравствуйте, ${firstName}!`,
    '☀️ SENERGY',
    `Менеджер: ${managerName}`,
    SEP,
    'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ',
    SEP,
  ];

  if (lead.city) lines.push(`📍 ${lead.city}`);
  if (objectLabel) lines.push(`🏠 ${objectLabel}`);
  if (systemLabel) lines.push(`⚡ ${systemLabel}`);
  lines.push(`🔋 ${formatNum(lead.capacityKw)} кВт`);
  lines.push('📦 Комплект:');

  for (const item of items) {
    lines.push(`  • ${item.name} — ${formatItemQty(item)}`);
  }

  lines.push(`💰 ИТОГО: ${formatMoney(total)}`);
  lines.push(SEP);
  lines.push('⚠️ Примечание: это предварительный расчёт.');
  lines.push('По факту замера объекта и уточнения комплектации сумма может отличаться.');
  lines.push('Готовы ответить на вопросы.');
  lines.push('Когда вам удобно обсудить детали?');

  return lines.join('\n');
}
