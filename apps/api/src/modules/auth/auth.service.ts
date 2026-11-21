import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { UserModel } from "../users/user.model";

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key)))
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const MIN_PASSWORD_LENGTH = 8;

// Creates the first admin from env when no users exist (demo bootstrap).
export async function seedAdmin() {
  if ((await UserModel.estimatedDocumentCount()) > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the first admin.");
    return;
  }

  await UserModel.create({
    name: "Admin",
    email,
    passwordHash: await hashPassword(password),
    role: "admin"
  });
  console.log(`Seeded admin user ${email}`);
}
