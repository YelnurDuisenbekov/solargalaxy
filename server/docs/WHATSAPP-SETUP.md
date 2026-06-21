# WhatsApp API — SOLAR GALAXY

**Бизнес-номер:** +7 777 475 1332

## Быстрая настройка (5 минут)

### 1. Meta Developer Console

Откройте: https://developers.facebook.com/apps/

- **Создать приложение** → тип **Business** → название: `Solar Galaxy CRM`
- В приложении: **Add product** → **WhatsApp** → **Set up**

### 2. Подключить номер

WhatsApp → **API Setup**:

1. В блоке **From** добавьте или выберите номер **+7 777 475 1332**
2. Скопируйте **Phone number ID** (число, например `123456789012345`)
3. Скопируйте **Temporary access token** (или создайте постоянный через System User)

### 3. Автоматическая настройка проекта

В терминале из папки `server`:

```bash
node scripts/whatsapp-setup.mjs
```

Скрипт запросит Token и Phone ID, проверит API, создаст шаблоны `sg_followup` и `sg_initial`, запишет `.env`.

Или сразу с параметрами:

```bash
node scripts/whatsapp-setup.mjs --token "EAA..." --phone-id "123456789012345"
```

### 4. Webhook (для входящих сообщений)

Для локальной разработки установите [ngrok](https://ngrok.com):

```bash
ngrok http 4000
```

Скопируйте URL, например `https://abc123.ngrok.io`, и в Meta:

- WhatsApp → **Configuration** → **Webhook**
- Callback URL: `https://abc123.ngrok.io/api/whatsapp/webhook`
- Verify token: `solargalaxy-webhook-secret`
- Subscribe: `messages`, `message_template_status`

Добавьте в `.env`:

```
WHATSAPP_WEBHOOK_PUBLIC_URL="https://abc123.ngrok.io/api/whatsapp/webhook"
```

### 5. Проверка

```bash
npm run dev
```

Откройте в CRM: **Система → WhatsApp API** — статус должен быть «Подключён».

---

## Шаблоны (если создавать вручную в Business Manager)

### sg_followup (ru, Marketing)

```
Здравствуйте, {{1}}!

Это {{2}} из SOLAR GALAXY.

Вы интересовались солнечной станцией — готов обсудить детали, ответить на вопросы и подготовить расчёт. Когда вам удобно созвониться?
```

Пример: `Айдар` | `Алмас`

### sg_initial (ru, Marketing)

```
Здравствуйте, {{1}}!

Меня зовут {{2}}, менеджер по продажам SOLAR GALAXY.

По вашей заявке: город {{3}}, мощность {{4}}.

Готов ответить на вопросы и подготовить расчёт. Когда вам удобно созвониться?
```

Пример: `Айдар` | `Алмас` | `Алматы` | `10 кВт`

---

## Постоянный токен (production)

1. [business.facebook.com](https://business.facebook.com) → **Business settings**
2. **Users → System users** → Add → Admin
3. **Add assets** → ваше приложение → Full control
4. **Generate token** → выберите `whatsapp_business_messaging`, `whatsapp_business_management`
5. Вставьте токен в `.env` как `WHATSAPP_TOKEN`
