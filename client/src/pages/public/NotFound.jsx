import { Link } from 'react-router-dom';
import SeoHead from '../../components/SeoHead';
import './NotFound.css';

export default function NotFound() {
  return (
    <>
      <SeoHead
        title="Страница не найдена"
        description="Запрашиваемая страница не существует. Вернитесь на главную Solar Galaxy."
        path="/404"
        noindex
      />
      <section className="not-found">
        <div className="container not-found__inner">
          <p className="not-found__code">404</p>
          <h1>Страница не найдена</h1>
          <p>Такой страницы нет или адрес устарел. Проверьте URL или перейдите на главную.</p>
          <div className="not-found__actions">
            <Link to="/" className="btn btn--primary">На главную</Link>
            <Link to="/contact" className="btn btn--outline">Контакты</Link>
          </div>
        </div>
      </section>
    </>
  );
}
