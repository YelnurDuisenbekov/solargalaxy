import { Link } from 'react-router-dom';
import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import { formatNum } from '../../utils/format';
import './About.css';

const IMAGES = {
  eps: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&q=80',
  panels: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80',
  farm: 'https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=800&q=80',
  roof: 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?w=800&q=80',
};

const STATS = [
  { value: 'до 70%', label: 'экономия на электроэнергии' },
  { value: 'от 2 лет', label: 'срок окупаемости при коммерческом потреблении' },
  { value: '+10%', label: 'прогноз роста тарифов для юрлиц в 2026 году' },
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
    title: 'Быстрая окупаемость в реалиях 2026',
    text: `При коммерческом тарифе ${formatNum(38)}–${formatNum(58)} ₸/кВт·ч и инсоляции Казахстана инвестиция окупается за 4–6 лет с IRR 18–25% — независимо от мощности станции.`,
  },
  {
    title: 'Государственная поддержка ВИЭ',
    text: 'Закон о ВИЭ, упрощённое подключение и растущий спрос на «зелёную» энергию усиливают экономику каждого проекта — от бытовой установки до промышленной станции.',
  },
];

const SOLAR_CARDS = [
  {
    img: IMAGES.panels,
    alt: 'Солнечные панели высокой эффективности',
    title: 'Панели нового поколения',
    text: 'Монокристалл с КПД до 24% — больше киловатт-часов с каждого квадратного метра кровли.',
  },
  {
    img: IMAGES.farm,
    alt: 'Солнечная электростанция в степи Казахстана',
    title: 'Любая мощность',
    text: 'Хоть 2 кВт, хоть 2 МВт — единый инжиниринговый стандарт EPS на любом объекте.',
  },
  {
    img: IMAGES.roof,
    alt: 'СЭС на крыше коммерческого здания',
    title: 'Сетевая и гибридная СЭС',
    text: 'Подключение к сети, резерв при отключениях, интеграция с системами учёта предприятия.',
  },
];

export default function About() {
  return (
    <>
      <section className="about-hero">
        <div className="container">
          <Reveal>
            <h1>О компании Solar Galaxy</h1>
            <p>
              Инжиниринговая компания полного цикла: проектируем, поставляем
              и монтируем солнечные электростанции «под ключ» для бизнеса, частного сектора,
              сельхозкомплексов и государственных учреждений по всему Казахстану.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container about-eps">
          <Reveal>
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
          </Reveal>
          <Reveal delay={0.1}>
            <img
              className="about-eps__img"
              src={IMAGES.eps}
              alt="Инженеры Solar Galaxy на объекте солнечной электростанции"
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <span className="section__label">Технология</span>
            <h2 className="section__title">Солнечная энергетика сегодня</h2>
            <p className="section__desc">
              Казахстан — одна из самых солнечных стран мира: {formatNum(1400)}–{formatNum(1800)} кВт·ч на квадратный
              метр в год. Современные фотоэлектрические системы превращают это преимущество
              в реальную экономию и независимость от роста тарифов.
            </p>
          </Reveal>

          <RevealGroup className="about-solar-grid" stagger={0.1}>
            {SOLAR_CARDS.map((c) => (
              <RevealItem key={c.title}>
                <article className="card about-solar-card">
                  <img src={c.img} alt={c.alt} loading="lazy" />
                  <div className="about-solar-card__body">
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </div>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <span className="section__label">Рынок Казахстана</span>
            <h2 className="section__title">Почему сейчас — лучшее время для СЭС</h2>
            <p className="section__desc">
              С 2024 года Минэнерго поэтапно повышает предельные тарифы на электроэнергию.
              В 2026 году продолжается пересмотр для десятков энергогенерирующих групп.
              Для бизнеса и домохозяйств это означает рост счетов,
              а для владельцев СЭС — ускорение окупаемости инвестиции.
            </p>
          </Reveal>

          <RevealGroup className="about-stats" stagger={0.08}>
            {STATS.map((s) => (
              <RevealItem key={s.label}>
                <div className="card about-stat">
                  <div className="about-stat__value">{s.value}</div>
                  <div className="about-stat__label">{s.label}</div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <span className="section__label">Экономика</span>
            <h2 className="section__title">Насколько выгодны панели в реалиях 2026 года</h2>
            <p className="section__desc">
              При текущих тарифах коммерческий потребитель экономит до 70% расходов
              на электроэнергию. Окупаемость — от 2 лет на объектах с высоким потреблением
              (торговля, АЗС, производство). Частный сектор с нет-митерингом сокращает
              платёжки и повышает капитализацию недвижимости.
            </p>
          </Reveal>

          <RevealGroup className="about-benefits" stagger={0.1}>
            {BENEFITS.map((b, i) => (
              <RevealItem key={b.title}>
                <div className="card about-benefit-item">
                  <span className="about-benefit-item__num">{i + 1}</span>
                  <div>
                    <h4>{b.title}</h4>
                    <p>{b.text}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="about-cta">
        <div className="container">
          <Reveal>
            <h2>Готовы рассчитать окупаемость для вашего объекта?</h2>
            <p>
              Инженеры Solar Galaxy подготовят предварительный расчёт за 1 рабочий день.
              г. Шымкент, ул. Байтурсынова 85 (БЦ Орда), каб. 210 · +7 700 330 1999
            </p>
            <Link to="/#quote-form" className="btn btn--primary">Получить расчёт</Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
