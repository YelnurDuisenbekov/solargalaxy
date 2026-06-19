import { useState } from 'react';
import { publicApi } from '../../api';
import './Contact.css';

/* Контакты */
const CONTACTS = {
  phone: '+7 700 000 0841',
  phoneHref: 'tel:+77000000841',
  address: 'г. Шымкент, ул. Жибек Жолы, 71/6',
  hours: 'Пн–Пт: 9:00–18:00',
};

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
          <h1>Контакты</h1>
          <p>Готовы помочь с потребностями в солнечной энергии. Свяжитесь с нами для индивидуального решения.</p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          <div className="contact-info">
            <div className="card contact-card">
              <span className="contact-card__label">Телефон</span>
              <a href={CONTACTS.phoneHref} className="contact-card__value">{CONTACTS.phone}</a>
            </div>
            <div className="card contact-card">
              <span className="contact-card__label">Адрес</span>
              <p className="contact-card__value">{CONTACTS.address}</p>
            </div>
            <div className="card contact-card">
              <span className="contact-card__label">Режим работы</span>
              <p className="contact-card__value">{CONTACTS.hours}</p>
            </div>
            <div className="card contact-card">
              <span className="contact-card__label">География</span>
              <p className="contact-card__value contact-card__value--muted">
                Шымкент, Туркестан, Жетысай, Сарыагаш и весь Казахстан
              </p>
            </div>
          </div>

          <form className="card contact-form" onSubmit={submit}>
            <h2>Оставить заявку</h2>
            <input className="input" placeholder="Имя" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Телефон" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <textarea className="input" placeholder="Опишите объект или задайте вопрос" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button type="submit" className="btn btn--primary">Отправить заявку</button>
            {msg && <p className="contact-form__msg">{msg}</p>}
          </form>
        </div>
      </section>
    </>
  );
}
