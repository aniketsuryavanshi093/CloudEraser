"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Canvas, Circle, IText, Line, PencilBrush, Rect, util } from "fabric";
import {
  BoardSocket,
  BoardSnapshot,
  DrawOperation,
  Tool,
  PresenceUser,
} from "@/types/ConstantTypes";

function serialize(object: any) {
  return object.toObject(["id"]);
}
function objectMap(canvas: Canvas): Record<string, any> {
  return Object.fromEntries(
    canvas
      .getObjects()
      .map((object, index) => [
        String(object.get("id") ?? index),
        serialize(object),
      ]),
  );
}

export function WhiteboardCanvas({
  boardId,
  token,
}: {
  boardId: string;
  token: string;
}) {
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<BoardSocket | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const applyingRemote = useRef(false);
  const version = useRef<number | null>(null);
  const previousObjects = useRef<Record<string, any>>({});
  const pending = useRef<DrawOperation[]>([]);
  const sending = useRef(false);
  const resyncing = useRef(false);
  const lastCursorSent = useRef(0);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef<Tool>("pencil");
  const colorRef = useRef("#2563eb");
  const widthRef = useRef(3);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#2563eb");
  const [width, setWidth] = useState(3);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!canvasElement.current) return;
    const canvas = new Canvas(canvasElement.current, {
      backgroundColor: "#ffffff",
      isDrawingMode: true,
      selection: true,
    });
    canvas.setDimensions({
      width: window.innerWidth,
      height: window.innerHeight - 112,
    });
    canvasRef.current = canvas;
    const socket = io(
      process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000",
      { auth: { token } },
    );
    socketRef.current = socket;

    const setMode = () => {
      canvas.isDrawingMode = toolRef.current === "pencil";
      canvas.selection = toolRef.current === "select";
      canvas.forEachObject((object) => {
        object.selectable = toolRef.current === "select";
      });
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = colorRef.current;
        canvas.freeDrawingBrush.width = widthRef.current;
      }
    };
    const rebuild = async (data: BoardSnapshot) => {
      applyingRemote.current = true;
      canvas.clear();
      const objects = await util.enlivenObjects(
        Object.values(data.objects ?? {}),
      );
      objects.forEach((object) => {
        if ("type" in object)
          canvas.add(object as Parameters<Canvas["add"]>[0]);
      });
      canvas.backgroundColor = data.background ?? "#ffffff";
      canvas.renderAll();
      previousObjects.current = objectMap(canvas);
      applyingRemote.current = false;
      setMode();
    };
    const applyOp = async (operation: DrawOperation) => {
      const item = operation.payload[0];
      if (!item?.p || item.p[0] !== "objects") return;
      const id = String(item.p[1]);
      applyingRemote.current = true;
      const existing = canvas
        .getObjects()
        .find((object) => String(object.get("id")) === id);
      if (item.od === undefined && item.oi !== undefined) {
        if (existing) canvas.remove(existing);
        const [object] = await util.enlivenObjects([item.oi]);
        if (object && "type" in object && "set" in object) {
          (object as any).set("id", id);
          canvas.add(object as Parameters<Canvas["add"]>[0]);
        }
      } else if (item.oi === undefined && item.od !== undefined) {
        if (existing) canvas.remove(existing);
      } else if (item.oi !== undefined) {
        if (existing) canvas.remove(existing);
        const [object] = await util.enlivenObjects([item.oi]);
        if (object && "type" in object && "set" in object) {
          (object as any).set("id", id);
          canvas.add(object as Parameters<Canvas["add"]>[0]);
        }
      }
      canvas.renderAll();
      previousObjects.current = objectMap(canvas);
      applyingRemote.current = false;
    };
    const requestResync = () => {
      if (resyncing.current || !socket.connected) return;
      resyncing.current = true;
      pending.current = [];
      sending.current = false;
      socket.emit(
        "resync-board",
        { boardId },
        (response: { ok: boolean; error?: string }) => {
          resyncing.current = false;
          if (!response.ok)
            setError(response.error ?? "Unable to resynchronize board");
        },
      );
    };
    const flush = () => {
      if (
        resyncing.current ||
        sending.current ||
        !pending.current.length ||
        !socket.connected
      )
        return;
      sending.current = true;
      const operation = pending.current[0];
      socket.emit(
        "draw-op",
        operation,
        (response: { ok: boolean; error?: string }) => {
          sending.current = false;
          if (!response.ok) {
            setError(response.error ?? "Operation rejected");
            pending.current.shift();
          } else pending.current.shift();
          flush();
        },
      );
    };
    const enqueue = (payload: any[]) => {
      if (applyingRemote.current) return;
      pending.current.push({
        id: crypto.randomUUID(),
        type: "canvas-op",
        payload,
        version: version.current ?? undefined,
      });
      previousObjects.current = objectMap(canvas);
      flush();
    };
    const onObjectAdded = (event: any) => {
      if (applyingRemote.current || !event.target) return;
      const object = event.target;
      if (!object.get("id")) object.set("id", crypto.randomUUID());
      enqueue([
        { p: ["objects", String(object.get("id"))], oi: serialize(object) },
      ]);
    };
    const onObjectModified = (event: any) => {
      if (applyingRemote.current || !event.target) return;
      const object = event.target;
      const id = String(object.get("id") ?? crypto.randomUUID());
      object.set("id", id);
      enqueue([
        {
          p: ["objects", id],
          oi: serialize(object),
          od: previousObjects.current[id],
        },
      ]);
    };
    const onObjectRemoved = (event: any) => {
      if (applyingRemote.current || !event.target) return;
      const object = event.target;
      const id = String(object.get("id"));
      if (id && previousObjects.current[id])
        enqueue([{ p: ["objects", id], od: previousObjects.current[id] }]);
    };
    const onMouseDown = (event: any) => {
      if (
        !["rectangle", "circle", "line", "text"].includes(toolRef.current) ||
        !event.pointer
      )
        return;
      if (toolRef.current === "text") {
        const text = new IText("Type here", {
          left: event.pointer.x,
          top: event.pointer.y,
          fill: colorRef.current,
          fontSize: 24,
        });
        text.set("id", crypto.randomUUID());
        canvas.add(text);
        canvas.setActiveObject(text);
        setTool("select");
        return;
      }
      drawing.current = event.pointer;
    };
    const onMouseUp = (event: any) => {
      const start = drawing.current;
      const end = event.pointer;
      drawing.current = null;
      if (!start || !end) return;
      const common = {
        stroke: colorRef.current,
        strokeWidth: widthRef.current,
        fill:
          toolRef.current === "rectangle" || toolRef.current === "circle"
            ? `${colorRef.current}22`
            : undefined,
      };
      let object: any;
      if (toolRef.current === "rectangle")
        object = new Rect({
          left: Math.min(start.x, end.x),
          top: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
          ...common,
        });
      if (toolRef.current === "circle")
        object = new Circle({
          left: Math.min(start.x, end.x),
          top: Math.min(start.y, end.y),
          radius: Math.hypot(end.x - start.x, end.y - start.y) / 2,
          ...common,
        });
      if (toolRef.current === "line")
        object = new Line([start.x, start.y, end.x, end.y], common);
      if (object) {
        object.set("id", crypto.randomUUID());
        canvas.add(object);
        setTool("select");
      }
    };
    socket.on("connect", () => {
      setConnected(true);
      socket.emit(
        "join-board",
        { boardId },
        (response: { ok: boolean; error?: string }) => {
          if (!response.ok) setError(response.error ?? "Unable to join board");
        },
      );
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setError("Realtime connection failed"));
    socket.on("board-snapshot", ({ data, version: incoming }) => {
      version.current = incoming;
      void rebuild(data).finally(() => {
        resyncing.current = false;
        flush();
      });
    });
    socket.on("draw-op", ({ operation, userId, version: incoming }) => {
      if (
        incoming !== null &&
        version.current !== null &&
        incoming !== version.current + 1
      ) {
        requestResync();
        return;
      }
      version.current = incoming;
      if (userId !== undefined && userId === "self") return;
      void applyOp(operation);
    });
    socket.on("presence", ({ users: next }) => setUsers(next));
    socket.on("user-joined", (user) =>
      setUsers((current) =>
        current.some((item) => item.userId === user.userId)
          ? current
          : [...current, user],
      ),
    );
    socket.on("user-left", ({ userId }) => {
      setUsers((current) => current.filter((user) => user.userId !== userId));
      setCursors((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    });
    canvas.on("mouse:move", (event: any) => {
      if (!event.pointer) return;
      const now = Date.now();
      if (now - lastCursorSent.current < 50) return;
      lastCursorSent.current = now;
      socket.emit("cursor-move", event.pointer);
    });
    socket.on("cursor-move", ({ userId, x, y }) =>
      setCursors((current) => ({ ...current, [userId]: { x, y } })),
    );
    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:up", onMouseUp);
    canvas.on("object:added", onObjectAdded);
    canvas.on("object:modified", onObjectModified);
    canvas.on("object:removed", onObjectRemoved);
    setMode();
    return () => {
      canvas.dispose();
      socket.disconnect();
      canvasRef.current = null;
      socketRef.current = null;
    };
  }, [boardId, token]);

  const chooseTool = (next: Tool) => {
    setTool(next);
    toolRef.current = next;
  };
  return (
    <div className="relative h-[calc(100vh-112px)] w-full overflow-hidden bg-white">
      <div className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white p-2 shadow-sm">
        {(
          ["select", "pencil", "rectangle", "circle", "line", "text"] as Tool[]
        ).map((item) => (
          <button
            key={item}
            onClick={() => chooseTool(item)}
            className={`rounded px-3 py-1 text-sm ${tool === item ? "bg-indigo-600 text-white" : "border bg-white"}`}
          >
            {item}
          </button>
        ))}
        <label className="ml-2 text-sm">
          Color{" "}
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
        <label className="text-sm">
          Stroke{" "}
          <input
            className="w-16"
            type="number"
            min="1"
            max="30"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <span
          className={
            connected
              ? "ml-auto text-xs text-green-600"
              : "ml-auto text-xs text-gray-500"
          }
        >
          {connected ? "Connected" : "Connecting…"}
        </span>
        <details className="relative">
          <summary className="cursor-pointer text-sm">
            Users ({users.length})
          </summary>
          <div className="absolute right-0 top-7 z-20 w-48 rounded border bg-white p-2 shadow">
            {users.map((user) => (
              <div key={user.userId} className="truncate py-1 text-sm">
                ● {user.email ?? user.userId}
              </div>
            ))}
          </div>
        </details>
      </div>
      <canvas ref={canvasElement} />
      {Object.entries(cursors).map(([userId, position]) => (
        <div
          key={userId}
          className="pointer-events-none absolute h-3 w-3 rounded-full bg-pink-500"
          style={{ left: position.x, top: position.y + 48 }}
          title={userId}
        />
      ))}
      {error && (
        <div className="absolute bottom-4 left-4 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
