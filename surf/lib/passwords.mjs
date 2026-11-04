import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

const legacyVersion = "msp-scrypt-v1";
const currentVersion = "msp-scrypt-v2";
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 256;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const PASSWORD_SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 5,
  maxmem: 64 * 1024 * 1024,
};

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function normalizePhone(phone) {
  return typeof phone === "string" ? phone.trim() : "";
}

export function validatePassword(password) {
  if (typeof password !== "string") return "Password is required";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`;
  }
  return "";
}

export async function hashPassword(password) {
  const validationError = validatePassword(password);
  if (validationError) {
    const err = new Error(validationError);
    err.statusCode = 400;
    throw err;
  }

  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await scryptAsync(
    password,
    salt,
    PASSWORD_KEY_BYTES,
    PASSWORD_SCRYPT_OPTIONS,
  );

  return [
    currentVersion,
    PASSWORD_SCRYPT_OPTIONS.N,
    PASSWORD_SCRYPT_OPTIONS.r,
    PASSWORD_SCRYPT_OPTIONS.p,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password, passwordHash) {
  if (typeof password !== "string" || typeof passwordHash !== "string")
    return false;

  const [version, n, r, p, saltValue, hashValue, extra] = passwordHash.split("$");
  const legacy = version === legacyVersion;
  if (extra !== undefined || (!legacy && version !== currentVersion) ||
      n !== "16384" || r !== "8" || p !== (legacy ? "1" : "5") ||
      !/^[A-Za-z0-9_-]{22}$/.test(saltValue || "") ||
      !/^[A-Za-z0-9_-]{86}$/.test(hashValue || "")) return false;

  const expected = Buffer.from(hashValue, "base64url");
  if (expected.length !== PASSWORD_KEY_BYTES) return false;

  try {
    const actual = await scryptAsync(
      password,
      Buffer.from(saltValue, "base64url"),
      expected.length,
      {
        ...PASSWORD_SCRYPT_OPTIONS,
        p: legacy ? 1 : PASSWORD_SCRYPT_OPTIONS.p,
      },
    );
    if (legacy) await scryptAsync(password, Buffer.from(saltValue, "base64url"), PASSWORD_KEY_BYTES,
      { ...PASSWORD_SCRYPT_OPTIONS, p: 4 });
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(actual), expected)
    );
  } catch {
    return false;
  }
}
