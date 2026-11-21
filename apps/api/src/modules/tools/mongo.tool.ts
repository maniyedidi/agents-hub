import mongoose from "mongoose";

const MAX_DB_LIMIT = 20;
const FORBIDDEN_OPERATORS = new Set(["$where", "$function", "$accumulator", "$expr"]);

function assertSafeQuery(value: unknown) {
    if (Array.isArray(value)) {
        value.forEach(assertSafeQuery);
    } else if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
            if (FORBIDDEN_OPERATORS.has(key)) {
                throw new Error(`Operator ${key} is not allowed`);
            }
            assertSafeQuery(nested);
        }
    }
}

export async function mongoFind(agent: any, args: any) {
    const allowed: string[] = agent.dbCollections || [];
    if (!allowed.includes(args.collection)) {
        throw new Error(
            `Collection not allowed. Allowed collections: ${allowed.join(", ") || "none"}`
        );
    }

    const filter = args.filter || {};
    assertSafeQuery(filter);
    assertSafeQuery(args.projection || {});

    const limit = Math.min(Math.max(Number(args.limit) || MAX_DB_LIMIT, 1), MAX_DB_LIMIT);
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database is not connected");

    return db
        .collection(args.collection)
        .find(filter, { projection: args.projection, maxTimeMS: 5000 })
        .sort(args.sort || {})
        .limit(limit)
        .toArray();
}
