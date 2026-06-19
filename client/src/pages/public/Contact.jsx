import { useState } from 'react';
import { publicApi } from '../../api';
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
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await publicApi.createLead(form);
      setMsg('Заявка отправлена! Менеджер свяжется с вами.');
      setForm({ name: '', phone: '', email: '', notes: '' });
    } catch {
      setMsg('Не удалось отправить заявку. Позвоните нам: ' + CONTACTS.phone);
    }
  };

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
            <form className="card contact-form" onSubmit={submit}>
              <h2>Оставить заявку</h2>
              <input className="input" placeholder="Имя" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Телефон" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <textarea className="input" placeholder="Опишите объект или задайте вопрос" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button type="submit" className="btn btn--primary contact-form__submit">Отправить заявку</button>
              {msg && <p className="contact-form__msg">{msg}</p>}
            </form>
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
    </>
  );
}
