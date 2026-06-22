# Деплой Solar Galaxy (Vercel + Render)

## 1. Backend на Render

1. [render.com](https://render.com) → **New** → **Blueprint**
2. Подключите репозиторий `YelnurDuisenbekov/solargalaxy`, ветка `main`
3. Render прочитает `render.yaml` и создаст **PostgreSQL** + **Web Service** `solargalaxy-api`
4. После создания сервиса откройте **Environment** и задайте (из `server/.env`):
   - `GREEN_API_ID_INSTANCE`
   - `GREEN_API_TOKEN`
5. Дождитесь успешного деплоя. URL API будет вида:  
   `https://solargalaxy-api.onrender.com`

Проверка: откройте `https://<ваш-api>/api/health` — ответ `{"status":"ok",...}`.

Первый деплой создаёт учётки (если БД пустая):

| Логин | Пароль |
|-------|--------|
| admin | admin123 |
| director | director123 |
| menedzher1 | menedzher123 |

**Смените пароли** после первого входа в CRM.

## 2. Frontend на Vercel

1. [vercel.com](https://vercel.com) → проект `client-eta-lovat-29` (или ваш)
2. **Settings** → **Environment Variables**
3. Добавьте:

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | `https://solargalaxy-api.onrender.com` (без `/api`) |

4. **Deployments** → **Redeploy** последний деплой

## 3. Локальная разработка

```bash
docker compose up -d
cd server
cp .env.example .env
# DATABASE_URL уже указывает на локальный Postgres
npx prisma db push
npm run db:seed
cd ..
npm run dev
```

## 4. Проверка прода

1. Главная → калькулятор → отправить заявку
2. CRM `/app/crm` → новый лид
3. Вход клиента `/login` → кабинет `/portal`

На Free Render API «засыпает» после ~15 мин без запросов; первый запрос может занять 30–60 сек.
