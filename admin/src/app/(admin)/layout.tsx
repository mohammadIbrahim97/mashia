import { Sidebar } from '@/components/layout/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen min-h-[760px]">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-parchment">{children}</main>
    </div>
  );
}
