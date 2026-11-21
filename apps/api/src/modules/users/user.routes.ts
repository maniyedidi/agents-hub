import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { UserModel } from "./user.model";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../auth/auth.service";
import { requireAdmin } from "../auth/auth.hook";

const ROLES = ["admin", "user"];

export async function userRoutes(app: FastifyInstance) {
  // ---- Admin only: user management (registration lives here) ----
  app.post("/api/users", { preHandler: requireAdmin }, async (request, reply) => {
    const body = (request.body || {}) as any;

    if (!body.name || !body.email || typeof body.password !== "string" ||
        body.password.length < MIN_PASSWORD_LENGTH) {
      return reply.code(400).send({
        error: `name, email and a password of at least ${MIN_PASSWORD_LENGTH} characters are required`
      });
    }

    if (body.role !== undefined && !ROLES.includes(body.role)) {
      return reply.code(400).send({ error: "Invalid role" });
    }

    try {
      const user = await UserModel.create({
        name: body.name,
        email: body.email,
        role: body.role || "user",
        passwordHash: await hashPassword(body.password)
      });
      return reply.code(201).send(user);
    } catch (error: any) {
      if (error.code === 11000) {
        return reply.code(409).send({ error: "Email already registered" });
      }
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/api/users", { preHandler: requireAdmin }, async () =>
    UserModel.find().sort({ createdAt: -1 })
  );

  // Update name, role, active flag, or reset the password.
  app.patch("/api/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;

    if (!mongoose.isValidObjectId(id)) {
      return reply.code(400).send({ error: "Invalid user ID" });
    }

    const update: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();

    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) return reply.code(400).send({ error: "Invalid role" });
      update.role = body.role;
    }
    if (body.active !== undefined) update.active = Boolean(body.active);

    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
        });
      }
      update.passwordHash = await hashPassword(body.password);
    }

    // Prevent an admin from locking themselves out.
    if (id === request.user!.id && (update.role === "user" || update.active === false)) {
      return reply.code(400).send({ error: "You cannot demote or deactivate yourself" });
    }

    const user = await UserModel.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!user) return reply.code(404).send({ error: "User not found" });
    return user;
  });

  app.delete("/api/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!mongoose.isValidObjectId(id)) {
      return reply.code(400).send({ error: "Invalid user ID" });
    }
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You cannot delete yourself" });
    }

    const user = await UserModel.findByIdAndDelete(id);
    if (!user) return reply.code(404).send({ error: "User not found" });
    return { success: true };
  });
}
