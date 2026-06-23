import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLeadForm, { RegisterPromptModal } from '../../components/lead/PublicLeadForm';
import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import { scrollToQuoteForm } from '../../utils/scrollToQuoteForm';
import './Home.css';

const SOLUTIONS = [
  { icon: '☀', title: 'Солнечные фермы', desc: 'Наземные станции любой мощности — хоть 2 кВт, хоть 2 МВт' },
  { icon: '🏠', title: 'Крышные системы', desc: 'СЭС на кровлях бизнеса и частных домов' },
  { icon: '🔋', title: 'Энергохранилище', desc: 'Аккумуляторы для резерва и автономности' },
];

const STEPS = [
  { title: 'Замер и аудит', desc: 'Выезд инженера, анализ потребления и осмотр площадки' },
  { title: 'Проектирование', desc: '3D-модель, подбор оборудования, согласование с сетевой компанией' },
  { title: 'Поставка', desc: 'Панели с КПД до 24%, инверторы, крепёж и система мониторинга' },
  { title: 'Монтаж', desc: 'Профессиональный монтаж с соблюдением ГОСТ и пожарных норм' },
  { title: 'Пусконаладка', desc: 'Ввод в эксплуатацию, настройка нет-митеринга и передача документов' },
];

export default function Home() {
  const [registerPrompt, setRegisterPrompt] = useState(null);

  useEffect(() => {
    if (window.location.hash !== '#quote-form') return;
    const t = window.setTimeout(() => scrollToQuoteForm(), 150);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <Reveal>
            <h1>Солнечные электростанции под ключ в Казахстане</h1>
          </Reveal>

          <RevealGroup className="hero__stats" stagger={0.1}>
            <RevealItem className="hero__stat">
              <strong>до 70%</strong>
              <span>экономия на электроэнергии</span>
            </RevealItem>
            <RevealItem className="hero__stat">
              <strong>от 2 лет</strong>
              <span>срок окупаемости</span>
            </RevealItem>
            <RevealItem className="hero__stat">
              <strong>24%</strong>
              <span>КПД панелей нового поколения</span>
            </RevealItem>
          </RevealGroup>

          <Reveal delay={0.15}>
            <p>
              Solar Galaxy проектирует, поставляет и монтирует солнечные электростанции
              с КПД до 24%. Инжиниринг, автоматизация и нет-митеринг по методологии EPS.
            </p>
            <div className="hero__actions">
              <Link to="/about" className="btn btn--outline btn--outline-light">О компании</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <span className="section__label">Для кого</span>
            <h2 className="section__title">Решения для бизнеса и автономных объектов</h2>
            <p className="section__desc">
              Малый и средний бизнес, склады, производства — а также крестьянские хозяйства
              и удалённые объекты без доступа к электросети.
            </p>
          </Reveal>

          <RevealGroup className="audience" stagger={0.1}>
            <RevealItem>
              <div className="card audience-card">
                <h3>B2B — коммерческий сегмент</h3>
                <p>Снижение операционных расходов и защита маржи от роста тарифов Минэнерго.</p>
                <ul>
                  <li>IRR 18–25% при текущих тарифах 2026 года</li>
                  <li>Снижение пиковой нагрузки и платежа за кВт·ч</li>
                  <li>Интеграция с учётными системами предприятия</li>
                  <li>Проекты любой мощности — без ограничений по масштабу</li>
                </ul>
              </div>
            </RevealItem>
            <RevealItem>
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
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <span className="section__label">Решения</span>
            <h2 className="section__title">Создание устойчивого будущего</h2>
            <p className="section__desc">
              Экологически чистые энергетические решения для устойчивого развития —
              от частных домов до промышленных и государственных объектов.
            </p>
          </Reveal>

          <RevealGroup className="solutions-row" stagger={0.1}>
            {SOLUTIONS.map((s) => (
              <RevealItem key={s.title}>
                <div className="card solution-card">
                  <div className="solution-card__icon">{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <span className="section__label">Преимущества</span>
            <h2 className="section__title">Почему Solar Galaxy</h2>
          </Reveal>

          <RevealGroup className="advantages" stagger={0.08}>
            <RevealItem>
              <div className="card advantage">
                <div className="advantage__icon">24%</div>
                <h3>КПД до 24%</h3>
                <p>Панели последнего поколения — максимум киловатт-часов с каждого метра кровли</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="card advantage">
                <div className="advantage__icon">EPS</div>
                <h3>Инжиниринг под ключ</h3>
                <p>От замера до пусконаладки — единая методология Energy Performance System</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="card advantage">
                <div className="advantage__icon">AI</div>
                <h3>Автоматизация</h3>
                <p>Дистанционный мониторинг, алерты и отчёты по выработке в личном кабинете</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="card advantage">
                <div className="advantage__icon">↔</div>
                <h3>Нет-митеринг</h3>
                <p>Взаимозачёт излишков солнечной генерации с потреблением из сети</p>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <span className="section__label">Процесс</span>
            <h2 className="section__title">Этапы работы</h2>
            <p className="section__desc">
              Прозрачный процесс от первого звонка до ввода станции в эксплуатацию.
            </p>
          </Reveal>

          <RevealGroup className="steps" stagger={0.08}>
            {STEPS.map((s) => (
              <RevealItem key={s.title}>
                <div className="card step">
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section section--quote" id="quote">
        <div className="container">
          <Reveal>
            <span className="section__label">Калькулятор</span>
            <h2 className="section__title">Рост тарифов и расчёт СЭС</h2>
            <p className="section__desc">
              График роста тарифов, расчёт мощности станции и заявка инженеру — в одной форме.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <PublicLeadForm
              withCalculator
              submitLabel="Получить расчёт"
              onSubmitted={(lead) => setRegisterPrompt(lead)}
            />
          </Reveal>
        </div>
      </section>

      {registerPrompt && (
        <RegisterPromptModal lead={registerPrompt} onClose={() => setRegisterPrompt(null)} />
      )}
    </>
  );
}
