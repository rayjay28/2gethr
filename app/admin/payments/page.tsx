'use client'

import { useState, useEffect } from 'react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { getAdminAccessToken } from '@/lib/admin-auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  User,
  Calendar,
  MapPin,
  Send
} from 'lucide-react'

interface PaymentTransaction {
  id: string
  subscription_id: string
  amount: number
  currency: string
  status: string
  description: string
  stripe_payment_id: string | null
  metadata: {
    tier?: string
    billingCycle?: string
    cardDetails?: {
      cardholderName: string
      cardNumberLast4: string
      cardType: string
      expiryMonth: string
      expiryYear: string
    }
    billingAddress?: {
      line1: string
      line2?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    familyId?: string
    userId?: string
  }
  created_at: string
  user?: {
    id: string
    email: string
    first_name: string
    last_name: string
  }
  family?: {
    id: string
    name: string
  }
}

interface PaymentGateway {
  id: string
  provider: string
  display_name: string
  is_active: boolean
  merchant_id: string
  api_endpoint?: string
}

export default function AdminPaymentsPage() {
  const { admin } = useAdminAuth()
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [gateways, setGateways] = useState<PaymentGateway[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transactionRef, setTransactionRef] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [activeTab, setActiveTab] = useState('pending')

  const loadData = async () => {
    setLoading(true)
    try {
      const token = getAdminAccessToken()
      
      // Load transactions
      const txRes = await fetch('/api/admin/payments', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (txRes.ok) {
        const data = await txRes.json()
        setTransactions(data.data || [])
      }

      // Load payment gateways
      const gwRes = await fetch('/api/admin/payment-gateway', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (gwRes.ok) {
        const data = await gwRes.json()
        setGateways(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load payment data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const activeGateway = gateways.find(g => g.is_active && g.provider === 'amex')

  const handleProcessPayment = async (action: 'approve' | 'reject') => {
    if (!selectedTransaction) return
    
    if (action === 'approve' && !transactionRef.trim()) {
      toast.error('Please enter the AMEX transaction reference')
      return
    }
    
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    setProcessing(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/payments/${selectedTransaction.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action,
          transactionRef: transactionRef.trim(),
          rejectionReason: rejectionReason.trim(),
          gateway: 'amex'
        }),
      })

      const data = await res.json()
      
      if (res.ok) {
        toast.success(action === 'approve' ? 'Payment approved and subscription activated' : 'Payment rejected')
        setShowDetailDialog(false)
        setSelectedTransaction(null)
        setTransactionRef('')
        setRejectionReason('')
        loadData()
      } else {
        toast.error(data.error || 'Failed to process payment')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setProcessing(false)
    }
  }

  const pendingTransactions = transactions.filter(t => t.status === 'PENDING')
  const completedTransactions = transactions.filter(t => t.status === 'COMPLETED')
  const failedTransactions = transactions.filter(t => t.status === 'FAILED')

  const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0)

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'COMPLETED':
        return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Processing</h1>
          <p className="text-muted-foreground">Process subscription payments via AMEX merchant portal</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Gateway Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AMEX Gateway Status</CardTitle>
        </CardHeader>
        <CardContent>
          {activeGateway ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">AMEX</span>
                </div>
                <div>
                  <p className="font-medium">{activeGateway.display_name}</p>
                  <p className="text-sm text-muted-foreground">Merchant ID: {activeGateway.merchant_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://merchant.americanexpress.com" target="_blank" rel="noopener noreferrer">
                    Open AMEX Portal <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">No Gateway Connected</p>
                  <p className="text-sm text-muted-foreground">Connect AMEX in Settings to process payments</p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <a href="/admin/settings">Configure Gateway</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTransactions.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedTransactions.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{failedTransactions.length}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="failed" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Failed
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <TransactionList 
            transactions={pendingTransactions} 
            onSelect={(t) => { setSelectedTransaction(t); setShowDetailDialog(true); }}
            statusBadge={statusBadge}
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <TransactionList 
            transactions={completedTransactions}
            onSelect={(t) => { setSelectedTransaction(t); setShowDetailDialog(true); }}
            statusBadge={statusBadge}
          />
        </TabsContent>
        <TabsContent value="failed" className="mt-4">
          <TransactionList 
            transactions={failedTransactions}
            onSelect={(t) => { setSelectedTransaction(t); setShowDetailDialog(true); }}
            statusBadge={statusBadge}
          />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <TransactionList 
            transactions={transactions}
            onSelect={(t) => { setSelectedTransaction(t); setShowDetailDialog(true); }}
            statusBadge={statusBadge}
          />
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTransaction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Payment Details
                  {statusBadge(selectedTransaction.status)}
                </DialogTitle>
                <DialogDescription>
                  Transaction ID: {selectedTransaction.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Amount */}
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-3xl font-bold">${(selectedTransaction.amount / 100).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTransaction.metadata?.tier} - {selectedTransaction.metadata?.billingCycle}
                  </p>
                </div>

                {/* Customer Info */}
                {selectedTransaction.user && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </h4>
                    <div className="p-3 border rounded-lg space-y-1">
                      <p className="font-medium">{selectedTransaction.user.first_name} {selectedTransaction.user.last_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedTransaction.user.email}</p>
                    </div>
                  </div>
                )}

                {/* Card Details - For AMEX Processing */}
                {selectedTransaction.metadata?.cardDetails && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Card Information (for AMEX Portal)
                    </h4>
                    <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Cardholder Name</p>
                          <p className="font-medium">{selectedTransaction.metadata.cardDetails.cardholderName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Card Number</p>
                          <p className="font-medium font-mono">**** **** **** {selectedTransaction.metadata.cardDetails.cardNumberLast4}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Card Type</p>
                          <p className="font-medium uppercase">{selectedTransaction.metadata.cardDetails.cardType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expiry</p>
                          <p className="font-medium">{selectedTransaction.metadata.cardDetails.expiryMonth}/{selectedTransaction.metadata.cardDetails.expiryYear}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Use these details to process the payment in your AMEX Merchant Portal
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Billing Address */}
                {selectedTransaction.metadata?.billingAddress && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Billing Address
                    </h4>
                    <div className="p-3 border rounded-lg">
                      <p>{selectedTransaction.metadata.billingAddress.line1}</p>
                      {selectedTransaction.metadata.billingAddress.line2 && (
                        <p>{selectedTransaction.metadata.billingAddress.line2}</p>
                      )}
                      <p>
                        {selectedTransaction.metadata.billingAddress.city}, {selectedTransaction.metadata.billingAddress.state} {selectedTransaction.metadata.billingAddress.postalCode}
                      </p>
                      <p>{selectedTransaction.metadata.billingAddress.country}</p>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Submitted: {format(parseISO(selectedTransaction.created_at), 'PPP p')}
                </div>

                {/* Processing Actions */}
                {selectedTransaction.status === 'PENDING' && (
                  <>
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Process Payment via AMEX</h4>
                        <Button variant="outline" size="sm" asChild>
                          <a href="https://merchant.americanexpress.com" target="_blank" rel="noopener noreferrer">
                            Open AMEX Portal <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                          <div className="text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-medium mb-1">Processing Instructions:</p>
                            <ol className="list-decimal ml-4 space-y-1">
                              <li>Open the AMEX Merchant Portal</li>
                              <li>Enter the card details shown above</li>
                              <li>Process the payment for ${(selectedTransaction.amount / 100).toFixed(2)}</li>
                              <li>Copy the AMEX transaction reference number</li>
                              <li>Paste it below and click Approve</li>
                            </ol>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="transactionRef">AMEX Transaction Reference</Label>
                        <Input
                          id="transactionRef"
                          placeholder="Enter AMEX transaction reference after processing"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rejectionReason">Rejection Reason (if rejecting)</Label>
                        <Textarea
                          id="rejectionReason"
                          placeholder="Enter reason for rejection..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
                {selectedTransaction.status === 'PENDING' && (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleProcessPayment('reject')}
                      disabled={processing}
                    >
                      {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Reject
                    </Button>
                    <Button 
                      onClick={() => handleProcessPayment('approve')}
                      disabled={processing || !activeGateway}
                    >
                      {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Send className="mr-2 h-4 w-4" />
                      Approve Payment
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TransactionList({ 
  transactions, 
  onSelect, 
  statusBadge 
}: { 
  transactions: PaymentTransaction[]
  onSelect: (t: PaymentTransaction) => void
  statusBadge: (status: string) => React.ReactNode
}) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No transactions found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map(transaction => (
        <Card 
          key={transaction.id} 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelect(transaction)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {transaction.user 
                        ? `${transaction.user.first_name} ${transaction.user.last_name}`
                        : 'Unknown User'
                      }
                    </p>
                    {statusBadge(transaction.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {transaction.metadata?.tier} - {transaction.metadata?.billingCycle}
                    {transaction.metadata?.cardDetails && (
                      <span className="ml-2">
                        ({transaction.metadata.cardDetails.cardType?.toUpperCase()} ****{transaction.metadata.cardDetails.cardNumberLast4})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">${(transaction.amount / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(transaction.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
