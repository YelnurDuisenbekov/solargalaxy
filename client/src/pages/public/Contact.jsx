import { useState } from 'react';
import PublicLeadForm, { RegisterPromptModal } from '../../components/lead/PublicLeadForm';
import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import './Contact.css';

const CONTACTS = {
  phone: '+7 700 330 1999',
  phoneHref: 'tel:+77003301999',
  city: 'г. Шымкент',
  address: 'ул. Байтурсынова 85 (БЦ Орда), каб. 210',
  fullAddress: 'г. Шымкент, ул. Байтурсынова 85 (БЦ Орда), каб. 210',
  mapQuery: 'Шымкент, ул. Байтурсынова 85',
  hours: 'Пн–Пт: 9:00–18:00',
};

const INFO_CARDS = [
  { label: 'Телефон', value: CONTACTS.phone, href: CONTACTS.phoneHref },
  { label: 'Адрес', lines: [CONTACTS.city, CONTACTS.address] },
  { label: 'Режим работы', value: CONTACTS.hours },
  { label: 'География', value: 'Весь Казахстан', muted: true },
];

export default function Contact() {
  const [registerPrompt, setRegisterPrompt] = useState(null);

  return (
    <>
      <section className="contact-hero">
        <div className="container">
          <Reveal>
            <h1>Контакты</h1>
            <p>Готовы помочь с потребностями в солнечной энергии. Свяжитесь с нами для индивидуального решения.</p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          <RevealGroup className="contact-info" stagger={0.08}>
            {INFO_CARDS.map((c) => (
              <RevealItem key={c.label}>
                <div className="card contact-card">
                  <span className="contact-card__label">{c.label}</span>
                  {c.href ? (
                    <a href={c.href} className="contact-card__value">{c.value}</a>
                  ) : c.lines ? (
                    <>
                      <p className="contact-card__value">{c.lines[0]}</p>
                      <p className="contact-card__value contact-card__value--sub">{c.lines[1]}</p>
                    </>
                  ) : (
                    <p className={`contact-card__value${c.muted ? ' contact-card__value--muted' : ''}`}>
                      {c.value}
                    </p>
                  )}
                </div>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal delay={0.1}>
            <div className="contact-form-block">
              <h2 className="contact-form-block__title">Оставить заявку</h2>
              <PublicLeadForm
                formId="contact-form"
                submitLabel="Отправить заявку"
                onSubmitted={(lead) => setRegisterPrompt(lead)}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section--alt contact-map-section">
        <div className="container">
          <Reveal>
            <span className="section__label">Как нас найти</span>
            <h2 className="section__title">Офис в Шымкенте</h2>
            <p className="section__desc">{CONTACTS.fullAddress}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="contact-map">
              <iframe
                title="Карта — Solar Galaxy, Шымкент"
                src={`https://yandex.kz/map-widget/v1/?text=${encodeURIComponent(CONTACTS.mapQuery)}&z=17`}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={`https://yandex.kz/maps/?text=${encodeURIComponent(CONTACTS.mapQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-map__link"
            >
              Открыть в Яндекс Картах
            </a>
          </Reveal>
        </div>
      </section>

      {registerPrompt && (
        <RegisterPromptModal lead={registerPrompt} onClose={() => setRegisterPrompt(null)} />
      )}
    </>
  );
}
