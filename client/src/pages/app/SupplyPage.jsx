import { useEffect, useState } from 'react';

import { operationsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

import { Reveal } from '../../components/motion/ScrollReveal';

import './app-pages.css';



const TYPE_LABEL = {

  PURCHASE_REQUIRED: 'Докупка',

  LOW_STOCK: 'Низкий остаток',

  PROJECT_UPDATE: 'Проект',

  QUALIFIED_LEAD_REMINDER: 'Лиды',

  AUTO_WHATSAPP_FOLLOWUP: 'WhatsApp',

  MATERIALS_APPROVAL: 'Согласование',

  STOCK_ADJUSTMENT: 'Склад',

  MATERIAL_TRANSFER: 'Акт',

  ASSIGNEE_CHANGED: 'Назначение',

  MATERIAL_WRITE_OFF: 'Списание',

};



function NotificationCard({ n, showRecipient, onMarkRead }) {

  return (

    <div

      className={`card app-activity-item${n.read ? ' app-activity-item--done' : ''}`}

      style={{ borderLeft: n.read ? undefined : '3px solid var(--primary, #2563eb)' }}

    >

      <div className="app-activity-item__body" style={{ flex: 1 }}>

        <div className="app-activity-item__title">

          <span className="badge badge--progress" style={{ marginRight: 8 }}>{TYPE_LABEL[n.type] || n.type}</span>

          {n.title}

        </div>

        <p style={{ fontSize: '0.875rem', marginTop: 6 }}>{n.message}</p>

        <div className="app-activity-item__meta">

          {showRecipient && n.user?.fullName && (

            <span style={{ marginRight: 12 }}>Кому: <strong>{n.user.fullName}</strong></span>

          )}

          {n.fromUser?.fullName && (

            <span style={{ marginRight: 12 }}>От: <strong>{n.fromUser.fullName}</strong></span>

          )}

          {new Date(n.createdAt).toLocaleString('ru-RU')}

        </div>

      </div>

      {!n.read && onMarkRead && (

        <button type="button" className="btn btn--dark app-table-btn" onClick={() => onMarkRead(n.id)}>OK</button>

      )}

    </div>

  );

}



export default function SupplyPage() {

  const { isDirector, isAdmin } = useAuth();

  const canViewAll = isDirector || isAdmin;

  const [tab, setTab] = useState('mine');

  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');



  const load = () => {

    setLoading(true);

    const fetcher = tab === 'all' && canViewAll

      ? operationsApi.allNotifications()

      : operationsApi.notifications();

    fetcher

      .then((data) => {

        setNotifications(data);

        setError('');

      })

      .catch((e) => setError(e.message))

      .finally(() => setLoading(false));

  };



  useEffect(load, [tab, canViewAll]);



  const markRead = async (id) => {

    try {

      await operationsApi.markRead(id, tab === 'all' ? 'all' : undefined);

      load();

    } catch (e) {

      setError(e.message);

    }

  };



  const markAll = async () => {

    try {

      await operationsApi.markAllRead(tab === 'all' ? 'all' : undefined);

      load();

    } catch (e) {

      setError(e.message);

    }

  };



  const unread = notifications.filter((n) => !n.read).length;



  return (

    <div>

      <Reveal>

        <h1 className="app-page-title">

          {canViewAll && tab === 'all' ? 'Все уведомления' : 'Уведомления'}

        </h1>

        <p className="app-page-desc">

          {canViewAll && tab === 'all'

            ? 'Маршрутизация уведомлений: от кого и кому они отправлены.'

            : 'Ваши уведомления по проектам, складу, лидам и назначениям.'}

        </p>

      </Reveal>



      {canViewAll && (

        <div className="app-toolbar" style={{ marginBottom: 8 }}>

          <div className="app-tabs">

            <button

              type="button"

              className={`app-tab${tab === 'mine' ? ' app-tab--active' : ''}`}

              onClick={() => setTab('mine')}

            >

              Мои

            </button>

            <button

              type="button"

              className={`app-tab${tab === 'all' ? ' app-tab--active' : ''}`}

              onClick={() => setTab('all')}

            >

              Все уведомления

            </button>

          </div>

        </div>

      )}



      <div className="app-toolbar">

        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>

          {loading ? 'Загрузка…' : unread > 0 ? `${unread} непрочитанных` : 'Все прочитаны'}

        </span>

        {!loading && unread > 0 && tab === 'mine' && (

          <button type="button" className="btn btn--dark" onClick={markAll}>Прочитать все</button>

        )}

      </div>



      {error && (

        <div className="app-form-errors" style={{ marginBottom: 16 }}>

          <p className="error-msg">{error}</p>

        </div>

      )}



      <div className="app-activity-list">

        {notifications.map((n) => (

          <NotificationCard

            key={n.id}

            n={n}

            showRecipient={tab === 'all'}

            onMarkRead={tab === 'mine' ? markRead : undefined}

          />

        ))}

        {!loading && !notifications.length && !error && (

          <p style={{ color: 'var(--text-muted)' }}>

            Уведомлений пока нет.

          </p>

        )}

      </div>

    </div>

  );

}

