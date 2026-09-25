import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth"

// GET - Get user's favorites
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: error || "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get("type") // task, event, place, or null for all

    let favorites
    if (itemType) {
      favorites = await sql`
        SELECT * FROM user_favorites 
        WHERE user_id = ${user.id} AND item_type = ${itemType}
        ORDER BY created_at DESC
      `
    } else {
      favorites = await sql`
        SELECT * FROM user_favorites 
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `
    }

    // Fetch the actual items for each favorite
    const enrichedFavorites = await Promise.all(
      favorites.map(async (fav) => {
        let item = null
        if (fav.item_type === 'task') {
          const tasks = await sql`SELECT id, title, status, priority, due_date FROM tasks WHERE id = ${fav.item_id}`
          item = tasks[0] || null
        } else if (fav.item_type === 'event') {
          const events = await sql`SELECT id, title, start_time, end_time, event_type FROM events WHERE id = ${fav.item_id}`
          item = events[0] || null
        } else if (fav.item_type === 'place') {
          const places = await sql`SELECT id, name, address, icon, color FROM saved_places WHERE id = ${fav.item_id}`
          item = places[0] || null
        }
        return { ...fav, item }
      })
    )

    // Filter out favorites where the item no longer exists
    const validFavorites = enrichedFavorites.filter(f => f.item !== null)

    return NextResponse.json({
      success: true,
      data: validFavorites,
    })
  } catch (error) {
    console.error("Get favorites error:", error)
    return NextResponse.json({ success: false, error: "Failed to get favorites" }, { status: 500 })
  }
}

// POST - Add a favorite
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: error || "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { itemType, itemId } = body

    if (!itemType || !itemId) {
      return NextResponse.json({ success: false, error: "itemType and itemId are required" }, { status: 400 })
    }

    if (!['task', 'event', 'place'].includes(itemType)) {
      return NextResponse.json({ success: false, error: "Invalid item type" }, { status: 400 })
    }

    // Check if already favorited
    const existing = await sql`
      SELECT id FROM user_favorites 
      WHERE user_id = ${user.id} AND item_type = ${itemType} AND item_id = ${itemId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "Already favorited" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    await sql`
      INSERT INTO user_favorites (id, user_id, item_type, item_id, created_at)
      VALUES (${id}, ${user.id}, ${itemType}, ${itemId}, NOW())
    `

    return NextResponse.json({
      success: true,
      data: { id, itemType, itemId },
    })
  } catch (error) {
    console.error("Add favorite error:", error)
    return NextResponse.json({ success: false, error: "Failed to add favorite" }, { status: 500 })
  }
}

// DELETE - Remove a favorite
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: error || "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get("type")
    const itemId = searchParams.get("itemId")

    if (!itemType || !itemId) {
      return NextResponse.json({ success: false, error: "type and itemId are required" }, { status: 400 })
    }

    await sql`
      DELETE FROM user_favorites 
      WHERE user_id = ${user.id} AND item_type = ${itemType} AND item_id = ${itemId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove favorite error:", error)
    return NextResponse.json({ success: false, error: "Failed to remove favorite" }, { status: 500 })
  }
}
