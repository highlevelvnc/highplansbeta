'use client'

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import LoginContent from './login-content'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
