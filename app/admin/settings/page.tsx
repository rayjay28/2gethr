'use client'

import { useEffect, useState } from 'react'
import { Settings, Lock, User, Shield, History, Plus, Trash2, Loader2, CreditCard, Check, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { getAdminAccessToken } from '@/hooks/use-admin-auth'

interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  roles: string[]
  permissions: string[]
  createdAt: string
  lastLoginAt: string | null
}

interface AuditLog {
  id: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown>
  ipAddress: string
  createdAt: string
}

interface OtherAdmin {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  roles: { name: string }[]
  createdAt: string
  lastLoginAt: string | null
}

interface PaymentGateway {
  id: string
  provider: string
  display_name: string
  is_active: boolean
  merchant_id: string
  api_endpoint: string | null
  created_at: string
  updated_at: string
}

export default function AdminSettingsPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [otherAdmins, setOtherAdmins] = useState<OtherAdmin[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  
  // Profile update state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [updatingProfile, setUpdatingProfile] = useState(false)
  
  // New admin dialog state
  const [showNewAdminDialog, setShowNewAdminDialog] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminFirstName, setNewAdminFirstName] = useState('')
  const [newAdminLastName, setNewAdminLastName] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('ADMIN')
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  // Payment gateway state
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([])
  const [loadingGateways, setLoadingGateways] = useState(false)
  const [showGatewayDialog, setShowGatewayDialog] = useState(false)
  const [savingGateway, setSavingGateway] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showApiSecret, setShowApiSecret] = useState(false)
  
  // Gateway form state
  const [gatewayName, setGatewayName] = useState('amex')
  const [gatewayDisplayName, setGatewayDisplayName] = useState('American Express')
  const [merchantId, setMerchantId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('https://api.americanexpress.com/payments/v1')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [gatewayActive, setGatewayActive] = useState(true)
  const [gatewayDefault, setGatewayDefault] = useState(true)

  useEffect(() => {
    loadAdminProfile()
  }, [])

  async function loadAdminProfile() {
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/auth/me', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setAdmin(data.admin)
        setFirstName(data.admin.firstName || '')
        setLastName(data.admin.lastName || '')
      }
    } catch (error) {
      console.error('Failed to load admin profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAuditLogs() {
    setLoadingLogs(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/settings/audit-logs', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setLoadingLogs(false)
    }
  }

  async function loadOtherAdmins() {
    setLoadingAdmins(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/settings/admins', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setOtherAdmins(data.admins || [])
      }
    } catch (error) {
      console.error('Failed to load admins:', error)
    } finally {
      setLoadingAdmins(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    
    setChangingPassword(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/settings/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error || 'Failed to change password')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setUpdatingProfile(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/settings/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ firstName, lastName }),
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Profile updated successfully')
        setAdmin(prev => prev ? { ...prev, firstName, lastName } : null)
      } else {
        toast.error(data.error || 'Failed to update profile')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setUpdatingProfile(false)
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (newAdminPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    
    setCreatingAdmin(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/settings/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: newAdminEmail,
          firstName: newAdminFirstName,
          lastName: newAdminLastName,
          password: newAdminPassword,
          role: newAdminRole,
        }),
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Admin created successfully')
        setShowNewAdminDialog(false)
        setNewAdminEmail('')
        setNewAdminFirstName('')
        setNewAdminLastName('')
        setNewAdminPassword('')
        setNewAdminRole('ADMIN')
        loadOtherAdmins()
      } else {
        toast.error(data.error || 'Failed to create admin')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCreatingAdmin(false)
    }
  }

  async function handleDeactivateAdmin(adminId: string) {
    if (!confirm('Are you sure you want to deactivate this admin?')) return
    
    try {
      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/settings/admins/${adminId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      
      if (res.ok) {
        toast.success('Admin deactivated')
        loadOtherAdmins()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to deactivate admin')
      }
    } catch {
      toast.error('An error occurred')
    }
  }

  const loadPaymentGateways = async () => {
    setLoadingGateways(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/payment-gateway', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setPaymentGateways(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load payment gateways:', error)
    } finally {
      setLoadingGateways(false)
    }
  }

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!merchantId.trim()) {
      toast.error('Merchant ID is required')
      return
    }
    
    setSavingGateway(true)
    try {
      const token = getAdminAccessToken()
      const res = await fetch('/api/admin/payment-gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          gatewayName,
          displayName: gatewayDisplayName,
          merchantId: merchantId.trim(),
          apiKey: apiKey.trim() || null,
          apiSecret: apiSecret.trim() || null,
          apiEndpoint: apiEndpoint.trim() || null,
          webhookUrl: webhookUrl.trim() || null,
          webhookSecret: webhookSecret.trim() || null,
          isActive: gatewayActive,
          isDefault: gatewayDefault,
          supportedCardTypes: gatewayName === 'amex' 
            ? ['amex'] 
            : ['visa', 'mastercard', 'amex', 'discover'],
        }),
      })

      const data = await res.json()
      
      if (res.ok) {
        toast.success(data.message || 'Payment gateway saved')
        setShowGatewayDialog(false)
        loadPaymentGateways()
        // Reset form
        setMerchantId('')
        setApiKey('')
        setApiSecret('')
        setWebhookSecret('')
      } else {
        toast.error(data.error || 'Failed to save payment gateway')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSavingGateway(false)
    }
  }

  const handleDeleteGateway = async (gateway: string) => {
    if (!confirm('Are you sure you want to remove this payment gateway?')) return
    
    try {
      const token = getAdminAccessToken()
      const res = await fetch(`/api/admin/payment-gateway?gateway=${gateway}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      
      if (res.ok) {
        toast.success('Payment gateway removed')
        loadPaymentGateways()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to remove payment gateway')
      }
    } catch {
      toast.error('An error occurred')
    }
  }

  const isSuperAdmin = admin?.roles?.includes('SUPER_ADMIN')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">Manage your account and admin settings</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2" onClick={loadAuditLogs}>
            <History className="h-4 w-4" />
            Activity Log
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="admins" className="flex items-center gap-2" onClick={loadOtherAdmins}>
              <Shield className="h-4 w-4" />
              Manage Admins
            </TabsTrigger>
          )}
          <TabsTrigger value="payments" className="flex items-center gap-2" onClick={loadPaymentGateways}>
            <CreditCard className="h-4 w-4" />
            Payment Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your admin profile details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={admin?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {admin?.roles?.map(role => (
                      <Badge key={role} variant={role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={updatingProfile}>
                  {updatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your admin account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Your Activity Log</CardTitle>
              <CardDescription>Recent actions performed by your admin account</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No activity logs found</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start justify-between border-b pb-4 last:border-0">
                      <div>
                        <p className="font-medium">{log.action.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.targetType}: {log.targetId}
                        </p>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground">IP: {log.ipAddress}</p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="admins">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Manage Admin Accounts</CardTitle>
                  <CardDescription>Create and manage other admin users</CardDescription>
                </div>
                <Dialog open={showNewAdminDialog} onOpenChange={setShowNewAdminDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Admin</DialogTitle>
                      <DialogDescription>Add a new administrator account</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateAdmin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newAdminEmail">Email</Label>
                        <Input
                          id="newAdminEmail"
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="newAdminFirstName">First Name</Label>
                          <Input
                            id="newAdminFirstName"
                            value={newAdminFirstName}
                            onChange={(e) => setNewAdminFirstName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newAdminLastName">Last Name</Label>
                          <Input
                            id="newAdminLastName"
                            value={newAdminLastName}
                            onChange={(e) => setNewAdminLastName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newAdminPassword">Password</Label>
                        <Input
                          id="newAdminPassword"
                          type="password"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newAdminRole">Role</Label>
                        <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                            <SelectItem value="SUPPORT">Support</SelectItem>
                            <SelectItem value="ANALYST">Analyst</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowNewAdminDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={creatingAdmin}>
                          {creatingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Admin
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingAdmins ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : otherAdmins.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No other admin accounts found</p>
                ) : (
                  <div className="space-y-4">
                    {otherAdmins.map(otherAdmin => (
                      <div key={otherAdmin.id} className="flex items-center justify-between border rounded-lg p-4">
                        <div>
                          <p className="font-medium">{otherAdmin.firstName} {otherAdmin.lastName}</p>
                          <p className="text-sm text-muted-foreground">{otherAdmin.email}</p>
                          <div className="flex gap-2 mt-1">
                            {otherAdmin.roles?.map(role => (
                              <Badge key={role.name} variant="secondary" className="text-xs">
                                {role.name}
                              </Badge>
                            ))}
                            <Badge variant={otherAdmin.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-xs">
                              {otherAdmin.status}
                            </Badge>
                          </div>
                        </div>
                        {otherAdmin.id !== admin?.id && otherAdmin.status === 'ACTIVE' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeactivateAdmin(otherAdmin.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Payment Integrations Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Gateway Integrations</CardTitle>
                  <CardDescription>Connect to merchant processing portals to process payments</CardDescription>
                </div>
                <Dialog open={showGatewayDialog} onOpenChange={setShowGatewayDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Gateway
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Connect Payment Gateway</DialogTitle>
                      <DialogDescription>
                        Enter your merchant portal credentials to process payments
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveGateway} className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="gatewayProvider">Payment Provider</Label>
                          <Select value={gatewayName} onValueChange={(v) => {
                            setGatewayName(v)
                            if (v === 'amex') {
                              setGatewayDisplayName('American Express')
                              setApiEndpoint('https://api.americanexpress.com/payments/v1')
                            } else if (v === 'stripe') {
                              setGatewayDisplayName('Stripe')
                              setApiEndpoint('https://api.stripe.com/v1')
                            } else if (v === 'square') {
                              setGatewayDisplayName('Square')
                              setApiEndpoint('https://connect.squareup.com/v2')
                            } else if (v === 'paypal') {
                              setGatewayDisplayName('PayPal')
                              setApiEndpoint('https://api.paypal.com/v2')
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="amex">American Express (AMEX)</SelectItem>
                              <SelectItem value="stripe">Stripe</SelectItem>
                              <SelectItem value="square">Square</SelectItem>
                              <SelectItem value="paypal">PayPal</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {gatewayName === 'amex' && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard className="h-5 w-5 text-blue-600" />
                              <span className="font-medium text-blue-900 dark:text-blue-100">American Express Merchant Portal</span>
                            </div>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Connect to AMEX Payment Services to process American Express card payments directly.
                              You&apos;ll need your Merchant ID and API credentials from your AMEX merchant account.
                            </p>
                            <a 
                              href="https://merchant.americanexpress.com" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                            >
                              Access AMEX Merchant Portal <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name</Label>
                            <Input
                              id="displayName"
                              value={gatewayDisplayName}
                              onChange={(e) => setGatewayDisplayName(e.target.value)}
                              placeholder="American Express"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="merchantId">Merchant ID *</Label>
                            <Input
                              id="merchantId"
                              value={merchantId}
                              onChange={(e) => setMerchantId(e.target.value)}
                              placeholder="Your merchant ID"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="apiEndpoint">API Endpoint</Label>
                          <Input
                            id="apiEndpoint"
                            value={apiEndpoint}
                            onChange={(e) => setApiEndpoint(e.target.value)}
                            placeholder="https://api.americanexpress.com/payments/v1"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="apiKey">API Key / Client ID</Label>
                          <div className="relative">
                            <Input
                              id="apiKey"
                              type={showApiKey ? 'text' : 'password'}
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="Your API key or client ID"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="apiSecret">API Secret / Client Secret</Label>
                          <div className="relative">
                            <Input
                              id="apiSecret"
                              type={showApiSecret ? 'text' : 'password'}
                              value={apiSecret}
                              onChange={(e) => setApiSecret(e.target.value)}
                              placeholder="Your API secret"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowApiSecret(!showApiSecret)}
                            >
                              {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
                          <Input
                            id="webhookUrl"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://yoursite.com/api/webhooks/amex"
                          />
                          <p className="text-xs text-muted-foreground">
                            URL where payment notifications will be sent
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
                          <Input
                            id="webhookSecret"
                            type="password"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            placeholder="Webhook signing secret"
                          />
                        </div>

                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gatewayActive}
                              onChange={(e) => setGatewayActive(e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Active</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gatewayDefault}
                              onChange={(e) => setGatewayDefault(e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Set as default gateway</span>
                          </label>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowGatewayDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={savingGateway}>
                          {savingGateway && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Connect Gateway
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingGateways ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : paymentGateways.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Payment Gateways Connected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect a merchant processing portal to start processing payments
                  </p>
                  <Button onClick={() => setShowGatewayDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add AMEX Gateway
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentGateways.map(gateway => (
                    <div key={gateway.id} className="flex items-center justify-between border rounded-lg p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          gateway.provider === 'amex' 
                            ? 'bg-blue-100 dark:bg-blue-900' 
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <CreditCard className={`h-6 w-6 ${
                            gateway.provider === 'amex' 
                              ? 'text-blue-600' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{gateway.display_name}</p>
                            <Badge variant={gateway.is_active ? 'default' : 'destructive'} className="text-xs">
                              {gateway.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Merchant ID: {gateway.merchant_id}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {gateway.provider}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gateway.is_active && (
                          <div className="flex items-center gap-1 text-green-600 text-sm mr-4">
                            <Check className="h-4 w-4" />
                            Connected
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteGateway(gateway.provider)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Supported Payment Providers</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">AMEX</span>
                    </div>
                    <span>American Express</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-purple-600">S</span>
                    </div>
                    <span>Stripe</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-600">SQ</span>
                    </div>
                    <span>Square</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-700">PP</span>
                    </div>
                    <span>PayPal</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
