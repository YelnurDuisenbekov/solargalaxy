import { useCallback, useEffect, useMemo, useState } from 'react';
import { proposalsApi, warehouseApi, crmApi } from '../../api';
import { Reveal } from '../../components/motion/ScrollReveal';
import { formatMoney, formatNum } from '../../utils/format';
import { SYSTEM_TYPE } from '../../utils/crmLabels';
import { KIT_CATEGORY, COST_ALLOCATION, COST_ALLOCATION_HINT } from '../../utils/proposalLabels';
import './app-pages.css';

const SYSTEM_TABS = [
  { id: 'ON_GRID', label: 'Сетевая' },
  { id: 'OFF_GRID', label: 'Автономная' },
  { id: 'HYBRID', label: 'Гибридная' },
];

const emptyLine = {
  category: 'PANEL',
  allocation: 'PER_PANEL',
  productId: '',
  qtyMultiplier: 1,
  unitPriceOverride: '',
  label: '',
};

export default function ProposalPage() {
  const [systemTab, setSystemTab] = useState('ON_GRID');
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [previewKw, setPreviewKw] = useState(20);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState(emptyLine);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const loadTemplates = useCallback(() => {
    proposalsApi.templates(systemTab).then(setTemplates).catch((e) => setError(e.message));
  }, [systemTab]);

  const runPreview = useCallback(() => {
    proposalsApi.preview(systemTab, previewKw)
      .then(setPreview)
      .catch((e) => setError(e.message));
  }, [systemTab, previewKw]);

  useEffect(() => {
    warehouseApi.products().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { runPreview(); }, [runPreview]);

  const systemLines = templates.filter((t) => t.systemType === systemTab);

  const productsForCategory = (category) =>
    products.filter((p) => !p.kitCategory || p.kitCategory === category);

  const saveNewLine = async (e) => {
    e.preventDefault();
    try {
      await proposalsApi.createTemplate({
        systemType: systemTab,
        category: newLine.category,
        allocation: newLine.allocation,
        productId: newLine.productId || null,
        qtyMultiplier: Number(newLine.qtyMultiplier) || 1,
        unitPriceOverride: newLine.unitPriceOverride !== '' ? Number(newLine.unitPriceOverride) : null,
        label: newLine.label || null,
      });
      setNewLine(emptyLine);
      setAdding(false);
      loadTemplates();
      runPreview();
    } catch (err) { setError(err.message); }
  };

  const startEdit = (line) => {
    setEditingId(line.id);
    setEditDraft({
      category: line.category,
      allocation: line.allocation,
      productId: line.productId || '',
      qtyMultiplier: line.qtyMultiplier,
      unitPriceOverride: line.unitPriceOverride ?? '',
      label: line.label || '',
      enabled: line.enabled,
    });
  };

  const saveEdit = async (id) => {
    try {
      await proposalsApi.updateTemplate(id, {
        category: editDraft.category,
        allocation: editDraft.allocation,
        productId: editDraft.productId || null,
        qtyMultiplier: Number(editDraft.qtyMultiplier) || 1,
        unitPriceOverride: editDraft.unitPriceOverride !== '' ? Number(editDraft.unitPriceOverride) : null,
        label: editDraft.label || null,
        enabled: editDraft.enabled,
      });
      setEditingId(null);
      setEditDraft(null);
      loadTemplates();
      runPreview();
    } catch (err) { setError(err.message); }
  };

  const removeLine = async (id) => {
    if (!window.confirm('Удалить строку расхода?')) return;
    try {
      await proposalsApi.deleteTemplate(id);
      loadTemplates();
      runPreview();
    } catch (err) { setError(err.message); }
  };

  const toggleEnabled = async (line) => {
    try {
      await proposalsApi.updateTemplate(line.id, { enabled: !line.enabled });
      loadTemplates();
      runPreview();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Коммерческое предложение</h1>
        <p className="app-page-desc">
          Удельные расходы по типам систем и автоматический подбор комплекта под мощность клиента
        </p>
      </Reveal>

      <div className="app-subtabs">
        {SYSTEM_TABS.map((st) => (
          <button
            key={st.id}
            type="button"
            className={`app-subtab${systemTab === st.id ? ' app-subtab--active' : ''}`}
            onClick={() => setSystemTab(st.id)}
          >
            {st.label}
          </button>
        ))}
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      <Reveal delay={0.05}>
        <div className="card app-section-card">
          <div className="app-toolbar">
            <h2 className="app-section-card__title" style={{ margin: 0 }}>
              Удельные расходы — {SYSTEM_TYPE[systemTab]}
            </h2>
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>+ Строка</button>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Задайте товар, распределение (на панель / на кВт / на проект) и множитель количества.
            Панели и инвертор подбираются автоматически по мощности, если товар не указан явно.
          </p>

          {adding && (
            <form className="app-form-grid" style={{ marginBottom: 20 }} onSubmit={saveNewLine}>
              <select className="input" value={newLine.category} onChange={(e) => setNewLine({ ...newLine, category: e.target.value, productId: '' })}>
                {Object.entries(KIT_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input" value={newLine.allocation} onChange={(e) => setNewLine({ ...newLine, allocation: e.target.value })} title={COST_ALLOCATION_HINT[newLine.allocation]}>
                {Object.entries(COST_ALLOCATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input" value={newLine.productId} onChange={(e) => setNewLine({ ...newLine, productId: e.target.value })}>
                <option value="">Автоподбор</option>
                {productsForCategory(newLine.category).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.powerW ? ` (${p.powerW} Вт)` : ''}{p.capacityKw ? ` (${p.capacityKw} кВт)` : ''}</option>
                ))}
              </select>
              <input className="input" type="number" step="0.01" min="0.01" placeholder="Множитель" value={newLine.qtyMultiplier} onChange={(e) => setNewLine({ ...newLine, qtyMultiplier: e.target.value })} />
              <input className="input" type="number" min="0" placeholder="Цена за ед. (переопр.)" value={newLine.unitPriceOverride} onChange={(e) => setNewLine({ ...newLine, unitPriceOverride: e.target.value })} />
              <input className="input" placeholder="Подпись (необяз.)" value={newLine.label} onChange={(e) => setNewLine({ ...newLine, label: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn--primary">Сохранить</button>
                <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>Отмена</button>
              </div>
            </form>
          )}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Распределение</th>
                  <th>Товар</th>
                  <th>Множитель / %</th>
                  <th>Цена/ед.</th>
                  <th>Активна</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {systemLines.map((line) => {
                  const isEdit = editingId === line.id;
                  const draft = isEdit ? editDraft : null;
                  const row = isEdit ? draft : line;
                  const unitPrice = line.unitPriceOverride ?? line.product?.price ?? 0;

                  return (
                    <tr key={line.id} style={!line.enabled ? { opacity: 0.5 } : undefined}>
                      <td>
                        {isEdit ? (
                          <select className="input input--sm" value={row.category} onChange={(e) => setEditDraft({ ...draft, category: e.target.value, productId: '' })}>
                            {Object.entries(KIT_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        ) : KIT_CATEGORY[line.category]}
                      </td>
                      <td>
                        {isEdit ? (
                          <select className="input input--sm" value={row.allocation} onChange={(e) => setEditDraft({ ...draft, allocation: e.target.value })}>
                            {Object.entries(COST_ALLOCATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        ) : COST_ALLOCATION[line.allocation]}
                      </td>
                      <td>
                        {isEdit ? (
                          <select className="input input--sm" value={row.productId} onChange={(e) => setEditDraft({ ...draft, productId: e.target.value })}>
                            <option value="">Автоподбор</option>
                            {productsForCategory(row.category).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        ) : (line.product?.name || <span style={{ color: 'var(--text-muted)' }}>Автоподбор</span>)}
                      </td>
                      <td>
                        {isEdit ? (
                          <input className="input input--sm" type="number" step="0.01" min="0.01" value={row.qtyMultiplier} onChange={(e) => setEditDraft({ ...draft, qtyMultiplier: e.target.value })} />
                        ) : row.allocation === 'PERCENT_EQUIPMENT'
                          ? `${formatNum(row.qtyMultiplier, { maxDecimals: 2 })}%`
                          : formatNum(row.qtyMultiplier, { maxDecimals: 2 })}
                      </td>
                      <td>
                        {isEdit ? (
                          <input className="input input--sm" type="number" min="0" placeholder={line.product?.price ?? 0} value={row.unitPriceOverride} onChange={(e) => setEditDraft({ ...draft, unitPriceOverride: e.target.value })} />
                        ) : line.allocation === 'PERCENT_EQUIPMENT'
                          ? <span style={{ color: 'var(--text-muted)' }}>авто</span>
                          : formatMoney(unitPrice)}
                      </td>
                      <td>
                        <input type="checkbox" checked={line.enabled} onChange={() => toggleEnabled(line)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {isEdit ? (
                            <>
                              <button type="button" className="btn btn--primary app-table-btn" onClick={() => saveEdit(line.id)}>OK</button>
                              <button type="button" className="btn btn--ghost app-table-btn" onClick={() => setEditingId(null)}>×</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="btn btn--ghost app-table-btn" onClick={() => startEdit(line)}>Изм.</button>
                              <button type="button" className="btn btn--ghost app-table-btn" onClick={() => removeLine(line.id)}>Удал.</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {systemLines.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Нет строк — добавьте удельные расходы</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="card app-section-card">
          <div className="app-toolbar">
            <h2 className="app-section-card__title" style={{ margin: 0 }}>Расчёт КП</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.875rem' }}>
                Мощность, кВт:
                <input
                  className="input input--sm"
                  type="number"
                  min="1"
                  step="0.1"
                  value={previewKw}
                  onChange={(e) => setPreviewKw(Number(e.target.value))}
                  style={{ marginLeft: 8, width: 90 }}
                />
              </label>
              <button type="button" className="btn btn--dark" onClick={runPreview}>Пересчитать</button>
            </div>
          </div>

          {preview?.meta && (
            <div className="app-detail-grid" style={{ marginBottom: 16, fontSize: '0.875rem' }}>
              <div>
                <strong>Система:</strong> {SYSTEM_TYPE[systemTab]}<br />
                <strong>Мощность:</strong> {formatNum(preview.meta.capacityKw)} кВт
              </div>
              <div>
                <strong>Панели:</strong> {preview.meta.panelCount} шт × {preview.meta.panelPowerW} Вт<br />
                <strong>Оборудование:</strong> {formatMoney(preview.meta.equipmentSum ?? 0)}
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Категория</th>
                  <th>Кол-во</th>
                  <th>Цена</th>
                  <th>Сумма</th>
                  <th>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {preview?.items?.map((item, i) => (
                  <tr key={i}>
                    <td>
                      {item.name}
                      {item.inverterKw && <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}> ({item.inverterKw} кВт)</span>}
                      {item.panelPowerW && <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}> ({item.panelPowerW} Вт)</span>}
                      {item.percentOfEquipment != null && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                          {' '}({item.percentOfEquipment}% от {formatMoney(item.equipmentBase)})
                        </span>
                      )}
                    </td>
                    <td>{KIT_CATEGORY[item.category] || item.category}</td>
                    <td>{formatNum(item.quantity)}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
                    <td><strong>{formatMoney(item.quantity * item.unitPrice)}</strong></td>
                    <td>{formatNum(item.stockAvailable)}</td>
                  </tr>
                ))}
              </tbody>
              {preview && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right' }}><strong>Итого КП:</strong></td>
                    <td colSpan={2}><strong style={{ fontSize: '1.125rem' }}>{formatMoney(preview.amount)}</strong></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Редактируемое КП лида — автогенерация + сохранение правок */
export function LeadProposalModal({ lead, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [addForm, setAddForm] = useState({ productId: '', quantity: 1 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const kw = lead.capacityKw || 5;
  const systemType = lead.systemType || 'ON_GRID';

  const load = useCallback(() => {
    crmApi.getLeadProposal(lead.id).then((d) => {
      setData(d);
      setItems(d.proposalItems.map((i) => ({ ...i })));
    }).catch((e) => setError(e.message));
  }, [lead.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    warehouseApi.products().then(setProducts).catch(() => {});
  }, []);

  const total = items.reduce((s, i) => {
    const d = i.discountPct ?? 0;
    return s + i.quantity * i.unitPrice * (1 - d / 100);
  }, 0);

  const prodById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products],
  );

  const stockOf = (item) => {
    const p = item.productId ? prodById[item.productId] : null;
    if (p) return p.available ?? p.stock?.available ?? p.stock?.quantity ?? null;
    if (item.product?.stock) return item.product.stock.available ?? item.product.stock.quantity ?? null;
    return null;
  };

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const changeProduct = (idx, productId) => {
    if (!productId) {
      updateItem(idx, { productId: null, product: null });
      return;
    }
    const p = prodById[productId];
    if (!p) return;
    updateItem(idx, {
      productId: p.id,
      name: p.name,
      unitPrice: p.price,
      category: p.kitCategory || 'OTHER',
      product: p,
    });
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addProduct = (e) => {
    e.preventDefault();
    const p = products.find((x) => x.id === addForm.productId);
    if (!p) return;
    setItems((prev) => [...prev, {
      id: `new-${Date.now()}`,
      productId: p.id,
      category: p.kitCategory || 'OTHER',
      name: p.name,
      quantity: Number(addForm.quantity) || 1,
      unitPrice: p.price,
      discountPct: 0,
      product: p,
    }]);
    setAddForm({ productId: '', quantity: 1 });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = items.map((i, idx) => ({
        productId: i.productId || null,
        category: i.category || 'OTHER',
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discountPct: i.discountPct ?? 0,
        sortOrder: (idx + 1) * 10,
      }));
      await crmApi.saveLeadProposal(lead.id, { items: payload });
      onSaved?.();
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const recalc = async () => {
    if (data?.proposalCustomized && !window.confirm('Пересчитать КП заново? Ручные правки будут заменены.')) return;
    setSaving(true);
    try {
      await crmApi.recalcLeadProposal(lead.id);
      onSaved?.();
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2>КП — {lead.fullName}</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {SYSTEM_TYPE[systemType]}, {formatNum(kw)} кВт
          {data?.proposalCustomized && (
            <span style={{ marginLeft: 8, color: 'var(--blue)' }}>· отредактировано вручную</span>
          )}
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          КП формируется автоматически при создании лида. Выберите позицию со склада, измените количество или цену,
          затем нажмите «Сохранить» — после этого можно отправить КП клиенту.
        </p>
        {error && <p className="error-msg">{error}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Позиция (со склада)</th>
                <th>Категория</th>
                <th>Кол-во</th>
                <th>Остаток</th>
                <th>Цена</th>
                <th>Сумма</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const stock = stockOf(item);
                const shortage = stock != null && Number(item.quantity) > stock;
                return (
                <tr key={item.id || idx}>
                  <td style={{ minWidth: 240 }}>
                    <select
                      className="input input--sm"
                      value={item.productId || ''}
                      onChange={(e) => changeProduct(idx, e.target.value)}
                      style={{ marginBottom: 4 }}
                    >
                      <option value="">— своя позиция (без склада) —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {formatMoney(p.price)} · ост. {formatNum(p.available ?? p.stock?.available ?? p.stock?.quantity ?? 0)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input input--sm"
                      value={item.name}
                      placeholder="Название в КП"
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                    />
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>{KIT_CATEGORY[item.category] || item.category}</td>
                  <td>
                    <input
                      className="input input--sm"
                      type="number"
                      min="0.01"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                      style={{ width: 72 }}
                    />
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: shortage ? 'var(--danger, #d33)' : 'var(--text-muted)' }}>
                    {stock == null ? '—' : formatNum(stock)}
                    {shortage && <span title="Недостаточно на складе"> ⚠</span>}
                  </td>
                  <td>
                    <input
                      className="input input--sm"
                      type="number"
                      min="0"
                      step="1000"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>{formatMoney(item.quantity * item.unitPrice)}</td>
                  <td>
                    <button type="button" className="btn btn--ghost app-table-btn" onClick={() => removeItem(idx)}>×</button>
                  </td>
                </tr>
                );
              })}
              {!items.length && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Нет позиций — пересчитайте КП</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}><strong>Итого:</strong></td>
                <td colSpan={2}><strong>{formatMoney(total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <form className="app-form-grid" style={{ marginTop: 16 }} onSubmit={addProduct}>
          <select className="input" value={addForm.productId} onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })} required>
            <option value="">+ Добавить позицию со склада</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price)} · ост. {formatNum(p.available ?? p.stock?.available ?? p.stock?.quantity ?? 0)}
              </option>
            ))}
          </select>
          <input className="input" type="number" min="1" value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })} />
          <button type="submit" className="btn btn--ghost">Добавить</button>
        </form>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={recalc} disabled={saving}>Пересчитать</button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Закрыть</button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !items.length}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
