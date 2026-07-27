/**
 * ============================================================
 *  01 — Tool Definition Schema
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  An LLM can only call a tool reliably if we give it a precise,
 *  machine-readable description of:
 *      1. the tool's name
 *      2. what it does (natural language, used for tool selection)
 *      3. its input parameters (types, required fields, enums)
 *      4. optionally: an output schema
 *
 *  The de-facto standard is a subset of JSON Schema, because that's
 *  what OpenAI, Anthropic, Google, and Mistral all consume.
 *
 *  KEY DECISIONS
 *  -------------
 *  - Do we validate arguments before executing?  → YES. Reject at
 *    the boundary. This is our OWASP "input validation" line.
 *  - Do we use `strict` mode?  → When available. It forces the model
 *    to emit only known keys, no extra fields. Cuts hallucination.
 *  - Do we store schemas next to the handler, or in a central file?
 *    → Co-located. A tool = schema + handler + metadata. Registry
 *    zips them together (see 06_registry.ts).
 */

// ------------------------------------------------------------
// A minimal JSON-Schema subset — enough for real agents.
// ------------------------------------------------------------

export type JsonSchemaType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array"
    | "null";

export interface JsonSchema {
    type: JsonSchemaType | JsonSchemaType[];
    description?: string;
    enum?: unknown[];
    // object
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean;
    // array
    items?: JsonSchema;
    minItems?: number;
    maxItems?: number;
    // string
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    // number
    minimum?: number;
    maximum?: number;
}

/**
 * The `ToolDefinition` is what we send to the LLM.  It intentionally
 * mirrors the OpenAI `tools[]` shape so the transport layer is trivial.
 */
export interface ToolDefinition {
    type: "function"; // future-proof: OpenAI already uses `type` discriminator
    function: {
        name: string;              // ^[a-zA-Z0-9_-]{1,64}$ per OpenAI
        description: string;        // WHY + WHEN to use it — the model reads this
        parameters: JsonSchema;     // MUST be an object schema at the top level
        strict?: boolean;           // OpenAI structured outputs
    };
}

// ------------------------------------------------------------
// Runtime validator — small, dependency-free.
// In prod you'd use ajv or zod, but writing it yourself
// makes the failure modes visible.
// ------------------------------------------------------------

export interface ValidationError {
    path: string;
    message: string;
}

export function validate(
    value: unknown,
    schema: JsonSchema,
    path = "$",
): ValidationError[] {
    const errors: ValidationError[] = [];

    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
        errors.push({
            path,
            message: `expected ${types.join("|")}, got ${jsType(value)}`,
        });
        return errors; // don't cascade after a type mismatch
    }

    if (schema.enum && !schema.enum.includes(value as never)) {
        errors.push({ path, message: `not in enum ${JSON.stringify(schema.enum)}` });
    }

    if (schema.type === "object" && isPlainObject(value)) {
        const obj = value as Record<string, unknown>;
        for (const key of schema.required ?? []) {
            if (!(key in obj)) {
                errors.push({ path: `${path}.${key}`, message: "required" });
            }
        }
        for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
            if (key in obj) {
                errors.push(...validate(obj[key], childSchema, `${path}.${key}`));
            }
        }
        if (schema.additionalProperties === false) {
            const allowed = new Set(Object.keys(schema.properties ?? {}));
            for (const key of Object.keys(obj)) {
                if (!allowed.has(key)) {
                    errors.push({
                        path: `${path}.${key}`,
                        message: "additional property not allowed",
                    });
                }
            }
        }
    }

    if (schema.type === "array" && Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            errors.push({ path, message: `minItems ${schema.minItems}` });
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errors.push({ path, message: `maxItems ${schema.maxItems}` });
        }
        if (schema.items) {
            value.forEach((item, i) => {
                errors.push(...validate(item, schema.items!, `${path}[${i}]`));
            });
        }
    }

    if (schema.type === "string" && typeof value === "string") {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push({ path, message: `minLength ${schema.minLength}` });
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push({ path, message: `maxLength ${schema.maxLength}` });
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
            errors.push({ path, message: `pattern ${schema.pattern}` });
        }
    }

    if (
        (schema.type === "number" || schema.type === "integer") &&
        typeof value === "number"
    ) {
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push({ path, message: `minimum ${schema.minimum}` });
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push({ path, message: `maximum ${schema.maximum}` });
        }
        if (schema.type === "integer" && !Number.isInteger(value)) {
            errors.push({ path, message: "must be integer" });
        }
    }

    return errors;
}

function matchesType(value: unknown, type: JsonSchemaType): boolean {
    switch (type) {
        case "string":  return typeof value === "string";
        case "number":  return typeof value === "number" && Number.isFinite(value);
        case "integer": return typeof value === "number" && Number.isInteger(value);
        case "boolean": return typeof value === "boolean";
        case "null":    return value === null;
        case "array":   return Array.isArray(value);
        case "object":  return isPlainObject(value);
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function jsType(v: unknown): string {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
}

// ------------------------------------------------------------
// Example tools — used across the rest of the module.
// ------------------------------------------------------------

export const getWeatherTool: ToolDefinition = {
    type: "function",
    function: {
        name: "get_weather",
        description:
            "Get the current weather for a city. Use when the user asks about temperature, " +
            "conditions, or whether it will rain. Do NOT use for weather forecasts >48h.",
        strict: true,
        parameters: {
            type: "object",
            additionalProperties: false,
            required: ["city"],
            properties: {
                city: {
                    type: "string",
                    description: "City name, e.g. 'San Francisco'",
                    minLength: 1,
                    maxLength: 64,
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    description: "Temperature unit. Default: celsius",
                },
            },
        },
    },
};

export const searchWebTool: ToolDefinition = {
    type: "function",
    function: {
        name: "search_web",
        description: "Search the public web. Use for recent facts the model can't know.",
        parameters: {
            type: "object",
            additionalProperties: false,
            required: ["query"],
            properties: {
                query: { type: "string", minLength: 1, maxLength: 256 },
                top_k: { type: "integer", minimum: 1, maximum: 10 },
            },
        },
    },
};

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const good = { city: "Seattle", unit: "celsius" };
    const bad  = { city: "",         unit: "kelvin", extra: 1 };

    console.log("valid args →", validate(good, getWeatherTool.function.parameters));
    console.log("bad args   →", validate(bad,  getWeatherTool.function.parameters));
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why JSON Schema and not TypeScript types directly?
 *     A: The LLM has no compiler. It only sees the schema at inference time.
 *        The schema is *data*, not code — it can be transmitted, versioned,
 *        and validated at runtime.
 *
 *  Q: What if a param is `Date`?  JSON Schema has no date type.
 *     A: Use `type: "string"` + `format: "date-time"` (RFC 3339). Parse in
 *        the handler.  Never let JSON Schema pretend it validated the value
 *        beyond what it actually did.
 *
 *  Q: Union types (oneOf)?
 *     A: Real JSON Schema supports `oneOf/anyOf`. Most LLMs *technically*
 *        support it but obey it much better if you flatten to enums or
 *        a discriminator field.
 *
 *  Q: How large can `description` be?
 *     A: Big — but every character consumes prompt tokens on EVERY turn.
 *        Keep it under ~200 tokens/tool. Move examples to a separate
 *        few-shot prompt if needed.
 */
