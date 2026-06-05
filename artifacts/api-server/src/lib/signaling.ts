import type { Server, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { AUTH_COOKIE, verifyToken } from "./auth";
import { logger } from "./logger";

type Role = "user" | "interpreter";

interface Room {
  user?: WebSocket;
  interpreter?: WebSocket;
}

const rooms = new Map<string, Room>();

function peerOf(room: Room, role: Role): WebSocket | undefined {
  return role === "user" ? room.interpreter : room.user;
}

function cookieToken(req: IncomingMessage): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === AUTH_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

// Verifies that the authenticated user is allowed to join the room for this
// session in the requested role, and that the session is active.
async function authorize(
  req: IncomingMessage,
  sessionId: string,
  role: Role,
): Promise<boolean> {
  const token = cookieToken(req);
  if (!token) return false;
  const uid = verifyToken(token);
  if (uid == null) return false;

  const id = Number(sessionId);
  if (!Number.isInteger(id)) return false;

  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);
  if (!row) return false;
  if (row.status !== "active") return false;

  if (role === "user") return row.userId === uid;
  return row.interpreterId === uid;
}

// Ends a session whose peers have all disconnected without an explicit "end"
// (e.g. a browser tab was closed mid-call) and returns the assigned interpreter
// to "available". Guarded on status === "active" so a session that was already
// ended normally is left untouched and the interpreter is not double-processed.
async function endAbandonedSession(sessionId: string): Promise<void> {
  const id = Number(sessionId);
  if (!Number.isInteger(id)) return;
  try {
    const [ended] = await db
      .update(sessionsTable)
      .set({ status: "ended", endedAt: new Date() })
      .where(and(eq(sessionsTable.id, id), eq(sessionsTable.status, "active")))
      .returning();
    if (ended?.interpreterId != null) {
      await db
        .update(usersTable)
        .set({ status: "available" })
        .where(eq(usersTable.id, ended.interpreterId));
      logger.info({ sessionId: id }, "ended abandoned session, freed interpreter");
    }
  } catch (err) {
    logger.error({ err, sessionId: id }, "failed to end abandoned session");
  }
}

export function attachSignaling(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== "/api/ws") {
      return;
    }
    const sessionId = url.searchParams.get("sessionId");
    const role = url.searchParams.get("role") as Role | null;

    if (!sessionId || (role !== "user" && role !== "interpreter")) {
      socket.destroy();
      return;
    }

    void authorize(req, sessionId, role).then((ok) => {
      if (!ok) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, sessionId, role);
      });
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, sessionId: string, role: Role) => {
    let room = rooms.get(sessionId);
    if (!room) {
      room = {};
      rooms.set(sessionId, room);
    }
    room[role] = ws;

    logger.info({ sessionId, role }, "ws connected");

    // If both peers are present, tell both they are ready to negotiate.
    if (room.user && room.interpreter) {
      const readyMsg = JSON.stringify({ type: "ready" });
      room.user.send(readyMsg);
      room.interpreter.send(readyMsg);
    }

    ws.on("message", (data) => {
      const currentRoom = rooms.get(sessionId);
      if (!currentRoom) return;
      const peer = peerOf(currentRoom, role);
      if (peer && peer.readyState === WebSocket.OPEN) {
        peer.send(data.toString());
      }
    });

    ws.on("close", () => {
      const currentRoom = rooms.get(sessionId);
      if (!currentRoom) return;
      if (currentRoom[role] === ws) {
        delete currentRoom[role];
      }
      const peer = peerOf(currentRoom, role);
      if (peer && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify({ type: "peer-left" }));
      }
      if (!currentRoom.user && !currentRoom.interpreter) {
        rooms.delete(sessionId);
        // Both peers have left. If the session is still active this was an
        // abandoned call; end it so the assigned interpreter is freed instead
        // of remaining Busy forever.
        void endAbandonedSession(sessionId);
      }
      logger.info({ sessionId, role }, "ws disconnected");
    });
  });
}
