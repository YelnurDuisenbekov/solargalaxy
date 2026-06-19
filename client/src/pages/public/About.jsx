import { Link } from 'react-router-dom';
import { formatNum } from '../../utils/format';
import './About.css';

/* Изображения: премиальные фото солнечной энергетики */
const IMAGES = {
  eps: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&q=80',
  panels: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80',
  farm: 'https://images.unsplash.com/photo-1466611653911-950815379e64?w=800&q=80',
  roof: 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?w=800&q=80',
};

/* Ключевые цифры по тарифам РК (источники: Минэнерго, 2024–2025) */
const STATS = [
  { value: 'до 70%', label: 'экономия на электроэнергии' },
  { value: 'от 2 лет', label: 'срок окупаемости при коммерческом потреблении' },
  { value: '+20%', label: 'рост тарифов на генерацию с 1 февраля 2025' },
  { value: `${formatNum(1400)}+`, label: 'кВт·ч/м² солнечной инсоляции в год по РК' },
];

const BENEFITS = [
  {
    title: 'Фиксация расходов на 25+ лет',
    text: 'Пока тарифы на сетевую электроэнергию растут ежегодно, ваша СЭС вырабатывает энергию по предсказуемой стоимости — без сюрпризов от монополий.',
  },
  {
    title: 'Нет-митеринг и взаимозачёт',
    text: 'Излишки солнечной генерации уходят в сеть и зачитываются в счёт потребления. Бизнес снижает пиковые нагрузки и платёж за кВт·ч.',
  },
  {
    title: 'Быстрая окупаемость в реалиях 2025',
    text: `При коммерческом тарифе ${formatNum(35)}–${formatNum(55)} ₸/кВт·ч и инсоляции Казахстана инвестиция окупается за 4–6 лет с IRR 18–25% — независимо от мощности станции.`,
  },
  {
    title: 'Государственная поддержка ВИЭ',
    text: 'Закон о ВИЭ, упрощённое подключение и растущий спрос на «зелёную» энергию усиливают экономику каждого проекта — от бытовой установки до промышленной станции.',
  },
];

export default function About() {
  return (
    <>
      {/* Вводная секция */}
      <section className="about-hero">
        <div className="container">
          <h1>О компании Solar Galaxy</h1>
          <p>
            Инжиниринговая компания полного цикла: проектируем, поставляем
            и монтируем солнечные электростанции «под ключ» для бизнеса, частного сектора,
            сельхозкомплексов и государственных учреждений по всему Казахстану.
          </p>
        </div>
      </section>

      {/* Проект EPS */}
      <section className="section">
        <div className="container about-eps">
          <div>
            <span className="about-eps__badge">Флагманский проект</span>
            <h2 className="section__title">EPS — Energy Performance System</h2>
            <p className="section__desc">
              EPS — собственная методология Solar Galaxy для внедрения энергонезависимости.
              Мы не просто устанавливаем панели: проектируем систему под реальный профиль
              потребления, подбираем оборудование с КПД до 24%, настраиваем мониторинг
              и подключаем нет-митеринг.
            </p>
            <ul className="about-eps__list">
              <li>Аудит объекта и 3D-моделирование выработки по часам</li>
              <li>Подбор инверторов и панелей последнего поколения</li>
              <li>Автоматизация учёта и дистанционный контроль станции</li>
              <li>Пусконаладка, сдача в эксплуатацию и сервисное сопровождение</li>
            </ul>
          </div>
          <img
            className="about-eps__img"
            src={IMAGES.eps}
            alt="Инженеры Solar Galaxy на объекте солнечной электростанции"
            loading="lazy"
          />
        </div>
      </section>

      {/* Солнечная энергетика */}
      <section className="section section--alt">
        <div className="container">
          <span className="section__label">Технология</span>
          <h2 className="section__title">Солнечная энергетика сегодня</h2>
          <p className="section__desc">
            Казахстан — одна из самых солнечных стран мира: {formatNum(1400)}–{formatNum(1800)} кВт·ч на квадратный
            метр в год. Современные фотоэлектрические системы превращают это преимущество
            в реальную экономию и независимость от роста тарифов.
          </p>

          <div className="about-solar-grid">
            <article className="card about-solar-card">
              <img src={IMAGES.panels} alt="Солнечные панели высокой эффективности" loading="lazy" />
              <div className="about-solar-card__body">
                <h3>Панели нового поколения</h3>
                <p>Монокристалл с КПД до 24% — больше киловатт-часов с каждого квадратного метра кровли.</p>
              </div>
            </article>
            <article className="card about-solar-card">
              <img src={IMAGES.farm} alt="Солнечная электростанция в степи Казахстана" loading="lazy" />
              <div className="about-solar-card__body">
                <h3>Любая мощность</h3>
                <p>Хоть 2 кВт, хоть 2 МВт — единый инжиниринговый стандарт EPS на любом объекте.</p>
              </div>
            </article>
            <article className="card about-solar-card">
              <img src={IMAGES.roof} alt="СЭС на крыше коммерческого здания" loading="lazy" />
              <div className="about-solar-card__body">
                <h3>Сетевая и гибридная СЭС</h3>
                <p>Подключение к сети, резерв при отключениях, интеграция с системами учёта предприятия.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Статистика Казахстана */}
      <section className="section">
        <div className="container">
          <span className="section__label">Рынок Казахстана</span>
          <h2 className="section__title">Почему сейчас — лучшее время для СЭС</h2>
          <p className="section__desc">
            С 2024 года Минэнерго поэтапно повышает предельные тарифы на электроэнергию:
            в феврале 2025 — в среднем на 20%, в августе — очередной пересмотр для десятков
            энергогенерирующих групп. Для бизнеса и домохозяйств это означает рост счетов,
            а для владельцев СЭС — ускорение окупаемости инвестиции.
          </p>

          <div className="about-stats">
            {STATS.map((s) => (
              <div key={s.label} className="card about-stat">
                <div className="about-stat__value">{s.value}</div>
                <div className="about-stat__label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Выгода в реальных условиях */}
      <section className="section section--alt">
        <div className="container">
          <span className="section__label">Экономика</span>
          <h2 className="section__title">Насколько выгодны панели в реалиях 2025 года</h2>
          <p className="section__desc">
            При текущих тарифах коммерческий потребитель экономит до 70% расходов
            на электроэнергию. Окупаемость — от 2 лет на объектах с высоким потреблением
            (торговля, АЗС, производство). Частный сектор с нет-митерингом сокращает
            платёжки и повышает капитализацию недвижимости.
          </p>

          <div className="about-benefits">
            {BENEFITS.map((b, i) => (
              <div key={b.title} className="card about-benefit-item">
                <span className="about-benefit-item__num">{i + 1}</span>
                <div>
                  <h4>{b.title}</h4>
                  <p>{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Призыв к действию */}
      <section className="about-cta">
        <div className="container">
          <h2>Готовы рассчитать окупаемость для вашего объекта?</h2>
          <p>Инженеры Solar Galaxy подготовят предварительный расчёт за 1 рабочий день. Шымкент, ул. Жибек Жолы, 71/6 · +7 700 000 0841</p>
          <Link to="/contact" className="btn btn--primary">Получить расчёт</Link>
        </div>
      </section>
    </>
  );
}
