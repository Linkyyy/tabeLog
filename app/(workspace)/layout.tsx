import Diary from "@/components/Diary";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Diary />
      {children}
    </>
  );
}
