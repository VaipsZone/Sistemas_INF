import { betterAuth } from "better-auth";
import db from "../database/db.js";

export const auth = betterAuth({
    database: db.pool,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "client",
                input: false,
            },
        },
    },
});