import { expectType } from "tsd";
import { createEnv } from "../src/index";

const defs = {
  PORT: { type: "number", default: 3000 },
  NODE_ENV: ["development", "test", "production"],
  DEBUG: { type: "boolean", default: false },
  OPTIONAL: { type: "string" } as const
} as const;

const env = createEnv(defs);

expectType<number>(env.PORT);
expectType<"development" | "test" | "production">(env.NODE_ENV);
expectType<boolean>(env.DEBUG);
expectType<string | undefined>(env.OPTIONAL);
