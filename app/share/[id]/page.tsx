import { notFound } from "next/navigation";
import Link from "next/link";
import { getEntry } from "@/lib/db";
import { assertConfig } from "@/lib/config";
import { RecipeContent } from "@/components/EntryPresentation";
export const dynamic = "force-dynamic";
export const metadata = { title: "美味分享 · tabeLog" };
export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  assertConfig();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const entry = await getEntry(id, null);
  if (!entry) notFound();
  return (
    <main className="shared-page">
      <header>
        <Link href="/" className="shared-brand">
          tabe<span>Log</span>
        </Link>
        <Link href="/">逛逛美味广场 ↗</Link>
      </header>
      <article className="shared-article">
        <span className="eyebrow">
          {entry.kind === "recipe"
            ? "FROM A LITTLE KITCHEN"
            : "A TASTE TO REMEMBER"}
        </span>
        <div className="shared-meta">
          {entry.kind === "recipe" ? "我的菜单" : "探店日记"} · {entry.cuisine}{" "}
          · 公开分享
        </div>
        <h1>{entry.name}</h1>
        <p className="shared-author">
          {entry.authorName} · {entry.visitedAt} · ★ {entry.rating.toFixed(1)}
        </p>
        {entry.photos.length > 0 && (
          <div className="shared-photos">
            {entry.photos.map((p, i) => (
              <img
                key={p.id}
                src={p.url}
                alt={`${entry.name}的照片 ${i + 1}`}
              />
            ))}
          </div>
        )}
        {entry.kind === "visit" && (
          <p className="shared-address">
            📍{" "}
            {entry.address ||
              `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`}
          </p>
        )}
        {entry.recipe && <RecipeContent entry={entry} />}
        <div className="detail-review">{entry.review}</div>
        <footer>
          一餐一记，一味一忆。<Link href="/">回到 tabeLog →</Link>
        </footer>
      </article>
    </main>
  );
}
