import { NextResponse } from 'next/server'
import { getAdminFromCookies, logoutAdmin, clearAdminAuthCookies } from '@/lib/admin-auth'

export async function POST() {
  try {
    const admin = await getAdminFromCookies()
    
    if (admin) {
      await logoutAdmin(admin.id)
    } else {
      await clearAdminAuthCookies()
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin logout error:', error)
    await clearAdminAuthCookies()
    return NextResponse.json({ success: true })
  }
}
