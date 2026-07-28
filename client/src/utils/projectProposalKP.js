import { formatMoney, formatNum } from './format';
import { OBJECT_TYPE, SYSTEM_TYPE } from './crmLabels';
import {
  groupMaterials,
  effectiveUnitPrice,
  lineSubtotal,
  lineTotal,
  kitSubtotal,
  kitTotal,
} from './materialDiscount';
import { downloadHtmlAsPdf } from './kpPdf';

const BRAND = {
  companyName: 'Solar Galaxy',
  website: 'solargalaxy.kz',
  contactName: 'Елнур',
  whatsapp: '+7 700 330 1999',
  whatsappDigits: '77003301999',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildProposalData(project, overrides = {}) {
  const lead = project.lead || project.deal?.lead || {};
  const client = project.client || {};
  const materials = project.materials || [];
  const grouped = groupMaterials(materials);
  const globalDisc = Number(project.kitGlobalDiscountPct ?? 0);
  const useGlobal = globalDisc > 0;
  const subtotal = kitSubtotal(materials);
  const total = project.kitTotal ?? kitTotal(materials, globalDisc);

  const clientName = overrides.clientName || client.fullName || client.company || lead.fullName || '—';
  const phone = overrides.phone || lead.phone || client.phone || '';
  const city = overrides.city || project.city || lead.city || '';
  const objectLabel = overrides.objectLabel || (lead.objectType ? (OBJECT_TYPE[lead.objectType] || lead.objectType) : '');
  const systemLabel = overrides.systemLabel || (lead.systemType ? (SYSTEM_TYPE[lead.systemType] || lead.systemType) : '');
  const capacityKw = overrides.capacityKw || project.capacityKw || lead.capacityKw || '';
  const managerName = overrides.managerName || project.assignee?.fullName || BRAND.contactName;
  const projectNumber = project.projectNumber || project.id?.slice(0, 8) || '';
  const dateStr = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  const proposalTitle = overrides.projectTitle || project.title || 'Солнечная электростанция';
  const intro = overrides.intro
    || 'Проектирование, поставка оборудования, монтаж и пусконаладка солнечной электростанции под ключ в Казахстане.';

  return {
    grouped,
    materials,
    globalDisc,
    useGlobal,
    subtotal,
    total,
    clientName,
    phone,
    city,
    objectLabel,
    systemLabel,
    capacityKw,
    managerName,
    projectNumber,
    dateStr,
    proposalTitle,
    intro,
  };
}

function editableAttr(editable, key) {
  if (!editable) return '';
  return ` contenteditable="true" data-edit="${key}" spellcheck="false"`;
}

/**
 * Генерация HTML коммерческого предложения.
 * Стиль — Instagram Solar Galaxy: cream / forest / gold, крупный логотип.
 */
export function generateProjectKPHtml(project, overrides = {}, {
  logoMarkSrc,
  editable = false,
} = {}) {
  const {
    grouped,
    materials,
    globalDisc,
    useGlobal,
    subtotal,
    total,
    clientName,
    phone,
    city,
    objectLabel,
    systemLabel,
    capacityKw,
    managerName,
    projectNumber,
    dateStr,
    proposalTitle,
    intro,
  } = buildProposalData(project, overrides);

  const hasLineDiscounts = materials.some((m) => Number(m.discountPct ?? 0) > 0);
  const showDiscountCol = !useGlobal && hasLineDiscounts;
  const colCount = showDiscountCol ? 5 : 4;
  const labelColspan = colCount - 1;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const markUrl = logoMarkSrc || `${origin}/logo-mark.png`;

  const pdfFileName = `КП-${projectNumber || 'SolarGalaxy'}-SolarGalaxy.pdf`;

  const groupRows = grouped.map((g) => {
    const rows = g.items.map((m) => {
      const price = effectiveUnitPrice(m);
      const disc = m.discountPct ?? 0;
      const sub = useGlobal ? lineSubtotal(m) : lineTotal(m);
      const unit = m.product?.unit || 'шт';
      const discountCell = showDiscountCol
        ? `<td class="center">${disc > 0 ? `${escapeHtml(disc)}%` : '—'}</td>`
        : '';
      return `<tr class="item-row">
        <td>${escapeHtml(m.product?.name || m.name || '—')}</td>
        <td class="center">${escapeHtml(formatNum(m.quantityPlanned))} ${escapeHtml(unit)}</td>
        <td class="right">${escapeHtml(formatMoney(price))}</td>
        ${discountCell}
        <td class="right">${escapeHtml(formatMoney(sub))}</td>
      </tr>`;
    }).join('');

    // Заголовок группы — те же ячейки, что у обычных строк (без colspan-кластера)
    const emptyCells = Array.from({ length: colCount - 1 }, () => '<td></td>').join('');
    const header = `<tr class="group-header"><td>${escapeHtml(g.label)}</td>${emptyCells}</tr>`;
    return `${header}${rows}`;
  }).join('');

  const discountHeader = showDiscountCol ? '<th class="center">Скидка</th>' : '';

  const toolbar = editable
    ? `<div class="kp-toolbar no-print">
  <button type="button" class="btn-edit" id="btnToggleEdit">✏️ Редактировать</button>
  <button type="button" class="btn-print" id="btnSavePdf">📄 Сохранить PDF</button>
  <span class="kp-toolbar__hint" id="editHint">Правьте текст в документе, затем сохраните PDF</span>
</div>`
    : '';

  const editScript = editable
    ? `<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"><\/script>
<script>
(function () {
  var editing = true;
  var sheet = document.querySelector('.sheet');
  var hint = document.getElementById('editHint');
  var btn = document.getElementById('btnToggleEdit');
  var saveBtn = document.getElementById('btnSavePdf');
  var fields = document.querySelectorAll('[data-edit]');
  var pdfName = ${JSON.stringify(pdfFileName)};

  function setEditing(on) {
    editing = on;
    fields.forEach(function (el) {
      el.contentEditable = on ? 'true' : 'false';
      el.classList.toggle('is-editing', on);
    });
    if (btn) btn.textContent = on ? '🔒 Закончить правку' : '✏️ Редактировать';
    if (hint) hint.textContent = on
      ? 'Кликайте по подсвеченным полям и правьте текст. Затем «Сохранить PDF».'
      : 'Редактирование выключено. Включите снова или сохраните PDF.';
    if (sheet) sheet.classList.toggle('sheet--editing', on);
  }

  async function savePdf() {
    if (!window.html2canvas || !window.jspdf) {
      alert('Не удалось загрузить библиотеку PDF. Проверьте интернет и попробуйте снова.');
      return;
    }
    setEditing(false);
    var prevText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Сохраняем PDF…';
    try {
      var target = document.querySelector('.sheet');
      var margin = target.style.margin;
      var shadow = target.style.boxShadow;
      target.style.margin = '0';
      target.style.boxShadow = 'none';

      var canvas = await window.html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F6F3EC',
        logging: false,
        windowWidth: Math.max(target.scrollWidth, 794),
        windowHeight: Math.max(target.scrollHeight, 1123)
      });

      target.style.margin = margin;
      target.style.boxShadow = shadow;

      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      var pageWidth = pdf.internal.pageSize.getWidth();
      var pageHeight = pdf.internal.pageSize.getHeight();
      var pxPerMm = canvas.width / pageWidth;
      var pageHeightPx = Math.floor(pageHeight * pxPerMm);
      var pageCanvas = document.createElement('canvas');
      var pageCtx = pageCanvas.getContext('2d');
      var y = 0;
      var pageIndex = 0;
      while (y < canvas.height) {
        var sliceHeight = Math.min(pageHeightPx, canvas.height - y);
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        pageCtx.fillStyle = '#F6F3EC';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        var imgData = pageCanvas.toDataURL('image/jpeg', 0.93);
        if (pageIndex > 0) pdf.addPage();
        var sliceHmm = (sliceHeight * pageWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, sliceHmm);
        y += sliceHeight;
        pageIndex += 1;
      }
      pdf.save(pdfName);
      if (hint) hint.textContent = 'PDF сохранён';
    } catch (err) {
      console.error(err);
      alert('Не удалось сохранить PDF. Попробуйте ещё раз.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = prevText;
    }
  }

  setEditing(true);
  if (btn) btn.addEventListener('click', function () { setEditing(!editing); });
  if (saveBtn) saveBtn.addEventListener('click', function () { savePdf(); });
})();
<\/script>`
    : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>КП — ${escapeHtml(projectNumber)} — ${BRAND.companyName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
  @page { size: A4; margin: 10mm; }
  :root {
    --forest: #0A5C3A;
    --forestDeep: #084A30;
    --green: #1B8A45;
    --gold: #E8A317;
    --goldDeep: #C2890A;
    --cream: #F6F3EC;
    --creamDeep: #EBE6DC;
    --ink: #0A1F2C;
    --muted: #5A6B74;
    --line: #D8E0D6;
    --white: #ffffff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Inter", "Manrope", sans-serif;
    color: var(--ink);
    background: linear-gradient(180deg, #e8f0e6 0%, #dfe8dc 100%);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 210mm; min-height: 297mm;
    margin: 16px auto; background: var(--cream);
    box-shadow: 0 12px 40px rgba(8,74,48,.14);
    overflow: hidden; position: relative;
  }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; width: 100%; }
    .no-print { display: none !important; }
    [contenteditable] { outline: none !important; background: transparent !important; }
  }

  /* ── Toolbar ── */
  .kp-toolbar {
    position: sticky; top: 0; z-index: 30;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(90deg, var(--forestDeep), var(--forest));
    border-bottom: 3px solid var(--gold);
  }
  .kp-toolbar button {
    border: none; border-radius: 999px; padding: 10px 18px;
    font-weight: 700; cursor: pointer; font-family: inherit; font-size: 13px;
  }
  .btn-print { background: var(--gold); color: var(--forestDeep); }
  .btn-edit { background: rgba(255,255,255,.16); color: #fff; border: 1px solid rgba(255,255,255,.35) !important; }
  .kp-toolbar__hint { color: rgba(255,255,255,.78); font-size: 12px; margin-left: 6px; }

  /* ── Hero: watermark + content (без лого слева) ── */
  .hero {
    position: relative;
    padding: 14px 28px 16px;
    background:
      radial-gradient(circle at 92% 8%, rgba(232,163,23,.28), transparent 34%),
      radial-gradient(circle at 8% 90%, rgba(27,138,69,.12), transparent 40%),
      linear-gradient(165deg, #fffef9 0%, var(--cream) 55%, var(--creamDeep) 100%);
    overflow: hidden;
    border-bottom: 4px solid var(--gold);
  }
  .hero-mark {
    position: absolute;
    right: -20px; top: -30px;
    width: 300px; height: 300px;
    opacity: .08;
    pointer-events: none;
    z-index: 0;
  }
  .hero-mark img { width: 100%; height: 100%; object-fit: contain; }
  .hero-rays {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background:
      repeating-conic-gradient(from 0deg at 88% 12%,
        rgba(232,163,23,.05) 0deg 6deg,
        transparent 6deg 18deg);
    mask-image: radial-gradient(circle at 88% 12%, #000 0%, transparent 55%);
  }
  .hero-curve {
    position: absolute; left: 0; right: 0; bottom: -1px; height: 12px; z-index: 2;
    background: linear-gradient(90deg, var(--forestDeep), var(--green) 55%, var(--gold));
    clip-path: ellipse(110% 100% at 50% 100%);
  }

  .brand-row { display: none; }
  .meta-stack {
    position: relative; z-index: 1;
    flex-shrink: 0;
    min-width: 200px; max-width: 240px;
  }
  .meta-stack .brand-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--forest);
    color: #fff;
    border: 2px solid var(--gold);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 10px; font-weight: 800;
    letter-spacing: .08em; text-transform: uppercase;
    box-shadow: 0 6px 18px rgba(8,74,48,.2);
    margin-bottom: 8px;
  }
  .meta-stack .brand-badge::before {
    content: ""; width: 10px; height: 10px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff6c8, var(--gold));
    box-shadow: 0 0 0 2px rgba(232,163,23,.35);
  }

  .hero-body {
    position: relative; z-index: 1;
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 20px;
  }
  .hero-copy { flex: 1; min-width: 0; }
  .pill {
    display: inline-block;
    background: linear-gradient(90deg, var(--gold), #f0c14d);
    color: var(--forestDeep);
    font-weight: 800; font-size: 10px; letter-spacing: .14em;
    padding: 5px 12px; border-radius: 999px; margin-bottom: 6px;
    text-transform: uppercase;
    box-shadow: 0 4px 12px rgba(232,163,23,.35);
  }
  .hero-copy h2 {
    font-family: "Manrope", sans-serif;
    font-size: 26px; font-weight: 800; line-height: 1.12;
    color: var(--forestDeep);
    letter-spacing: -.02em; margin-bottom: 4px;
  }
  .hero-copy .gold-rule {
    width: 72px; height: 4px; border-radius: 999px;
    background: linear-gradient(90deg, var(--gold), transparent);
    margin: 0 0 8px;
  }
  .hero-copy p {
    font-size: 12.5px; line-height: 1.45; color: var(--muted);
    max-width: 440px;
  }
  .meta-box {
    background: linear-gradient(145deg, var(--forestDeep), var(--forest));
    color: #fff;
    border: 2px solid var(--gold);
    border-radius: 16px; padding: 12px 14px;
    font-size: 12px; line-height: 1.55;
    box-shadow: 0 10px 28px rgba(8,74,48,.22);
  }
  .meta-box b { color: var(--gold); font-weight: 800; font-size: 14px; }

  /* ── Body ── */
  .body { padding: 16px 28px 24px; position: relative; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .info-card {
    background: linear-gradient(180deg, #fff 0%, var(--cream) 100%);
    border-radius: 14px;
    padding: 0;
    border: 1px solid var(--line);
    box-shadow: 0 4px 14px rgba(8,74,48,.05);
    position: relative;
    overflow: hidden;
    min-height: 118px;
    display: flex;
    flex-direction: column;
  }
  .info-card::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    background: linear-gradient(180deg, var(--gold), var(--green));
  }
  .info-card__title {
    padding: 12px 16px 8px 18px;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(90deg, rgba(232,163,23,.12), rgba(27,138,69,.06));
  }
  .info-card__title h3 {
    font-size: 13px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--forestDeep);
    margin: 0; font-weight: 800;
  }
  .info-card__data {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    padding: 12px 16px 14px 18px;
    align-content: center;
  }
  .info-card__data .field { min-width: 0; }
  .info-card__data .field span.label {
    display: block;
    font-size: 9px; letter-spacing: .1em; text-transform: uppercase;
    color: var(--muted); font-weight: 700; margin-bottom: 2px;
  }
  .info-card__data .field .value {
    font-size: 13px; line-height: 1.35; color: var(--ink); font-weight: 600;
  }
  .info-card__data .field .value strong { font-weight: 800; color: var(--forestDeep); }
  .info-card__data .field--wide { grid-column: 1 / -1; }

  /* ── Table: градиент на строку целиком ── */
  .kit-table {
    width: 100%; border-collapse: collapse; margin-top: 4px;
    font-size: 14px; overflow: hidden; border-radius: 12px;
  }
  .kit-table thead tr {
    background: linear-gradient(90deg, var(--forestDeep), var(--forest));
  }
  .kit-table th {
    background: transparent;
    color: #fff;
    padding: 12px 12px; text-align: left; font-weight: 700;
    font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
  }
  .kit-table th.right, .kit-table td.right { text-align: right; }
  .kit-table th.center, .kit-table td.center { text-align: center; }
  .kit-table td {
    padding: 11px 12px; border-bottom: 1px solid var(--line);
    background: transparent;
  }
  .kit-table tbody tr.item-row { background: #fff; }
  .kit-table tbody tr.item-row:nth-child(even) { background: #fbfaf6; }
  .kit-table tbody tr.group-header,
  .kit-table tbody tr.group-header:nth-child(even),
  .kit-table tbody tr.group-header:nth-child(odd) {
    background: linear-gradient(90deg, rgba(232,163,23,.22), rgba(27,138,69,.10)) !important;
  }
  .kit-table .group-header td {
    background: transparent !important;
    font-weight: 800;
    font-size: 13px; letter-spacing: .04em;
    color: var(--forestDeep); padding: 10px 12px;
    border-bottom: 2px solid var(--gold);
  }
  .kit-table .total-row {
    background: var(--cream);
  }
  .kit-table .total-row td {
    background: transparent;
    font-weight: 700; border-top: 2px solid var(--forest);
    padding: 12px; font-size: 15px;
  }
  .kit-table tbody tr.total-row.grand,
  .kit-table tfoot tr.total-row.grand {
    background: linear-gradient(90deg, rgba(232,163,23,.22), rgba(27,138,69,.14)) !important;
  }
  .kit-table .total-row.grand td {
    background: transparent !important;
    font-size: 17px; color: var(--forestDeep);
  }
  .kit-table .discount-row td {
    background: transparent;
    color: var(--muted); font-style: italic;
    border-top: 1px dashed var(--line); padding: 8px 12px;
  }

  /* ── Note / Footer ── */
  .note {
    margin-top: 16px; padding: 12px 14px;
    background: linear-gradient(90deg, #fff8df, #f7f3e4);
    border: 1px solid #f0d88a;
    border-left: 4px solid var(--gold);
    border-radius: 10px; font-size: 11px; color: #6b5c10; line-height: 1.5;
  }
  .footer {
    margin-top: 22px; padding: 16px 18px;
    background: linear-gradient(135deg, var(--forestDeep), var(--forest) 60%, #0d6b42);
    border-radius: 16px;
    display: flex; justify-content: space-between; align-items: center;
    gap: 16px;
    color: rgba(255,255,255,.85); font-size: 11px; line-height: 1.55;
    box-shadow: 0 10px 28px rgba(8,74,48,.2);
    position: relative; overflow: hidden;
  }
  .footer::after {
    content: ""; position: absolute; right: -20px; top: -30px;
    width: 120px; height: 120px; border-radius: 50%;
    background: radial-gradient(circle, rgba(232,163,23,.28), transparent 70%);
  }
  .footer strong { color: #fff; font-size: 13px; }
  .footer .cta {
    position: relative; z-index: 1;
    background: var(--gold); color: var(--forestDeep);
    padding: 10px 16px; border-radius: 999px;
    font-weight: 800; font-size: 12px; text-align: center;
    line-height: 1.35;
    box-shadow: 0 6px 16px rgba(0,0,0,.18);
  }
  .footer .cta small { display: block; font-weight: 600; font-size: 10px; opacity: .85; margin-top: 2px; }

  /* Editable highlights */
  .sheet--editing [data-edit].is-editing {
    outline: 2px dashed rgba(232,163,23,.7);
    outline-offset: 3px;
    background: rgba(232,163,23,.08);
    border-radius: 4px;
    cursor: text;
  }
  [data-edit]:focus { outline-color: var(--green) !important; }
</style>
</head>
<body>
${toolbar}
<div class="sheet${editable ? ' sheet--editing' : ''}">
  <div class="hero">
    <div class="hero-rays" aria-hidden="true"></div>
    <div class="hero-mark" aria-hidden="true"><img src="${markUrl}" alt="" /></div>
    <div class="hero-body">
      <div class="meta-stack">
        <div class="brand-badge">КП · СЭС под ключ</div>
        <div class="meta-box">
          <b>№ ${escapeHtml(projectNumber)}</b><br/>
          <span${editableAttr(editable, 'date')}>${escapeHtml(dateStr)}</span><br/>
          ${city ? `📍 <span${editableAttr(editable, 'city')}>${escapeHtml(city)}</span>` : `<span${editableAttr(editable, 'city')}></span>`}
          ${capacityKw
            ? `<br/>⚡ <span${editableAttr(editable, 'kw')}>${escapeHtml(formatNum(capacityKw))}</span> кВт`
            : `<br/>⚡ <span${editableAttr(editable, 'kw')}></span> кВт`}
        </div>
      </div>
      <div class="hero-copy">
        <span class="pill">Коммерческое предложение</span>
        <h2${editableAttr(editable, 'title')}>${escapeHtml(proposalTitle)}</h2>
        <div class="gold-rule"></div>
        <p${editableAttr(editable, 'intro')}>${escapeHtml(intro)}</p>
      </div>
    </div>
    <div class="hero-curve" aria-hidden="true"></div>
  </div>

  <div class="body">
    <div class="grid2">
      <div class="info-card">
        <div class="info-card__title"><h3>Заказчик</h3></div>
        <div class="info-card__data">
          <div class="field field--wide">
            <span class="label">Имя / компания</span>
            <div class="value"><strong${editableAttr(editable, 'client')}>${escapeHtml(clientName)}</strong></div>
          </div>
          <div class="field">
            <span class="label">Телефон</span>
            <div class="value"><span${editableAttr(editable, 'phone')}>${escapeHtml(phone || '—')}</span></div>
          </div>
          <div class="field">
            <span class="label">Город</span>
            <div class="value"><span${editableAttr(editable, 'city2')}>${escapeHtml(city || '—')}</span></div>
          </div>
          ${objectLabel ? `<div class="field">
            <span class="label">Объект</span>
            <div class="value"><span${editableAttr(editable, 'object')}>${escapeHtml(objectLabel)}</span></div>
          </div>` : ''}
          ${systemLabel ? `<div class="field">
            <span class="label">Система</span>
            <div class="value"><span${editableAttr(editable, 'system')}>${escapeHtml(systemLabel)}</span></div>
          </div>` : ''}
        </div>
      </div>
      <div class="info-card">
        <div class="info-card__title"><h3>Исполнитель</h3></div>
        <div class="info-card__data">
          <div class="field field--wide">
            <span class="label">Компания</span>
            <div class="value"><strong>${BRAND.companyName}</strong></div>
          </div>
          <div class="field">
            <span class="label">Сайт</span>
            <div class="value">${BRAND.website}</div>
          </div>
          <div class="field">
            <span class="label">WhatsApp</span>
            <div class="value">${BRAND.whatsapp}</div>
          </div>
          <div class="field field--wide">
            <span class="label">Менеджер</span>
            <div class="value"><span${editableAttr(editable, 'manager')}>${escapeHtml(managerName)}</span></div>
          </div>
        </div>
      </div>
    </div>

    <table class="kit-table">
      <thead>
        <tr>
          <th>Наименование</th>
          <th class="center">Кол-во</th>
          <th class="right">Цена</th>
          ${discountHeader}
          <th class="right">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${groupRows}
      </tbody>
      <tfoot>
        ${useGlobal ? `
        <tr class="total-row">
          <td colspan="${labelColspan}" style="text-align:right">Подитог</td>
          <td class="right">${escapeHtml(formatMoney(subtotal))}</td>
        </tr>
        <tr class="discount-row">
          <td colspan="${labelColspan}" style="text-align:right">Общая скидка ${escapeHtml(globalDisc)}%</td>
          <td class="right">−${escapeHtml(formatMoney(subtotal - total))}</td>
        </tr>
        ` : ''}
        <tr class="total-row grand">
          <td colspan="${labelColspan}" style="text-align:right">ИТОГО</td>
          <td class="right">${escapeHtml(formatMoney(total))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="note"${editableAttr(editable, 'note')}>
      ⚠️ Данное коммерческое предложение является предварительным. Окончательная стоимость определяется после замера объекта и согласования комплектации. Срок действия предложения — 14 дней.
    </div>

    <div class="footer">
      <div>
        <strong>${BRAND.companyName}</strong><br/>
        ${BRAND.website}<br/>
        Менеджер: <span${editableAttr(editable, 'manager2')}>${escapeHtml(managerName)}</span>
      </div>
      <div class="cta">
        Готовы обсудить проект?<br/>
        <small>${BRAND.website} · WhatsApp · ${BRAND.whatsapp}</small>
      </div>
    </div>
  </div>
</div>
${editScript}
</body>
</html>`;
}

async function loadImageDataUrl(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return `${window.location.origin}${path}`;
  }
}

async function loadBrandAssets() {
  const logoMarkSrc = await loadImageDataUrl('/logo-mark.png');
  return { logoMarkSrc };
}

function openHtmlBlob(html, downloadName) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  return Boolean(opened);
}

/**
 * Просмотр КП в новой вкладке с редактированием и сохранением PDF.
 */
export async function openProjectKPPreview(project, overrides = {}) {
  const assets = await loadBrandAssets();
  const html = generateProjectKPHtml(project, overrides, {
    ...assets,
    editable: true,
  });
  const num = project.projectNumber || project.id?.slice(0, 8) || 'КП';
  return openHtmlBlob(html, `КП-${num}-SolarGalaxy.html`);
}

/**
 * Сразу скачать КП как PDF-файл (без диалога печати).
 */
export async function downloadProjectKP(project, overrides = {}) {
  const assets = await loadBrandAssets();
  const html = generateProjectKPHtml(project, overrides, {
    ...assets,
    editable: false,
  });
  const num = project.projectNumber || project.id?.slice(0, 8) || 'КП';
  await downloadHtmlAsPdf(html, `КП-${num}-SolarGalaxy.pdf`);
  return true;
}

/**
 * Текст КП для WhatsApp из проекта (не из лида).
 */
export function formatProjectKPWhatsApp(project, overrides = {}) {
  const { materials, grouped, total, city, capacityKw, proposalTitle, managerName } = buildProposalData(project, overrides);

  if (!materials.length || total <= 0) return null;

  const lead = project.lead || project.deal?.lead || {};
  const client = project.client || {};
  const clientName = (overrides.clientName || client.fullName || lead.fullName || '').trim().split(/\s+/)[0] || 'клиент';

  const SEP = '━━━━━━━━━━━━━━';
  const lines = [
    `Здравствуйте, ${clientName}!`,
    '☀️ SOLAR GALAXY',
    `Менеджер: ${managerName}`,
    SEP,
    'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ',
    `Проект: ${proposalTitle}`,
    SEP,
  ];

  if (city) lines.push(`📍 ${city}`);
  if (capacityKw) lines.push(`🔋 ${formatNum(capacityKw)} кВт`);
  lines.push('📦 Комплект:');

  for (const g of grouped) {
    lines.push(`\n${g.label}:`);
    for (const m of g.items) {
      const unit = m.product?.unit || 'шт';
      lines.push(`  • ${m.product?.name || '—'} — ${formatNum(m.quantityPlanned)} ${unit}`);
    }
  }

  lines.push('');
  lines.push(`💰 ИТОГО: ${formatMoney(total)}`);
  lines.push(SEP);
  lines.push('⚠️ Предварительный расчёт. Окончательная сумма — после замера объекта.');
  lines.push(`Для связи: WhatsApp ${BRAND.whatsapp}`);
  lines.push('Когда вам удобно обсудить детали?');

  return lines.join('\n');
}
