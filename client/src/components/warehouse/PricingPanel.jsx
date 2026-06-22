import { useEffect, useState } from 'react';
import { warehouseApi } from '../../api';
import { formatMoney } from '../../utils/format';

const DEFAULT_PURCHASE = 100_000;

function marginPct(purchase, sale) {
  if (!purchase || purchase <= 0) return '';
  return Math.round(((sale - purchase) / purchase) * 10000) / 100;
}

function priceFromMargin(purchase, pct) {
  if (!purchase || purchase <= 0) return 0;
  return Math.round(purchase * (1 + pct / 100) * 100) / 100;
}

function effectivePurchase() {
  return DEFAULT_PURCHASE;
}

function rowFromProduct(p) {
  const purchase = effectivePurchase();
  const price = p.price ?? 0;
  return {
    purchase: String(purchase),
    price: String(price),
    margin: String(marginPct(purchase, price)),
  };
}

export default function PricingPanel({ onError }) {
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    warehouseApi.products()
      .then((data) => {
        setProducts(data);
        const next = {};
        for (const p of data) next[p.id] = rowFromProduct(p);
        setDraft(next);
      })
      .catch((e) => onError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateMargin = (id, rawMargin) => {
    setDraft((prev) => {
      const purchase = Number(prev[id]?.purchase) || DEFAULT_PURCHASE;
      const row = { ...prev[id], margin: rawMargin };
      const pct = Number(rawMargin);
      if (rawMargin !== '' && !Number.isNaN(pct)) {
        row.price = String(priceFromMargin(purchase, pct));
      }
      return { ...prev, [id]: row };
    });
  };

  const updatePrice = (id, rawPrice) => {
    setDraft((prev) => {
      const purchase = Number(prev[id]?.purchase) || DEFAULT_PURCHASE;
      const row = { ...prev[id], price: rawPrice };
      const price = Number(rawPrice);
      if (rawPrice !== '' && !Number.isNaN(price)) {
        row.margin = String(marginPct(purchase, price));
      }
      return { ...prev, [id]: row };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = products.map((p) => ({
        productId: p.id,
        price: Number(draft[p.id]?.price) || 0,
        purchasePrice: Number(draft[p.id]?.purchase) || DEFAULT_PURCHASE,
      }));
      const updated = await warehouseApi.updatePricing({ updates });
      setProducts(updated);
      const next = {};
      for (const p of updated) next[p.id] = rowFromProduct(p);
      setDraft(next);
    } catch (e) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card app-section-card">
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
        Маржа и цена продажи связаны: изменение одного поля пересчитывает другое. Закупка по умолчанию — {formatMoney(DEFAULT_PURCHASE)}.
      </p>

      <div className="app-toolbar" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--primary" disabled={saving || loading} onClick={save}>
          {saving ? 'Сохранение…' : 'Сохранить цены'}
        </button>
      </div>

      {loading ? (
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Название</th>
                <th>Закупка</th>
                <th>Маржа %</th>
                <th>Цена продажи</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const row = draft[p.id] ?? { purchase: String(DEFAULT_PURCHASE), price: '', margin: '' };
                const purchase = Number(row.purchase) || DEFAULT_PURCHASE;

                return (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{formatMoney(purchase)}</td>
                    <td>
                      <input
                        className="input input--sm"
                        type="number"
                        step="0.1"
                        style={{ width: 88 }}
                        value={row.margin}
                        onChange={(e) => updateMargin(p.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input input--sm"
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ width: 120 }}
                        value={row.price}
                        onChange={(e) => updatePrice(p.id, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
              {!products.length && (
                <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>Товаров пока нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <p style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Цена = закупка × (1 + маржа%). Например: закупка 100&nbsp;000 ₸ и маржа 25% → цена 125&nbsp;000 ₸.
        </p>
      )}
    </div>
  );
}
