import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import ConstructorMapView from '../../components/constructor/ConstructorMapView';
import ConstructorAddressSearch from '../../components/constructor/ConstructorAddressSearch';
import ConstructorInstructions from '../../components/constructor/ConstructorInstructions';
import Constructor3D from '../../components/constructor/Constructor3D';
import {
  INITIAL_CONSTRUCTOR_STATE,
  downloadJson,
  loadConstructorState,
  useConstructorDerived,
} from '../../components/constructor/useConstructor';
import { INVERTERS, MODULES } from '../../utils/constructor/equipment';
import { findModule } from '../../utils/constructor/equipment.js';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import './app-pages.css';
import '../../components/constructor/ConstructorPage.css';

const TABS = [
  { id: 'site', label: 'Участок и крыша' },
  { id: 'panels', label: 'Панели' },
  { id: 'wiring', label: 'Инвертор и кабели' },
  { id: 'shading', label: 'Затенение' },
  { id: 'finance', label: 'Финансы' },
  { id: 'export', label: 'ОЖТ / сеть' },
];

export default function ConstructorPage() {
  const { isAdmin, hasPerm } = useAuth();
  const [state, setState] = useState(loadConstructorState);
  const [tab, setTab] = useState('site');
  const [helpOpen, setHelpOpen] = useState(true);
  const { ready: googleReady, hasKey: hasGoogleKey } = useGoogleMaps();

  const derived = useConstructorDerived(state);
  const { panels, strings, cables, summary, gridExport, gridRows, gridCols, facets } = derived;
  const selectedPanel = panels.find((p) => p.id === state.selectedPanelId);

  if (!isAdmin && !hasPerm('admin.full')) {
    return <Navigate to="/app" replace />;
  }

  const patch = (partial) => setState((s) => ({ ...s, ...partial }));

  const saveDraft = () => {
    localStorage.setItem('sg-constructor-draft', JSON.stringify(state));
  };

  const handleMapClick = ({ lat, lng }) => {
    setState((s) => {
      const point = { lat, lng };

      if (s.drawMode === 'roof') {
        if (s.roofShape === 'rectangle') {
          const draft = [...(s.roofRectDraft || []), point];
          if (draft.length < 2) {
            return { ...s, roofRectDraft: draft, panels: [] };
          }
          const [a, b] = draft;
          const rect = [
            { lat: a.lat, lng: a.lng },
            { lat: a.lat, lng: b.lng },
            { lat: b.lat, lng: b.lng },
            { lat: b.lat, lng: a.lng },
          ];
          return { ...s, roofPolygon: rect, roofRectDraft: [], panels: [] };
        }
        return { ...s, roofPolygon: [...s.roofPolygon, point], panels: [] };
      }

      if (s.drawMode === 'edge') {
        const draft = [...(s.edgeDraft || []), point];
        if (draft.length >= 2) {
          const newEdge = {
            id: `edge-${Date.now()}`,
            from: draft[0],
            to: draft[1],
            sideAActive: true,
            sideBActive: true,
          };
          return {
            ...s,
            roofEdges: [...(s.roofEdges || []), newEdge],
            edgeDraft: [],
            panels: [],
          };
        }
        return { ...s, edgeDraft: draft };
      }

      return s;
    });
  };

  const handleObstacleAdd = ({ lat, lng }) => {
    setState((s) => ({
      ...s,
      obstacles: [
        ...(s.obstacles || []),
        { id: `obs-${Date.now()}`, lat, lng, heightM: 4, radiusM: 2 },
      ],
    }));
  };

  const undoLastCorner = () => {
    setState((s) => {
      if (s.roofRectDraft?.length) {
        return { ...s, roofRectDraft: s.roofRectDraft.slice(0, -1), panels: [] };
      }
      if (s.roofPolygon.length) {
        return { ...s, roofPolygon: s.roofPolygon.slice(0, -1), panels: [] };
      }
      return s;
    });
  };

  const handleLocationSelect = (loc) => {
    setState((s) => ({
      ...s,
      countryCode: loc.countryCode,
      city: loc.city || '',
      address: loc.address || loc.formattedAddress || '',
      formattedAddress: loc.formattedAddress || '',
      lat: loc.lat,
      lng: loc.lng,
      mapFlyKey: (s.mapFlyKey || 0) + 1,
      roofPolygon: [],
      roofRectDraft: [],
      roofEdges: [],
      edgeDraft: [],
      panels: [],
    }));
  };

  const updatePanel = (id, changes) => {
    patch({
      panels: panels.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    });
  };

  const formatMoney = (n) => `${(n || 0).toLocaleString('ru-RU')} ₸`;

  return (
    <div className="constructor-page">
      <Reveal>
        <h1 className="app-page-title">Конструктор СЭС</h1>
        <p className="app-page-desc">
          Прототип проектировщика: карта, 3D-крыша, расстановка панелей, строки MPPT, кабели, затенение,
          финансовый отчёт и пакет для ОЖТ / подключения к сети. Не связан с CRM и проектами — черновик в браузере.
        </p>
      </Reveal>

      <div className="constructor-toolbar card app-section-card">
        <div className="constructor-toolbar__row">
          <input
            className="input"
            placeholder="Название проекта"
            value={state.projectName}
            onChange={(e) => patch({ projectName: e.target.value })}
          />
          <span className="constructor-kpi-address">
            {[state.city, state.address].filter(Boolean).join(', ') || 'Адрес не выбран'}
          </span>
          <button type="button" className="btn btn--outline-dark" onClick={saveDraft}>Сохранить черновик</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => downloadJson(gridExport, `senergy-grid-${Date.now()}.json`)}
          >
            Экспорт JSON
          </button>
        </div>
        <div className="constructor-kpi">
          <span><strong>{summary.activePanelCount}</strong> панелей</span>
          <span><strong>{summary.totalKw}</strong> кВт</span>
          <span><strong>{summary.annualKwh.toLocaleString('ru-RU')}</strong> кВт·ч/год</span>
          <span><strong>{formatMoney(summary.totalCapex)}</strong> CAPEX</span>
        </div>
      </div>

      <div className="app-tabs constructor-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`app-tab${tab === t.id ? ' app-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'site' && (
        <div className="constructor-stack">
          <ConstructorInstructions open={helpOpen} onToggle={() => setHelpOpen((v) => !v)} />

          <div className="card app-section-card constructor-section">
            <h2 className="constructor-section-title">Параметры карты</h2>
            <p className="constructor-section-desc">
              Поиск места, слой карты и обводка крыши на спутнике
              {hasGoogleKey && googleReady && ' · Google Maps активен'}
            </p>

            <ConstructorAddressSearch
              countryCode={state.countryCode || 'kz'}
              city={state.city}
              address={state.address}
              lat={state.lat}
              lng={state.lng}
              onPatch={patch}
              onLocationSelect={handleLocationSelect}
            />
            {state.formattedAddress && (
              <p className="constructor-selected-address">На карте: <strong>{state.formattedAddress}</strong></p>
            )}

            <div className="constructor-subsection">
              <h3 className="constructor-subsection__title">Слой карты</h3>
              <div className="constructor-draw-modes">
                {[
                  ['hybrid', 'Гибрид (Google)'],
                  ['roadmap', 'Схема'],
                  ['satellite', 'Спутник'],
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className={`btn btn--sm${(state.mapStyle || 'hybrid') === type ? ' btn--primary' : ' btn--outline-dark'}`}
                    onClick={() => patch({ mapStyle: type })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="constructor-subsection">
              <h3 className="constructor-subsection__title">Инструменты на карте</h3>
              <div className="constructor-draw-modes">
                {[
                  ['roof', '① Углы крыши'],
                  ['edge', '② Рёбра крыши'],
                  ['obstacle', '③ Препятствие'],
                  ['view', 'Просмотр'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn btn--sm${state.drawMode === mode ? ' btn--primary' : ' btn--outline-dark'}`}
                    onClick={() => patch({ drawMode: mode, edgeDraft: [], roofRectDraft: [] })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {state.drawMode === 'roof' && (
                <div className="constructor-draw-modes" style={{ marginTop: 8 }}>
                  {[
                    ['rectangle', 'Прямоугольник (2 клика → 4 угла)'],
                    ['free', 'Свободный контур (каждый угол)'],
                  ].map(([shape, label]) => (
                    <button
                      key={shape}
                      type="button"
                      className={`btn btn--sm${(state.roofShape || 'rectangle') === shape ? ' btn--primary' : ' btn--outline-dark'}`}
                      onClick={() => patch({ roofShape: shape, roofPolygon: [], roofRectDraft: [], panels: [] })}
                    >
                      {label}
                    </button>
                  ))}
                  <button type="button" className="btn btn--sm btn--outline-dark" onClick={undoLastCorner} disabled={!state.roofPolygon.length && !state.roofRectDraft?.length}>
                    Отменить точку
                  </button>
                  <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => patch({ roofPolygon: [], roofRectDraft: [], panels: [], roofEdges: [], edgeDraft: [] })}>
                    Очистить контур
                  </button>
                </div>
              )}
              {state.drawMode === 'roof' && (state.roofShape || 'rectangle') === 'rectangle' && (
                <p className="constructor-active-hint">
                  <strong>Прямоугольник:</strong> клик 1 — первый угол, клик 2 — противоположный угол.
                  Остальные 3 угла проставятся автоматически.
                  {state.roofRectDraft?.length === 1 && ' · Ждём 2-й клик…'}
                  {state.roofPolygon.length >= 4 && ' · Контур готов ✓'}
                </p>
              )}
              {state.drawMode === 'roof' && state.roofShape === 'free' && (
                <p className="constructor-active-hint">
                  <strong>Свободный контур:</strong> кликайте по каждому углу крыши. Точек: <strong>{state.roofPolygon.length}</strong>
                  {state.roofPolygon.length >= 3 ? ' · Контур готов ✓' : ' · минимум 3'}
                </p>
              )}
              {state.drawMode === 'edge' && (
                <p className="constructor-active-hint">
                  <strong>Рёбра крыши:</strong> линия, вдоль которой крыша идёт под углом (скаты с двух сторон).
                  Клик 1 — начало, клик 2 — конец ребра. Можно добавить несколько рёбер.
                  {state.edgeDraft?.length === 1 && ' · Ждём 2-й клик…'}
                  {(state.roofEdges?.length || 0) > 0 && ` · Рёбер: ${state.roofEdges.length}`}
                </p>
              )}
              {(state.roofEdges?.length || 0) > 0 && (
                <ul className="constructor-edge-list">
                  {(state.roofEdges || []).map((edge, idx) => (
                    <li key={edge.id} className="constructor-edge-item">
                      <span className="constructor-edge-item__label">Ребро {idx + 1}</span>
                      <label className="constructor-check">
                        <input
                          type="checkbox"
                          checked={edge.sideAActive !== false}
                          onChange={(e) => patch({
                            roofEdges: state.roofEdges.map((ed) => (
                              ed.id === edge.id ? { ...ed, sideAActive: e.target.checked } : ed
                            )),
                            panels: [],
                          })}
                        />
                        Сторона А — панели
                      </label>
                      <label className="constructor-check">
                        <input
                          type="checkbox"
                          checked={edge.sideBActive !== false}
                          onChange={(e) => patch({
                            roofEdges: state.roofEdges.map((ed) => (
                              ed.id === edge.id ? { ...ed, sideBActive: e.target.checked } : ed
                            )),
                            panels: [],
                          })}
                        />
                        Сторона Б — панели
                      </label>
                      <button
                        type="button"
                        className="btn btn--sm btn--outline-dark"
                        onClick={() => patch({
                          roofEdges: state.roofEdges.filter((ed) => ed.id !== edge.id),
                          panels: [],
                        })}
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ConstructorMapView
              lat={state.lat}
              lng={state.lng}
              roofPolygon={state.roofPolygon}
              roofRectDraft={state.roofRectDraft}
              roofEdges={state.roofEdges}
              edgeDraft={state.edgeDraft}
              obstacles={state.obstacles}
              drawMode={state.drawMode}
              mapStyle={state.mapStyle || 'hybrid'}
              flyToKey={state.mapFlyKey}
              onMapClick={handleMapClick}
              onObstacleAdd={handleObstacleAdd}
            />
          </div>

          <div className="card app-section-card constructor-section">
            <h2 className="constructor-section-title">Параметры конструктора</h2>
            <p className="constructor-section-desc">Геометрия крыши для расчёта панелей и 3D-модели</p>

            <div className="constructor-grid-2">
              <div className="constructor-params">
                <label>
                  Уклон крыши, °
                  <input type="range" min="5" max="60" value={state.pitchDeg} onChange={(e) => patch({ pitchDeg: +e.target.value })} />
                  <span>{state.pitchDeg}°</span>
                </label>
                <label>
                  Азимут ската, ° (180 = юг)
                  <input type="range" min="0" max="359" value={state.azimuthDeg} onChange={(e) => patch({ azimuthDeg: +e.target.value })} />
                  <span>{state.azimuthDeg}°</span>
                </label>
                {facets.length > 0 && (
                  <ul className="constructor-facet-list">
                    {facets.map((f) => (
                      <li key={f.id}>
                        <strong>{f.label}</strong>
                        {' · '}
                        ~{f.areaM2} м² · азимут {f.azimuthDeg}°
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="app-dl constructor-roof-stats">
                  <dt>Площадь контура</dt>
                  <dd>{state.roofPolygon.length >= 3 ? `~${Math.round(derived.roofAreaM2)} м²` : '— обведите крышу'}</dd>
                  <dt>Углов отмечено</dt>
                  <dd>{state.roofPolygon.length}</dd>
                  <dt>Рёбер / скатов</dt>
                  <dd>
                    {(state.roofEdges?.length || 0) || '—'}
                    {facets.length > 0 ? ` / ${facets.length} скатов` : ''}
                  </dd>
                  <dt>Панелей (расчёт)</dt>
                  <dd>{summary.activePanelCount || '—'}</dd>
                </dl>
              </div>
              <div className="constructor-3d-block">
                <h3 className="constructor-subsection__title">3D-превью</h3>
                <Constructor3D
                  roofPolygon={state.roofPolygon}
                  roofEdges={state.roofEdges}
                  facets={facets}
                  pitchDeg={state.pitchDeg}
                  azimuthDeg={state.azimuthDeg}
                  moduleWidthM={derived.module.widthM}
                  moduleHeightM={derived.module.heightM}
                  activePanels={panels}
                  selectedPanelId={state.selectedPanelId}
                  hasRoof={state.roofPolygon.length >= 3}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'panels' && (
        <div className="constructor-grid-2">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Оборудование</h2>
            <div className="constructor-form-grid">
              <label>
                Модуль
                <select className="input" value={state.moduleSku} onChange={(e) => patch({ moduleSku: e.target.value, panels: [] })}>
                  {MODULES.map((m) => <option key={m.sku} value={m.sku}>{m.name} — {m.powerW}W</option>)}
                </select>
              </label>
              <label>
                Инвертор
                <select className="input" value={state.inverterSku} onChange={(e) => patch({ inverterSku: e.target.value })}>
                  {INVERTERS.map((i) => <option key={i.sku} value={i.sku}>{i.name} — {i.capacityKw} kW</option>)}
                </select>
              </label>
              <label>
                Панелей в строке (DC)
                <input className="input" type="number" min="6" max="24" value={state.panelsPerString} onChange={(e) => patch({ panelsPerString: +e.target.value })} />
              </label>
            </div>
            <button type="button" className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => patch({ panels: [] })}>
              Пересчитать сетку по контуру
            </button>
          </div>
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Редактор панелей</h2>
            <p className="app-page-desc">Клик по ячейке — выбор. Можно отключить, сменить модуль, задать потери от тени.</p>
            <div className="constructor-panel-grid" style={{ '--cols': gridCols }}>
              {panels.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`constructor-panel-cell${!p.active ? ' constructor-panel-cell--off' : ''}${state.selectedPanelId === p.id ? ' constructor-panel-cell--selected' : ''}${p.shadeLossPct > 10 ? ' constructor-panel-cell--shade' : ''}`}
                  title={`${p.id} · строка ${p.stringId || '—'} · тень ${p.shadeLossPct}%`}
                  onClick={() => patch({ selectedPanelId: p.id })}
                >
                  {p.active ? findModule(p.moduleSku).powerW : '×'}
                </button>
              ))}
            </div>
            {selectedPanel && (
              <div className="constructor-panel-editor">
                <h3>Панель {selectedPanel.id}</h3>
                <label className="constructor-check">
                  <input type="checkbox" checked={selectedPanel.active} onChange={(e) => updatePanel(selectedPanel.id, { active: e.target.checked })} />
                  Активна
                </label>
                <label>
                  Модуль
                  <select className="input" value={selectedPanel.moduleSku} onChange={(e) => updatePanel(selectedPanel.id, { moduleSku: e.target.value })}>
                    {MODULES.map((m) => <option key={m.sku} value={m.sku}>{m.name}</option>)}
                  </select>
                </label>
                <label>
                  Потери от тени, %
                  <input className="input" type="number" min="0" max="100" value={selectedPanel.shadeLossPct} onChange={(e) => updatePanel(selectedPanel.id, { shadeLossPct: +e.target.value })} />
                </label>
                <label>
                  Примечание
                  <input className="input" value={selectedPanel.note || ''} onChange={(e) => updatePanel(selectedPanel.id, { note: e.target.value })} />
                </label>
                <p>Строка: <strong>{selectedPanel.stringId || '—'}</strong></p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'wiring' && (
        <div className="constructor-stack">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Подключение к инвертору</h2>
            <dl className="app-dl">
              <dt>Инвертор</dt><dd>{derived.inverter.name} ({derived.inverter.capacityKw} kW, {derived.inverter.phases}-ф)</dd>
              <dt>MPPT</dt><dd>{derived.inverter.mpptCount} трекера</dd>
              <dt>DC макс.</dt><dd>{derived.inverter.maxDcKw} kW · установлено {summary.totalKw} kW</dd>
              <dt>Загрузка DC/AC</dt><dd>{Math.round((summary.totalKw / derived.inverter.capacityKw) * 100)}%</dd>
            </dl>
            <table className="app-table">
              <thead>
                <tr><th>Строка</th><th>MPPT</th><th>Панелей</th><th>P, W</th><th>Voc</th><th>Vmp</th><th>Imp</th></tr>
              </thead>
              <tbody>
                {strings.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td><td>{s.mppt}</td><td>{s.panelCount}</td><td>{s.powerW}</td>
                    <td>{Math.round(s.voc)} V</td><td>{Math.round(s.vmp)} V</td><td>{s.imp} A</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Кабельный журнал (DC)</h2>
            <label>
              Расстояние крыша → инвертор, м
              <input className="input" type="number" min="5" max="200" value={state.roofToInverterM} onChange={(e) => patch({ roofToInverterM: +e.target.value })} />
            </label>
            <table className="app-table" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>Строка</th><th>Тип</th><th>Длина, м</th><th>Сечение</th><th>Ток, A</th><th>Падение U, %</th><th>OK</th></tr>
              </thead>
              <tbody>
                {cables.map((c) => (
                  <tr key={c.stringId}>
                    <td>{c.stringId}</td><td>{c.type}</td><td>{c.lengthM}</td><td>{c.sectionMm2} mm²</td>
                    <td>{c.currentA}</td><td>{c.voltageDropPct}%</td><td>{c.ok ? '✓' : '⚠'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'shading' && (
        <div className="card app-section-card">
          <h2 className="app-section-card__title">Затенение</h2>
          <p className="app-page-desc">
            Отметьте препятствия на карте (режим «Препятствие»). Высота и радиус редактируются ниже.
            Расчёт упрощённый — для точности нужен LiDAR или ручная 3D-модель (этап 2).
          </p>
          <p>Средние потери от тени: <strong>{summary.avgShadeLossPct}%</strong></p>
          <ul className="constructor-obstacle-list">
            {(state.obstacles || []).map((obs) => (
              <li key={obs.id}>
                <span>{obs.lat.toFixed(5)}, {obs.lng.toFixed(5)}</span>
                <label>
                  h, м
                  <input className="input" type="number" min="1" max="30" value={obs.heightM} onChange={(e) => patch({ obstacles: state.obstacles.map((o) => o.id === obs.id ? { ...o, heightM: +e.target.value } : o) })} />
                </label>
                <label>
                  r, м
                  <input className="input" type="number" min="0.5" max="20" step="0.5" value={obs.radiusM} onChange={(e) => patch({ obstacles: state.obstacles.map((o) => o.id === obs.id ? { ...o, radiusM: +e.target.value } : o) })} />
                </label>
                <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => patch({ obstacles: state.obstacles.filter((o) => o.id !== obs.id) })}>Удалить</button>
              </li>
            ))}
          </ul>
          {panels.filter((p) => p.shadeLossPct > 5).length > 0 && (
            <table className="app-table">
              <thead><tr><th>Панель</th><th>Строка</th><th>Потери, %</th></tr></thead>
              <tbody>
                {panels.filter((p) => p.active && p.shadeLossPct > 5).map((p) => (
                  <tr key={p.id}><td>{p.id}</td><td>{p.stringId}</td><td>{p.shadeLossPct}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'finance' && (
        <div className="constructor-grid-2">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Финансовый отчёт</h2>
            <div className="constructor-form-grid">
              <label>
                Тариф, ₸/кВт·ч
                <input className="input" type="number" value={state.tariffPerKwh} onChange={(e) => patch({ tariffPerKwh: +e.target.value })} />
              </label>
              <label>
                Самопотребление, %
                <input className="input" type="number" min="0" max="100" value={state.selfConsumptionPct} onChange={(e) => patch({ selfConsumptionPct: +e.target.value })} />
              </label>
            </div>
            <dl className="app-dl" style={{ marginTop: 16 }}>
              <dt>Оборудование</dt><dd>{formatMoney(summary.equipmentCost)}</dd>
              <dt>Кабели</dt><dd>{formatMoney(summary.cableCost)}</dd>
              <dt>ПНР</dt><dd>{formatMoney(summary.commissioning)}</dd>
              <dt>CAPEX итого</dt><dd><strong>{formatMoney(summary.totalCapex)}</strong></dd>
              <dt>Выработка / год</dt><dd>{summary.annualKwh.toLocaleString('ru-RU')} кВт·ч</dd>
              <dt>Экономия / год</dt><dd>{formatMoney(summary.annualSaving)}</dd>
              <dt>Окупаемость</dt><dd>{summary.paybackYears ?? '—'} лет</dd>
              <dt>С учётом роста тарифа</dt><dd>{summary.paybackWithGrowth ?? '—'} лет</dd>
              <dt>NPV 20 лет (10%)</dt><dd>{formatMoney(summary.npv20)}</dd>
              <dt>LCOE</dt><dd>{summary.lcoe} ₸/кВт·ч</dd>
              <dt>Продажа в сеть</dt><dd>{summary.gridExportKwh.toLocaleString('ru-RU')} кВт·ч/год</dd>
            </dl>
          </div>
          <div className="card app-section-card constructor-print-block">
            <h2 className="app-section-card__title">Сводка для клиента</h2>
            <p><strong>{state.projectName || 'Проект СЭС'}</strong></p>
            <p>{state.address || 'Адрес не указан'}</p>
            <p>Мощность: {summary.totalKw} kW ({summary.activePanelCount} × {summary.module.powerW}W)</p>
            <p>Инвертор: {summary.inverter.name}</p>
            <p>Выработка: ~{summary.annualKwh.toLocaleString('ru-RU')} kWh/год</p>
            <p>Инвестиции: {formatMoney(summary.totalCapex)}</p>
            <p>Окупаемость: ~{summary.paybackYears} лет</p>
            <button type="button" className="btn btn--outline-dark" onClick={() => window.print()}>Печать / PDF</button>
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div className="card app-section-card">
          <h2 className="app-section-card__title">Пакет для ОЖТ, диспетчеризации и подключения к сети</h2>
          <p className="app-page-desc">
            Структурированные данные для подачи в сетевую компанию и настройки SCADA/диспетчеризации.
            Формат JSON — основа; позже добавим PDF и интеграцию с API оператора.
          </p>
          <div className="constructor-form-grid">
            <label>Заявитель<input className="input" value={state.applicantName} onChange={(e) => patch({ applicantName: e.target.value })} /></label>
            <label>ИИН/БИН<input className="input" value={state.iinBin} onChange={(e) => patch({ iinBin: e.target.value })} /></label>
            <label>Точка присоединения<input className="input" value={state.connectionPoint} onChange={(e) => patch({ connectionPoint: e.target.value })} /></label>
            <label>
              Режим
              <select className="input" value={state.gridMode} onChange={(e) => patch({ gridMode: e.target.value })}>
                <option value="net-metering">Зелёный тариф / net-metering</option>
                <option value="surplus">Продажа излишков</option>
                <option value="full-export">Полная выдача в сеть</option>
              </select>
            </label>
            <label>
              Схема учёта
              <input className="input" value={state.meteringScheme} onChange={(e) => patch({ meteringScheme: e.target.value })} />
            </label>
            <label className="constructor-check">
              <input type="checkbox" checked={state.dispatchAccess} onChange={(e) => patch({ dispatchAccess: e.target.checked })} />
              Требуется доступ к диспетчеризации (SCADA)
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            Примечания для ОЖТ
            <textarea className="input" rows={3} value={state.ohtNotes} onChange={(e) => patch({ ohtNotes: e.target.value })} />
          </label>
          <pre className="constructor-json-preview">{JSON.stringify(gridExport, null, 2)}</pre>
          <button type="button" className="btn btn--primary" onClick={() => downloadJson(gridExport, `grid-package-${Date.now()}.json`)}>
            Скачать пакет JSON
          </button>
        </div>
      )}
    </div>
  );
}
