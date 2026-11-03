// Shared between the server (actions.ts) and the browser (ProjectBoard):
// a "use server" file may only export async functions, so a plain
// constant the client also needs has to live in its own module.
//
// Was 5 — confirmed wrong from a live Groq error: "Too many images
// provided. This model supports up to 3 images" (invalid_request_error),
// hit in production via the Projects board with a multi-page assignment.
// If the vision model changes, re-check the real cap from an actual error
// rather than trusting this number.
export const MAX_VISION_IMAGES = 3;
