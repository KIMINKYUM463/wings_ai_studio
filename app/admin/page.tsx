'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string | null
  nickname: string | null
  profile_image_url: string | null
  instructor: 'wings' | 'onback' | null
  created_at: string
}

interface Program {
  id: string
  program_name: string
  program_path: string
  program_description: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInstructor, setSelectedInstructor] = useState<'wings' | 'onback' | null>(null)

  useEffect(() => {
    loadUsers()
    loadPrograms()
    
    // 5초마다 사용자 목록 자동 새로고침 (실시간 업데이트)
    const interval = setInterval(() => {
      loadUsers()
    }, 5000) // 5초마다
    
    return () => {
      clearInterval(interval)
    }
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      
      if (response.ok) {
        const usersData = data.users || []
        setUsers(usersData)
        console.log('[Admin] 사용자 목록 로드 성공:', usersData.length, '명')
        console.log('[Admin] 전체 사용자 데이터:', JSON.stringify(usersData, null, 2))
        // 각 사용자의 instructor 값 확인
        usersData.forEach((user: User, index: number) => {
          console.log(`[Admin] 사용자 ${index + 1}: ${user.email || user.nickname || '이름없음'} (id: ${user.id}), instructor =`, user.instructor, `(type: ${typeof user.instructor}, === 'wings': ${user.instructor === 'wings'}, === 'onback': ${user.instructor === 'onback'})`)
        })
      } else {
        console.error('[Admin] 사용자 목록 로드 실패:', data.error)
        alert(`사용자 목록을 불러올 수 없습니다: ${data.error || '알 수 없는 오류'}`)
        setUsers([])
      }
    } catch (error) {
      console.error('[Admin] 사용자 목록 로드 중 예외 발생:', error)
      alert(`사용자 목록을 불러오는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadPrograms = async () => {
    try {
      const response = await fetch('/api/admin/programs')
      if (response.ok) {
        const data = await response.json()
        setPrograms(data.programs || [])
      }
    } catch (error) {
      console.error('프로그램 목록 로드 실패:', error)
    }
  }

  const handleInstructorToggle = async (userId: string, instructor: 'wings' | 'onback') => {
    try {
      // 현재 사용자의 instructor 값 확인
      const currentUser = users.find(u => u.id === userId)
      const currentInstructor = currentUser?.instructor
      
      // 토글: 같은 강사를 다시 클릭하면 해제 (null), 다른 강사면 변경
      const newInstructor = currentInstructor === instructor ? null : instructor
      
      console.log('[Admin] 강사 토글:', { userId, currentInstructor, newInstructor })
      
      const response = await fetch('/api/admin/users/instructor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          instructor: newInstructor,
        }),
      })

      const data = await response.json()
      
      if (response.ok && data.user) {
        console.log('[Admin] 강사 설정 성공:', data.user)
        // 응답에서 받은 사용자 데이터로 즉시 업데이트
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === userId 
              ? { ...user, instructor: data.user.instructor }
              : user
          )
        )
      } else {
        console.error('[Admin] 강사 설정 실패:', data.error)
        alert(`강사 설정 실패: ${data.error || '알 수 없는 오류'}`)
        // 실패 시 전체 목록 다시 로드
        await loadUsers()
      }
    } catch (error) {
      console.error('[Admin] 강사 설정 중 예외 발생:', error)
      alert('강사 설정에 실패했습니다.')
      // 실패 시 전체 목록 다시 로드
      await loadUsers()
    }
  }

  const getInstructorName = (instructor: string | null) => {
    switch (instructor) {
      case 'wings':
        return '윙스'
      case 'onback':
        return '온백'
      default:
        return '미지정'
    }
  }

  const getInstructorPrograms = (instructor: 'wings' | 'onback' | null) => {
    if (!instructor) return []
    return programs.filter(p => p.instructor === instructor)
  }

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-black">관리자 페이지</h1>
            <p className="text-gray-600">가입한 사용자 목록 및 강사 설정 (5초마다 자동 새로고침)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadUsers}
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

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">로딩 중...</p>
          </div>
        ) : users.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">사용자가 없거나 데이터를 불러올 수 없습니다.</p>
            <button
              onClick={loadUsers}
              className="px-4 py-2 rounded-md bg-blue-500 text-white hover:opacity-90 transition-opacity"
            >
              다시 시도
            </button>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">지정강사</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-600">
                        가입한 사용자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const userPrograms = getInstructorPrograms(user.instructor)
                      // instructor 값 확인을 위한 디버깅
                      const instructorValue = user.instructor
                      const isWings = instructorValue === 'wings' || String(instructorValue) === 'wings'
                      const isOnback = instructorValue === 'onback' || String(instructorValue) === 'onback'
                      
                      // 디버깅: 렌더링 시점의 instructor 값 확인 (첫 번째 사용자만)
                      if (users.indexOf(user) === 0) {
                        console.log(`[Admin Render] 첫 번째 사용자 ${user.email}: instructor =`, instructorValue, `(type: ${typeof instructorValue}), isWings=${isWings}, isOnback=${isOnback}`)
                      }
                      
                      return (
                        <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-black">
                            {user.email || '이메일 없음'}
                          </td>
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
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleInstructorToggle(user.id, 'wings')}
                                className={`px-4 py-2 text-sm rounded transition-colors font-medium ${
                                  isWings
                                    ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                                    : 'bg-gray-100 border border-gray-300 hover:bg-blue-50 hover:border-blue-300 text-black'
                                }`}
                                title={isWings ? '클릭하여 선택 해제' : '클릭하여 윙스 강사 선택'}
                              >
                                윙스
                              </button>
                              <button
                                onClick={() => handleInstructorToggle(user.id, 'onback')}
                                className={`px-4 py-2 text-sm rounded transition-colors font-medium ${
                                  isOnback
                                    ? 'bg-green-500 text-white shadow-md hover:bg-green-600'
                                    : 'bg-gray-100 border border-gray-300 hover:bg-green-50 hover:border-green-300 text-black'
                                }`}
                                title={isOnback ? '클릭하여 선택 해제' : '클릭하여 온백 강사 선택'}
                              >
                                온백
                              </button>
                              {userPrograms.length > 0 && (
                                <div className="ml-2 text-xs text-gray-500" title={userPrograms.map(p => p.program_name).join(', ')}>
                                  ({userPrograms.length}개 프로그램)
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

