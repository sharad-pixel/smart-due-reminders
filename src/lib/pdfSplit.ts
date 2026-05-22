import { PDFDocument } from "pdf-lib";

/**
 * Soft thresholds used across upload dialogs. The OCR fallback in the
 * live-contract-extract edge function caps scanned PDFs at 8 MB, so we
 * encourage users to split anything bigger (or anything past ~30 pages,
 * which keeps each AI extraction call inside the function's CPU budget).
 */
export const PDF_SOFT_MAX_BYTES = 8 * 1024 * 1024;
export const PDF_HARD_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_SOFT_MAX_PAGES = 30;
export const DEFAULT_SPLIT_PAGES = 15;

export interface PdfInfo {
  pageCount: number;
  bytes: number;
}

/** Returns page count + size for a PDF File. Throws if pdf-lib can't open it. */
export async function inspectPdf(file: File): Promise<PdfInfo> {
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return { pageCount: doc.getPageCount(), bytes: file.size };
}

/** True when the file is a PDF that exceeds either size or page thresholds. */
export function shouldRecommendSplit(file: File, info?: PdfInfo | null): boolean {
  if (!isPdf(file)) return false;
  if (file.size > PDF_SOFT_MAX_BYTES) return true;
  if (info && info.pageCount > PDF_SOFT_MAX_PAGES) return true;
  return false;
}

export function isPdf(file: File): boolean {
  const name = (file.name || "").toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

/**
 * Split a PDF File into N segments of `pagesPerSegment` pages each. The
 * returned Files use the original basename plus a `-part-N-of-M` suffix so
 * users can recognise the segments in the ingestion list.
 */
export async function splitPdfByPages(
  file: File,
  pagesPerSegment: number,
): Promise<File[]> {
  if (pagesPerSegment < 1) throw new Error("pagesPerSegment must be >= 1");
  const buf = await file.arrayBuffer();
  const source = await PDFDocument.load(buf, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  if (totalPages <= pagesPerSegment) return [file];

  const segments: File[] = [];
  const baseName = file.name.replace(/\.pdf$/i, "");
  const totalSegments = Math.ceil(totalPages / pagesPerSegment);

  for (let segIdx = 0; segIdx < totalSegments; segIdx += 1) {
    const start = segIdx * pagesPerSegment;
    const end = Math.min(start + pagesPerSegment, totalPages);
    const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);

    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, pageIndices);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const segName = `${baseName} - part ${segIdx + 1} of ${totalSegments}.pdf`;
    segments.push(new File([blob], segName, { type: "application/pdf" }));
  }

  return segments;
}
