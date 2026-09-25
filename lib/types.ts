// Safe Link - Shared TypeScript Types (Local definitions, no Prisma)

// ============================================
// Enums matching database
// ============================================

export enum FamilyRole {
  OWNER = "OWNER",
  PARENT = "PARENT",
  CHILD = "CHILD",
  CAREGIVER = "CAREGIVER",
}

export enum EventStatus {
  APPROVED = "APPROVED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  CANCELLED = "CANCELLED",
}

export enum EventVisibility {
  FAMILY = "FAMILY",
  PRIVATE = "PRIVATE",
  SELECTED_MEMBERS = "SELECTED_MEMBERS",
}

export enum ParticipantStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  TENTATIVE = "TENTATIVE",
}

export enum RecurrenceFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum LocationMode {
  OFF = "OFF",
  LOW_POWER = "LOW_POWER",
  BALANCED = "BALANCED",
  HIGH_ACCURACY = "HIGH_ACCURACY",
}

export enum GeofenceEventType {
  ENTER = "ENTER",
  EXIT = "EXIT",
  DWELL = "DWELL",
}

export enum NotificationType {
  EVENT_REMINDER = "EVENT_REMINDER",
  EVENT_INVITATION = "EVENT_INVITATION",
  EVENT_UPDATE = "EVENT_UPDATE",
  EVENT_APPROVAL_REQUEST = "EVENT_APPROVAL_REQUEST",
  EVENT_APPROVED = "EVENT_APPROVED",
  EVENT_REJECTED = "EVENT_REJECTED",
  LOCATION_ALERT = "LOCATION_ALERT",
  GEOFENCE_ALERT = "GEOFENCE_ALERT",
  FAMILY_INVITATION = "FAMILY_INVITATION",
  SUBSCRIPTION_ALERT = "SUBSCRIPTION_ALERT",
  SYSTEM = "SYSTEM",
}

export enum SubscriptionTier {
  FREE = "FREE",
  PREMIUM = "PREMIUM",
  PREMIUM_PLUS = "PREMIUM_PLUS",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  TRIALING = "TRIALING",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum ConsentType {
  TERMS_OF_SERVICE = "TERMS_OF_SERVICE",
  PRIVACY_POLICY = "PRIVACY_POLICY",
  LOCATION_TRACKING = "LOCATION_TRACKING",
  PUSH_NOTIFICATIONS = "PUSH_NOTIFICATIONS",
  DATA_PROCESSING = "DATA_PROCESSING",
}

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "VIEW"
  | "EXPORT"
  | "SUBSCRIPTION_CHANGE"

// ============================================
// Base Entity Interfaces
// ============================================

export interface User {
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  phone: string | null
  profilePhotoUrl: string | null
  profilePhotoPath: string | null
  timezone: string
  isActive: boolean
  emailVerified: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Family {
  id: string
  name: string
  ownerId: string
  inviteCode: string | null
  inviteCodeExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FamilyMember {
  id: string
  familyId: string
  userId: string | null
  role: FamilyRole
  displayName: string | null
  isActive: boolean
  canCreateEvents: boolean
  requiresEventApproval: boolean
  canOverrideConflicts: boolean
  canViewFamilyCalendar: boolean
  canInviteMembers: boolean
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface ChildProfile {
  id: string
  familyMemberId: string
  displayName: string
  age: number | null
  school: string | null
  grade: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Calendar {
  id: string
  familyId: string
  name: string
  description: string | null
  color: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Event {
  id: string
  calendarId: string
  createdById: string
  title: string
  description: string | null
  location: string | null
  savedPlaceId: string | null
  startTime: Date
  endTime: Date
  isAllDay: boolean
  status: EventStatus
  visibility: EventVisibility
  color: string | null
  reminderMinutes: number[]
  isRecurring: boolean
  recurrenceRuleId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface EventParticipant {
  id: string
  eventId: string
  userId: string | null
  childProfileId: string | null
  status: ParticipantStatus
  respondedAt: Date | null
  createdAt: Date
}

export interface RecurrenceRule {
  id: string
  frequency: RecurrenceFrequency
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
  monthOfYear: number | null
  endDate: Date | null
  occurrenceCount: number | null
  createdAt: Date
}

export interface EventRequest {
  id: string
  eventId: string
  requestedById: string
  status: string
  reviewedById: string | null
  reviewedAt: Date | null
  reviewNotes: string | null
  createdAt: Date
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown> | null
  isRead: boolean
  createdAt: Date
}

export interface SavedPlace {
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
  color: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: string
  familyId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  trialEndsAt: Date | null
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// ============================================
// Auth Types
// ============================================

export interface JWTPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  timezone?: string
}

// ============================================
// Family Types
// ============================================

export interface FamilyInvite {
  familyId: string
  inviteCode: string
  familyName: string
  inviterName: string
  expiresAt?: Date
}

export interface MemberPermissions {
  canCreateEvents: boolean
  requiresEventApproval: boolean
  canOverrideConflicts: boolean
  canViewFamilyCalendar: boolean
  canInviteMembers: boolean
}

// ============================================
// Event Types
// ============================================

export interface CreateEventInput {
  calendarId: string
  title: string
  description?: string
  location?: string
  savedPlaceId?: string
  startTime: string | Date
  endTime: string | Date
  isAllDay?: boolean
  visibility?: EventVisibility
  color?: string
  reminderMinutes?: number[]
  participantIds?: string[]
  recurrence?: {
    frequency: RecurrenceFrequency
    interval?: number
    daysOfWeek?: number[]
    dayOfMonth?: number
    monthOfYear?: number
    endDate?: string | Date
    occurrenceCount?: number
  }
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  status?: EventStatus
}

export interface EventConflict {
  eventId: string
  title: string
  startTime: Date
  endTime: Date
  participantId: string
  participantName: string
}

// ============================================
// Location Types
// ============================================

export interface LocationUpdate {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  heading?: number
  batteryLevel?: number
  timestamp?: string | Date
}

export interface SavedPlaceInput {
  name: string
  address?: string
  latitude: number
  longitude: number
  radius?: number
  geofenceEnabled?: boolean
  alertOnArrival?: boolean
  alertOnDeparture?: boolean
  icon?: string
  color?: string
}

export interface GeofenceAlert {
  placeId: string
  placeName: string
  userId: string
  userName: string
  eventType: GeofenceEventType
  timestamp: Date
}

// ============================================
// Subscription Types
// ============================================

export interface SubscriptionPlan {
  tier: SubscriptionTier
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  features: string[]
}

export interface SubscriptionFeatures {
  maxFamilyMembers: number
  maxSavedPlaces: number
  maxCalendars: number
  locationSharing: boolean
  geofencing: boolean
  advancedRecurrence: boolean
  exportCalendar: boolean
  prioritySupport: boolean
}

// ============================================
// Notification Types
// ============================================

export interface NotificationPayload {
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface PushNotificationToken {
  userId: string
  token: string
  platform: "ios" | "android" | "web"
  createdAt: Date
}

// ============================================
// Audit Types
// ============================================

export interface AuditLogEntry {
  action: AuditAction
  entityType: string
  entityId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  metadata?: Record<string, unknown>
}
