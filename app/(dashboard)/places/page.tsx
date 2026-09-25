'use client'

import { useState } from 'react'
import { useFamilies } from '@/hooks/use-family'
import { useSubscription } from '@/hooks/use-subscription'
import { getAccessToken } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { 
  MapPin, 
  Plus,
  Home,
  Building,
  GraduationCap,
  ShoppingBag,
  Heart,
  Trash2,
  Edit,
  Bell,
  BellOff,
  Crown,
  Star
} from 'lucide-react'
import { useFavorites } from '@/components/favorites-dropdown'
import useSWR from 'swr'
import Link from 'next/link'

interface SavedPlace {
  id: string
  familyId: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius: number
  geofenceEnabled: boolean
  alertOnArrival: boolean
  alertOnDeparture: boolean
  icon: string | null
  color: string
  createdAt: string
}

const placeIcons: { [key: string]: typeof MapPin } = {
  home: Home,
  work: Building,
  school: GraduationCap,
  shopping: ShoppingBag,
  medical: Heart,
  default: MapPin,
}

const defaultColors = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
]

const fetcher = async (url: string) => {
  const token = getAccessToken()
  const res = await fetch(url, { 
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Failed to fetch')
  const data = await res.json()
  return data.data
}

export default function PlacesPage() {
  const { families, isLoading: familiesLoading } = useFamilies()
  const primaryFamily = families[0]
  const { access, isLoading: subscriptionLoading } = useSubscription(primaryFamily?.id || null)
  
  const { data: places, isLoading: placesLoading, mutate } = useSWR<SavedPlace[]>(
    primaryFamily?.id ? `/api/places?familyId=${primaryFamily.id}` : null,
    fetcher
  )
  const { isFavorite, toggleFavorite } = useFavorites()

  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const [editPlaceOpen, setEditPlaceOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null)
  const [newPlace, setNewPlace] = useState({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
    geofenceEnabled: false,
    alertOnArrival: true,
    alertOnDeparture: true,
    icon: 'default',
    color: '#3B82F6',
  })
  const [editPlace, setEditPlace] = useState({
    name: '',
    address: '',
    radius: 100,
    geofenceEnabled: false,
    alertOnArrival: true,
    alertOnDeparture: true,
    icon: 'default',
    color: '#3B82F6',
  })

  const handleAddPlace = async () => {
    if (!newPlace.name.trim()) {
      toast.error('Please enter a place name')
      return
    }

    if (!primaryFamily?.id) {
      toast.error('No family selected')
      return
    }

    // For demo, use random coordinates if not set
    const lat = newPlace.latitude || 37.7749 + (Math.random() - 0.5) * 0.1
    const lng = newPlace.longitude || -122.4194 + (Math.random() - 0.5) * 0.1

    setIsAdding(true)
    try {
      const token = getAccessToken()
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          familyId: primaryFamily.id,
          name: newPlace.name,
          address: newPlace.address || null,
          latitude: lat,
          longitude: lng,
          radius: newPlace.radius,
          geofenceEnabled: newPlace.geofenceEnabled,
          alertOnArrival: newPlace.alertOnArrival,
          alertOnDeparture: newPlace.alertOnDeparture,
          icon: newPlace.icon,
          color: newPlace.color,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Place saved successfully!')
        setAddPlaceOpen(false)
        setNewPlace({
          name: '',
          address: '',
          latitude: 0,
          longitude: 0,
          radius: 100,
          geofenceEnabled: false,
          alertOnArrival: true,
          alertOnDeparture: true,
          icon: 'default',
          color: '#3B82F6',
        })
        mutate()
      } else {
        toast.error(data.error || 'Failed to save place')
      }
    } catch {
      toast.error('Failed to save place')
    }
    setIsAdding(false)
  }

  const openEditDialog = (place: SavedPlace) => {
    setEditingPlace(place)
    setEditPlace({
      name: place.name,
      address: place.address || '',
      radius: place.radius,
      geofenceEnabled: place.geofenceEnabled,
      alertOnArrival: place.alertOnArrival,
      alertOnDeparture: place.alertOnDeparture,
      icon: place.icon || 'default',
      color: place.color,
    })
    setEditPlaceOpen(true)
  }

  const handleUpdatePlace = async () => {
    if (!editingPlace || !editPlace.name.trim()) {
      toast.error('Please enter a place name')
      return
    }

    setIsEditing(true)
    try {
      const token = getAccessToken()
      const res = await fetch(`/api/places/${editingPlace.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editPlace.name,
          address: editPlace.address || null,
          radius: editPlace.radius,
          geofenceEnabled: editPlace.geofenceEnabled,
          alertOnArrival: editPlace.alertOnArrival,
          alertOnDeparture: editPlace.alertOnDeparture,
          icon: editPlace.icon,
          color: editPlace.color,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Place updated successfully!')
        setEditPlaceOpen(false)
        setEditingPlace(null)
        mutate()
      } else {
        toast.error(data.error || 'Failed to update place')
      }
    } catch {
      toast.error('Failed to update place')
    }
    setIsEditing(false)
  }

  const handleDeletePlace = async (placeId: string) => {
    if (!confirm('Are you sure you want to delete this place?')) return

    try {
      const token = getAccessToken()
      const res = await fetch(`/api/places/${placeId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (res.ok) {
        toast.success('Place deleted')
        mutate()
      } else {
        toast.error('Failed to delete place')
      }
    } catch {
      toast.error('Failed to delete place')
    }
  }

  const isLoading = familiesLoading || placesLoading || subscriptionLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!primaryFamily) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Empty
          title="No family yet"
          description="Create or join a family to save places"
        />
        <Button asChild className="mt-6">
          <Link href="/onboarding">Get Started</Link>
        </Button>
      </div>
    )
  }

  const maxPlaces = access.limits.maxSavedPlaces
  const currentCount = places?.length || 0
  const canAddMore = currentCount < maxPlaces

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saved Places</h1>
          <p className="text-muted-foreground">
            Manage family locations and geofence alerts
          </p>
        </div>
        <Dialog open={addPlaceOpen} onOpenChange={setAddPlaceOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canAddMore}>
              <Plus className="w-4 h-4 mr-2" />
              Add Place
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Place</DialogTitle>
              <DialogDescription>
                Save a location for quick access and optional geofence alerts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="placeName">Place Name</Label>
                <Input
                  id="placeName"
                  placeholder="e.g., Home, School, Grandma's House"
                  value={newPlace.name}
                  onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="placeAddress">Address (optional)</Label>
                <Input
                  id="placeAddress"
                  placeholder="123 Main St, City, State"
                  value={newPlace.address}
                  onChange={(e) => setNewPlace({ ...newPlace, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(placeIcons).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewPlace({ ...newPlace, icon: key })}
                      className={`p-2 rounded-lg border ${
                        newPlace.icon === key
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewPlace({ ...newPlace, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newPlace.color === color ? 'border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {access.hasPremium && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="geofence">Enable Geofence</Label>
                      <p className="text-xs text-muted-foreground">
                        Get alerts when family members arrive or leave
                      </p>
                    </div>
                    <Switch
                      id="geofence"
                      checked={newPlace.geofenceEnabled}
                      onCheckedChange={(checked) =>
                        setNewPlace({ ...newPlace, geofenceEnabled: checked })
                      }
                    />
                  </div>
                  {newPlace.geofenceEnabled && (
                    <div className="pl-4 border-l-2 border-muted space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="arrival">Alert on Arrival</Label>
                        <Switch
                          id="arrival"
                          checked={newPlace.alertOnArrival}
                          onCheckedChange={(checked) =>
                            setNewPlace({ ...newPlace, alertOnArrival: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="departure">Alert on Departure</Label>
                        <Switch
                          id="departure"
                          checked={newPlace.alertOnDeparture}
                          onCheckedChange={(checked) =>
                            setNewPlace({ ...newPlace, alertOnDeparture: checked })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="radius">Radius: {newPlace.radius}m</Label>
                        <Input
                          id="radius"
                          type="range"
                          min={50}
                          max={500}
                          step={25}
                          value={newPlace.radius}
                          onChange={(e) =>
                            setNewPlace({ ...newPlace, radius: parseInt(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              {!access.hasPremium && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Crown className="w-4 h-4 text-amber-500" />
                    Geofencing requires Premium
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upgrade to get arrival and departure alerts
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPlaceOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPlace} disabled={isAdding}>
                {isAdding ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save Place
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Place Dialog */}
        <Dialog open={editPlaceOpen} onOpenChange={setEditPlaceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Place</DialogTitle>
              <DialogDescription>
                Update the details for this saved location
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editPlaceName">Place Name</Label>
                <Input
                  id="editPlaceName"
                  placeholder="e.g., Home, School, Grandma's House"
                  value={editPlace.name}
                  onChange={(e) => setEditPlace({ ...editPlace, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPlaceAddress">Address (optional)</Label>
                <Input
                  id="editPlaceAddress"
                  placeholder="123 Main St, City, State"
                  value={editPlace.address}
                  onChange={(e) => setEditPlace({ ...editPlace, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(placeIcons).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditPlace({ ...editPlace, icon: key })}
                      className={`p-2 rounded-lg border ${
                        editPlace.icon === key
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditPlace({ ...editPlace, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        editPlace.color === color ? 'border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {access.hasPremium && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="editGeofence">Enable Geofence</Label>
                      <p className="text-xs text-muted-foreground">
                        Get alerts when family members arrive or leave
                      </p>
                    </div>
                    <Switch
                      id="editGeofence"
                      checked={editPlace.geofenceEnabled}
                      onCheckedChange={(checked) =>
                        setEditPlace({ ...editPlace, geofenceEnabled: checked })
                      }
                    />
                  </div>
                  {editPlace.geofenceEnabled && (
                    <div className="pl-4 border-l-2 border-muted space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="editArrival">Alert on Arrival</Label>
                        <Switch
                          id="editArrival"
                          checked={editPlace.alertOnArrival}
                          onCheckedChange={(checked) =>
                            setEditPlace({ ...editPlace, alertOnArrival: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="editDeparture">Alert on Departure</Label>
                        <Switch
                          id="editDeparture"
                          checked={editPlace.alertOnDeparture}
                          onCheckedChange={(checked) =>
                            setEditPlace({ ...editPlace, alertOnDeparture: checked })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editRadius">Radius: {editPlace.radius}m</Label>
                        <Input
                          id="editRadius"
                          type="range"
                          min={50}
                          max={500}
                          step={25}
                          value={editPlace.radius}
                          onChange={(e) =>
                            setEditPlace({ ...editPlace, radius: parseInt(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              {!access.hasPremium && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Crown className="w-4 h-4 text-amber-500" />
                    Geofencing requires Premium
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upgrade to get arrival and departure alerts
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPlaceOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePlace} disabled={isEditing}>
                {isEditing ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Usage Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Saved Places</p>
              <p className="text-2xl font-bold">
                {currentCount} <span className="text-muted-foreground text-lg font-normal">/ {maxPlaces === Infinity ? 'Unlimited' : maxPlaces}</span>
              </p>
            </div>
            {!canAddMore && (
              <Badge variant="secondary">
                <Crown className="w-3 h-3 mr-1" />
                Upgrade for more
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Places Grid */}
      {places?.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">No saved places yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your frequently visited locations for quick access
              </p>
              <Button onClick={() => setAddPlaceOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Place
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {places?.map((place) => {
            const IconComponent = placeIcons[place.icon || 'default'] || MapPin
            return (
              <Card key={place.id} className="overflow-hidden">
                <div
                  className="h-2"
                  style={{ backgroundColor: place.color }}
                />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${place.color}20` }}
                      >
                        <IconComponent
                          className="w-5 h-5"
                          style={{ color: place.color }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base">{place.name}</CardTitle>
                        {place.address && (
                          <CardDescription className="text-xs line-clamp-1">
                            {place.address}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleFavorite('place', place.id)}
                      >
                        <Star 
                          className={`w-4 h-4 ${isFavorite('place', place.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                        />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openEditDialog(place)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePlace(place.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {place.geofenceEnabled ? (
                      <Badge variant="outline" className="text-xs">
                        <Bell className="w-3 h-3 mr-1" />
                        Geofence On
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <BellOff className="w-3 h-3 mr-1" />
                        Geofence Off
                      </Badge>
                    )}
                    {place.geofenceEnabled && (
                      <>
                        {place.alertOnArrival && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            Arrival
                          </Badge>
                        )}
                        {place.alertOnDeparture && (
                          <Badge variant="outline" className="text-xs text-amber-600">
                            Departure
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Radius: {place.radius}m
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
