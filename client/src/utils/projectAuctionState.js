/** @typedef {'none' | 'open' | 'won' | 'failed'} AuctionState */

/** @returns {AuctionState} */
export function getAuctionState(project) {
  if (!project) return 'none';
  if (project.winningBidId || project.winningBid) return 'won';
  if (project.auctionOpen) return 'open';
  if (project.auctionLaunched || project.auctionDeadline || (project._count?.bids ?? project.bids?.length ?? 0) > 0) {
    return 'failed';
  }
  return 'none';
}

export function canLaunchAuction(project) {
  const state = getAuctionState(project);
  return state === 'none' || state === 'failed';
}

export function pastAuctionNote(project) {
  const bidCount = project._count?.bids ?? project.bids?.length ?? 0;
  const parts = [];
  if (bidCount > 0) {
    const word = bidCount === 1 ? 'ставка' : bidCount < 5 ? 'ставки' : 'ставок';
    parts.push(`${bidCount} ${word}`);
  }
  if (project.auctionDeadline) {
    parts.push(`срок до ${new Date(project.auctionDeadline).toLocaleDateString('ru-RU')}`);
  }
  const details = parts.length ? ` (${parts.join(', ')})` : '';
  return `Прошлые торги завершились без выбора подрядчика${details}. Можно запустить повторно.`;
}
