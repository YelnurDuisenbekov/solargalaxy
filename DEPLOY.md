# Деплой Senergy (Vercel + Render)

## 1. Backend на Render

### Вариант A — Blueprint (рекомендуется)

1. [render.com](https://render.com) → **New → Blueprint**
2. Репозиторий `YelnurDuisenbekov/solargalaxy`, ветка `main`
3. При запросе переменных (`sync: false`) вставьте из `server/.env`:
   - `GREEN_API_ID_INSTANCE`
   - `GREEN_API_TOKEN`
   - `GREEN_API_URL` (например `https://7107.api.greenapi.com`)
4. **Apply** → дождитесь деплоя (~5–10 мин)

### Вариант B — автоматически через API

После Blueprint создайте API key: Render → **Account Settings → API Keys**

```powershell
$env:RENDER_API_KEY="rnd_ваш_ключ"
node scripts/render-provision.mjs
```

Скрипт пропишет Green API из `server/.env` и перезапустит деплoy.

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
