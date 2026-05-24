import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemService } from '@/services/files/filesystem.service';
import type { Note } from '@/types/db';

type PdfLine = {
  text: string;
  size: number;
  y: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const TITLE_SIZE = 24;
const BODY_SIZE = 12;
const TITLE_LINE_HEIGHT = 30;
const BODY_LINE_HEIGHT = 17;

function toPdfSafeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

function escapePdfString(value: string) {
  return toPdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function safePdfFileName(title: string, fallback = 'Untitled Note') {
  const safe = FileSystemService.safeFileName(toPdfSafeText(title.trim() || fallback));
  return `${safe || FileSystemService.safeFileName(fallback)}.pdf`;
}

function wrapLine(text: string, fontSize: number) {
  const availableWidth = PAGE_WIDTH - MARGIN * 2;
  const maxChars = Math.max(18, Math.floor(availableWidth / (fontSize * 0.52)));
  const words = toPdfSafeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function paginate(input: { title: string; body: string }) {
  const pages: PdfLine[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;

  function currentPage() {
    return pages[pages.length - 1];
  }

  function ensureRoom(lineHeight: number) {
    if (y - lineHeight < MARGIN) {
      pages.push([]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function addLine(text: string, size: number, lineHeight: number) {
    ensureRoom(lineHeight);
    currentPage().push({ text, size, y });
    y -= lineHeight;
  }

  for (const line of wrapLine(input.title || 'Untitled Document', TITLE_SIZE)) {
    addLine(line, TITLE_SIZE, TITLE_LINE_HEIGHT);
  }

  y -= 10;

  const paragraphs = (input.body?.trim() ? input.body : 'No content').replace(/\r\n/g, '\n').split('\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      y -= BODY_LINE_HEIGHT;
      continue;
    }
    for (const line of wrapLine(paragraph, BODY_SIZE)) {
      addLine(line, BODY_SIZE, BODY_LINE_HEIGHT);
    }
    y -= 4;
  }

  return pages;
}

function pageContent(lines: PdfLine[]) {
  const commands = lines.map(
    (line) => `/F1 ${line.size} Tf\n1 0 0 1 ${MARGIN} ${line.y} Tm\n(${escapePdfString(line.text)}) Tj`
  );
  return `BT\n${commands.join('\n')}\nET`;
}

function createPdf(input: { title: string; body: string }) {
  const pages = paginate(input);
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(''); // Pages object is filled after page objects are created.
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (const page of pages) {
    const content = pageContent(page);
    const contentObjectNumber = objects.length + 2;
    const pageObjectNumber = objects.length + 1;
    pageObjectNumbers.push(pageObjectNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  const infoObjectNumber = objects.length + 1;
  objects.push(
    `<< /Title (${escapePdfString(input.title || 'Untitled Document')}) /Producer (Ark) /Creator (Ark) >>`
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export class TextPdfService {
  static fileNameFor(title: string, fallback = 'Untitled Document') {
    return safePdfFileName(title, fallback);
  }

  static async export(input: { title: string; body: string; fallbackFileName?: string }) {
    await FileSystemService.ensureAppDirectories();
    const fileName = this.fileNameFor(input.title, input.fallbackFileName);
    const uri = `${FileSystemService.dir('cache')}${fileName}`;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    await FileSystem.writeAsStringAsync(uri, createPdf(input), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { uri, fileName };
  }
}

export class NotePdfService {
  static fileNameFor(note: Note) {
    return TextPdfService.fileNameFor(note.title, 'Untitled Note');
  }

  static async export(note: Note) {
    return TextPdfService.export({
      title: note.title || 'Untitled Note',
      body: note.body?.trim() ? note.body : 'No content',
      fallbackFileName: 'Untitled Note',
    });
  }
}
