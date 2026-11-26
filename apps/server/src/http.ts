import type { IncomingMessage, ServerResponse } from "node:http";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface Ctx {
  req: IncomingMessage;
  params: Record<string, string>;
  body: any;
  userId?: string;
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
interface Route { method: string; parts: string[]; auth: boolean; handler: Handler }

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler, opts: { auth?: boolean } = {}) {
    this.routes.push({ method, parts: path.split("/").filter(Boolean), auth: opts.auth ?? true, handler });
    return this;
  }

  match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    const parts = path.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method || route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      route.parts.forEach((p, i) => {
        if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(parts[i]);
        else if (p !== parts[i]) ok = false;
      });
      if (ok) return { route, params };
    }
    return null;
  }
}

const MAX_BODY = 256 * 1024;

export async function readJson(req: IncomingMessage): Promise<any> {
  if (req.method === "GET" || req.method === "DELETE") return {};
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new ApiError(413, "too_large", "İstek çok büyük.");
    chunks.push(c as Buffer);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "bad_json", "İstek okunamadı.");
  }
}

export function send(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}
