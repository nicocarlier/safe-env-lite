class EnvValidationError extends Error {
    constructor(problems) {
        super(buildMessage(problems));
        this.problems = problems;
        // maintain proper prototype chain
        Object.setPrototypeOf(this, EnvValidationError.prototype);
    }
}
function buildMessage(problems) {
    const lines = ["❌ Invalid environment configuration:"];
    for (const p of problems) {
        const valPart = p.value !== undefined ? ` (value: "${p.value}")` : "";
        lines.push(`- ${p.key}: ${p.message}${valPart}`);
    }
    return lines.join("\n");
}
function normalizeDef(d) {
    if (Array.isArray(d)) {
        return { kind: "enum", values: d.map(String), required: true };
    }
    if (typeof d === "string") {
        return { kind: "primitive", type: d, required: true };
    }
    // long form - d is now LongDef (object type)
    const longDef = d;
    return {
        kind: "primitive",
        type: longDef.type,
        required: !!longDef.required || (longDef.default === undefined ? false : false), // we'll rely on default check at runtime
        default: longDef.default,
        nullable: !!longDef.nullable,
    };
}
function coerceValue(raw, def) {
    if (def.kind === "enum") {
        if (raw === undefined)
            return undefined;
        return raw;
    }
    // primitive
    if (raw === undefined) {
        return def.default === undefined ? undefined : def.default;
    }
    if (def.type === "string") {
        if (def.nullable && raw === "null")
            return null;
        return raw;
    }
    if (def.type === "number") {
        const n = Number(raw);
        return Number.isNaN(n) ? { __badNumber: raw } : n;
    }
    if (def.type === "boolean") {
        const lowered = raw.toLowerCase();
        if (["1", "true", "yes", "on"].includes(lowered))
            return true;
        if (["0", "false", "no", "off"].includes(lowered))
            return false;
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
export function createEnv(defs) {
    const problems = [];
    const result = {};
    for (const key of Object.keys(defs)) {
        const rawDef = defs[key];
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
        const hasDefault = normalized.default !== undefined;
        const provided = rawValue !== undefined || hasDefault || normalized.nullable;
        if (!provided && normalized.required) {
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
    return Object.freeze(result);
}
export { EnvValidationError };
