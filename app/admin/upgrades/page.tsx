'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAdminAuth, getAdminAccessToken } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { 
  CreditCard, 
  Check, 
  X, 
  Clock,
  DollarSign,
  ArrowLeft,
  RefreshCw
} from 'lucide-react'

interface UpgradeRequest {
  id: string
  subscription_id: string
  amount: number
  currency: string
  status: string
  description: string
  metadata: {
    requestedTier: string
    billingCycle: string
    paymentMethod: string
    requestedBy: string
    requestedAt: string
    familyName: string
  }
  created_at: string
  family_name?: string
  user_email?: string
  user_name?: string
}

export default function AdminUpgradesPage() {
  const { admin, isLoading: authLoading, hasPermission } = useAdminAuth()
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [stripePaymentId, setStripePaymentId] = useState('')
  const [notes, setNotes] = useState('')

  const loadRequests = useCallback(async () => {
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/upgrades', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        setRequests(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load upgrade requests:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (admin) {
      loadRequests()
    }
  }, [admin, loadRequests])

  const handleApprove = async () => {
    if (!selectedRequest) return

    setProcessing(selectedRequest.id)
    try {
      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/upgrades/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'approve',
          stripePaymentId: stripePaymentId.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (res.ok) {
        toast.success('Upgrade approved and activated')
        setDialogOpen(false)
        setSelectedRequest(null)
        setStripePaymentId('')
        setNotes('')
        loadRequests()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to approve upgrade')
      }
    } catch (error) {
      toast.error('Failed to process approval')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this upgrade request?')) return

    setProcessing(requestId)
    try {
      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/upgrades/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'reject' }),
      })

      if (res.ok) {
        toast.success('Upgrade request rejected')
        loadRequests()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to reject')
      }
    } catch (error) {
      toast.error('Failed to process rejection')
    } finally {
      setProcessing(null)
    }
  }

  const openApproveDialog = (request: UpgradeRequest) => {
    setSelectedRequest(request)
    setDialogOpen(true)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!hasPermission('subscription:update')) {
    return (
      <div className="container py-8">
        <Empty
          icon={CreditCard}
          title="Access Denied"
          description="You don't have permission to manage subscription upgrades."
        />
      </div>
    )
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const processedRequests = requests.filter(r => r.status !== 'PENDING')

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Upgrade Requests</h1>
            <p className="text-muted-foreground">
              Process subscription upgrade payments
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingRequests.length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Check className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {requests.filter(r => r.status === 'SUCCEEDED').length}
              </p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                ${(requests.filter(r => r.status === 'SUCCEEDED').reduce((sum, r) => sum + r.amount, 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Upgrade Requests</CardTitle>
          <CardDescription>
            Review and process payment for upgrade requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <Empty
              icon={CreditCard}
              title="No Pending Requests"
              description="All upgrade requests have been processed"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.metadata.familyName || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{request.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.metadata.requestedTier}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{request.metadata.billingCycle}</TableCell>
                    <TableCell className="font-medium">
                      ${(request.amount / 100).toFixed(2)} {request.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleReject(request.id)}
                          disabled={processing === request.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => openApproveDialog(request)}
                          disabled={processing === request.id}
                        >
                          {processing === request.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Processed */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.slice(0, 10).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.metadata.familyName || 'Unknown'}</TableCell>
                    <TableCell>{request.metadata.requestedTier}</TableCell>
                    <TableCell>${(request.amount / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={request.status === 'SUCCEEDED' ? 'default' : 'destructive'}
                        className={request.status === 'SUCCEEDED' ? 'bg-green-500' : ''}
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Upgrade Payment</DialogTitle>
            <DialogDescription>
              Confirm payment and activate the subscription upgrade
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Family</span>
                  <span className="font-medium">{selectedRequest.metadata.familyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{selectedRequest.metadata.requestedTier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium capitalize">{selectedRequest.metadata.billingCycle}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Amount</span>
                  <span>${(selectedRequest.amount / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripePaymentId">Payment Reference (Optional)</Label>
                <Input
                  id="stripePaymentId"
                  placeholder="Stripe payment ID or reference"
                  value={stripePaymentId}
                  onChange={(e) => setStripePaymentId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Internal notes about this transaction"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing !== null}>
              {processing ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approve & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
