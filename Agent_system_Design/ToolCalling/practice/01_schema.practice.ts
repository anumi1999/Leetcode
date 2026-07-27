/**
 * ============================================================
 *  PRACTICE — 01 Tool Definition Schema
 * ============================================================
 *
 *  Rules:
 *    - Do NOT import from ../01_schema.ts. Rebuild from scratch.
 *    - Only peek at the reference file after you attempt each task.
 *    - Run with:  bun 01_schema.practice.ts
 *
 *  You should be able to finish tasks 1–4 in ~30 min after studying.
 *  Tasks 5–7 are stretch / interview-hard.
 * ============================================================
 */

// ------------------------------------------------------------
// TASK 1 — Types
// ------------------------------------------------------------
// Define:
//   type JsonSchemaType = ...        // 7 primitive kinds
//   interface JsonSchema { ... }     // supports: type (single OR array),
//                                    //           description, enum,
//                                    //           object: properties/required/additionalProperties,
//                                    //           array: items/minItems/maxItems,
//                                    //           string: minLength/maxLength/pattern,
//                                    //           number: minimum/maximum
//   interface ToolDefinition { ... } // OpenAI-shaped: {type:"function", function:{name,description,parameters,strict?}}
//
// Constraint: `parameters` MUST be typed as JsonSchema (top-level is object at runtime).

// TODO: your types here

export type JsonSchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";

export interface JsonSchema {
    type: JsonSchemaType | JsonSchemaType[];
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: JsonSchema | JsonSchema[],
    minItems?: number,
    maxItems?: number,
    minLength?: number,
    maxLength?: number,
    pattern?: string,
    minimum?: number,
    maximum?: number,
    enum?: unknown[],
}

interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: JsonSchema;
        strict?: boolean;
    };
}
// ------------------------------------------------------------
// TASK 2 — validate(value, schema, path?) : ValidationError[]
// ------------------------------------------------------------
// Requirements:
//   - Empty array = valid.
//   - Type mismatch: return ONE error, do not cascade further.
//   - Object: check `required`, recurse into `properties`,
//             reject unknown keys if additionalProperties === false.
//   - Array: minItems / maxItems / recurse via `items`.
//   - String: minLength / maxLength / pattern (RegExp).
//   - Number: minimum / maximum, and `integer` must be Number.isInteger.
//   - `enum`: value must be included.
//   - `path` starts at "$" and grows: "$.city", "$.tags[0]".
//
// Gotchas to think about:
//   - typeof NaN === "number" but you probably want to reject it.
//   - Arrays: typeof [] === "object"; distinguish with Array.isArray.
//   - null: typeof null === "object". Only valid if schema.type includes "null".

export interface ValidationError {
    path: string;
    message: string;
}

// TODO: implement
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
export function validate(value: unknown, schema: JsonSchema, path = "$"): ValidationError[] { 
    const error: ValidationError[] = [];
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(k => matchesType(value, k))) { error.push({ path, message: `Expected ${types.join(" | ")} but got ${typeof value}` }); return error; }


    switch (schema.type) {
        case "string":
            if (typeof value !== "string") {
                error.push({ path, message: `Expected string but got ${typeof value}` });
            } else {
                if (schema.minLength !== undefined && value.length < schema.minLength) {
                    error.push({ path, message: `String is shorter than minimum length ${schema.minLength}` });
                }
                if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                    error.push({ path, message: `String is longer than maximum length ${schema.maxLength}` });
                }
                if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
                    error.push({ path, message: `String does not match pattern ${schema.pattern}` });
                }
            }
            break;
        case "number":
            if( typeof value !== "number" || isNaN(value)) {
                error.push({ path, message: `Expected number but got ${typeof value}` });
            } else {
                if (schema.minimum !== undefined && value < schema.minimum) {
                    error.push({ path, message: `Number is less than minimum ${schema.minimum}` });
                }
                if (schema.maximum !== undefined && value > schema.maximum) {
                    error.push({ path, message: `Number is greater than maximum ${schema.maximum}` });
                }
            }
            break;
        case "integer":
            if (typeof value !== "number" || !Number.isInteger(value)) {
                error.push({ path, message: `Expected integer but got ${typeof value}` });
            }
            break;
        case "object":
            if (typeof value !== "object" || value === null || Array.isArray(value)) {
                error.push({ path, message: `Expected object but got ${typeof value}` });
            } else {
                if (schema.required) {
                    for (const req of schema.required) {
                        if (!(req in value)) {
                            error.push({ path, message: `Missing required property ${req}` });
                        }
                    }
                }
            }
            break;
        case "array":
            if (!Array.isArray(value)) {
                error.push({ path, message: `Expected array but got ${typeof value}` });
            } else {
                if (schema.minItems !== undefined && value.length < schema.minItems) {
                    error.push({ path, message: `Array has fewer items than minimum ${schema.minItems}` });
                }
                if (schema.maxItems !== undefined && value.length > schema.maxItems) {
                    error.push({ path, message: `Array has more items than maximum ${schema.maxItems}` });
                }
            }
            break;
        case "boolean":
            if (typeof value !== "boolean") {
                error.push({ path, message: `Expected boolean but got ${typeof value}` });
            }
            break;
        case "null":
            if (value !== null) {
                error.push({ path, message: `Expected null but got ${typeof value}` });
            }
            break;
    }
    if (schema.enum && !schema.enum.includes(value)) {
        error.push({ path, message: `Value is not in enum ${JSON.stringify(schema.enum)}` });
    }
    return error;
}


// ------------------------------------------------------------
// TASK 3 — Define two example tools
// ------------------------------------------------------------
// (a) get_weather(city: string, unit?: "celsius"|"fahrenheit")
//     - city required, minLength 1, maxLength 64
//     - unit is an enum
//     - additionalProperties: false, strict: true
//
// (b) search_web(query: string, top_k?: integer 1..10)
//     - query required, minLength 1, maxLength 256
//     - top_k optional integer with bounds

// TODO: export const getWeatherTool: ToolDefinition = { ... }
// TODO: export const searchWebTool: ToolDefinition = { ... }
export const searchWebTool: ToolDefinition = {
    type: "function",
    function: {
        name : 'search_web',
        description: 'Search on Web',
        strict: false,
        parameters:{
            type: 'object',
            required: ['query'],
            additionalProperties: false,
            properties: {
                query: {
                    minLength: 1,
                    maxLength: 256,
                    type: 'string'
                },
                top_k: {
                    type: "integer",
                    description: "Number of top results to return. Default: 5",
                    minimum: 1,
                    maximum: 10
                }
            }
        }
    }
}

export const getWeatherTool: ToolDefinition = {
    type: "function",
    function: {
        name : 'get_weather',
        description: 'Returns Weather of the city',
        strict: true,
        parameters:{
            type: 'object',
            required: ['city'],
            additionalProperties: false,
            properties: {
                city: {
                    minLength: 1,
                    maxLength: 64,
                    type: 'string'
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    description: "Temperature unit. Default: celsius",
                }
            }
        }
    }
}

// ------------------------------------------------------------
// TASK 4 — Self-test harness
// ------------------------------------------------------------
// Write cases[] and print pass/fail. Aim for coverage of every branch above.
// Below is a minimal starter; extend it.

interface Case {
    name: string;
    value: unknown;
    schema: unknown; // will be your JsonSchema at runtime
    expect: "valid" | "invalid";
    /** Optional substring that must appear somewhere in errors. */
    contains?: string;
}

const cases: Case[] = [
{ name: "primitive type mismatch",  value: 42, schema: {type:"string"} as JsonSchema, expect: "invalid", contains: "Expected" },
{ name: "null for object",          value: null, schema: {type:"object"} as JsonSchema, expect: "invalid" },
{ name: "missing required",         value: {}, schema: getWeatherTool.function.parameters, expect: "invalid", contains: "city" },
{ name: "nested wrong type",        value: {city: 42}, schema: getWeatherTool.function.parameters, expect: "invalid", contains: "Expected string" },
{ name: "additional prop",          value: {city:"SF", extra:1}, schema: getWeatherTool.function.parameters, expect: "invalid", contains: "additional" },
{ name: "enum miss",                value: {city:"SF", unit:"kelvin"}, schema: getWeatherTool.function.parameters, expect: "invalid", contains: "enum" },
{ name: "minLength",                value: {city:""}, schema: getWeatherTool.function.parameters, expect: "invalid", contains: "minimum length" },
{ name: "integer bounds",           value: {query:"x", top_k: 99}, schema: searchWebTool.function.parameters, expect: "invalid", contains: "maximum" },
{ name: "integer not integer",      value: {query:"x", top_k: 1.5}, schema: searchWebTool.function.parameters, expect: "invalid", contains: "integer" },
{ name: "clean valid",              value: {city:"SF", unit:"celsius"}, schema: getWeatherTool.function.parameters, expect: "valid" },
];

function runSelfTests() {
    let pass = 0;
    let fail = 0;
    for (const c of cases) {
        // @ts-expect-error until you implement validate()
        const errs = validate(c.value, c.schema);
        const ok =
            (c.expect === "valid" && errs.length === 0) ||
            (c.expect === "invalid" &&
                errs.length > 0 &&
                (!c.contains || JSON.stringify(errs).includes(c.contains)));
        if (ok) {
            pass++;
        } else {
            fail++;
            console.log("FAIL:", c.name, "→", errs);
        }
    }
    console.log(`\n${pass}/${pass + fail} passed`);
}


// ------------------------------------------------------------
// TASK 5 — Extension: `oneOf`
// ------------------------------------------------------------
// Add `oneOf?: JsonSchema[]` to JsonSchema. A value is valid iff it
// matches EXACTLY ONE subschema. Return errors from all failed branches
// only if none matched. Consider: how do you avoid combinatorial blow-up?


// ------------------------------------------------------------
// TASK 6 — Extension: `format`
// ------------------------------------------------------------
// Support format: "date-time" | "email" | "uuid" | "uri" for strings.
// Return path-scoped errors. Reject with a helpful message like
// `format date-time: not RFC3339`.


// ------------------------------------------------------------
// TASK 7 — Interview stretch
// ------------------------------------------------------------
// (a) Add `coerce` option: if the value is a string but the schema is
//     "number" or "boolean", attempt safe coercion. Explain in a comment
//     why an agent MIGHT want this (models sometimes emit "3" not 3)
//     and why it's DANGEROUS ("false" is truthy!).
// (b) Add `describeSchemaForModel(schema)` that returns a short natural
//     language description you could inject into a system prompt when
//     the model doesn't natively consume JSON Schema.
// (c) Explain (in a comment) how you'd handle recursive schemas
//     (e.g. `$ref: "#"`). Do NOT implement — just describe the cycle
//     detection strategy.


if (require.main === module) {
    runSelfTests();
}
