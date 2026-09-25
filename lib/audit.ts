import { sql } from "./db"
import type { AuditAction } from "./types"

interface AuditLogParams {
  userId: string | null
  familyId?: string
  action: AuditAction
  targetType: string
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function logAuditEvent({
  userId,
  familyId,
  action,
  targetType,
  targetId,
  metadata,
  ipAddress,
  userAgent,
}: AuditLogParams) {
  try {
    await sql`
      INSERT INTO audit_logs (
        id, user_id, family_id, action, entity_type, entity_id,
        metadata, ip_address, user_agent, created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${familyId || null},
        ${action},
        ${targetType},
        ${targetId || null},
        ${metadata ? JSON.stringify(metadata) : null},
        ${ipAddress || null},
        ${userAgent || null},
        NOW()
      )
    `
  } catch (error) {
    console.error("Failed to create audit log:", error)
  }
}

export function getClientInfo(request: Request) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"

  const userAgent = request.headers.get("user-agent") || "unknown"

  return { ipAddress, userAgent }
}
