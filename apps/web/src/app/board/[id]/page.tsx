import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RealtimeBoard } from "./RealtimeBoard";

export default async function BoardPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
        <a href="/dashboard" className="font-semibold text-gray-900">
          Collaborative Whiteboard
        </a>
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </header>
      <RealtimeBoard boardId={params.id} />
    </main>
  );
}
