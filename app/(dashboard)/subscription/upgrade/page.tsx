'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useFamilies } from '@/hooks/use-family'
import { getAccessToken } from '@/hooks/use-events'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Check, 
  Crown,
  CreditCard,
  Shield,
  Sparkles,
  Clock,
  Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tiers = {
  PREMIUM: {
    name: 'Basic',
    description: 'Enhanced family features',
    features: [
      'Up to 5 children',
      'Advanced reminder settings',
      'Complex recurring events',
      '90 days history',
      'SMS notifications',
      'Priority support'
    ],
    price: { monthly: 3.99, annual: 39.90 }
  },
  PREMIUM_PLUS: {
    name: 'Premium',
    description: 'Full family safety suite',
    features: [
      'Unlimited children',
      'Real-time location sharing',
      'Geofence alerts',
      '1 year history',
      'Phone alert notifications',
      'Custom reminder times',
      'Family activity reports',
      '24/7 priority support'
    ],
    price: { monthly: 7.99, annual: 79.90 }
  }
}

// Next.js requires any component that calls useSearchParams() to be wrapped
// in a Suspense boundary, or the page fails to prerender at build time
// ("useSearchParams() should be wrapped in a suspense boundary").
export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <UpgradeForm />
    </Suspense>
  )
}

function UpgradeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTierParam = searchParams.get('tier')?.toUpperCase()
  
  // Map URL params to internal tier keys
  const getTierKey = (param: string | undefined | null): 'PREMIUM' | 'PREMIUM_PLUS' => {
    if (!param) return 'PREMIUM'
    if (param === 'PREMIUM_PLUS' || param === 'PREMIUM PLUS') return 'PREMIUM_PLUS'
    // PREMIUM or BASIC both map to the Basic plan (PREMIUM key)
    return 'PREMIUM'
  }
  
  const { user, isLoading: authLoading } = useAuth()
  const { families, isLoading: familiesLoading } = useFamilies()
  
  const [selectedTier, setSelectedTier] = useState<'PREMIUM' | 'PREMIUM_PLUS'>(getTierKey(rawTierParam))
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  // Payment form fields
  const [cardDetails, setCardDetails] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    billingAddress: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  })
  
  const primaryFamily = families?.[0]
  const tier = tiers[selectedTier] ?? tiers.PREMIUM
  
  // Safety check - if tier is somehow undefined, show loading state
  if (!tier) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8 text-muted-foreground" />
      </div>
    )
  }
  
  const price = billingCycle === 'annual' ? tier.price.annual : tier.price.monthly
  const monthlyEquivalent = billingCycle === 'annual' ? (tier.price.annual / 12).toFixed(2) : tier.price.monthly

  useEffect(() => {
    if (rawTierParam) {
      setSelectedTier(getTierKey(rawTierParam))
    }
  }, [rawTierParam])

  const handleSubmit = async () => {
    if (!primaryFamily?.id) {
      toast.error('No family found')
      return
    }

    // Validate card details
    if (!cardDetails.cardholderName.trim()) {
      toast.error('Please enter cardholder name')
      return
    }
    
    const cardNumber = cardDetails.cardNumber.replace(/\s/g, '')
    if (cardNumber.length < 15) {
      toast.error('Please enter a valid card number')
      return
    }
    
    if (!cardDetails.expiryMonth || !cardDetails.expiryYear) {
      toast.error('Please enter card expiry date')
      return
    }
    
    if (cardDetails.cvv.length < 3) {
      toast.error('Please enter a valid CVV')
      return
    }
    
    if (!cardDetails.billingAddress.trim() || !cardDetails.city.trim() || 
        !cardDetails.state.trim() || !cardDetails.zipCode.trim()) {
      toast.error('Please complete billing address')
      return
    }

    if (!agreedToTerms) {
      toast.error('Please agree to the terms and conditions')
      return
    }

    setIsSubmitting(true)

    try {
      const token = getAccessToken()
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          familyId: primaryFamily.id,
          tier: selectedTier,
          billingCycle,
          paymentMethod: 'pending_admin_processing',
          // Card details for admin to process via AMEX portal
          cardDetails: {
            cardholderName: cardDetails.cardholderName.trim(),
            cardNumberLast4: cardNumber.slice(-4),
            cardNumberEncrypted: btoa(cardNumber), // Base64 encode (in production, use proper encryption)
            expiryMonth: cardDetails.expiryMonth,
            expiryYear: cardDetails.expiryYear,
            cvvEncrypted: btoa(cardDetails.cvv), // Base64 encode (in production, use proper encryption)
            billingAddress: {
              street: cardDetails.billingAddress.trim(),
              city: cardDetails.city.trim(),
              state: cardDetails.state.trim(),
              zipCode: cardDetails.zipCode.trim(),
              country: cardDetails.country,
            }
          }
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Upgrade request submitted!')
        router.push('/subscription/confirmation?transactionId=' + data.transactionId)
      } else {
        toast.error(data.error || 'Failed to submit upgrade request')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || familiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/subscription">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Subscription
        </Link>
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4">
          <Crown className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Upgrade to {tier.name}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Unlock premium features and give your family the best protection
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left Column - Plan Selection & Payment */}
        <div className="lg:col-span-3 space-y-6">
          {/* Plan Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(tiers) as [keyof typeof tiers, typeof tiers.PREMIUM][]).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTier(key)}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      selectedTier === key 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{t.name}</span>
                      {selectedTier === key && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                    <p className="text-lg font-bold mt-2">
                      ${billingCycle === 'annual' ? (t.price.annual / 12).toFixed(2) : t.price.monthly}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Billing Cycle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Billing Cycle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    billingCycle === 'monthly' 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Monthly</span>
                    {billingCycle === 'monthly' && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-2xl font-bold">${tier.price.monthly}</p>
                  <p className="text-sm text-muted-foreground">Billed monthly</p>
                </button>
                
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all relative overflow-hidden",
                    billingCycle === 'annual' 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Badge className="absolute top-2 right-2 bg-green-500">Save 17%</Badge>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Annual</span>
                    {billingCycle === 'annual' && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-2xl font-bold">${tier.price.annual}</p>
                  <p className="text-sm text-muted-foreground">
                    ${(tier.price.annual / 12).toFixed(2)}/mo billed yearly
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </CardTitle>
              <CardDescription>
                Your payment will be processed securely by our admin team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cardholder Name */}
              <div className="space-y-2">
                <Label htmlFor="cardholderName">Cardholder Name</Label>
                <Input
                  id="cardholderName"
                  placeholder="Name on card"
                  value={cardDetails.cardholderName}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, cardholderName: e.target.value }))}
                />
              </div>

              {/* Card Number */}
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.cardNumber}
                  onChange={(e) => {
                    // Format card number with spaces
                    const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '')
                    const formatted = value.match(/.{1,4}/g)?.join(' ') || value
                    setCardDetails(prev => ({ ...prev, cardNumber: formatted.slice(0, 19) }))
                  }}
                  maxLength={19}
                />
              </div>

              {/* Expiry and CVV */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryMonth">Month</Label>
                  <Input
                    id="expiryMonth"
                    placeholder="MM"
                    value={cardDetails.expiryMonth}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 2)
                      setCardDetails(prev => ({ ...prev, expiryMonth: value }))
                    }}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryYear">Year</Label>
                  <Input
                    id="expiryYear"
                    placeholder="YY"
                    value={cardDetails.expiryYear}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 2)
                      setCardDetails(prev => ({ ...prev, expiryYear: value }))
                    }}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    type="password"
                    placeholder="123"
                    value={cardDetails.cvv}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setCardDetails(prev => ({ ...prev, cvv: value }))
                    }}
                    maxLength={4}
                  />
                </div>
              </div>

              <Separator />

              {/* Billing Address */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Billing Address</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="billingAddress" className="text-xs text-muted-foreground">Street Address</Label>
                  <Input
                    id="billingAddress"
                    placeholder="123 Main St"
                    value={cardDetails.billingAddress}
                    onChange={(e) => setCardDetails(prev => ({ ...prev, billingAddress: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-xs text-muted-foreground">City</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={cardDetails.city}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-xs text-muted-foreground">State</Label>
                    <Input
                      id="state"
                      placeholder="CA"
                      value={cardDetails.state}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="text-xs text-muted-foreground">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      placeholder="12345"
                      value={cardDetails.zipCode}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-xs text-muted-foreground">Country</Label>
                    <Input
                      id="country"
                      value={cardDetails.country}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, country: e.target.value }))}
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Payment will be processed securely after admin approval</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  I agree to the{' '}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-2">
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{tier.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {billingCycle === 'annual' ? 'Annual' : 'Monthly'} billing
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{tier.name} Plan</span>
                  <span>${price.toFixed(2)}</span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Annual discount</span>
                    <span>-${((tier.price.monthly * 12) - tier.price.annual).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${price.toFixed(2)}</span>
              </div>
              
              {billingCycle === 'annual' && (
                <p className="text-xs text-muted-foreground text-center">
                  That&apos;s just ${monthlyEquivalent}/month
                </p>
              )}

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={
                  isSubmitting || 
                  !agreedToTerms || 
                  !cardDetails.cardholderName.trim() ||
                  cardDetails.cardNumber.replace(/\s/g, '').length < 15 ||
                  !cardDetails.expiryMonth ||
                  !cardDetails.expiryYear ||
                  cardDetails.cvv.length < 3 ||
                  !cardDetails.billingAddress.trim() ||
                  !cardDetails.city.trim() ||
                  !cardDetails.state.trim() ||
                  !cardDetails.zipCode.trim()
                }
              >
                {isSubmitting ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Submit Upgrade Request
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>Secure payment processing</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-3 pt-0">
              <Separator />
              <div className="space-y-2 w-full">
                <p className="text-xs font-medium">What&apos;s included:</p>
                <ul className="space-y-1">
                  {tier.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
