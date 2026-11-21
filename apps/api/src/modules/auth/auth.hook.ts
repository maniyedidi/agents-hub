import { FastifyReply, FastifyRequest } from "fastify";
import { UserModel } from "../users/user.model";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string; role: string };
  }
}

// Global gate: every /api route needs a valid token except login.
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split("?")[0];
  if (!path.startsWith("/api/") || path === "/api/auth/login") return;

  try {
    const payload = await request.jwtVerify<{ sub: string }>();
    const user = await UserModel.findById(payload.sub).lean();
    if (!user || !user.active) throw new Error("inactive");
    request.user = { id: String(user._id), email: user.email, role: user.role };
  } catch {
    return reply.code(401).send({ error: "Authentication required" });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.role !== "admin") {
    return reply.code(403).send({ error: "Admin access required" });
  }
}
