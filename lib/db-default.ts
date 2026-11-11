/**
 * Built-in database connection, used ONLY when the MONGODB_URI environment variable is not set.
 * Set MONGODB_URI (Vercel → Settings → Environment Variables) to override it without touching code.
 *
 * SECURITY: this file contains a live credential. Server code only (imported by lib/db.ts); never import it from a
 * "use client" file. Keep the GitHub repository PRIVATE, and rotate this password in Atlas if the repo is ever shared.
 */
export const DEFAULT_MONGODB_URI =
  "mongodb+srv://Kingboughzy15u_db_user:b8Muj5VOjHoxGREi@cluster0.5vmkgrg.mongodb.net/rivers10yaya?retryWrites=true&w=majority&appName=Cluster0";
