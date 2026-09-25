'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAdminAccessToken } from '@/hooks/use-admin-auth'
import { Search, TicketIcon, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface TicketData {
  id: string
  ticketNumber: string
  category: string
  priority: string
  status: string
  subject: string
  user: { id: string; email: string; name: string } | null
  family: { id: string; name: string } | null
  assignedAdmin: { id: string; email: string } | null
  messageCount: number
  createdAt: string
}

const priorityColors: Record<string, string> = {
  URGENT: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-warning text-warning-foreground',
  NORMAL: 'bg-secondary text-secondary-foreground',
  LOW: 'bg-muted text-muted-foreground',
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-info text-info-foreground',
  IN_PROGRESS: 'bg-primary text-primary-foreground',
  WAITING_USER: 'bg-warning text-warning-foreground',
  ESCALATED: 'bg-destructive text-destructive-foreground',
  RESOLVED: 'bg-success text-success-foreground',
  CLOSED: 'bg-muted text-muted-foreground',
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')

  useEffect(() => {
    loadTickets()
  }, [pagination.page, status, priority])

  async function loadTickets() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
      })
      if (status !== 'all') params.set('status', status)
      if (priority !== 'all') params.set('priority', priority)

      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/tickets?${params}`, { 
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets)
        setPagination(data.pagination)
        setStatusCounts(data.statusCounts)
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground">Manage customer support requests</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="px-3 py-1">
          Open: {statusCounts.OPEN || 0}
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          In Progress: {statusCounts.IN_PROGRESS || 0}
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          Waiting: {statusCounts.WAITING_USER || 0}
        </Badge>
        {(statusCounts.ESCALATED || 0) > 0 && (
          <Badge variant="destructive" className="px-3 py-1">
            Escalated: {statusCounts.ESCALATED}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPagination(p => ({ ...p, page: 1 })) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="WAITING_USER">Waiting on User</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => { setPriority(v); setPagination(p => ({ ...p, page: 1 })) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TicketIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              No tickets found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{ticket.ticketNumber}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {ticket.subject}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ticket.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[ticket.priority]}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[ticket.status]}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ticket.user?.email || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ticket.assignedAdmin?.email || 'Unassigned'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/tickets/${ticket.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} tickets
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
