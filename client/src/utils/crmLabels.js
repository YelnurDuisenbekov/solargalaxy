export const LEAD_STATUS = {
  NEW: 'Новый',
  CONTACTED: 'Контакт',
  QUALIFIED: 'Заинтересован',
  SURVEY: 'Замер',
  CONVERTED: 'Проект создан',
  LOST: 'Потерян',
};



export const DEAL_STATUS = {

  NEW: 'Новая',

  IN_PROGRESS: 'В работе',

  WON: 'Выиграна',

  LOST: 'Проиграна',

};



export const PROJECT_PHASE = {

  DESIGN: 'Проектирование',

  BIDDING: 'Торги',

  PROCUREMENT: 'Закупка',

  INSTALLATION: 'Монтаж',

  COMMISSIONING: 'Пусконаладка',

  COMPLETED: 'Завершён',

  CANCELLED: 'Отменён',

};

/** Подпись этапа проекта (старые проекты могли быть в SURVEY) */
export function projectPhaseLabel(phase) {
  if (phase === 'SURVEY') return 'Проектирование';
  return PROJECT_PHASE[phase] || phase;
}



export const OBJECT_TYPE = {

  HOUSE: 'Частный дом',

  OFFICE: 'Офис',

  FARM: 'КХ / Ферма',

  INDUSTRIAL: 'Промышленный',

  OTHER: 'Другое',

};



export const SYSTEM_TYPE = {

  ON_GRID: 'Сетевая',

  OFF_GRID: 'Автономная',

  HYBRID: 'Гибридная',

};



export const KIT_CATEGORY = {

  PANEL: 'Панель',

  INVERTER: 'Инвертор',

  BATTERY: 'Аккумулятор',

  MOUNTING: 'Опорная конструкция',

  COMMISSIONING: 'Пусконаладка',

  CABLE: 'Кабели',

  OTHER: 'Прочее',

};



export const USER_ROLE = {

  ADMIN: 'Администратор',

  DIRECTOR: 'Директор',

  MANAGER: 'Менеджер',

  EMPLOYEE: 'Сотрудник',

  WAREHOUSE: 'Завсклад',

  SUPPLY: 'Снабжение',

  ACCOUNTANT: 'Бухгалтерия',

  CONTRACTOR: 'Подрядчик',

  CLIENT: 'Клиент',

};



export const PERMISSION_LABELS = {

  'users.view': 'Просмотр пользователей',

  'users.create': 'Создание пользователей',

  'users.edit': 'Редактирование пользователей',

  'users.delete': 'Удаление пользователей',

  'users.permissions': 'Управление разрешениями',

  'crm.view': 'CRM — свои данные',

  'crm.view_all': 'CRM — все данные',

  'crm.edit': 'CRM — редактирование',

  'erp.view': 'ERP — свои проекты',

  'erp.view_all': 'ERP — все проекты',

  'erp.edit': 'ERP — редактирование',

  'finance.view': 'Финансы — просмотр',

  'finance.edit': 'Финансы — редактирование',

  'warehouse.view': 'Склад — просмотр',

  'warehouse.issue': 'Склад — выдача',

  'warehouse.edit': 'Склад — редактирование',

  'supply.view': 'Снабжение',

  'profile.edit': 'Редактирование профиля',

};



export const LEAD_SOURCES = ['Сайт', 'Реклама', 'Соцсети', 'Телефон', 'Рекомендация', 'CRM', 'Другое'];



export const INVOICE_STATUS = {

  DRAFT: 'Черновик',

  SENT: 'Отправлен',

  PAID: 'Оплачен',

  CANCELLED: 'Отменён',

};



export const ACTIVITY_TYPE = {

  CALL: 'Звонок',

  MEETING: 'Встреча',

  EMAIL: 'Email',

  TASK: 'Задача',

  NOTE: 'Заметка',

};



export const leadBadge = {

  NEW: 'badge--new',

  CONTACTED: 'badge--progress',

  QUALIFIED: 'badge--won',

  SURVEY: 'badge--progress',

  CONVERTED: 'badge--won',

  LOST: 'badge--lost',

};



export const dealBadge = {

  NEW: 'badge--new',

  IN_PROGRESS: 'badge--progress',

  WON: 'badge--won',

  LOST: 'badge--lost',

};



export const invoiceBadge = {

  DRAFT: 'badge--progress',

  SENT: 'badge--new',

  PAID: 'badge--won',

  CANCELLED: 'badge--lost',

};



export const phaseBadge = {

  SURVEY: 'badge--new',

  DESIGN: 'badge--new',

  BIDDING: 'badge--progress',

  PROCUREMENT: 'badge--progress',

  INSTALLATION: 'badge--progress',

  COMMISSIONING: 'badge--progress',

  COMPLETED: 'badge--won',

  CANCELLED: 'badge--lost',

};



export const sourceBadge = {

  Сайт: 'badge--new',

  Реклама: 'badge--progress',

  Соцсети: 'badge--won',

  Телефон: 'badge--progress',

  Рекомендация: 'badge--won',

  CRM: 'badge--new',

  Другое: 'badge--lost',

};


