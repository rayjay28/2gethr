import { neon } from "@neondatabase/serverless"

// Neon serverless SQL client for raw queries
export const sql = neon(process.env.DATABASE_URL!)

export default sql
