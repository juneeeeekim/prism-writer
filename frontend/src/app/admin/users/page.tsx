'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RoleBadge from '@/components/ui/RoleBadge'

interface UserProfile {
  id: string
  email: string
  role: 'pending' | 'free' | 'premium' | 'special' | 'admin'
  is_approved: boolean
  monthly_token_limit: number
  daily_request_limit: number
  created_at: string
  last_sign_in_at?: string
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending'>('all')

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleUpdateUser = async (userId: string, updates: { role?: string, isApproved?: boolean }) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      })
      if (!res.ok) throw new Error('Update failed')
      
      // Refresh list
      fetchUsers()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const filteredUsers = filter === 'all' 
    ? users 
    : users.filter(u => !u.is_approved || u.role === 'pending')

  if (loading) return <div className="p-8">Loading users...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">사용자 관리</h1>
            <p className="text-gray-500 mt-2">가입 승인 및 등급 관리 시스템</p>
          </div>
          <Link href="/admin" className="text-indigo-600 hover:underline">← 관리자 홈</Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            전체 사용자 ({users.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pending' 
                ? 'bg-yellow-500 text-white' 
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            승인 대기 ({users.filter(u => !u.is_approved).length})
          </button>
        </div>

        {/* User Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등급</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">할당량 (일/월)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {user.email[0].toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</div>
                        <div className="text-xs text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <RoleBadge role={user.role} />
                      <select
                        className="text-xs border rounded p-1"
                        value={user.role}
                        onChange={(e) => handleUpdateUser(user.id, { role: e.target.value })}
                      >
                        <option value="pending">Pending</option>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                        <option value="special">Special</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_approved ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        승인됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        대기 중
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>일일: {user.daily_request_limit}회</div>
                    <div>월간: {user.monthly_token_limit?.toLocaleString() ?? 0} 토큰</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {!user.is_approved ? (
                      <button
                        onClick={() => handleUpdateUser(user.id, { isApproved: true, role: 'free' })} // Approve defaults to free
                        className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded-md"
                      >
                        승인하기
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateUser(user.id, { isApproved: false })}
                        className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md"
                      >
                        차단/대기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
