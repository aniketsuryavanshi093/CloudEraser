"use client";

import { useEffect, useState } from "react";
import { WhiteboardCanvas } from "@/components/whiteboard/WhiteboardCanvas";

export function RealtimeBoard({ boardId }: { boardId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/realtime-token")
      .then(async (response) => {
        const body = (await response.json()) as {
          token?: string;
          error?: string;
        };
        if (!response.ok || !body.token)
          throw new Error(body.error ?? "Unable to create realtime token");
        if (!cancelled) setToken(body.token);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "Unable to connect",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!token) return <p className="p-6 text-gray-500">Connecting to board…</p>;
  return <WhiteboardCanvas boardId={boardId} token={token} />;
}
