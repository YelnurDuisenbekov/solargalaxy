import { useRef, useState } from 'react';
import WhatsAppIcon from './WhatsAppIcon';
import { getLeadWhatsAppAction, openWhatsAppChat, resolveLeadProposal } from '../utils/whatsapp';

export default function LeadWhatsAppLink({
  lead,
  user,
  className = 'btn btn--whatsapp app-lead-actions__icon-btn',
  onContact,
}) {
  const wa = getLeadWhatsAppAction(lead, user);
  const opening = useRef(false);
  const [loading, setLoading] = useState(false);

  const hasKpHint = lead.capacityKw && (lead.proposalAmount > 0 || lead.proposalItems?.length);
  const title = hasKpHint ? 'Отправить КП в WhatsApp' : wa.title;

  if (!wa.targets) {
    return (
      <button type="button" className={className} disabled title={wa.error} aria-label="WhatsApp недоступен">
        <WhatsAppIcon size={18} />
      </button>
    );
  }

  const handleClick = async (e) => {
    e.stopPropagation();
    if (opening.current || loading) return;
    opening.current = true;
    setLoading(true);
    try {
      const isHandoff = lead.assignee && user && lead.assignee.id !== user.id;
      let proposal = null;
      if (!isHandoff && lead.capacityKw) {
        proposal = await resolveLeadProposal(lead);
      }
      const action = getLeadWhatsAppAction(lead, user, proposal);
      if (!action.targets) return;
      openWhatsAppChat(action.targets);
      if (action.marksContact && onContact) onContact(lead);
    } finally {
      setLoading(false);
      window.setTimeout(() => { opening.current = false; }, 1500);
    }
  };

  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={title}
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? '…' : <WhatsAppIcon size={18} />}
    </button>
  );
}
