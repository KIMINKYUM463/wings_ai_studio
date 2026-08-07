'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string | null
  nickname: string | null
  profile_image_url: string | null
  approved: boolean
  created_at: string
}

type ApprovalFilter = 'all' | 'approved' | 'pending'

export default function AdminPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [emailQuery, setEmailQuery] = useState('')
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all')

  useEffect(() => {
    try {
      if (sessionStorage.getItem('wings_admin_ok') === '1') {
        setAuthed(true)
      } else {
        setIsLoading(false)
      }
    } catch {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    void loadUsers()
  }, [authed])

  const filteredUsers = useMemo(() => {
    const q = emailQuery.trim().toLowerCase()
    return users.filter((user) => {
      const email = (user.email || '').toLowerCase()
      const matchEmail = !q || email.includes(q)
      const isApproved = Boolean(user.approved)
      const matchApproval =
        approvalFilter === 'all' ||
        (approvalFilter === 'approved' && isApproved) ||
        (approvalFilter === 'pending' && !isApproved)
      return matchEmail && matchApproval
    })
  }, [users, emailQuery, approvalFilter])

  const approvedCount = users.filter((u) => u.approved).length
  const pendingCount = users.length - approvedCount

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault()
    if (passwordInput === '6168') {
      try {
        sessionStorage.setItem('wings_admin_ok', '1')
      } catch {
        /* ignore */
      }
      setAuthError('')
      setIsLoading(true)
      setAuthed(true)
    } else {
      setAuthError('비밀번호가 올바르지 않습니다.')
    }
  }

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users || [])
      } else {
        console.error('[Admin] 사용자 목록 로드 실패:', data.error)
        alert(`사용자 목록을 불러올 수 없습니다: ${data.error || '알 수 없는 오류'}`)
        setUsers([])
      }
    } catch (error) {
      console.error('[Admin] 사용자 목록 로드 중 예외 발생:', error)
      alert(
        `사용자 목록을 불러오는 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprovalToggle = async (userId: string, approved: boolean) => {
    try {
      const response = await fetch('/api/admin/users/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved }),
      })
      const data = await response.json()

      if (response.ok && data.user) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, approved: Boolean(data.user.approved) } : user
          )
        )
      } else {
        alert(`승인 상태 변경 실패: ${data.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('[Admin] 승인 변경 실패:', error)
      alert('승인 상태 변경에 실패했습니다.')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <form
          onSubmit={handleAdminLogin}
          className="w-full max-w-sm border border-gray-200 rounded-xl p-6 shadow-sm"
        >
          <h1 className="text-xl font-bold mb-2">관리자 로그인</h1>
          <p className="text-sm text-gray-500 mb-4">비밀번호를 입력하세요.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3 outline-none focus:border-blue-500"
            placeholder="비밀번호"
            autoFocus
          />
          {authError && <p className="text-sm text-red-500 mb-3">{authError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-black">관리자 페이지</h1>
            <p className="text-gray-600">가입한 사용자 목록 · 승인된 사용자만 롱폼/숏폼 이용 가능</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadUsers()}
              className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 transition-colors text-white text-sm font-medium"
            >
              새로고침
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-black"
            >
              메인으로
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            placeholder="이메일로 검색..."
            className="w-full md:max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'all', label: `전체 ${users.length}` },
                { key: 'approved', label: `승인 ${approvedCount}` },
                { key: 'pending', label: `비승인 ${pendingCount}` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setApprovalFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  approvalFilter === tab.key
                    ? tab.key === 'pending'
                      ? 'bg-amber-500 text-white'
                      : tab.key === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">로딩 중...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">사용자가 없거나 데이터를 불러올 수 없습니다.</p>
            <button
              onClick={() => void loadUsers()}
              className="px-4 py-2 rounded-md bg-blue-500 text-white hover:opacity-90 transition-opacity"
            >
              다시 시도
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-600">검색 조건에 맞는 사용자가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">이메일</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">닉네임</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">프로필</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">가입일</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">상태</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">승인 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isApproved = Boolean(user.approved)
                    return (
                      <tr
                        key={user.id}
                        className={`border-b border-gray-200 transition-colors ${
                          isApproved ? 'bg-white hover:bg-emerald-50/40' : 'bg-amber-50/50 hover:bg-amber-50'
                        }`}
                      >
                        <td className="px-6 py-4 text-sm text-black">{user.email || '이메일 없음'}</td>
                        <td className="px-6 py-4 text-sm text-black">{user.nickname || '닉네임 없음'}</td>
                        <td className="px-6 py-4">
                          {user.profile_image_url && (
                            <img
                              src={user.profile_image_url}
                              alt={user.nickname || '프로필'}
                              className="w-10 h-10 rounded-full"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isApproved ? '승인됨' : '비승인'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleApprovalToggle(user.id, true)}
                              disabled={isApproved}
                              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                                isApproved
                                  ? 'bg-emerald-600 text-white cursor-default'
                                  : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApprovalToggle(user.id, false)}
                              disabled={!isApproved}
                              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                                !isApproved
                                  ? 'bg-amber-600 text-white cursor-default'
                                  : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              비승인
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
