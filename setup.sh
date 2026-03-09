#!/bin/bash
# =============================================================================
# AI Receptionist SaaS - Local Setup Script for macOS
# =============================================================================

set -e

echo ""
echo "=========================================="
echo "  AI Receptionist SaaS - Local Setup"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Install it from https://nodejs.org/ (v20+ required)"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js v18+ required (found v$(node -v))"
    exit 1
fi
echo "Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    exit 1
fi
echo "npm $(npm -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate

# Setup .env if not exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env from .env.example..."
    cp .env.example .env
    
    # Generate a random NEXTAUTH_SECRET
    SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|generate-a-64-char-hex-string-using-openssl-rand-hex-32|${SECRET}|" .env
    else
        sed -i "s|generate-a-64-char-hex-string-using-openssl-rand-hex-32|${SECRET}|" .env
    fi
    
    echo ""
    echo "=========================================="
    echo "  IMPORTANT: Configure your .env file"
    echo "=========================================="
    echo ""
    echo "At minimum, you need:"
    echo ""
    echo "  1. DATABASE_URL - PostgreSQL connection string"
    echo "     Options:"
    echo "       - Neon (free): https://neon.tech"
    echo "       - Supabase (free): https://supabase.com"
    echo "       - Local: postgresql://user:pass@localhost:5432/ai_receptionist"
    echo ""
    echo "  2. At least ONE LLM API key for AI features:"
    echo "       - OPENAI_API_KEY"
    echo "       - ANTHROPIC_API_KEY"
    echo "       - GEMINI_API_KEY"
    echo ""
    echo "  3. TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER"
    echo "     for voice/SMS (get a free trial at https://twilio.com)"
    echo ""
    echo "Edit .env now, then run:"
    echo "  npx prisma db push    # Create database tables"
    echo "  npm run dev            # Start dev server"
    echo ""
else
    echo ""
    echo ".env already exists, skipping..."
fi

# Push database schema if DATABASE_URL is set
if grep -q 'DATABASE_URL="postgresql://user:password' .env 2>/dev/null; then
    echo ""
    echo "WARNING: DATABASE_URL is still the default placeholder."
    echo "Edit .env with your real database URL, then run:"
    echo "  npx prisma db push"
    echo "  npm run dev"
    echo ""
else
    echo ""
    echo "Pushing database schema..."
    npx prisma db push --accept-data-loss 2>/dev/null && echo "Database schema synced!" || echo "WARNING: Could not push schema. Check your DATABASE_URL in .env"
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Commands:"
echo "  npm run dev           Start development server (http://localhost:3000)"
echo "  npm run build         Production build"
echo "  npm run start         Start production server"
echo "  npx prisma studio     Open database GUI"
echo "  npx prisma db push    Sync schema to database"
echo ""
echo "First visit: http://localhost:3000/signup to create an account"
echo ""
