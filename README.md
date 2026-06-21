# SolarGalaxy

Платформа Solar Galaxy: публичный сайт, CRM, ERP (проекты и финансы), виртуальный склад, личный кабинет клиента.

## Стек

| Часть | Технологии |
|-------|------------|
| Frontend | React, Vite, React Router, Framer Motion |
| Backend | Node.js, Express, Prisma |
| БД | SQLite (dev), PostgreSQL (prod) |

## Роли пользователей

- **ADMIN** — полный доступ, пользователи, склад, CRM, ERP
- **EMPLOYEE** — CRM, проекты, склад, финансы
- **CLIENT** — личный кабинет: сделки, проекты, счета

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
- Кабинет: http://localhost:5173/login  

### Демо-аккаунты (после seed)

| Роль | Email | Пароль |
|------|-------|--------|
| Админ | admin@solargalaxy.kz | admin123 |
| Сотрудник | employee@solargalaxy.kz | employee123 |
| Клиент | client@solargalaxy.kz | client123 |

## Модули

### CRM (`/app/crm`)
- Лиды с воронкой статусов (новый → квалификация → конвертация)
- Конвертация лида в сделку
- Kanban сделок (новая / в работе / выиграна / проиграна)
- Задачи и активности (звонки, встречи, задачи)
- Поля для СЭС: мощность кВт, город, адрес

### ERP — Проекты (`/app/projects`)
- Жизненный цикл монтажа: обследование → проект → закупка → монтаж → пусконаладка
- Создание проекта из сделки
- Материалы проекта и выдача со склада на объект

### ERP — Финансы (`/app/finance`)
- Счета по проектам и клиентам
- Статусы: черновик → отправлен → оплачен

### Склад (`/app/warehouse`)
- Товары, остатки, движения (приход / расход / коррекция)
- Привязка расхода к проекту

### Личный кабинет клиента (`/app/portal`)
- Статус сделок, проектов и счетов

## API

| Prefix | Описание |
|--------|----------|
| `/api/public` | Заявки с сайта |
| `/api/crm` | Лиды, сделки, активности |
| `/api/erp` | Проекты, материалы |
| `/api/finance` | Счета |
| `/api/warehouse` | Склад |
| `/api/portal` | Кабинет клиента |
| `/api/integrations` | 1С (заглушка) |

## Структура

```
solargalaxy/
├── client/     # React — сайт + приложение
├── server/     # Express API + Prisma
└── package.json
```
