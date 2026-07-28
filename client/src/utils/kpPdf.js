import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Рендер DOM-элемента в многостраничный A4 PDF и скачивание файла.
 */
export async function downloadElementAsPdf(element, filename = 'document.pdf') {
  if (!element) throw new Error('Нет содержимого для PDF');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#F6F3EC',
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: Math.max(element.scrollWidth, 794),
    windowHeight: Math.max(element.scrollHeight, 1123),
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pxPerMm = canvas.width / pageWidth;
  const pageHeightPx = Math.floor(pageHeight * pxPerMm);

  const pageCanvas = document.createElement('canvas');
  const pageCtx = pageCanvas.getContext('2d');

  let y = 0;
  let pageIndex = 0;
  while (y < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    pageCtx.fillStyle = '#F6F3EC';
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageCtx.drawImage(
      canvas,
      0, y, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight,
    );

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.93);
    if (pageIndex > 0) pdf.addPage();
    const sliceHmm = (sliceHeight * pageWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, sliceHmm);

    y += sliceHeight;
    pageIndex += 1;
  }

  pdf.save(filename);
}

function waitForDocumentReady(doc) {
  const images = [...doc.images];
  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }),
  ).then(() => new Promise((r) => setTimeout(r, 250)));
}

/**
 * Рендер HTML-строки КП в скрытом iframe → скачать PDF.
 */
export async function downloadHtmlAsPdf(html, filename) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;',
  );
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();

    await waitForDocumentReady(doc);

    const toolbar = doc.querySelector('.kp-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    const sheet = doc.querySelector('.sheet');
    if (!sheet) throw new Error('Не найден лист КП');

    // html2canvas лучше рендерит без тени/скролла
    sheet.style.margin = '0';
    sheet.style.boxShadow = 'none';

    await downloadElementAsPdf(sheet, filename);
    return true;
  } finally {
    iframe.remove();
  }
}
