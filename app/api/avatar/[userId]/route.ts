import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { sql } from "@/lib/db"

// Serve user avatars - publicly accessible for display in UI
// This endpoint doesn't require authentication since avatars are meant to be displayed
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    if (!userId) {
      return new NextResponse("User ID required", { status: 400 })
    }

    // Get the user's profile photo path from database
    const users = await sql`
      SELECT profile_photo_path FROM users WHERE id = ${userId}
    `

    if (users.length === 0 || !users[0].profile_photo_path) {
      // Return a placeholder or 404
      return new NextResponse("No avatar", { status: 404 })
    }

    const pathname = users[0].profile_photo_path

    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    })

    if (!result) {
      return new NextResponse("Not found", { status: 404 })
    }

    // Blob hasn't changed - tell browser to use cached copy
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          // "public" would let shared/CDN caches keep serving this response
          // under the stable /api/avatar/{userId} URL even after the user
          // uploads a new photo (the pathname/etag changes, but nothing
          // busts the old cached entry). Scope caching to the browser only,
          // per Vercel's private-blob-serving guidance, so a new upload is
          // reflected as soon as the browser revalidates.
          "Cache-Control": "private, no-cache",
        },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.error("Error serving avatar:", error)
    return new NextResponse("Failed to serve avatar", { status: 500 })
  }
}
