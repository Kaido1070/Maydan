import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// نسخة الويب: داخل معاينة claude.ai نستخدم صلاحية التنزيل (downloads)،
// وفي المتصفح العادي نستخدم رابط تنزيل.

type Downloads = { save: (request: { filename: string; data: string | Blob }) => Promise<{ status: string }> };

async function downloadsCapability(): Promise<Downloads | null> {
  const claude = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  try {
    return (await claude.use('downloads')) as Downloads | null;
  } catch {
    return null;
  }
}

const MESSAGES: Record<string, string> = {
  rate_limited: 'فيه طلب حفظ مفتوح، انتظر لحظة وحاول مرة ثانية',
  too_large: 'الملف أكبر من المسموح',
};

async function saveFile(filename: string, data: string | Blob, mimeType: string) {
  const downloads = await downloadsCapability();
  if (downloads) {
    try {
      await downloads.save({ filename, data });
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'declined') return; // المستخدم ألغى الحفظ
      throw new Error(MESSAGES[code] ?? 'الحفظ غير متاح في هذه المعاينة');
    }
    return;
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType + ';charset=utf-8' }) : data;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareText(fileName: string, content: string, mimeType: string, _uti: string) {
  await saveFile(fileName, content, mimeType);
}

/** يرسم HTML التقرير في إطار مخفي ثم يحوله لصفحات PDF بمقاس A4 (يحافظ على تشكيل الحروف العربية). */
export async function buildPdf(html: string): Promise<Blob> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden';
  document.body.append(frame);
  try {
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve();
      frame.srcdoc = html;
    });
    const doc = frame.contentDocument!;
    await doc.fonts?.ready;
    const body = doc.body;
    body.style.background = '#ffffff';
    const canvas = await html2canvas(body, { scale: 2, backgroundColor: '#ffffff', windowWidth: 794, width: 794, height: body.scrollHeight });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pxPerPage = Math.floor((canvas.width * pageHeight) / pageWidth);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    for (let top = 0, page = 0; top < canvas.height; top += pxPerPage, page++) {
      const height = Math.min(pxPerPage, canvas.height - top);
      slice.height = height;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, height);
      ctx.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
      if (page) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, (height * pageWidth) / canvas.width);
    }
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}

export async function sharePdf(fileName: string, html: string) {
  await saveFile(fileName, await buildPdf(html), 'application/pdf');
}
