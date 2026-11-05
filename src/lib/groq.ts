import "server-only";
import Groq from "groq-sdk";

// Must not throw at import (next build imports every route): a placeholder
// key means calls fail at request time, where they're handled.
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "gsk_not_configured" });
