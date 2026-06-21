import { useEffect, useState } from 'react';

import { operationsApi } from '../../api';

import { Reveal } from '../../components/motion/ScrollReveal';

import './app-pages.css';



const SUPPLY_NOTIFICATION_TYPES = ['PURCHASE_REQUIRED', 'LOW_STOCK', 'PROJECT_UPDATE'];

const TYPE_LABEL = {

  PURCHASE_REQUIRED: 'Докупка',

  LOW_STOCK: 'Низкий остаток',

  PROJECT_UPDATE: 'Проект',

};



export default function SupplyPage() {

  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');



  const load = () => {

    setLoading(true);

    operationsApi.notifications()

      .then((data) => {

        setNotifications(data.filter((n) => SUPPLY_NOTIFICATION_TYPES.includes(n.type)));

        setError('');

      })

      .catch((e) => setError(e.message))

      .finally(() => setLoading(false));

  };



  useEffect(load, []);



  const markRead = async (id) => {

    try {

      await operationsApi.markRead(id);

      load();

    } catch (e) {

      setError(e.message);

    }

  };



  const markAll = async () => {

    try {

      await operationsApi.markAllRead();

      load();

    } catch (e) {

      setError(e.message);

    }

  };



  const unread = notifications.filter((n) => !n.read).length;



  return (

    <div>

      <Reveal>

        <h1 className="app-page-title">Снабжение — уведомления</h1>

        <p className="app-page-desc">

          Запросы на докупку товара при нехватке на складе или при выдаче на проект.

        </p>

      </Reveal>



      <div className="app-toolbar">

        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>

          {loading ? 'Загрузка…' : unread > 0 ? `${unread} непрочитанных` : 'Все прочитаны'}

        </span>

        {!loading && unread > 0 && (

          <button type="button" className="btn btn--dark" onClick={markAll}>Прочитать все</button>

        )}

      </div>



      {error && (

        <div className="app-form-errors" style={{ marginBottom: 16 }}>

          <p className="error-msg">{error}</p>

          {error.includes('прав') && (

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 8 }}>

              Перелогиньтесь после обновления системы или обратитесь к администратору.

            </p>

          )}

        </div>

      )}



      <div className="app-activity-list">

        {notifications.map((n) => (

          <div

            key={n.id}

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

                {new Date(n.createdAt).toLocaleString('ru-RU')}

              </div>

            </div>

            {!n.read && (

              <button type="button" className="btn btn--dark app-table-btn" onClick={() => markRead(n.id)}>OK</button>

            )}

          </div>

        ))}

        {!loading && !notifications.length && !error && (

          <p style={{ color: 'var(--text-muted)' }}>

            Уведомлений пока нет. Они появятся, когда на складе не хватит товара для проекта или остаток станет низким.

          </p>

        )}

      </div>

    </div>

  );

}


