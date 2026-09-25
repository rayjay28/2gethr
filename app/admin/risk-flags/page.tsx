'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAdminAccessToken } from '@/hooks/use-admin-auth'
import { AlertTriangle, Shield, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface RiskFlag {
  id: string
  familyId: string | null
  userId: string | null
  flagType: string
  severity: string
  description: string
  isResolved: boolean
  resolvedAt: string | null
  resolvedBy: string | null
  resolution: string | null
  createdAt: string
  familyName?: string
  userName?: string
  userEmail?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminRiskFlagsPage() {
  const [flags, setFlags] = useState<RiskFlag[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('unresolved')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [resolvedTodayFilter, setResolvedTodayFilter] = useState<boolean>(false)
  const [selectedFlag, setSelectedFlag] = useState<RiskFlag | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolving, setResolving] = useState(false)
  
  // Stats for summary cards (fetched separately with all flags)
  const [summaryStats, setSummaryStats] = useState({
    unresolved: 0,
    critical: 0,
    high: 0,
    resolvedToday: 0
  })

  useEffect(() => {
    loadFlags()
    loadSummaryStats()
  }, [pagination.page, statusFilter, severityFilter, resolvedTodayFilter])

  async function loadSummaryStats() {
    try {
      const token = getAdminAccessToken()
      // Fetch all stats in parallel
      const [unresolvedRes, criticalRes, highRes, resolvedTodayRes] = await Promise.all([
        fetch('/api/admin/risk-flags?status=unresolved&limit=1', { 
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        fetch('/api/admin/risk-flags?status=unresolved&severity=CRITICAL&limit=1', { 
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        fetch('/api/admin/risk-flags?status=unresolved&severity=HIGH&limit=1', { 
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        fetch('/api/admin/risk-flags?status=resolved&resolvedToday=true&limit=1', { 
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
      ])
      
      const [unresolvedData, criticalData, highData, resolvedTodayData] = await Promise.all([
        unresolvedRes.ok ? unresolvedRes.json() : { pagination: { total: 0 } },
        criticalRes.ok ? criticalRes.json() : { pagination: { total: 0 } },
        highRes.ok ? highRes.json() : { pagination: { total: 0 } },
        resolvedTodayRes.ok ? resolvedTodayRes.json() : { pagination: { total: 0 } },
      ])
      
      setSummaryStats({
        unresolved: unresolvedData.pagination?.total || 0,
        critical: criticalData.pagination?.total || 0,
        high: highData.pagination?.total || 0,
        resolvedToday: resolvedTodayData.pagination?.total || 0,
      })
    } catch (error) {
      console.error('Failed to load summary stats:', error)
    }
  }

  async function loadFlags() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (severityFilter !== 'all') params.set('severity', severityFilter)
      if (resolvedTodayFilter) params.set('resolvedToday', 'true')

      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/risk-flags?${params}`, { 
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setFlags(data.flags || [])
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error('Failed to load risk flags:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResolve() {
    if (!selectedFlag || !resolution.trim()) return
    
    setResolving(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/risk-flags/${selectedFlag.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ resolution: resolution.trim() }),
      })
      
      if (res.ok) {
        toast.success('Risk flag resolved')
        setSelectedFlag(null)
        setResolution('')
        loadFlags()
      } else {
        toast.error('Failed to resolve flag')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setResolving(false)
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case 'CRITICAL': return <Badge variant="destructive">Critical</Badge>
      case 'HIGH': return <Badge className="bg-orange-500">High</Badge>
      case 'MEDIUM': return <Badge variant="secondary">Medium</Badge>
      default: return <Badge variant="outline">Low</Badge>
    }
  }

  function getFlagTypeLabel(type: string) {
    switch (type) {
      case 'SUSPICIOUS_ACTIVITY': return 'Suspicious Activity'
      case 'PAYMENT_FRAUD': return 'Payment Fraud'
      case 'ACCOUNT_ABUSE': return 'Account Abuse'
      case 'LOCATION_ANOMALY': return 'Location Anomaly'
      case 'DATA_PRIVACY': return 'Data Privacy'
      default: return type.replace(/_/g, ' ')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Risk Flags</h1>
          <p className="text-muted-foreground">Monitor and resolve trust & safety issues</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Trust & Safety</span>
        </div>
      </div>

      {/* Summary Cards - Clickable filters */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-all hover:border-primary ${statusFilter === 'unresolved' && severityFilter === 'all' && !resolvedTodayFilter ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => {
            setStatusFilter('unresolved')
            setSeverityFilter('all')
            setResolvedTodayFilter(false)
            setPagination(p => ({ ...p, page: 1 }))
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unresolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{summaryStats.unresolved}</span>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:border-destructive ${statusFilter === 'unresolved' && severityFilter === 'CRITICAL' ? 'border-destructive ring-1 ring-destructive' : ''}`}
          onClick={() => {
            setStatusFilter('unresolved')
            setSeverityFilter('CRITICAL')
            setResolvedTodayFilter(false)
            setPagination(p => ({ ...p, page: 1 }))
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{summaryStats.critical}</span>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:border-orange-500 ${statusFilter === 'unresolved' && severityFilter === 'HIGH' ? 'border-orange-500 ring-1 ring-orange-500' : ''}`}
          onClick={() => {
            setStatusFilter('unresolved')
            setSeverityFilter('HIGH')
            setResolvedTodayFilter(false)
            setPagination(p => ({ ...p, page: 1 }))
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{summaryStats.high}</span>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:border-green-500 ${resolvedTodayFilter ? 'border-green-500 ring-1 ring-green-500' : ''}`}
          onClick={() => {
            setStatusFilter('resolved')
            setSeverityFilter('all')
            setResolvedTodayFilter(true)
            setPagination(p => ({ ...p, page: 1 }))
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{summaryStats.resolvedToday}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setResolvedTodayFilter(false); setPagination(p => ({ ...p, page: 1 })) }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setResolvedTodayFilter(false); setPagination(p => ({ ...p, page: 1 })) }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              {(statusFilter !== 'unresolved' || severityFilter !== 'all' || resolvedTodayFilter) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setStatusFilter('unresolved')
                    setSeverityFilter('all')
                    setResolvedTodayFilter(false)
                    setPagination(p => ({ ...p, page: 1 }))
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
            {resolvedTodayFilter && (
              <Badge variant="secondary" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Showing: Resolved Today
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : flags.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">No risk flags found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>{getSeverityBadge(flag.severity)}</TableCell>
                      <TableCell className="font-medium">
                        {getFlagTypeLabel(flag.flagType)}
                      </TableCell>
                      <TableCell>
                        {flag.familyName && (
                          <Link href={`/admin/families/${flag.familyId}`} className="text-primary hover:underline">
                            {flag.familyName}
                          </Link>
                        )}
                        {flag.userName && (
                          <div>
                            <Link href={`/admin/users/${flag.userId}`} className="text-primary hover:underline">
                              {flag.userName}
                            </Link>
                            <p className="text-xs text-muted-foreground">{flag.userEmail}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={flag.description}>
                        {flag.description}
                      </TableCell>
                      <TableCell>
                        {flag.isResolved ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Open
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(flag.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {!flag.isResolved && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedFlag(flag)}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} flags
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!selectedFlag} onOpenChange={() => setSelectedFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Risk Flag</DialogTitle>
            <DialogDescription>
              {selectedFlag && (
                <>
                  <span className="font-medium">{getFlagTypeLabel(selectedFlag.flagType)}</span>
                  <br />
                  {selectedFlag.description}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter resolution notes..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFlag(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={!resolution.trim() || resolving}>
              {resolving ? 'Resolving...' : 'Mark as Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
