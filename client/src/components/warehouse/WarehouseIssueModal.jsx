import { useState } from 'react';
import { warehouseApi } from '../../api';
import { formatNum } from '../../utils/format';

export default function WarehouseIssueModal({ project, onClose, onIssued, onError }) {
  const issuable = (project.materials || []).filter(
    (m) => (m.quantityPlanned ?? 0) > (m.quantityIssued ?? 0),
  );
  const [lines, setLines] = useState(() => issuable.map((m) => ({
    productId: m.productId,
    selected: true,
    quantity: m.quantityPlanned - m.quantityIssued,
    maxQty: m.quantityPlanned - m.quantityIssued,
    name: m.product?.name || '—',
    sku: m.product?.sku || '—',
    unit: m.product?.unit || 'шт',
    stock: m.product?.stock?.quantity ?? 0,
  })));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const updateLine = (productId, patch) => {
    setLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  };

  const submit = async () => {
    const items = lines
      .filter((line) => line.selected && Number(line.quantity) > 0)
      .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }));

    if (!items.length) {
      onError('Выберите хотя бы одну позицию для выдачи');
      return;
    }

    for (const line of lines.filter((l) => l.selected)) {
      const qty = Number(line.quantity);
      if (!qty || qty < 1) {
        onError(`Укажите количество для «${line.name}»`);
        return;
      }
      if (qty > line.maxQty) {
        onError(`«${line.name}»: не больше ${line.maxQty} шт. по плану`);
        return;
      }
      if (qty > line.stock) {
        onError(`«${line.name}»: на складе только ${line.stock} шт.`);
        return;
      }
    }

    setSaving(true);
    try {
      const act = await warehouseApi.createProjectTransferAct(project.id, { items, note: note.trim() || undefined });
      onIssued(act);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2>Расход — {project.projectNumber || project.title}</h2>
        {project.assignee?.fullName && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Менеджер: {project.assignee.fullName}
          </p>
        )}

        {!issuable.length ? (
          <p style={{ color: 'var(--text-muted)' }}>По комплекту проекта всё уже выдано.</p>
        ) : (
          <>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Товар</th>
                    <th>На складе</th>
                    <th>К выдаче</th>
                    <th>Макс.</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.productId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={line.selected}
                          onChange={(e) => updateLine(line.productId, { selected: e.target.checked })}
                        />
                      </td>
                      <td>{line.name}</td>
                      <td>{formatNum(line.stock)} {line.unit}</td>
                      <td>
                        <input
                          className="input input--sm"
                          type="number"
                          min="1"
                          max={Math.min(line.maxQty, line.stock)}
                          style={{ width: 72 }}
                          value={line.quantity}
                          disabled={!line.selected}
                          onChange={(e) => updateLine(line.productId, { quantity: e.target.value })}
                        />
                      </td>
                      <td>{formatNum(line.maxQty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="app-field" style={{ marginTop: 12 }}>
              <label>Примечание к акту</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </>
        )}

        <div className="app-modal__actions">
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
          {issuable.length > 0 && (
            <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
              {saving ? 'Оформление…' : 'Выдать и создать акт'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
