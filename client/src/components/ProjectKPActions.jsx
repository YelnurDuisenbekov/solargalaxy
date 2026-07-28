import { useEffect, useMemo, useState, useRef } from 'react';
import WhatsAppIcon from './WhatsAppIcon';
import { downloadProjectKP, openProjectKPPreview, formatProjectKPWhatsApp } from '../utils/projectProposalKP';
import { phoneToWaDigits, openWhatsAppChat } from '../utils/whatsapp';

/**
 * Кнопки «Просмотр КП», «Скачать КП» и «Направить КП» для ProjectMaterialsPanel.
 */
export default function ProjectKPActions({ project }) {
  const [showSend, setShowSend] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef(null);

  const materials = project.materials || [];
  const hasKit = materials.length > 0;
  const lead = project.lead || project.deal?.lead || {};
  const client = project.client || {};

  const defaults = useMemo(() => ({
    projectTitle: project.title || '',
    clientName: client.fullName || client.company || lead.fullName || '',
    phone: lead.phone || client.phone || '',
    city: project.city || lead.city || '',
    objectLabel: lead.objectTypeLabel || '',
    systemLabel: lead.systemTypeLabel || '',
    capacityKw: project.capacityKw != null ? String(project.capacityKw) : '',
    managerName: 'Елнур',
    intro: 'Проектирование, поставка оборудования, монтаж и пусконаладка солнечной электростанции под ключ в Казахстане.',
  }), [client.company, client.fullName, client.phone, lead.fullName, lead.objectTypeLabel, lead.phone, lead.systemTypeLabel, lead.city, project.title, project.city, project.capacityKw]);

  const [overrides, setOverrides] = useState(defaults);
  const [savingPdf, setSavingPdf] = useState(false);
  const phone = overrides.phone || '';

  useEffect(() => {
    setOverrides(defaults);
  }, [defaults]);

  if (!hasKit) return null;

  const handleChange = (field, value) => {
    setOverrides((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreview = async () => {
    const opened = await openProjectKPPreview(project, overrides);
    if (!opened) {
      window.alert('Браузер заблокировал окно. Разрешите всплывающие окна и попробуйте снова.');
    }
  };

  const handleDownload = async () => {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      await downloadProjectKP(project, overrides);
    } catch (err) {
      console.error(err);
      window.alert('Не удалось сохранить PDF. Попробуйте ещё раз.');
    } finally {
      setSavingPdf(false);
    }
  };

  const handleWhatsApp = () => {
    const digits = phoneToWaDigits(phone);
    if (!digits) return;
    const text = formatProjectKPWhatsApp(project, overrides);
    if (!text) return;
    const encoded = encodeURIComponent(text);
    const targets = {
      app: `whatsapp://send?phone=${digits}&text=${encoded}`,
      web: `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`,
      mobile: `https://wa.me/${digits}?text=${encoded}`,
    };
    openWhatsAppChat(targets);
    setShowSend(false);
  };

  const handleCopyText = async () => {
    const text = formatProjectKPWhatsApp(project, overrides);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasPhone = !!phoneToWaDigits(phone);

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={handlePreview} title="Открыть КП для просмотра и правки">
        👁 Просмотр КП
      </button>
      <button type="button" className="btn btn--outline-dark" onClick={handleDownload} disabled={savingPdf} title="Скачать КП как PDF">
        {savingPdf ? '⏳ Сохраняем PDF…' : '📄 Скачать PDF'}
      </button>
      <button type="button" className="btn btn--outline-dark" onClick={() => setShowSend(!showSend)} title="Направить КП клиенту">
        📤 Направить КП
      </button>

      {showSend && (
        <div className="app-kp-send-dropdown" ref={modalRef}>
          <div className="app-kp-send-dropdown__backdrop" onClick={() => setShowSend(false)} />
          <div className="app-kp-send-dropdown__content">
            <h4>Направить КП клиенту</h4>
            <div className="app-kp-send-dropdown__grid">
              <label>
                <span>Название КП</span>
                <input className="input input--sm" value={overrides.projectTitle} onChange={(e) => handleChange('projectTitle', e.target.value)} />
              </label>
              <label>
                <span>Заказчик</span>
                <input className="input input--sm" value={overrides.clientName} onChange={(e) => handleChange('clientName', e.target.value)} />
              </label>
              <label>
                <span>Телефон клиента</span>
                <input className="input input--sm" value={overrides.phone} onChange={(e) => handleChange('phone', e.target.value)} />
              </label>
              <label>
                <span>Город</span>
                <input className="input input--sm" value={overrides.city} onChange={(e) => handleChange('city', e.target.value)} />
              </label>
              <label>
                <span>Мощность, кВт</span>
                <input className="input input--sm" value={overrides.capacityKw} onChange={(e) => handleChange('capacityKw', e.target.value)} />
              </label>
              <label>
                <span>Менеджер</span>
                <input className="input input--sm" value={overrides.managerName} onChange={(e) => handleChange('managerName', e.target.value)} />
              </label>
              <label className="app-kp-send-dropdown__field--full">
                <span>Описание</span>
                <textarea className="input input--sm" rows={3} value={overrides.intro} onChange={(e) => handleChange('intro', e.target.value)} />
              </label>
            </div>
            <p className="app-kp-send-dropdown__hint">
              Сначала скорректируйте данные КП, затем откройте просмотр или отправьте клиенту.
            </p>
            <button type="button" className="btn btn--primary" onClick={handlePreview}>
              👁 Просмотр и правка КП
            </button>
            {hasPhone ? (
              <button type="button" className="btn btn--whatsapp" onClick={handleWhatsApp}>
                <WhatsAppIcon size={16} /> WhatsApp
              </button>
            ) : (
              <p className="app-kp-send-dropdown__hint">У клиента не указан телефон — WhatsApp недоступен</p>
            )}
            <button type="button" className="btn btn--outline-dark" onClick={handleCopyText}>
              {copied ? '✅ Скопировано!' : '📋 Копировать текст КП'}
            </button>
            <button type="button" className="btn btn--outline-dark" onClick={handleDownload} disabled={savingPdf}>
              {savingPdf ? '⏳ Сохраняем PDF…' : '📄 Скачать PDF и отправить'}
            </button>
            <p className="app-kp-send-dropdown__hint">
              Скачайте КП и отправьте файлом через WhatsApp, Telegram или email.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
