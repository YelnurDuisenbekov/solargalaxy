import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import './Services.css';

const EQUIPMENT = [
  {
    tag: 'Оборудование',
    title: 'Солнечные панели',
    desc: 'Высокоэффективные модули для частных домов, коммерческих объектов и промышленных предприятий. Надёжная работа, высокая производительность и длительный срок службы.',
  },
  {
    tag: 'Оборудование',
    title: 'Инверторы',
    desc: 'Сетевые, гибридные и автономные инверторы для эффективного преобразования солнечной энергии. Подберём оборудование под любые задачи и мощности.',
  },
  {
    tag: 'Оборудование',
    title: 'Аккумуляторы',
    desc: 'Современные системы накопления энергии для резервного питания и максимальной энергонезависимости при отключениях сети.',
  },
  {
    tag: 'Оборудование',
    title: 'Комплектующие',
    desc: 'Кабели, крепёжные системы, защитное оборудование, контроллеры и все необходимые компоненты для монтажа солнечной электростанции.',
  },
  {
    tag: 'Услуга',
    title: 'Солнечные станции под ключ',
    desc: 'Готовые решения для дома, бизнеса и производства: проектирование, поставка оборудования, монтаж и ввод в эксплуатацию с гарантией результата.',
  },
  {
    tag: 'Услуга',
    title: 'Сетевая СЭС',
    desc: 'Подключение к сети, взаимозачёт излишков энергии и снижение расходов на электроэнергию до 70%.',
  },
  {
    tag: 'Услуга',
    title: 'Автономная СЭС',
    desc: 'Полная энергонезависимость для удалённых объектов, ферм и сельскохозяйственных комплексов.',
  },
  {
    tag: 'Услуга',
    title: 'Гибридная СЭС',
    desc: 'Сеть + аккумуляторы — резервное питание при отключениях и оптимальное использование солнечной генерации.',
  },
];

const SOLUTIONS = [
  {
    icon: '☀',
    title: 'Солнечные фермы',
    desc: 'Наземные станции любой мощности — хоть 2 кВт, хоть 2 МВт, без ограничений по масштабу.',
  },
  {
    icon: '🏠',
    title: 'Крышные системы',
    desc: 'СЭС на кровлях складов, торговых центров, офисов и частных домов — без потери полезной площади.',
  },
  {
    icon: '🔋',
    title: 'Энергетическое хранилище',
    desc: 'Системы накопления для резервного питания и максимальной автономности объекта.',
  },
];

export default function Services() {
  return (
    <>
      <section className="services-hero">
        <div className="container">
          <Reveal>
            <h1>Услуги и оборудование</h1>
            <p>
              Солнечные электростанции под ключ в Казахстане — от подбора панелей
              до пусконаладки. Экономия на электроэнергии до 70%, окупаемость от 2 лет.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <span className="section__label">Направления</span>
            <h2 className="section__title">Создание устойчивого будущего</h2>
            <p className="section__desc">
              Экологически чистые энергетические решения для частных домов, коммерческих объектов,
              производственных предприятий, сельхозкомплексов и государственных учреждений.
            </p>
          </Reveal>

          <RevealGroup className="services-types" stagger={0.1}>
            {SOLUTIONS.map((s) => (
              <RevealItem key={s.title}>
                <div className="card services-type">
                  <div className="services-type__icon">{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <span className="section__label">Каталог</span>
            <h2 className="section__title">Магазин солнечного оборудования</h2>
            <p className="section__desc">
              Поставляем проверенное оборудование и выполняем полный цикл работ —
              проектирование, монтаж, ввод в эксплуатацию.
            </p>
          </Reveal>

          <RevealGroup className="services-grid" stagger={0.07}>
            {EQUIPMENT.map((item) => (
              <RevealItem key={item.title}>
                <div className="card services-card">
                  <span className="services-card__tag">{item.tag}</span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
    </>
  );
}
