const STEPS = [
  {
    title: '1. Найдите объект на карте',
    text: 'Выберите страну и город из списка. Введите улицу и дом — кликните вариант из подсказок или кнопку «Показать на карте». Карта приблизится к зданию.',
  },
  {
    title: '2. Обведите крышу',
    text: 'Режим «Углы крыши». Прямоугольник (по умолчанию): 2 клика по противоположным углам — остальные 4 точки ставятся сами. Или «Свободный контур» — каждый угол отдельным кликом.',
  },
  {
    title: '3. Укажите рёбра крыши (необязательно)',
    text: 'Режим «Рёбра крыши» → два клика по направлению ребра. Линия автоматически продлевается до периметра контура. Можно несколько рёбер. Для каждого — включайте/выключайте стороны А и Б.',
  },
  {
    title: '4. Задайте параметры крыши',
    text: 'Уклон и азимут (если нет рёбер — для всего контура). При рёбрах азимут каждого ската считается автоматически.',
  },
  {
    title: '5. Панели и расчёт',
    text: 'Вкладка «Панели» — сетка только на активных скатах. Можно отключать отдельные модули — не обязательно заполнять всю сторону.',
  },
];

export default function ConstructorInstructions({ open, onToggle, compact = false }) {
  if (compact) {
    return (
      <details className="constructor-help" open={open}>
        <summary onClick={(e) => { e.preventDefault(); onToggle?.(); }}>
          Как пользоваться конструктором
        </summary>
        <ol className="constructor-help__list">
          {STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </details>
    );
  }

  return (
    <div className="constructor-help constructor-help--open">
      <h3 className="constructor-section-title">Инструкция</h3>
      <ol className="constructor-help__list">
        {STEPS.map((s) => (
          <li key={s.title}>
            <strong>{s.title}</strong>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
