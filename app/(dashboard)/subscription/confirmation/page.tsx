'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  CheckCircle2,
  Clock,
  ArrowRight,
  Home
} from 'lucide-react'

// Next.js requires any component that calls useSearchParams() to be wrapped
// in a Suspense boundary, or the page fails to prerender at build time
// ("useSearchParams() should be wrapped in a suspense boundary").
export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationContent />
    </Suspense>
  )
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const transactionId = searchParams.get('transactionId')

  return (
    <div className="container max-w-2xl py-16">
      <Card className="text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Upgrade Request Submitted!</CardTitle>
          <CardDescription className="text-base">
            Thank you for choosing Togethr Premium
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 text-left space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">What happens next:</span>
            </div>
            <ol className="space-y-2 text-sm ml-6 list-decimal">
              <li>Our team will review your upgrade request</li>
              <li>You&apos;ll receive a payment link via email</li>
              <li>Once payment is confirmed, your premium features will be activated</li>
              <li>You&apos;ll receive a confirmation email with your receipt</li>
            </ol>
          </div>

          {transactionId && (
            <div className="p-3 rounded-lg bg-muted/30 text-sm">
              <span className="text-muted-foreground">Request ID: </span>
              <code className="font-mono">{transactionId}</code>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Processing typically takes 1-2 business days. If you have any questions,
            please contact our support team.
          </p>
        </CardContent>

        <CardFooter className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link href="/support">
              Contact Support
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
