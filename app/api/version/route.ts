import { NextResponse } from 'next/server'
import { gate } from '@/lib/http'

// Version réellement en ligne (commit GitHub déployé) : permet de vérifier qu'on regarde la bonne version.
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? 'development',
  })
}
