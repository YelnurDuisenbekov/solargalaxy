import { useEffect, useState } from 'react';
import { warehouseApi } from '../../api';
import { Reveal } from '../../components/motion/ScrollReveal';
import { formatMoney, formatNum } from '../../utils/format';

export default function WarehousePage() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({ productId: '', type: 'IN', quantity: 1, note: '' });

  const load = () => {
    warehouseApi.products().then(setProducts);
    warehouseApi.movements().then(setMovements);
  };

  useEffect(load, []);

  const submitMove = async (e) => {
    e.preventDefault();
    await warehouseApi.createMovement({ ...form, quantity: Number(form.quantity) });
    setForm({ ...form, quantity: 1, note: '' });
    load();
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Виртуальный склад</h1>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="card app-section-card">
          <h2 className="app-section-card__title">Остатки</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>SKU</th><th>Название</th><th>Категория</th><th>Остаток</th><th>Цена</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={p.stock && p.stock.quantity <= p.minStock ? { background: '#fef2f2' } : {}}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td><strong>{formatNum(p.stock?.quantity ?? 0)}</strong> {p.unit}</td>
                    <td>{formatMoney(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="card app-section-card">
          <h2 className="app-section-card__title">Движение товара</h2>
          <form className="app-form-grid app-form-grid--warehouse" onSubmit={submitMove}>
            <select className="input" required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Товар</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="IN">Приход</option>
              <option value="OUT">Расход</option>
              <option value="ADJUST">Коррекция</option>
            </select>
            <input className="input" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className="input" placeholder="Комментарий" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button type="submit" className="btn btn--primary">OK</button>
          </form>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="card app-section-card">
          <h2 className="app-section-card__title">История</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Товар</th><th>Тип</th><th>Кол-во</th><th>Автор</th><th>Дата</th></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.product.name}</td>
                    <td>{m.type === 'IN' ? 'Приход' : m.type === 'OUT' ? 'Расход' : 'Коррекция'}</td>
                    <td>{formatNum(m.quantity)}</td>
                    <td>{m.author?.fullName || '—'}</td>
                    <td>{new Date(m.createdAt).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
