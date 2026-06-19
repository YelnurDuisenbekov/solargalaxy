import { useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../../api';
import TariffChart, { TARIFF_HISTORY } from '../../components/TariffChart';
import { formatNum, formatTariff } from '../../utils/format';
import './Home.css';

const SOLUTIONS = [
  { icon: '☀', title: 'Солнечные фермы', desc: 'Наземные станции любой мощности — хоть 2 кВт, хоть 2 МВт' },
  { icon: '🏠', title: 'Крышные системы', desc: 'СЭС на кровлях бизнеса и частных домов' },
  { icon: '🔋', title: 'Энергохранилище', desc: 'Аккумуляторы для резерва и автономности' },
];

/* Этапы работы по методологии EPS */
const STEPS = [
  { title: 'Замер и аудит', desc: 'Выезд инженера, анализ потребления и осмотр площадки' },
  { title: 'Проектирование', desc: '3D-модель, подбор оборудования, согласование с сетевой компанией' },
  { title: 'Поставка', desc: 'Панели с КПД до 24%, инверторы, крепёж и система мониторинга' },
  { title: 'Монтаж', desc: 'Профессиональный монтаж с соблюдением ГОСТ и пожарных норм' },
  { title: 'Пусконаладка', desc: 'Ввод в эксплуатацию, настройка нет-митеринга и передача документов' },
];

export default function Home() {
  const [monthlyBill, setMonthlyBill] = useState(150000);
  const [roofArea, setRoofArea] = useState(200);
  const [currentTariff, setCurrentTariff] = useState(42);
  const [segment, setSegment] = useState('business');
  const [ctaForm, setCtaForm] = useState({ name: '', phone: '' });
  const [ctaMsg, setCtaMsg] = useState('');

  const marketTariff = TARIFF_HISTORY[TARIFF_HISTORY.length - 1];
  const marketRate = segment === 'household' ? marketTariff.household : marketTariff.business;
  const isBelowMarket = currentTariff > 0 && currentTariff < marketRate;
  const belowMarketPct = isBelowMarket
    ? Math.round(((marketRate - currentTariff) / marketRate) * 100)
    : 0;

  const submitCta = async (e) => {
    e.preventDefault();
    try {
      await publicApi.createLead({ ...ctaForm, notes: 'Заявка с главной страницы' });
      setCtaMsg('Заявка отправлена! Менеджер свяжется с вами.');
      setCtaForm({ name: '', phone: '' });
    } catch {
      setCtaMsg('Не удалось отправить. Попробуйте позже или позвоните нам.');
    }
  };

  return (
    <>
      {/* Hero-секция */}
      <section className="hero">
        <div className="container hero__inner">
          <h1>Солнечные электростанции под ключ в Казахстане</h1>
          <div className="hero__stats">
            <div className="hero__stat">
              <strong>до 70%</strong>
              <span>экономия на электроэнергии</span>
            </div>
            <div className="hero__stat">
              <strong>от 2 лет</strong>
              <span>срок окупаемости</span>
            </div>
            <div className="hero__stat">
              <strong>24%</strong>
              <span>КПД панелей нового поколения</span>
            </div>
          </div>
          <p>
            Solar Galaxy проектирует, поставляет и монтирует солнечные электростанции
            с КПД до 24%. Инжиниринг, автоматизация и нет-митеринг по методологии EPS.
          </p>
          <div className="hero__actions">
            <a href="#calculator" className="btn btn--primary">Рассчитать окупаемость</a>
            <Link to="/about" className="btn btn--outline">О компании</Link>
          </div>
        </div>
      </section>

      {/* Для кого: B2B / B2C */}
      <section className="section">
        <div className="container">
          <span className="section__label">Для кого</span>
          <h2 className="section__title">Решения для бизнеса и автономных объектов</h2>
          <p className="section__desc">
            Малый и средний бизнес, склады, производства — а также крестьянские хозяйства
            и удалённые объекты без доступа к электросети.
          </p>

          <div className="audience">
            <div className="card audience-card">
              <h3>B2B — коммерческий сегмент</h3>
              <p>Снижение операционных расходов и защита маржи от роста тарифов Минэнерго.</p>
              <ul>
                <li>IRR 18–25% при текущих тарифах 2025 года</li>
                <li>Снижение пиковой нагрузки и платежа за кВт·ч</li>
                <li>Интеграция с учётными системами предприятия</li>
                <li>Проекты любой мощности — без ограничений по масштабу</li>
              </ul>
            </div>
            <div className="card audience-card">
              <h3>B2C — КХ и автономные объекты</h3>
              <p>Энергия там, где нет сети: крестьянские хозяйства, фермы, дачи и удалённые поселения.</p>
              <ul>
                <li>Автономная СЭС — полная независимость без подключения к сети</li>
                <li>Гибридные системы с аккумуляторами для круглосуточного питания</li>
                <li>Электрификация пастбищ, теплиц, насосных и ирригационных систем</li>
                <li>Мониторинг выработки и состояния станции в реальном времени</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Направления: фермы, крыши, хранилище */}
      <section className="section section--alt">
        <div className="container">
          <span className="section__label">Решения</span>
          <h2 className="section__title">Создание устойчивого будущего</h2>
          <p className="section__desc">
            Экологически чистые энергетические решения для устойчивого развития —
            от частных домов до промышленных и государственных объектов.
          </p>
          <div className="solutions-row">
            {SOLUTIONS.map((s) => (
              <div key={s.title} className="card solution-card">
                <div style={{ fontSize: '1.75rem' }}>{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Наши преимущества */}
      <section className="section">
        <div className="container">
          <span className="section__label">Преимущества</span>
          <h2 className="section__title">Почему Solar Galaxy</h2>

          <div className="advantages">
            <div className="card advantage">
              <div className="advantage__icon">24%</div>
              <h3>КПД до 24%</h3>
              <p>Панели последнего поколения — максимум киловатт-часов с каждого метра кровли</p>
            </div>
            <div className="card advantage">
              <div className="advantage__icon">EPS</div>
              <h3>Инжиниринг под ключ</h3>
              <p>От замера до пусконаладки — единая методология Energy Performance System</p>
            </div>
            <div className="card advantage">
              <div className="advantage__icon">AI</div>
              <h3>Автоматизация</h3>
              <p>Дистанционный мониторинг, алерты и отчёты по выработке в личном кабинете</p>
            </div>
            <div className="card advantage">
              <div className="advantage__icon">↔</div>
              <h3>Нет-митеринг</h3>
              <p>Взаимозачёт излишков солнечной генерации с потреблением из сети</p>
            </div>
          </div>
        </div>
      </section>

      {/* Интерактивный калькулятор */}
      <section className="section" id="calculator">
        <div className="container">
          <span className="section__label">Калькулятор</span>
          <h2 className="section__title">Рост тарифов и ваша экономия</h2>
          <p className="section__desc">
            Укажите текущий тариф и посмотрите, насколько выросли цены на электроэнергию
            для частных и юридических потребителей в Казахстане с 2019 года.
          </p>

          <div className="calculator">
            <div className="card calculator__form">
              <div className="calculator__field">
                <label htmlFor="tariff">Текущий тариф, ₸/кВт·ч</label>
                <input
                  id="tariff"
                  className="input"
                  type="number"
                  min={5}
                  step={0.5}
                  value={currentTariff}
                  onChange={(e) => setCurrentTariff(Number(e.target.value))}
                />
                {isBelowMarket && (
                  <p className="calculator__tariff-hint calculator__tariff-hint--below">
                    Ваш тариф на <strong>{belowMarketPct}%</strong> ниже рыночного
                    ({formatTariff(marketRate)} ₸/кВт·ч в {marketTariff.year} г.)
                  </p>
                )}
                {currentTariff > marketRate && (
                  <p className="calculator__tariff-hint calculator__tariff-hint--above">
                    Ваш тариф на <strong>{Math.round(((currentTariff - marketRate) / marketRate) * 100)}%</strong> выше рыночного
                    ({formatTariff(marketRate)} ₸/кВт·ч в {marketTariff.year} г.)
                  </p>
                )}
              </div>
              <div className="calculator__field">
                <label htmlFor="segment">Категория потребителя</label>
                <select
                  id="segment"
                  className="input"
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    setCurrentTariff(e.target.value === 'household' ? 25.5 : 44);
                  }}
                >
                  <option value="household">Физическое лицо (частник)</option>
                  <option value="business">Юридическое лицо</option>
                </select>
              </div>
              <div className="calculator__field">
                <label htmlFor="bill">Счёт за электроэнергию в месяц, ₸</label>
                <input
                  id="bill"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder={formatNum(150000)}
                  value={monthlyBill ? formatNum(monthlyBill) : ''}
                  onChange={(e) => setMonthlyBill(Number(e.target.value.replace(/\s/g, '')) || 0)}
                />
              </div>
              <div className="calculator__field">
                <label htmlFor="area">Доступная площадь под панели, м²</label>
                <input
                  id="area"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={roofArea ? formatNum(roofArea) : ''}
                  onChange={(e) => setRoofArea(Number(e.target.value.replace(/\s/g, '')) || 0)}
                />
              </div>
              <Link to="/contact" className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
                Заказать точный расчёт EPS
              </Link>
            </div>

            <div className="card calculator__chart">
              <TariffChart currentTariff={currentTariff} segment={segment} />
            </div>
          </div>
        </div>
      </section>

      {/* Этапы работы */}
      <section className="section section--alt">
        <div className="container">
          <span className="section__label">Процесс</span>
          <h2 className="section__title">Этапы работы</h2>
          <p className="section__desc">
            Прозрачный процесс от первого звонка до ввода станции в эксплуатацию.
          </p>

          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.title} className="card step">
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Форма захвата */}
      <section className="home-cta">
        <div className="container home-cta__inner">
          <div>
            <h2>Начните с бесплатной консультации</h2>
            <p>
              Оставьте контакты — инженер Solar Galaxy свяжется с вами в течение
              одного рабочего дня и подготовит предварительный расчёт по EPS.
            </p>
          </div>
          <form className="home-cta__form" onSubmit={submitCta}>
            <input
              className="input"
              placeholder="Ваше имя"
              required
              value={ctaForm.name}
              onChange={(e) => setCtaForm({ ...ctaForm, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="Телефон"
              required
              value={ctaForm.phone}
              onChange={(e) => setCtaForm({ ...ctaForm, phone: e.target.value })}
            />
            <button type="submit" className="btn btn--primary">Получить консультацию</button>
            {ctaMsg && <p style={{ fontSize: '0.875rem', color: 'var(--green)' }}>{ctaMsg}</p>}
          </form>
        </div>
      </section>
    </>
  );
}
