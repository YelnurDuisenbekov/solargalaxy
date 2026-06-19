# SolarGalaxy

Платформа для солнечной энергетики: публичный сайт, CRM, виртуальный склад, управление пользователями (сотрудники и клиенты).

## Стек

| Часть | Технологии |
|-------|------------|
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express, Prisma |
| БД | SQLite (dev), PostgreSQL (prod) |

## Роли пользователей

- **ADMIN** — полный доступ, создание сотрудников и клиентов
- **EMPLOYEE** — CRM, склад, работа с заявками
- **CLIENT** — личный кабинет, свои заказы и документы

## Быстрый старт

```bash
npm install
cd server && copy .env.example .env
npm run db:push --workspace=server
npm run db:seed --workspace=server
npm run dev
```

- Сайт: http://localhost:5173  
- API: http://localhost:4000  

### Демо-аккаунты (после seed)

| Роль | Email | Пароль |
|------|-------|--------|
| Админ | admin@solargalaxy.kz | admin123 |
| Сотрудник | employee@solargalaxy.kz | employee123 |
| Клиент | client@solargalaxy.kz | client123 |

## Модули

- **CRM** — лиды, сделки, контакты клиентов
- **Склад** — товары, остатки, движения (приход/расход)

## Структура

```
solargalaxy/
├── client/     # React — сайт + приложение
├── server/     # Express API + Prisma
└── package.json
```
