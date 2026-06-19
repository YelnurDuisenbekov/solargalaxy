import { formatNum, formatTariff } from '../utils/format';

/* Динамика тарифов по РК (средние значения с НДС, ₸/кВт·ч)
   Источники: Минэнерго, региональные энергосбытовые компании, 2019–2025 */
export const TARIFF_HISTORY = [
  { year: 2019, household: 16.5, business: 24.0 },
  { year: 2020, household: 17.0, business: 26.5 },
  { year: 2021, household: 18.2, business: 29.5 },
  { year: 2022, household: 18.9, business: 32.0 },
  { year: 2023, household: 20.5, business: 36.5 },
  { year: 2024, household: 23.2, business: 40.5 },
  { year: 2025, household: 25.5, business: 44.0 },
];

function growthSinceBase(data, key) {
  const base = data[0][key];
  const current = data[data.length - 1][key];
  return Math.round(((current - base) / base) * 100);
}

function yearlyGrowth(data, key) {
  return data.slice(1).map((d, i) => {
    const prev = data[i][key];
    const pct = Math.round(((d[key] - prev) / prev) * 100);
    return { year: d.year, pct };
  });
}

function toPoints(data, key, padL, padT, innerW, innerH, maxVal, count) {
  return data.map((d, i) => ({
    x: padL + (i / (count - 1)) * innerW,
    y: padT + innerH - (d[key] / maxVal) * innerH,
    val: d[key],
    year: d.year,
  }));
}

function linePath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/* Треугольник вверх ▲ + процент роста */
function GrowthLabel({ x, y, pct, color }) {
  if (pct <= 0) return null;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-30" y="-14" width="60" height="24" rx="4" className="tariff-chart__tag-bg" />
      <path d="M -24 7 L -17 -6 L -10 7 Z" fill={color} />
      <text x="2" y="6" className="tariff-chart__growth-label" fill={color}>
        +{pct}%
      </text>
    </g>
  );
}

function buildChartNote(currentTariff, segment, marketTariff) {
  const marketRate = segment === 'business' ? marketTariff.business : marketTariff.household;
  const base2019 = segment === 'business' ? TARIFF_HISTORY[0].business : TARIFF_HISTORY[0].household;
  const segmentLabel = segment === 'business' ? 'юридических лиц' : 'физических лиц';
  const marketGrowth = Math.round(((marketRate - base2019) / base2019) * 100);

  if (currentTariff <= 0) {
    return `Укажите текущий тариф, чтобы сравнить его с рыночным уровнем ${formatTariff(marketRate)} ₸/кВт·ч (${marketTariff.year} г.) для ${segmentLabel}.`;
  }

  if (currentTariff < marketRate) {
    const belowPct = Math.round(((marketRate - currentTariff) / marketRate) * 100);
    const vs2019 = Math.round(((currentTariff - base2019) / base2019) * 100);
    return (
      <>
        Ваш тариф <strong>{formatTariff(currentTariff)} ₸/кВт·ч</strong> — на{' '}
        <strong>{belowPct}%</strong> ниже рыночного ({formatTariff(marketRate)} ₸/кВт·ч, {marketTariff.year} г.) для {segmentLabel}.
        {' '}При этом он на {vs2019 >= 0 ? `${vs2019}% выше` : `${Math.abs(vs2019)}% ниже`} уровня 2019 года ({formatTariff(base2019)} ₸/кВт·ч).
        {' '}Средний рыночный тариф с 2019 года вырос на <strong>+{marketGrowth}%</strong>.
      </>
    );
  }

  if (currentTariff > marketRate) {
    const abovePct = Math.round(((currentTariff - marketRate) / marketRate) * 100);
    const vs2019 = Math.round(((currentTariff - base2019) / base2019) * 100);
    return (
      <>
        Ваш тариф <strong>{formatTariff(currentTariff)} ₸/кВт·ч</strong> — на{' '}
        <strong>{abovePct}%</strong> выше рыночного ({formatTariff(marketRate)} ₸/кВт·ч, {marketTariff.year} г.) для {segmentLabel}.
        {' '}Это на <strong>+{vs2019}%</strong> выше уровня 2019 года. Средний рыночный тариф за тот же период вырос на <strong>+{marketGrowth}%</strong>.
      </>
    );
  }

  const vs2019 = Math.round(((currentTariff - base2019) / base2019) * 100);
  return (
    <>
      Ваш тариф <strong>{formatTariff(currentTariff)} ₸/кВт·ч</strong> совпадает с рыночным уровнем {marketTariff.year} года для {segmentLabel}.
      {' '}Это на <strong>+{vs2019}%</strong> выше тарифа 2019 года. Средний рост по рынку с 2019 года — <strong>+{marketGrowth}%</strong>.
    </>
  );
}

export default function TariffChart({ currentTariff, segment }) {
  const maxVal = Math.max(
    ...TARIFF_HISTORY.flatMap((d) => [d.household, d.business]),
    currentTariff || 0,
  ) * 1.1;

  const labelZoneH = 56;
  const chartH = 300;
  const chartW = 560;
  const padL = 44;
  const padR = 16;
  const padT = labelZoneH + 12;
  const padB = 36;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const n = TARIFF_HISTORY.length;

  const householdPts = toPoints(TARIFF_HISTORY, 'household', padL, padT, innerW, innerH, maxVal, n);
  const businessPts = toPoints(TARIFF_HISTORY, 'business', padL, padT, innerW, innerH, maxVal, n);

  const hhGrowth = yearlyGrowth(TARIFF_HISTORY, 'household');
  const busGrowth = yearlyGrowth(TARIFF_HISTORY, 'business');

  const householdTotal = growthSinceBase(TARIFF_HISTORY, 'household');
  const businessTotal = growthSinceBase(TARIFF_HISTORY, 'business');

  const marketTariff = TARIFF_HISTORY[TARIFF_HISTORY.length - 1];

  const yUser = padT + innerH - (currentTariff / maxVal) * innerH;

  /* Фиксированные ряды в верхней зоне — без наложения */
  const HH_LABEL_Y = 18;
  const BUS_LABEL_Y = 42;

  return (
    <div className="tariff-chart">
      <div className="tariff-chart__header">
        <h3>Рост тарифов в Казахстане</h3>
        <div className="tariff-chart__growth">
          <span className="tariff-chart__badge tariff-chart__badge--household">
            Физлица: +{householdTotal}% с 2019
          </span>
          <span className="tariff-chart__badge tariff-chart__badge--business">
            Юрлица: +{businessTotal}% с 2019
          </span>
        </div>
      </div>

      <div className="tariff-chart__legend">
        <span><i className="tariff-chart__dot tariff-chart__dot--household" />Частные потребители</span>
        <span><i className="tariff-chart__dot tariff-chart__dot--business" />Юридические лица</span>
        {currentTariff > 0 && (
          <span><i className="tariff-chart__dot tariff-chart__dot--user" />Ваш тариф</span>
        )}
      </div>

      <svg
        className="tariff-chart__svg"
        viewBox={`0 0 ${chartW} ${chartH}`}
        role="img"
        aria-label="Линейный график роста тарифов на электроэнергию"
      >
        {/* Зона подписей сверху */}
        <rect x={padL} y={4} width={innerW} height={labelZoneH} className="tariff-chart__label-zone" rx="6" />

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          const val = Math.round(maxVal * t);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} className="tariff-chart__grid" />
              <text x={padL - 8} y={y + 5} className="tariff-chart__axis" textAnchor="end">
                {formatNum(val)}
              </text>
            </g>
          );
        })}

        <path d={linePath(householdPts)} className="tariff-chart__line tariff-chart__line--household" fill="none" />
        <path d={linePath(businessPts)} className="tariff-chart__line tariff-chart__line--business" fill="none" />

        {householdPts.map((p) => (
          <g key={`hh-${p.year}`}>
            <circle cx={p.x} cy={p.y} r="4" className="tariff-chart__point tariff-chart__point--household" />
            <text
              x={p.x}
              y={p.y - 10}
              className="tariff-chart__point-val tariff-chart__point-val--household"
              textAnchor="middle"
            >
              {formatTariff(p.val)}
            </text>
          </g>
        ))}

        {businessPts.map((p) => (
          <g key={`bus-${p.year}`}>
            <circle cx={p.x} cy={p.y} r="4" className="tariff-chart__point tariff-chart__point--business" />
            <text
              x={p.x}
              y={p.y - 10}
              className="tariff-chart__point-val tariff-chart__point-val--business"
              textAnchor="middle"
            >
              {formatTariff(p.val)}
            </text>
          </g>
        ))}

        {/* Годы по оси X */}
        {householdPts.map((p) => (
          <text key={`yr-${p.year}`} x={p.x} y={chartH - 10} className="tariff-chart__label" textAnchor="middle">
            {p.year}
          </text>
        ))}

        {/* Подписи роста — верхний ряд: физлица */}
        {hhGrowth.map((g, i) => {
          const x = (householdPts[i].x + householdPts[i + 1].x) / 2;
          return <GrowthLabel key={`hh-g-${g.year}`} x={x} y={HH_LABEL_Y} pct={g.pct} color="#24a85a" />;
        })}

        {/* Подписи роста — второй ряд: юрлица */}
        {busGrowth.map((g, i) => {
          const x = (businessPts[i].x + businessPts[i + 1].x) / 2;
          return <GrowthLabel key={`bus-g-${g.year}`} x={x} y={BUS_LABEL_Y} pct={g.pct} color="#12528C" />;
        })}

        {currentTariff > 0 && (
          <line x1={padL} y1={yUser} x2={chartW - padR} y2={yUser} className="tariff-chart__user-line" />
        )}
      </svg>

      <p className="tariff-chart__note">
        {buildChartNote(currentTariff, segment, marketTariff)}
      </p>
    </div>
  );
}
