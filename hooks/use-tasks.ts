import useSWR from 'swr'
import { getAccessToken } from './use-auth'

interface Task {
  id: string
  family_id: string
  title: string
  description: string | null
  status: string
  priority: string
  category: string | null
  created_by_id: string
  assigned_to_id: string | null
  child_profile_id: string | null
  due_date: string | null
  completed_at: string | null
  approved_at: string | null
  approved_by_id: string | null
  completed_by_id: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  // Joined fields
  creator_first_name: string
  creator_last_name: string
  assignee_first_name: string | null
  assignee_last_name: string | null
  assignee_profile_photo_path: string | null
  child_display_name: string | null
  child_avatar_url: string | null
  family_name: string
}

const fetcher = async (url: string) => {
  const token = getAccessToken()
  const res = await fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function useTasks(familyId?: string, status?: string) {
  const params = new URLSearchParams()
  if (familyId) params.set('familyId', familyId)
  if (status) params.set('status', status)
  
  // Build the URL - always fetch even without familyId (API handles getting user's families)
  const url = `/api/tasks?${params.toString()}`
  
  const { data, error, isLoading, mutate } = useSWR<{ data: Task[] }>(
    url,
    fetcher
  )
  
  return {
    tasks: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

export function useTask(taskId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ data: Task & { history: unknown[], comments: unknown[] } }>(
    taskId ? `/api/tasks/${taskId}` : null,
    fetcher
  )
  
  return {
    task: data?.data,
    isLoading,
    error,
    mutate,
  }
}

export async function createTask(taskData: {
  familyId: string
  title: string
  description?: string
  assignedToUserId?: string
  assignedToChildId?: string
  dueDate?: string
  reminderAt?: string
  priority?: string
  requiresApproval?: boolean
  category?: string
  isRecurring?: boolean
  recurrenceRule?: string
}) {
  const token = getAccessToken()
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(taskData),
  })
  
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to create task')
  }
  
  return res.json()
}

export async function updateTask(taskId: string, action: string, updates?: Record<string, unknown>) {
  const token = getAccessToken()
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...updates }),
  })
  
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to update task')
  }
  
  return res.json()
}

export async function deleteTask(taskId: string) {
  const token = getAccessToken()
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  })
  
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to delete task')
  }
  
  return res.json()
}

export async function addTaskComment(taskId: string, content: string) {
  const token = getAccessToken()
  const res = await fetch(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
  })
  
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to add comment')
  }
  
  return res.json()
}

export type { Task }
