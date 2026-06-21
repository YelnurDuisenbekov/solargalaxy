/** Публичные поля проекта для публикации торгов (без сумм). */
export function projectAuctionBrief(project, { includeBids = false } = {}) {
  const lead = project.lead;
  const brief = {
    id: project.id,
    projectNumber: project.projectNumber,
    title: project.title,
    phase: project.phase,
    capacityKw: project.capacityKw,
    city: project.city || lead?.city,
    address: project.address,
    notes: project.notes,
    auctionBrief: project.auctionBrief,
    startDate: project.startDate,
    auctionOpen: project.auctionOpen,
    auctionDeadline: project.auctionDeadline,
    client: project.client ? {
      fullName: project.client.fullName,
      company: project.client.company,
      phone: project.client.phone,
    } : null,
    lead: lead ? {
      fullName: lead.fullName,
      phone: lead.phone,
      city: lead.city,
      objectType: lead.objectType,
      systemType: lead.systemType,
      capacityKw: lead.capacityKw,
      source: lead.source,
      notes: lead.notes,
    } : null,
    assignee: project.assignee ? { fullName: project.assignee.fullName, phone: project.assignee.phone } : null,
    materials: (project.materials || []).map((m) => ({
      id: m.id,
      name: m.product?.name,
      sku: m.product?.sku,
      quantityPlanned: m.quantityPlanned,
      unit: m.product?.unit,
    })),
    attachments: (project.attachments || []).map((a) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
    })),
  };
  if (includeBids) {
    brief.bids = project.bids;
    brief.bidCount = project._count?.bids ?? project.bids?.length ?? 0;
  } else if (project.bids?.length && project.bids[0]?.contractorId !== undefined) {
    brief.myBid = project.bids[0] ?? null;
    brief.bidCount = project._count?.bids ?? 0;
  }
  return brief;
}

/** Краткая карточка завершённых торгов (победитель и цена). */
export function projectAuctionResultBrief(project, { myBid = null } = {}) {
  const lead = project.lead;
  const won = project.winningBid;
  const contractor = won?.contractor;
  const brief = {
    id: project.id,
    projectNumber: project.projectNumber,
    title: project.title,
    city: project.city || lead?.city,
    capacityKw: project.capacityKw || lead?.capacityKw,
    bidCount: project._count?.bids ?? project.bids?.length ?? 0,
    closedAt: project.updatedAt,
    auctionDeadline: project.auctionDeadline,
    winner: won
      ? {
        name: contractor?.fullName || contractor?.company || '—',
        price: won.price,
      }
      : null,
  };
  if (myBid) {
    brief.myBid = { price: myBid.price, status: myBid.status };
  } else if (project.bids?.length === 1 && project.bids[0].contractorId !== undefined) {
    const b = project.bids[0];
    brief.myBid = { price: b.price, status: b.status };
  }
  return brief;
}
