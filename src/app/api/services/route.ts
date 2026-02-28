import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all services
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active')
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    
    if (active !== null) {
      where.active = active === 'true'
    }
    
    if (category) {
      where.category = category
    }

    const services = await db.service.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { appointments: true }
        }
      }
    })

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    )
  }
}

// POST - Create a new service
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, duration, price, category } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400 }
      )
    }

    const service = await db.service.create({
      data: {
        name,
        description,
        duration: duration || 30,
        price: price || 0,
        category,
        active: true
      }
    })

    return NextResponse.json({ service, success: true })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    )
  }
}

// PATCH - Update service
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const service = await db.service.update({
      where: { id },
      data
    })

    return NextResponse.json({ service, success: true })
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    )
  }
}
