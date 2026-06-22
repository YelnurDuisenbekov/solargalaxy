/** Сообщения после успешных POST/PUT/PATCH/DELETE. null — без toast. */
export function getMutationFlashMessage(method, path, data) {
  if (data?.flashMessage) return data.flashMessage;
  if (data?.message && typeof data.message === 'string') return data.message;

  const m = method.toUpperCase();
  const p = path.split('?')[0];

  if (p.includes('/notifications/') && (p.endsWith('/read') || p.includes('/read?'))) return null;
  if (p.endsWith('/notifications/read-all')) return null;

  if (m === 'DELETE') {
    if (p.includes('/materials/')) return 'Материал удалён';
    if (p.includes('/templates/')) return 'Шаблон удалён';
    return 'Удалено';
  }

  if (m === 'POST') {
    if (p === '/auth/login') return 'Вход выполнён';
    if (p === '/auth/register-client') return 'Регистрация завершена';
    if (p.endsWith('/claim')) return 'Лид взят в работу';
    if (p.endsWith('/reassign')) return 'Ответственный изменён';
    if (p.endsWith('/contact')) return 'Контакт отмечен';
    if (p.endsWith('/convert')) return 'Лид конвертирован в проект';
    if (p.endsWith('/approve')) return 'Согласовано';
    if (p.endsWith('/approve-director')) return 'Согласовано директором';
    if (p.endsWith('/approve-accountant')) return 'Согласовано бухгалтером';
    if (p.endsWith('/reject')) return 'Отклонено';
    if (p.endsWith('/accept')) return 'Принято';
    if (p.endsWith('/accept-bid')) return 'Ставка принята';
    if (p.endsWith('/accept-lowest-bid')) return 'Принята минимальная ставка';
    if (p.endsWith('/close-auction')) return 'Аукцион закрыт';
    if (p.endsWith('/toggle')) return 'Статус пользователя изменён';
    if (p.endsWith('/recalc')) return 'КП пересчитано';
    if (p.endsWith('/write-off')) return 'Запрос на списание отправлен';
    if (p.endsWith('/issue')) return 'Материалы выданы';
    if (p.endsWith('/materials/return-to-manager')) return 'Материалы возвращены менеджеру';
    if (p.endsWith('/materials/approve')) return 'Материалы согласованы';
    if (p.endsWith('/auction')) return 'Аукцион открыт';
    if (p.endsWith('/whatsapp')) return 'Сообщение отправлено';
    if (p.endsWith('/auto-whatsapp-sent')) return null;
    if (p.endsWith('/test')) return 'Тестовое сообщение отправлено';
    if (p.includes('/from-deal/')) return 'Проект создан из сделки';
    if (p.includes('/transfer-acts')) return 'Акт приём-передачи создан';
    if (p.includes('/sync/')) return 'Синхронизация выполнена';
    if (p === '/users') return 'Пользователь создан';
    if (p === '/crm/leads') return 'Лид создан';
    if (p === '/crm/deals') return 'Сделка создана';
    if (p === '/crm/activities') return 'Активность добавлена';
    if (p === '/erp/projects') return 'Проект создан';
    if (p.includes('/materials') && !p.includes('/bulk')) return 'Материал добавлен';
    if (p === '/finance/invoices') return 'Счёт создан';
    if (p === '/warehouse/products') return 'Товар добавлен';
    if (p === '/warehouse/suppliers') return 'Поставщик добавлен';
    if (p === '/warehouse/movements') return 'Движение оформлено';
    if (p === '/warehouse/receipts') return 'Приход оформлен';
    if (p === '/operations/bids') return 'Ставка отправлена';
    if (p === '/public/leads') return 'Заявка отправлена';
    if (p.includes('/proposals/templates')) return 'Шаблон создан';
    return 'Сохранено';
  }

  if (m === 'PUT' || m === 'PATCH') {
    if (p.endsWith('/proposal')) return 'Коммерческое предложение сохранено';
    if (p.includes('/materials/bulk')) return 'Материалы сохранены';
    if (p.includes('/products/pricing')) return 'Цены обновлены';
    if (p.includes('/stock/bulk')) return 'Остатки обновлены';
    if (p.endsWith('/permissions')) return 'Права обновлены';
    if (p.endsWith('/status')) return 'Статус обновлён';
    if (p === '/users/me') return 'Профиль сохранён';
    if (p.startsWith('/users/')) return 'Пользователь обновлён';
    if (p.startsWith('/crm/leads/')) return 'Лид обновлён';
    if (p.startsWith('/crm/deals/')) return 'Сделка обновлена';
    if (p.startsWith('/crm/activities/')) return 'Активность обновлена';
    if (p.startsWith('/erp/projects/')) return 'Проект обновлён';
    if (p.includes('/materials/')) return 'Материал обновлён';
    if (p.startsWith('/finance/invoices/')) return 'Счёт обновлён';
    if (p.startsWith('/warehouse/receipts/')) return 'Приход обновлён';
    if (p.includes('/proposals/templates/')) return 'Шаблон обновлён';
    return 'Изменения сохранены';
  }

  return null;
}
