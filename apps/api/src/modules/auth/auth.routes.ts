import { FastifyInstance } from "fastify";
import { UserModel } from "../users/user.model";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./auth.service";

export async function authRoutes(app: FastifyInstance) {
  // ---- Public ----
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = (request.body || {}) as { email?: string; password?: string };

    if (typeof email !== "string" || typeof password !== "string") {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const user = await UserModel.findOne({ email: email.toLowerCase().trim() })
      .select("+passwordHash");

    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign(
      { sub: String(user._id), role: user.role },
      { expiresIn: "12h" }
    );

    return { token, user };
  });

  // ---- Any signed-in user ----
  app.get("/api/auth/me", async request => UserModel.findById(request.user!.id));

  app.post("/api/auth/change-password", async (request, reply) => {
    const { currentPassword, newPassword } = (request.body || {}) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (typeof currentPassword !== "string" || typeof newPassword !== "string" ||
        newPassword.length < MIN_PASSWORD_LENGTH) {
      return reply.code(400).send({
        error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`
      });
    }

    const user = await UserModel.findById(request.user!.id).select("+passwordHash");
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return reply.code(401).send({ error: "Current password is incorrect" });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return { success: true };
  });
}
