export type PrimitiveType = "string" | "number" | "boolean";
export type ShortDef = PrimitiveType | readonly string[];
export type LongDef = {
    type: PrimitiveType;
    required?: boolean;
    default?: string | number | boolean | null;
    nullable?: boolean;
    description?: string;
};
export type EnvDef = Record<string, ShortDef | LongDef>;
type HasDefault<D> = D extends {
    default: any;
} ? true : false;
type IsRequired<D> = D extends {
    required: true;
} ? true : false;
type InferPrimitive<T extends PrimitiveType> = T extends "string" ? string : T extends "number" ? number : T extends "boolean" ? boolean : unknown;
type InferFromDef<D> = D extends readonly (infer U)[] ? U : D extends "string" ? string : D extends "number" ? number : D extends "boolean" ? boolean : D extends {
    type: infer TT;
} ? (TT extends PrimitiveType ? InferPrimitive<TT> : unknown) : unknown;
type IsOptionalDef<D> = D extends readonly any[] ? false : HasDefault<D> extends true ? false : IsRequired<D> extends true ? false : true;
export type InferEnv<T extends EnvDef> = {
    readonly [K in keyof T]: IsOptionalDef<T[K]> extends true ? (InferFromDef<T[K]> | undefined) : InferFromDef<T[K]>;
};
declare class EnvValidationError extends Error {
    problems: {
        key: string;
        message: string;
        value?: string | undefined;
    }[];
    constructor(problems: {
        key: string;
        message: string;
        value?: string;
    }[]);
}
/**
 * createEnv(defs)
 * - defs should be passed `as const` in TypeScript to preserve literal/enums inference.
 *
 * Throws EnvValidationError on problems.
 */
export declare function createEnv<T extends EnvDef>(defs: T): InferEnv<T>;
export { EnvValidationError };
