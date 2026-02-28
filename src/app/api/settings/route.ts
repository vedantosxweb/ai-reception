/**
 * Settings API
 * Manages application settings and configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get all settings or by category
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const where = category ? { category } : {}

    const settings = await db.systemSetting.findMany({
      where,
      orderBy: { category: 'asc' },
    })

    // Convert to key-value object
    const settingsObj: Record<string, Record<string, string>> = {}
    settings.forEach(s => {
      if (!settingsObj[s.category]) {
        settingsObj[s.category] = {}
      }
      settingsObj[s.category][s.key] = s.value
    })

    return NextResponse.json({ settings: settingsObj })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// POST - Update settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { settings } = body // Array of { key, value, category }

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: 'Settings must be an array' },
        { status: 400 }
      )
    }

    // Upsert each setting
    for (const setting of settings) {
      await db.systemSetting.upsert({
        where: { key: setting.key },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category || 'general',
        },
        update: {
          value: setting.value,
          category: setting.category || 'general',
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
