import { notFound } from "next/navigation";
import { assertConfig } from "@/lib/config";
import { publicMenu } from "@/lib/menu-service";
import { AppError } from "@/lib/validation";
import PublicMenu from "@/components/PublicMenu";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "扫码点餐 · tabeLog",
  referrer: "no-referrer" as const,
};
export default async function MenuPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  assertConfig();
  const { token } = await params;
  let data;
  try {
    data = await publicMenu(token);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  return <PublicMenu initialMenu={data.menu} token={token} />;
}
