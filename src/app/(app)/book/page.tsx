import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookViewer } from "./BookViewer";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const { page } = await searchParams;
  const [pdf, pageBookmarks] = await Promise.all([
    db.pdfFile.findUnique({ where: { userId: user.id } }),
    db.bookmark.findMany({ where: { userId: user.id, type: "PDF_PAGE" }, select: { ref: true } }),
  ]);
  const requested = Number(page);
  return (
    <BookViewer
      pdf={pdf ? { filename: pdf.filename, size: pdf.size, lastPage: pdf.lastPage } : null}
      initialPage={Number.isInteger(requested) && requested > 0 ? requested : (pdf?.lastPage ?? 1)}
      savedPages={pageBookmarks.map((b) => Number(b.ref))}
    />
  );
}
