import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { warehouseApi, erpApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import WarehouseIssueModal from '../../components/warehouse/WarehouseIssueModal';
import { formatMoney, formatNum } from '../../utils/format';

const MOVEMENT_LABELS = {
  IN: 'Приход',
  OUT: 'Расход',
  ADJUST: 'Редактирование',
};

const ACT_STATUS = {
  PENDING_MANAGER: 'Ожидает приёмки',
  ACCEPTED: 'Принят',
};

const WAREHOUSE_TABS = [
  { id: 'stock', label: 'Остатки' },
  { id: 'acts', label: 'Акты приём-передачи' },
  { id: 'accepted', label: 'Принятые акты', managerOnly: true },
];

const WRITE_OFF_STATUS = {
  PENDING_DIRECTOR: 'Ожидает директора',
  PENDING_ACCOUNTANT: 'Ожидает бухгалтера',
  APPROVED: 'Списано',
  REJECTED: 'Отклонено',
};

const PRODUCT_CATEGORIES = [
  'Панели',
  'Инверторы',
  'АКБ',
  'Монтаж',
  'Услуги',
  'Кабели',
  'Прочее',
];

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatSupplierName(orgType, rawName) {
  const cleaned = rawName
    .trim()
    .replace(/^ТОО\s*[«"]?/i, '')
    .replace(/[»"]\s*$/i, '')
    .replace(/^ИП\s+/i, '')
    .trim();
  if (!cleaned) return '';
  if (orgType === 'IP') return `ИП ${cleaned}`;
  return `ТОО «${cleaned}»`;
}

function AddSupplierModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({ orgType: 'TOO', name: '', bin: '' });
  const [saving, setSaving] = useState(false);
  const previewName = formatSupplierName(form.orgType, form.name);

  const submit = async (e) => {
    e.preventDefault();
    if (!previewName) {
      onError(form.orgType === 'IP' ? 'Укажите ФИО' : 'Укажите наименование');
      return;
    }
    setSaving(true);
    try {
      const supplier = await warehouseApi.createSupplier({
        orgType: form.orgType,
        name: form.name.trim(),
        bin: form.bin.replace(/\D/g, ''),
      });
      onCreated(supplier);
      onClose();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="app-section-card__title">Новый поставщик</h2>
        <form className="app-modal__form" onSubmit={submit}>
          <div className="app-supplier-org-type">
            <span className="app-field__label">Форма</span>
            <label className="app-supplier-org-type__option">
              <input
                type="radio"
                name="orgType"
                value="TOO"
                checked={form.orgType === 'TOO'}
                onChange={() => setForm({ ...form, orgType: 'TOO' })}
              />
              ТОО
            </label>
            <label className="app-supplier-org-type__option">
              <input
                type="radio"
                name="orgType"
                value="IP"
                checked={form.orgType === 'IP'}
                onChange={() => setForm({ ...form, orgType: 'IP' })}
              />
              ИП
            </label>
          </div>
          <label className="app-field">
            <span className="app-field__label">
              {form.orgType === 'IP' ? 'ФИО' : 'Наименование компании'}
            </span>
            <input
              className="input"
              required
              placeholder={form.orgType === 'IP' ? 'Иванов Иван Иванович' : 'Solar Energy'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          {previewName && (
            <p className="app-field__hint">Будет сохранено: <strong>{previewName}</strong></p>
          )}
          <label className="app-field">
            <span className="app-field__label">БИН</span>
            <input
              className="input"
              required
              inputMode="numeric"
              pattern="\d{12}"
              maxLength={12}
              placeholder="12 цифр"
              value={form.bin}
              onChange={(e) => setForm({ ...form, bin: e.target.value.replace(/\D/g, '').slice(0, 12) })}
            />
          </label>
          <div className="app-modal__actions">
            <button type="button" className="btn btn--outline-dark" disabled={saving} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving || form.bin.length !== 12}>
              {saving ? 'Сохранение…' : 'Добавить поставщика'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function emptyReceiptLine() {
  return {
    id: newLineId(),
    productId: '',
    quantity: 1,
    unitPrice: '',
  };
}

function receiptToForm(receipt) {
  const invoiceDate = receipt.invoiceDate?.slice?.(0, 10)
    || new Date(receipt.invoiceDate).toISOString().slice(0, 10);
  return {
    invoiceDate,
    invoiceNumber: receipt.invoiceNumber,
    supplierId: receipt.supplierId || receipt.supplier?.id || '',
    priceIncludesVat: receipt.priceIncludesVat ?? true,
  };
}

function receiptToLines(receipt) {
  return (receipt.items || []).map((item) => ({
    id: item.id || newLineId(),
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: String(item.unitPrice ?? ''),
  }));
}

function AddProductModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({ sku: '', name: '', category: PRODUCT_CATEGORIES[0] });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const product = await warehouseApi.createProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category,
        initialQty: 0,
      });
      onCreated(product);
      onClose();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="app-section-card__title">Новый товар</h2>
        <form className="app-modal__form" onSubmit={submit}>
          <label className="app-field">
            <span className="app-field__label">Категория</span>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="app-field">
            <span className="app-field__label">Название</span>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="app-field">
            <span className="app-field__label">SKU</span>
            <input
              className="input"
              required
              minLength={2}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>
          <div className="app-modal__actions">
            <button type="button" className="btn btn--outline-dark" disabled={saving} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Добавить товар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WarehouseReceiptModal({
  receipt, products, suppliers, onClose, onSaved, onError, onProductCreated, onSupplierCreated,
}) {
  const isEdit = Boolean(receipt);
  const [form, setForm] = useState(() => (isEdit ? receiptToForm(receipt) : {
    invoiceDate: todayIsoDate(),
    invoiceNumber: '',
    supplierId: '',
    priceIncludesVat: true,
  }));
  const [lines, setLines] = useState(() => (isEdit ? receiptToLines(receipt) : [emptyReceiptLine()]));
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [pendingLineId, setPendingLineId] = useState(null);
  const [saving, setSaving] = useState(false);

  const actualDateLabel = (isEdit ? new Date(receipt.receivedAt) : new Date()).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const updateLine = (lineId, patch) => {
    setLines((prev) => prev.map((l) => {
      if (l.id !== lineId) return l;
      const next = { ...l, ...patch };
      if (patch.productId && patch.productId !== l.productId) {
        const product = products.find((p) => p.id === patch.productId);
        next.unitPrice = String(product?.purchasePrice || product?.price || '');
      }
      return next;
    }));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyReceiptLine()]);
  };

  const removeLine = (lineId) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== lineId)));
  };

  const handleProductCreated = (product) => {
    onProductCreated(product);
    if (pendingLineId) {
      updateLine(pendingLineId, { productId: product.id });
    } else {
      setLines((prev) => [...prev, {
        ...emptyReceiptLine(),
        productId: product.id,
        unitPrice: String(product.purchasePrice || product.price || ''),
      }]);
    }
    setPendingLineId(null);
  };

  const handleSupplierCreated = (supplier) => {
    onSupplierCreated(supplier);
    setForm((prev) => ({ ...prev, supplierId: supplier.id }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) {
      onError('Выберите поставщика');
      return;
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (!validLines.length) {
      onError('Добавьте хотя бы один товар с количеством');
      return;
    }
    const ids = validLines.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) {
      onError('Один товар указан несколько раз — объедините в одну строку');
      return;
    }

    for (const line of validLines) {
      if (line.unitPrice === '' || Number(line.unitPrice) < 0) {
        onError('Укажите закупочную цену для каждой позиции');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        invoiceDate: new Date(`${form.invoiceDate}T12:00:00`).toISOString(),
        invoiceNumber: form.invoiceNumber.trim(),
        supplierId: form.supplierId,
        priceIncludesVat: form.priceIncludesVat,
        items: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
      };
      if (isEdit) {
        await warehouseApi.updateReceipt(receipt.id, payload);
      } else {
        await warehouseApi.createReceipt(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const usedInOtherLines = (productId, currentLineId) =>
    lines.some((l) => l.id !== currentLineId && l.productId === productId);

  return (
    <>
      <div className="app-modal-backdrop" onClick={onClose}>
        <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
          <h2 className="app-section-card__title">{isEdit ? 'Редактирование накладной' : 'Приход — накладная'}</h2>
          <form className="app-modal__form" onSubmit={submit}>
            <div className="app-form-grid app-form-grid--2col">
              <label className="app-field">
                <span className="app-field__label">Фактическая дата приёмки</span>
                <input className="input" type="text" readOnly value={actualDateLabel} />
              </label>
              <label className="app-field">
                <span className="app-field__label">Дата накладной</span>
                <input
                  className="input"
                  type="date"
                  required
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                />
              </label>
              <label className="app-field">
                <span className="app-field__label">Номер накладной</span>
                <input
                  className="input"
                  required
                  placeholder="Например, ПН-1042"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                />
              </label>
              <label className="app-field app-field--full">
                <span className="app-field__label">Поставщик</span>
                <div className="app-supplier-picker">
                  <select
                    className="input"
                    required
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                  >
                    <option value="">Выберите поставщика</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (БИН {s.bin})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn--outline-dark"
                    onClick={() => setShowAddSupplier(true)}
                  >
                    + Добавить
                  </button>
                </div>
              </label>
              <label className="app-field app-field--full app-field--checkbox">
                <label className="app-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.priceIncludesVat}
                    onChange={(e) => setForm({ ...form, priceIncludesVat: e.target.checked })}
                  />
                  <span>Цены в накладной с НДС</span>
                </label>
              </label>
            </div>

            <div className="app-receipt-lines">
              <div className="app-toolbar" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Купленные товары</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--outline-dark" onClick={addLine}>
                    + Строка
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline-dark"
                    onClick={() => { setPendingLineId(null); setShowAddProduct(true); }}
                  >
                    + Добавить товар
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>SKU</th>
                      <th>Кол-во</th>
                      <th>Закуп. цена, ₸</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const product = products.find((p) => p.id === line.productId);
                      return (
                        <tr key={line.id}>
                          <td>
                            <select
                              className="input input--sm"
                              value={line.productId}
                              onChange={(e) => updateLine(line.id, { productId: e.target.value })}
                            >
                              <option value="">Выберите товар</option>
                              {products
                                .filter((p) => p.id === line.productId || !usedInOtherLines(p.id, line.id))
                                .map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                          </td>
                          <td>{product?.sku || '—'}</td>
                          <td>
                            <input
                              className="input input--sm"
                              type="number"
                              min="1"
                              style={{ width: 88 }}
                              value={line.quantity}
                              onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="input input--sm"
                              type="number"
                              min="0"
                              step="1"
                              style={{ width: 104 }}
                              required
                              disabled={!line.productId}
                              value={line.unitPrice}
                              onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--ghost app-table-btn"
                              disabled={lines.length <= 1}
                              onClick={() => removeLine(line.id)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="app-modal__actions">
              <button type="button" className="btn btn--outline-dark" disabled={saving} onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Сохранение…' : (isEdit ? 'Сохранить' : 'Оформить приход')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAddProduct && (
        <AddProductModal
          onClose={() => { setShowAddProduct(false); setPendingLineId(null); }}
          onCreated={handleProductCreated}
          onError={onError}
        />
      )}

      {showAddSupplier && (
        <AddSupplierModal
          onClose={() => setShowAddSupplier(false)}
          onCreated={handleSupplierCreated}
          onError={onError}
        />
      )}
    </>
  );
}

function WarehouseMovementModal({ type, products, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ productId: '', quantity: 1, note: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await warehouseApi.createMovement({
        productId: form.productId,
        type,
        quantity: Number(form.quantity),
        note: form.note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const qtyMin = 1;

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="app-section-card__title">{MOVEMENT_LABELS[type]}</h2>
        <form className="app-modal__form" onSubmit={submit}>
          <label className="app-field">
            <span className="app-field__label">Товар</span>
            <select
              className="input"
              required
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              <option value="">Выберите товар</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (остаток: {formatNum(p.stock?.quantity ?? 0)} {p.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="app-field">
            <span className="app-field__label">Количество</span>
            <input
              className="input"
              type="number"
              min={qtyMin}
              required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </label>
          <label className="app-field">
            <span className="app-field__label">Комментарий</span>
            <input
              className="input"
              placeholder="Необязательно"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <div className="app-modal__actions">
            <button type="button" className="btn btn--outline-dark" disabled={saving} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Оформить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockAdjustConfirmModal({ changedCount, onConfirm, onCancel }) {
  const label = changedCount === 1 ? 'изменена 1 позиция' : `изменено ${changedCount} позиций`;
  return (
    <div className="app-modal-backdrop" onClick={onCancel}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="app-section-card__title">Согласование остатков</h3>
        <p style={{ margin: '12px 0 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          {label}. Направить изменения директору на согласование?
        </p>
        <div className="app-modal__actions">
          <button type="button" className="btn btn--outline-dark" onClick={onCancel}>Нет, отменить</button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>Да, направить директору</button>
        </div>
      </div>
    </div>
  );
}

function StockAdjustmentBanner({ batch, isDirector, onApprove, onReject, onError }) {
  const [returnNote, setReturnNote] = useState('');
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove(batch.id);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(batch.id, returnNote.trim());
      setReturnNote('');
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const authorName = batch.author?.fullName || 'Сотрудник';
  const createdAt = new Date(batch.createdAt).toLocaleString('ru-RU');

  return (
    <div className="app-materials-approval app-materials-approval--pending_director">
      <div>
        <strong>Ожидает согласования директора</strong>
        <p>
          {authorName}, {createdAt}: {batch.items.length === 1 ? '1 позиция' : `${batch.items.length} позиций`}.
        </p>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {batch.items.slice(0, 5).map((item) => (
            <li key={item.id}>
              {item.product?.name}: {formatNum(item.quantityBefore)} → {formatNum(item.quantityAfter)} {item.product?.unit || 'шт.'}
            </li>
          ))}
          {batch.items.length > 5 && <li>…и ещё {batch.items.length - 5}</li>}
        </ul>
        {!isDirector && (
          <p style={{ marginTop: 8 }}>Изменения направлены директору — ожидайте согласования.</p>
        )}
      </div>
      {isDirector && (
        <div className="app-materials-approval__actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={handleApprove}>
            Согласовать
          </button>
          <textarea
            className="input"
            rows={2}
            placeholder="Комментарий при отклонении…"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
          />
          <button type="button" className="btn btn--outline-dark" disabled={busy} onClick={handleReject}>
            Отклонить
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectSelectModal({ projects, loading, onSelect, onClose }) {
  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="app-section-card__title">Расход — выберите проект</h2>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          После выбора откроется карточка проекта для оформления выдачи материалов и акта приём-передачи.
        </p>
        {loading ? (
          <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Загрузка проектов…</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Проект</th>
                  <th>Этап</th>
                  <th>Менеджер</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.projectNumber || '—'}</strong></td>
                    <td>{p.title}</td>
                    <td>{PROJECT_PHASE[p.phase] || p.phase}</td>
                    <td>{p.assignee?.fullName || '—'}</td>
                    <td>
                      <button type="button" className="btn btn--primary app-table-btn" onClick={() => onSelect(p)}>
                        Выбрать
                      </button>
                    </td>
                  </tr>
                ))}
                {!projects.length && (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                      Нет проектов с невыданными материалами
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="app-modal__actions">
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

function StockReservationDetailModal({ loading, data, onClose }) {
  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="app-section-card__title">Резерв по проектам</h2>
        {data?.product && (
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {data.product.name} · SKU {data.product.sku}
          </p>
        )}
        {loading ? (
          <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Загрузка…</p>
        ) : data?.projects?.length ? (
          <>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Проект</th>
                    <th>Клиент</th>
                    <th>Этап</th>
                    <th>Нужно</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((row) => (
                    <tr key={row.projectId}>
                      <td>
                        <strong>{row.projectNumber || '—'}</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{row.title}</div>
                      </td>
                      <td>{row.clientName || '—'}</td>
                      <td>{PROJECT_PHASE[row.phase] || row.phase}</td>
                      <td>
                        <strong>{formatNum(row.quantity)}</strong> {data.product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Всего в резерве: <strong>{formatNum(data.totalReserved)}</strong> {data.product.unit}
            </p>
          </>
        ) : (
          <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Нет резерва по проектам</p>
        )}
        <div className="app-modal__actions">
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

function formatMovementProject(project) {
  if (!project) return '—';
  const label = project.projectNumber || project.title;
  return project.title && project.projectNumber
    ? `${project.projectNumber} — ${project.title}`
    : label;
}

function canUserAcceptAct(user, act) {
  if (!user || !act?.project?.assigneeId) return false;
  return act.project.assigneeId === user.id;
}

function TransferActsPanel({ acts, loading, user, onAccept, onError, onGoAccepted, showProjectLinks }) {
  const pendingActs = acts.filter((a) => a.status === 'PENDING_MANAGER');
  const [busyId, setBusyId] = useState(null);

  const handleAccept = async (actId) => {
    setBusyId(actId);
    try {
      await onAccept(actId);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card app-section-card">
      <h2 className="app-section-card__title">Акты приём-передачи</h2>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
        Ожидают приёмки менеджером. После принятия акт переходит во вкладку{' '}
        <button type="button" className="btn btn--ghost" style={{ padding: 0, fontSize: 'inherit', verticalAlign: 'baseline' }} onClick={() => onGoAccepted?.()}>
          «Принятые акты»
        </button>.
      </p>
      {loading ? (
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>№ акта</th>
                <th>Дата</th>
                <th>Проект</th>
                <th>Менеджер</th>
                <th>Передал</th>
                <th>Позиции</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingActs.map((act) => (
                <tr key={act.id}>
                  <td><strong>{act.actNumber}</strong></td>
                  <td>{new Date(act.issuedAt).toLocaleString('ru-RU')}</td>
                  <td>
                    {showProjectLinks ? (
                      <Link to={`/app/projects?open=${act.project?.id}`} style={{ fontSize: '0.875rem' }}>
                        {formatMovementProject(act.project)}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.875rem' }}>{formatMovementProject(act.project)}</span>
                    )}
                  </td>
                  <td>{act.project?.assignee?.fullName || '—'}</td>
                  <td>{act.issuedBy?.fullName || '—'}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {act.items?.map((item) => (
                      `${item.product?.name} × ${formatNum(item.quantity)}`
                    )).join('; ') || '—'}
                  </td>
                  <td>
                    <span style={{ color: act.status === 'PENDING_MANAGER' ? '#b45309' : 'var(--text-muted)' }}>
                      {ACT_STATUS[act.status] || act.status}
                    </span>
                  </td>
                  <td>
                    {act.status === 'PENDING_MANAGER' && canUserAcceptAct(user, act) && (
                      <button
                        type="button"
                        className="btn btn--primary app-table-btn"
                        disabled={busyId === act.id}
                        onClick={() => handleAccept(act.id)}
                      >
                        {busyId === act.id ? '…' : 'Принять'}
                      </button>
                    )}
                    {act.status === 'ACCEPTED' && act.acceptedBy?.fullName && (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {act.acceptedBy.fullName}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!pendingActs.length && (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--text-muted)' }}>
                    Нет актов, ожидающих приёмки.
                    {onGoAccepted && (
                      <> Принятые — во вкладке{' '}
                        <button type="button" className="btn btn--ghost" style={{ padding: 0, fontSize: 'inherit' }} onClick={onGoAccepted}>
                          «Принятые акты»
                        </button>.
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AcceptedActsPanel({
  data, loading, user, isDirector, isAdmin, isAccountant, canClaimLeads,
  onRefresh, onError,
}) {
  const [busyId, setBusyId] = useState(null);
  const [writeOffBusy, setWriteOffBusy] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const acts = data?.acts || [];
  const summary = data?.inventory?.summary || [];
  const rows = data?.inventory?.rows || [];
  const writeOffs = data?.writeOffs || [];
  const pendingWriteOffs = writeOffs.filter((b) => ['PENDING_DIRECTOR', 'PENDING_ACCOUNTANT'].includes(b.status));

  const projectsWithBalance = [...new Map(rows.map((r) => [r.projectId, r.project])).entries()]
    .map(([id, project]) => {
      const projectRows = rows.filter((r) => r.projectId === id);
      const balance = projectRows.reduce((s, r) => s + r.balance, 0);
      const hasPending = writeOffs.some(
        (b) => b.projectId === id && ['PENDING_DIRECTOR', 'PENDING_ACCOUNTANT'].includes(b.status),
      );
      return { id, project, balance, rows: projectRows, hasPending };
    })
    .filter((p) => p.balance > 0);

  const handleWriteOffRequest = async (projectId) => {
    setWriteOffBusy(projectId);
    try {
      await erpApi.writeOffMaterials(projectId);
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setWriteOffBusy(null);
    }
  };

  const handleDirectorApprove = async (id) => {
    setBusyId(id);
    try {
      await warehouseApi.approveWriteOffDirector(id);
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAccountantApprove = async (id) => {
    setBusyId(id);
    try {
      await warehouseApi.approveWriteOffAccountant(id);
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setBusyId(id);
    try {
      await warehouseApi.rejectWriteOff(id, rejectNote);
      setRejectId(null);
      setRejectNote('');
      onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const canRequestWriteOff = canClaimLeads || ['MANAGER', 'EMPLOYEE'].includes(user?.role);

  return (
    <div className="card app-section-card">
      <h2 className="app-section-card__title">Принятые акты</h2>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
        Материалы, принятые менеджером со склада. Списание — по согласованию директора и бухгалтера.
      </p>

      {loading ? (
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Загрузка…</p>
      ) : (
        <>
          {(canRequestWriteOff && summary.length > 0) && (
            <div style={{ marginTop: 20 }}>
              <h3 className="app-portal-detail__subtitle">Остаток у менеджера</h3>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Принято</th>
                      <th>Списано</th>
                      <th>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.productId}>
                        <td><strong>{row.product?.name}</strong><br /><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{row.product?.sku}</span></td>
                        <td>{formatNum(row.quantityAccepted)} {row.product?.unit}</td>
                        <td>{formatNum(row.quantityWrittenOff)} {row.product?.unit}</td>
                        <td><strong>{formatNum(row.balance)}</strong> {row.product?.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {canRequestWriteOff && projectsWithBalance.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 className="app-portal-detail__subtitle">Списание по проектам</h3>
              {projectsWithBalance.map(({ id, project, balance, rows: pRows, hasPending }) => {
                const canWrite = ['COMPLETED', 'COMMISSIONING'].includes(project?.phase);
                return (
                  <div key={id} className="app-materials-approval app-materials-approval--approved" style={{ marginTop: 12 }}>
                    <div>
                      <strong>{formatMovementProject(project)}</strong>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        {pRows.map((r) => `${r.product?.name} × ${formatNum(r.balance)}`).join('; ')}
                      </p>
                      {hasPending && <p style={{ fontSize: '0.875rem', color: '#b45309', marginTop: 6 }}>Запрос на списание на согласовании</p>}
                    </div>
                    {canWrite && !hasPending && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={writeOffBusy === id}
                        onClick={() => handleWriteOffRequest(id)}
                      >
                        {writeOffBusy === id ? '…' : 'Запросить списание'}
                      </button>
                    )}
                    {!canWrite && (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Списание на этапе «Пусконаладка» или «Завершён»
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pendingWriteOffs.length > 0 && (isDirector || isAdmin || isAccountant) && (
            <div style={{ marginTop: 24 }}>
              <h3 className="app-portal-detail__subtitle">Согласование списания</h3>
              {pendingWriteOffs.map((batch) => (
                <div key={batch.id} className="app-materials-approval app-materials-approval--pending_director" style={{ marginTop: 12 }}>
                  <div>
                    <strong>{formatMovementProject(batch.project)}</strong>
                    <p style={{ fontSize: '0.875rem', margin: '4px 0 0' }}>
                      {WRITE_OFF_STATUS[batch.status]} · {batch.requestedBy?.fullName || 'менеджер'} · {new Date(batch.createdAt).toLocaleString('ru-RU')}
                    </p>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {batch.items?.map((item) => (
                        <li key={item.id}>{item.product?.name}: {formatNum(item.quantity)} {item.product?.unit || 'шт.'}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="app-materials-approval__actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {batch.status === 'PENDING_DIRECTOR' && (isDirector || isAdmin) && (
                      <>
                        <button type="button" className="btn btn--primary" disabled={busyId === batch.id} onClick={() => handleDirectorApprove(batch.id)}>
                          Согласовать
                        </button>
                        <button type="button" className="btn btn--outline-dark" onClick={() => setRejectId(batch.id)}>Отклонить</button>
                      </>
                    )}
                    {batch.status === 'PENDING_ACCOUNTANT' && (isAccountant || isAdmin) && (
                      <>
                        <button type="button" className="btn btn--primary" disabled={busyId === batch.id} onClick={() => handleAccountantApprove(batch.id)}>
                          Подтвердить списание
                        </button>
                        <button type="button" className="btn btn--outline-dark" onClick={() => setRejectId(batch.id)}>Отклонить</button>
                      </>
                    )}
                  </div>
                  {rejectId === batch.id && (
                    <div style={{ marginTop: 12, width: '100%' }}>
                      <textarea className="input" rows={2} placeholder="Причина отклонения" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn btn--dark" disabled={busyId === batch.id} onClick={() => handleReject(batch.id)}>Отправить</button>
                        <button type="button" className="btn btn--outline-dark" onClick={() => { setRejectId(null); setRejectNote(''); }}>Отмена</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <h3 className="app-portal-detail__subtitle">История принятых актов</h3>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>№ акта</th>
                    <th>Принят</th>
                    <th>Проект</th>
                    <th>Позиции</th>
                    <th>Передал</th>
                  </tr>
                </thead>
                <tbody>
                  {acts.map((act) => (
                    <tr key={act.id}>
                      <td><strong>{act.actNumber}</strong></td>
                      <td>{act.acceptedAt ? new Date(act.acceptedAt).toLocaleString('ru-RU') : '—'}</td>
                      <td>
                        <Link to={`/app/projects?open=${act.project?.id}`} style={{ fontSize: '0.875rem' }}>
                          {formatMovementProject(act.project)}
                        </Link>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {act.items?.map((item) => `${item.product?.name} × ${formatNum(item.quantity)}`).join('; ') || '—'}
                      </td>
                      <td>{act.issuedBy?.fullName || '—'}</td>
                    </tr>
                  ))}
                  {!acts.length && (
                    <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>Принятых актов пока нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {writeOffs.filter((b) => ['APPROVED', 'REJECTED'].includes(b.status)).length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 className="app-portal-detail__subtitle">История списаний</h3>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Проект</th>
                      <th>Статус</th>
                      <th>Запросил</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writeOffs.filter((b) => ['APPROVED', 'REJECTED'].includes(b.status)).map((batch) => (
                      <tr key={batch.id}>
                        <td>{formatMovementProject(batch.project)}</td>
                        <td>{WRITE_OFF_STATUS[batch.status]}</td>
                        <td>{batch.requestedBy?.fullName || '—'}</td>
                        <td>{new Date(batch.createdAt).toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function WarehousePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isDirector, isAdmin, isAccountant, canClaimLeads, isWarehouseStaff } = useAuth();

  const tabParam = searchParams.get('tab');
  if (tabParam === 'pricing') {
    return <Navigate to="/app/pricing" replace />;
  }

  const visibleTabs = WAREHOUSE_TABS.filter((t) => !t.managerOnly || !isWarehouseStaff);
  const visibleTabIds = visibleTabs.map((t) => t.id);
  const tab = visibleTabIds.includes(tabParam) ? tabParam : 'stock';
  const canApproveStock = isDirector || isAdmin;
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [modalType, setModalType] = useState(null);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [issueProjects, setIssueProjects] = useState([]);
  const [issueProjectsLoading, setIssueProjectsLoading] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [stockEditMode, setStockEditMode] = useState(false);
  const [stockDraft, setStockDraft] = useState({});
  const [stockSaving, setStockSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [pendingItems, setPendingItems] = useState(null);
  const [approvalMsg, setApprovalMsg] = useState('');
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  const [reservationModal, setReservationModal] = useState(null);
  const [reservationData, setReservationData] = useState(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [transferActs, setTransferActs] = useState([]);
  const [actsLoading, setActsLoading] = useState(false);
  const [acceptedData, setAcceptedData] = useState(null);
  const [acceptedLoading, setAcceptedLoading] = useState(false);
  const [issueProject, setIssueProject] = useState(null);
  const [whSummary, setWhSummary] = useState(null);
  const [error, setError] = useState('');

  const setTab = (nextTab) => {
    const params = new URLSearchParams(searchParams);
    if (nextTab === 'stock') params.delete('tab');
    else params.set('tab', nextTab);
    setSearchParams(params, { replace: true });
  };

  const loadWhSummary = () => {
    warehouseApi.summary().then(setWhSummary).catch(() => {});
  };

  const loadTransferActs = () => {
    setActsLoading(true);
    warehouseApi.transferActs()
      .then(setTransferActs)
      .catch(() => {})
      .finally(() => setActsLoading(false));
  };

  const loadAcceptedInventory = () => {
    setAcceptedLoading(true);
    warehouseApi.acceptedInventory()
      .then(setAcceptedData)
      .catch(() => {})
      .finally(() => setAcceptedLoading(false));
  };

  const pendingActsForUser = whSummary?.pendingTransferActsForUser ?? 0;
  const pendingActsTotal = whSummary?.pendingTransferActsTotal ?? 0;
  const acceptedActsCount = acceptedData?.acts?.length ?? 0;

  const loadProducts = () => warehouseApi.products().then(setProducts).catch(() => {});
  const loadSuppliers = () => warehouseApi.suppliers().then(setSuppliers).catch(() => {});

  const loadReceipts = (supplierId = supplierFilter) => {
    warehouseApi.receipts(supplierId || undefined).then(setReceipts).catch(() => {});
  };

  const loadPendingAdjustments = () => {
    warehouseApi.stockAdjustments('PENDING_DIRECTOR')
      .then(setPendingAdjustments)
      .catch(() => {});
  };

  const load = () => {
    loadProducts();
    loadSuppliers();
    warehouseApi.movements().then(setMovements).catch(() => {});
    loadReceipts();
    loadPendingAdjustments();
  };

  useEffect(load, []);

  useEffect(() => {
    loadWhSummary();
    loadAcceptedInventory();
  }, []);

  useEffect(() => {
    if (tab === 'acts') loadTransferActs();
    if (tab === 'accepted') loadAcceptedInventory();
  }, [tab]);

  useEffect(() => {
    loadReceipts(supplierFilter);
  }, [supplierFilter]);

  const handleProductCreated = (product) => {
    setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  };

  const handleSupplierCreated = (supplier) => {
    setSuppliers((prev) => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  };

  const startStockEdit = () => {
    const draft = {};
    for (const p of products) {
      draft[p.id] = String(p.stock?.quantity ?? 0);
    }
    setStockDraft(draft);
    setStockEditMode(true);
    setError('');
  };

  const cancelStockEdit = () => {
    setStockEditMode(false);
    setStockDraft({});
    setConfirmSave(false);
    setPendingItems(null);
  };

  const buildStockItems = () => {
    const items = [];
    for (const p of products) {
      const raw = stockDraft[p.id];
      const quantity = Number(raw);
      if (raw === '' || Number.isNaN(quantity) || quantity < 0) {
        throw new Error(`Некорректный остаток: ${p.name}`);
      }
      items.push({ productId: p.id, quantity });
    }
    return items;
  };

  const countChangedItems = (items) => items.filter((item) => {
    const p = products.find((prod) => prod.id === item.productId);
    return (p?.stock?.quantity ?? 0) !== item.quantity;
  }).length;

  const performStockSave = async (sendForApproval) => {
    const items = pendingItems || buildStockItems();
    setStockSaving(true);
    try {
      const result = await warehouseApi.updateStockBulk({ items, sendForApproval });
      setProducts(result.products ?? result);
      if (result.approval?.message) setApprovalMsg(result.approval.message);
      else setApprovalMsg('');
      setStockEditMode(false);
      setStockDraft({});
      setConfirmSave(false);
      setPendingItems(null);
      warehouseApi.movements().then(setMovements).catch(() => {});
      loadPendingAdjustments();
    } catch (err) {
      setError(err.message);
    } finally {
      setStockSaving(false);
    }
  };

  const saveStockEdit = () => {
    setError('');
    let items;
    try {
      items = buildStockItems();
    } catch (err) {
      setError(err.message);
      return;
    }

    const changedCount = countChangedItems(items);
    if (!changedCount) {
      cancelStockEdit();
      return;
    }

    if (canApproveStock) {
      performStockSave(false);
      return;
    }

    setPendingItems(items);
    setConfirmSave(true);
  };

  const approveAdjustment = async (id) => {
    await warehouseApi.approveStockAdjustment(id);
    setApprovalMsg('');
    loadProducts();
    loadPendingAdjustments();
    warehouseApi.movements().then(setMovements).catch(() => {});
  };

  const rejectAdjustment = async (id, note) => {
    await warehouseApi.rejectStockAdjustment(id, { note });
    setApprovalMsg('');
    loadProducts();
    loadPendingAdjustments();
    warehouseApi.movements().then(setMovements).catch(() => {});
  };

  const openReservationDetail = async (product) => {
    const reserved = product.reserved ?? product.stock?.reserved ?? 0;
    if (reserved <= 0 || stockEditMode) return;

    setReservationModal(product);
    setReservationData(null);
    setReservationLoading(true);
    try {
      const data = await warehouseApi.productReservations(product.id);
      setReservationData(data);
    } catch (err) {
      setError(err.message);
      setReservationModal(null);
    } finally {
      setReservationLoading(false);
    }
  };

  const closeReservationDetail = () => {
    setReservationModal(null);
    setReservationData(null);
  };

  const openProjectIssue = () => {
    setShowProjectSelect(true);
    setIssueProjectsLoading(true);
    warehouseApi.issuableProjects()
      .then(setIssueProjects)
      .catch((err) => setError(err.message))
      .finally(() => setIssueProjectsLoading(false));
  };

  const selectProjectForIssue = async (project) => {
    setShowProjectSelect(false);
    try {
      const full = await warehouseApi.issuableProject(project.id);
      setIssueProject(full);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const issueId = searchParams.get('issueProject');
    if (issueId && isWarehouseStaff) {
      warehouseApi.issuableProject(issueId)
        .then(setIssueProject)
        .catch((err) => setError(err.message));
    }
  }, [searchParams, isWarehouseStaff]);

  const acceptTransferAct = async (actId) => {
    await warehouseApi.acceptTransferAct(actId);
    loadTransferActs();
    loadWhSummary();
    loadAcceptedInventory();
    if (!isWarehouseStaff) {
      setTab('accepted');
      setApprovalMsg('Акт принят — см. вкладку «Принятые акты».');
    } else {
      setTab('acts');
      setApprovalMsg('Акт принят менеджером.');
    }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Виртуальный склад</h1>
      </Reveal>

      <div className="app-tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`app-tab${tab === t.id ? ' app-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'acts' && pendingActsTotal > 0 ? ` (${pendingActsTotal})` : ''}
            {t.id === 'accepted' && acceptedActsCount > 0 ? ` (${acceptedActsCount})` : ''}
          </button>
        ))}
      </div>

      {pendingActsForUser > 0 && !isWarehouseStaff && (
        <Reveal delay={0.02}>
          <div className="app-materials-approval app-materials-approval--pending_director" style={{ marginBottom: 16 }}>
            <div>
              <strong>Требуется приёмка материалов</strong>
              <p>
                {pendingActsForUser === 1
                  ? '1 акт приём-передачи ожидает вашего подтверждения.'
                  : `${pendingActsForUser} акта приём-передачи ожидают вашего подтверждения.`}
              </p>
            </div>
            <div className="app-materials-approval__actions">
              {tab !== 'acts' && (
                <button type="button" className="btn btn--primary" onClick={() => setTab('acts')}>
                  Перейти к актам
                </button>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}
      {approvalMsg && (
        <p className="app-materials-approval-msg" style={{ marginBottom: 16 }}>{approvalMsg}</p>
      )}

      {tab === 'acts' && (
        <Reveal delay={0.05}>
          <TransferActsPanel
            acts={transferActs}
            loading={actsLoading}
            user={user}
            onAccept={acceptTransferAct}
            onError={setError}
            onGoAccepted={() => setTab('accepted')}
            showProjectLinks={!isWarehouseStaff}
          />
        </Reveal>
      )}

      {tab === 'accepted' && !isWarehouseStaff && (
        <Reveal delay={0.05}>
          <AcceptedActsPanel
            data={acceptedData}
            loading={acceptedLoading}
            user={user}
            isDirector={isDirector}
            isAdmin={isAdmin}
            isAccountant={isAccountant}
            canClaimLeads={canClaimLeads}
            onRefresh={loadAcceptedInventory}
            onError={setError}
          />
        </Reveal>
      )}

      {tab === 'stock' && (
      <>
      {pendingAdjustments.map((batch) => (
        <Reveal key={batch.id} delay={0.02}>
          <StockAdjustmentBanner
            batch={batch}
            isDirector={canApproveStock}
            onApprove={approveAdjustment}
            onReject={rejectAdjustment}
            onError={setError}
          />
        </Reveal>
      ))}

      <Reveal delay={0.05}>
        <div className="card app-section-card">
          <div className="app-toolbar">
            <h2 className="app-section-card__title" style={{ margin: 0 }}>Остатки</h2>
            <div className="app-toolbar__actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!stockEditMode ? (
                <>
                  <button type="button" className="btn btn--primary" onClick={() => setModalType('IN')}>
                    Приход
                  </button>
                  <button type="button" className="btn btn--outline-dark" onClick={openProjectIssue}>
                    Расход
                  </button>
                  <button type="button" className="btn btn--outline-dark" onClick={startStockEdit}>
                    Редактирование
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--outline-dark" disabled={stockSaving} onClick={cancelStockEdit}>
                    Отменить
                  </button>
                  <button type="button" className="btn btn--primary" disabled={stockSaving} onClick={saveStockEdit}>
                    {stockSaving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Остаток</th>
                  <th>Резерв</th>
                  <th>Доступно</th>
                  <th>Закуп. цена</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const quantity = p.stock?.quantity ?? 0;
                  const reserved = p.reserved ?? p.stock?.reserved ?? 0;
                  const available = p.available ?? p.stock?.available ?? quantity;
                  const isLow = available <= (p.minStock ?? 0);
                  return (
                  <tr key={p.id} style={isLow ? { background: '#fef2f2' } : {}}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>
                      {stockEditMode ? (
                        <input
                          className="input input--sm"
                          type="number"
                          min="0"
                          step="1"
                          style={{ width: 88 }}
                          value={stockDraft[p.id] ?? ''}
                          onChange={(e) => setStockDraft({ ...stockDraft, [p.id]: e.target.value })}
                        />
                      ) : (
                        <><strong>{formatNum(quantity)}</strong> {p.unit}</>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={reserved <= 0 || stockEditMode}
                        onClick={() => openReservationDetail(p)}
                        title={reserved > 0 ? 'Показать резерв по проектам' : undefined}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: reserved > 0 ? '#b45309' : 'var(--text-muted)',
                          cursor: reserved > 0 && !stockEditMode ? 'pointer' : 'default',
                          textDecoration: reserved > 0 && !stockEditMode ? 'underline dotted' : 'none',
                          font: 'inherit',
                        }}
                      >
                        {formatNum(reserved)} {p.unit}
                      </button>
                    </td>
                    <td>
                      <strong>{formatNum(available)}</strong> {p.unit}
                    </td>
                    <td>{formatMoney(p.purchasePrice ?? 0)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="card app-section-card">
          <div className="app-toolbar">
            <h2 className="app-section-card__title" style={{ margin: 0 }}>Приходные накладные</h2>
            <select
              className="input"
              style={{ maxWidth: 320 }}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="">Все поставщики</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Факт. дата</th>
                  <th>№ накладной</th>
                  <th>Дата накладной</th>
                  <th>Поставщик</th>
                  <th>БИН</th>
                  <th>Позиций</th>
                  <th>Товары</th>
                  <th>Автор</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.receivedAt).toLocaleDateString('ru-RU')}</td>
                    <td><strong>{r.invoiceNumber}</strong></td>
                    <td>{new Date(r.invoiceDate).toLocaleDateString('ru-RU')}</td>
                    <td>{r.supplier?.name || r.seller || '—'}</td>
                    <td>{r.supplier?.bin || '—'}</td>
                    <td>{r.items?.length ?? 0}</td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {r.items?.map((i) => (
                        `${i.product.name} × ${formatNum(i.quantity)} @ ${formatMoney(i.unitPrice ?? 0)}`
                      )).join('; ') || '—'}
                      {r.items?.length ? ` · ${r.priceIncludesVat ? 'с НДС' : 'без НДС'}` : ''}
                    </td>
                    <td>{r.author?.fullName || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--outline-dark app-table-btn"
                        onClick={() => setEditingReceipt(r)}
                      >
                        Редактировать
                      </button>
                    </td>
                  </tr>
                ))}
                {!receipts.length && (
                  <tr>
                    <td colSpan={9} style={{ color: 'var(--text-muted)' }}>Приходов пока нет</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="card app-section-card">
          <h2 className="app-section-card__title">История движений</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Тип</th>
                  <th>Кол-во</th>
                  <th>Комментарий</th>
                  <th>Проект</th>
                  <th>Передан</th>
                  <th>Автор</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.product.name}</td>
                    <td>{MOVEMENT_LABELS[m.type] || m.type}</td>
                    <td>{formatNum(m.quantity)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{m.note || '—'}</td>
                    <td style={{ fontSize: '0.875rem' }}>{formatMovementProject(m.project)}</td>
                    <td>{m.project?.assignee?.fullName || '—'}</td>
                    <td>{m.author?.fullName || '—'}</td>
                    <td>{new Date(m.createdAt).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
                {!movements.length && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text-muted)' }}>Операций пока нет</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
      </>
      )}

      {issueProject && (
        <WarehouseIssueModal
          project={issueProject}
          onClose={() => setIssueProject(null)}
          onIssued={(act) => {
            setIssueProject(null);
            loadProducts();
            loadTransferActs();
            loadWhSummary();
            warehouseApi.movements().then(setMovements).catch(() => {});
            setTab('acts');
            setApprovalMsg(`Создан акт ${act.actNumber}. Ожидает приёмки менеджером.`);
          }}
          onError={setError}
        />
      )}

      {showProjectSelect && (
        <ProjectSelectModal
          projects={issueProjects}
          loading={issueProjectsLoading}
          onSelect={selectProjectForIssue}
          onClose={() => setShowProjectSelect(false)}
        />
      )}
      {reservationModal && (
        <StockReservationDetailModal
          loading={reservationLoading}
          data={reservationData}
          onClose={closeReservationDetail}
        />
      )}
      {confirmSave && pendingItems && (
        <StockAdjustConfirmModal
          changedCount={countChangedItems(pendingItems)}
          onConfirm={() => performStockSave(true)}
          onCancel={() => {
            setConfirmSave(false);
            setPendingItems(null);
          }}
        />
      )}
      {(modalType === 'IN' || editingReceipt) && (
        <WarehouseReceiptModal
          receipt={editingReceipt}
          products={products}
          suppliers={suppliers}
          onClose={() => { setModalType(null); setEditingReceipt(null); }}
          onSaved={load}
          onError={setError}
          onProductCreated={handleProductCreated}
          onSupplierCreated={handleSupplierCreated}
        />
      )}
    </div>
  );
}
