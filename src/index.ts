export type PrimitiveType = "string" | "number" | "boolean";

export type ShortDef = PrimitiveType | readonly string[]; // "string" | ["one","two"]
export type LongDef = {
  type: PrimitiveType;
  required?: boolean;
  default?: string | number | boolean | null;
  nullable?: boolean; // allow explicit null (from env = "null")
  description?: string;
};
export type EnvDef = Record<string, ShortDef | LongDef>;

/* ---------- Type-level inference for consumers ---------- */

type IsTuple<T> = T extends readonly (infer _)[] ? true : false;
type HasDefault<D> = D extends { default: any } ? true : false;
type IsRequired<D> = D extends { required: true } ? true : false;

type InferPrimitive<T extends PrimitiveType> =
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "boolean" ? boolean :
  unknown;

type InferFromDef<D> =
  // enum shorthand: readonly string[]
  D extends readonly (infer U)[] ? U :
  // short primitive "string" | "number" | "boolean"
  D extends "string" ? string :
  D extends "number" ? number :
  D extends "boolean" ? boolean :
  // long form
  D extends { type: infer TT } ? (TT extends PrimitiveType ? InferPrimitive<TT> : unknown) :
  unknown;

type IsOptionalDef<D> =
  // tuple/enum shorthand treated as required by default (no undefined)
  D extends readonly any[] ? false :
  HasDefault<D> extends true ? false :
  IsRequired<D> extends true ? false :
  true;

export type InferEnv<T extends EnvDef> = {
  readonly [K in keyof T]:
    IsOptionalDef<T[K]> extends true ? (InferFromDef<T[K]> | undefined) : InferFromDef<T[K]>;
};

/* ---------- Runtime types & helpers ---------- */

type NormalizedDef =
  | { kind: "enum"; values: string[]; required: boolean }
  | { kind: "primitive"; type: PrimitiveType; required: boolean; default?: string | number | boolean | null; nullable?: boolean };

class EnvValidationError extends Error {
  public problems: { key: string; message: string; value?: string | undefined }[];
  constructor(problems: { key: string; message: string; value?: string }[]) {
    super(buildMessage(problems));
    this.problems = problems;
    // maintain proper prototype chain
    Object.setPrototypeOf(this, EnvValidationError.prototype);
  }
}

function buildMessage(problems: { key: string; message: string; value?: string }[]) {
  const lines = ["❌ Invalid environment configuration:"];
  for (const p of problems) {
    const valPart = p.value !== undefined ? ` (value: "${p.value}")` : "";
    lines.push(`- ${p.key}: ${p.message}${valPart}`);
  }
  return lines.join("\n");
}

function normalizeDef(d: ShortDef | LongDef): NormalizedDef {
  if (Array.isArray(d)) {
    return { kind: "enum", values: d.map(String), required: true };
  }
  if (typeof d === "string") {
    return { kind: "primitive", type: d as PrimitiveType, required: true };
  }
  // long form - d is now LongDef (object type)
  const longDef = d as LongDef;
  return {
    kind: "primitive",
    type: longDef.type,
    required: !!longDef.required || (longDef.default === undefined ? false : false), // we'll rely on default check at runtime
    default: longDef.default,
    nullable: !!longDef.nullable,
  };
}

function coerceValue(raw: string | undefined, def: NormalizedDef) {
  if (def.kind === "enum") {
    if (raw === undefined) return undefined;
    return raw;
  }
  // primitive
  if (raw === undefined) {
    return def.default === undefined ? undefined : def.default;
  }
  if (def.type === "string") {
    if (def.nullable && raw === "null") return null;
    return raw;
  }
  if (def.type === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? { __badNumber: raw } : n;
  }
  if (def.type === "boolean") {
    const lowered = raw.toLowerCase();
    if (["1", "true", "yes", "on"].includes(lowered)) return true;
    if (["0", "false", "no", "off"].includes(lowered)) return false;
    return { __badBoolean: raw };
  }
  return raw;
}

/* ---------- Public API ---------- */

/**
 * createEnv(defs)
 * - defs should be passed `as const` in TypeScript to preserve literal/enums inference.
 *
 * Throws EnvValidationError on problems.
 */
export function createEnv<T extends EnvDef>(defs: T): InferEnv<T> {
  const problems: { key: string; message: string; value?: string }[] = [];
  const result: Record<string, any> = {};

  for (const key of Object.keys(defs)) {
    const rawDef = (defs as any)[key] as ShortDef | LongDef;
    const normalized = normalizeDef(rawDef);
    const rawValue = process.env[key];

    if (normalized.kind === "enum") {
      if (rawValue === undefined) {
        problems.push({ key, message: `is missing (enum: allowed ${normalized.values.map(v => `"${v}"`).join(", ")})` });
        continue;
      }
      if (!normalized.values.includes(rawValue)) {
        problems.push({ key, message: `must be one of: ${normalized.values.join(", ")}`, value: rawValue });
        continue;
      }
      result[key] = rawValue;
      continue;
    }

    // primitive
    const coerced = coerceValue(rawValue, normalized);
    // handle coercion errors
    if (coerced && typeof coerced === "object" && "__badNumber" in coerced) {
      problems.push({ key, message: "is not a valid number", value: coerced.__badNumber });
      continue;
    }
    if (coerced && typeof coerced === "object" && "__badBoolean" in coerced) {
      problems.push({ key, message: "is not a valid boolean", value: coerced.__badBoolean });
      continue;
    }

    // presence checks
    const hasDefault = (normalized as any).default !== undefined;
    const provided = rawValue !== undefined || hasDefault || (normalized as any).nullable;

    if (!provided && (normalized as any).required) {
      problems.push({ key, message: "is required but missing" });
      continue;
    }

    // if it's undefined and not required and no default -> keep undefined
    result[key] = coerced;
  }

  if (problems.length > 0) {
    throw new EnvValidationError(problems);
  }

  // freeze result to prevent mutation
  return Object.freeze(result) as InferEnv<T>;
}

export { EnvValidationError };
