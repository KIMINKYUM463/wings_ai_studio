"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, Copy, ExternalLink, Eye, EyeOff, FileText, Key } from "lucide-react"

export const SHOTFORM_API_KEYS_UPDATED_EVENT = "shotform-api-keys-updated"

type ApiKeysState = {
  openai: string
  elevenlabs: string
  replicate: string
  ttsmaker: string
  supertone: string
  typecast: string
  youtubeClientId: string
  youtubeClientSecret: string
  youtubeDataApiKey: string
  apify: string
  vmake: string
  vmakeSecret: string
}

const EMPTY_KEYS: ApiKeysState = {
  openai: "",
  elevenlabs: "",
  replicate: "",
  ttsmaker: "",
  supertone: "",
  typecast: "",
  youtubeClientId: "",
  youtubeClientSecret: "",
  youtubeDataApiKey: "",
  apify: "",
  vmake: "",
  vmakeSecret: "",
}

function loadApiKeysFromStorage(): ApiKeysState {
  if (typeof window === "undefined") return EMPTY_KEYS
  return {
    openai: localStorage.getItem("shotform_openai_api_key") || "",
    elevenlabs: localStorage.getItem("shotform_elevenlabs_api_key") || "",
    replicate: localStorage.getItem("shotform_replicate_api_key") || "",
    ttsmaker: localStorage.getItem("shotform_ttsmaker_api_key") || "",
    supertone: localStorage.getItem("shotform_supertone_api_key") || "",
    typecast: localStorage.getItem("shotform_typecast_api_key") || "",
    youtubeClientId: localStorage.getItem("shotform_youtube_client_id") || "",
    youtubeClientSecret: localStorage.getItem("shotform_youtube_client_secret") || "",
    youtubeDataApiKey: localStorage.getItem("shotform_youtube_data_api_key") || "",
    apify: localStorage.getItem("shotform_apify_token") || "",
    vmake: localStorage.getItem("shotform_vmake_api_key") || "",
    vmakeSecret: localStorage.getItem("shotform_vmake_secret_access_key") || "",
  }
}

function saveApiKeysToStorage(keys: ApiKeysState) {
  localStorage.setItem("shotform_openai_api_key", keys.openai)
  localStorage.setItem("shotform_elevenlabs_api_key", keys.elevenlabs)
  localStorage.setItem("shotform_replicate_api_key", keys.replicate)
  localStorage.setItem("shotform_ttsmaker_api_key", keys.ttsmaker || "")
  localStorage.setItem("shotform_supertone_api_key", keys.supertone || "")
  localStorage.setItem("shotform_typecast_api_key", keys.typecast || "")
  localStorage.setItem("shotform_youtube_client_id", keys.youtubeClientId)
  localStorage.setItem("shotform_youtube_client_secret", keys.youtubeClientSecret)
  localStorage.setItem("shotform_youtube_data_api_key", keys.youtubeDataApiKey)
  localStorage.setItem("shotform_apify_token", keys.apify)
  localStorage.setItem("shotform_vmake_api_key", keys.vmake || "")
  localStorage.setItem("shotform_vmake_secret_access_key", keys.vmakeSecret || "")
  window.dispatchEvent(new Event(SHOTFORM_API_KEYS_UPDATED_EVENT))
}

type ShotFormApiKeySettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ApiKeyFieldProps = {
  id: string
  label: string
  value: string
  placeholder: string
  hint: string
  homepageUrl?: string
  show: boolean
  testing: boolean
  testResult?: { success: boolean; message: string }
  onChange: (value: string) => void
  onToggleShow: () => void
  onTest?: () => void
}

function ApiKeyField({
  id,
  label,
  value,
  placeholder,
  hint,
  homepageUrl,
  show,
  testing,
  testResult,
  onChange,
  onToggleShow,
  onTest,
}: ApiKeyFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {homepageUrl ? (
          <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
            <a href={homepageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              홈페이지
            </a>
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
        />
        <Button type="button" variant="outline" size="icon" onClick={onToggleShow} className="shrink-0">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => navigator.clipboard.writeText(value)}
          disabled={!value}
          className="shrink-0"
        >
          <Copy className="h-4 w-4" />
        </Button>
        {onTest ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onTest}
            disabled={testing || !value}
            className="shrink-0 text-xs"
          >
            {testing ? "확인 중..." : "연결확인"}
          </Button>
        ) : null}
      </div>
      {testResult ? (
        <p className={`text-xs ${testResult.success ? "text-green-600" : "text-red-600"}`}>{testResult.message}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function ShotFormApiKeySettingsDialog({ open, onOpenChange }: ShotFormApiKeySettingsDialogProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeysState>(EMPTY_KEYS)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  useEffect(() => {
    if (open) setApiKeys(loadApiKeysFromStorage())
  }, [open])

  const toggleShow = (key: string) => setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleSave = () => {
    saveApiKeysToStorage(apiKeys)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveToNotepad = () => {
    const apiKeysText = `WingsAIStudio ShotForm API 키 백업
생성일: ${new Date().toLocaleString("ko-KR")}

1. OpenAI API Key
${apiKeys.openai || "(미입력)"}

2. ElevenLabs API Key
${apiKeys.elevenlabs || "(미입력)"}

3. Replicate API Key
${apiKeys.replicate || "(미입력)"}

4. TTSMaker API Key
${apiKeys.ttsmaker || "(미입력)"}

5. Supertone API Key
${apiKeys.supertone || "(미입력)"}

6. Typecast API Key
${apiKeys.typecast || "(미입력)"}

7. YouTube Data API Key
${apiKeys.youtubeDataApiKey || "(미입력)"}

8. Apify API
${apiKeys.apify || "(미입력)"}

9. Vmake AI API Key
${apiKeys.vmake || "(미입력)"}

10. Vmake AI Secret Access Key
${apiKeys.vmakeSecret || "(미입력)"}
`
    const blob = new Blob([apiKeysText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `WingsAIStudio_ShotForm_API_Keys_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const testApiKey = useCallback(
    async (keyType: keyof ApiKeysState) => {
      const value = apiKeys[keyType]
      if (!value) {
        setTestResults((prev) => ({
          ...prev,
          [keyType]: { success: false, message: "API 키를 먼저 입력해주세요." },
        }))
        return
      }

      setTestingKeys((prev) => ({ ...prev, [keyType]: true }))
      setTestResults((prev) => ({ ...prev, [keyType]: { success: false, message: "" } }))

      try {
        switch (keyType) {
          case "openai": {
            const response = await fetch("https://api.openai.com/v1/models", {
              headers: { Authorization: `Bearer ${apiKeys.openai}` },
            })
            if (response.ok) {
              setTestResults((prev) => ({ ...prev, [keyType]: { success: true, message: "연결 성공!" } }))
            } else {
              const error = await response.json()
              setTestResults((prev) => ({
                ...prev,
                [keyType]: { success: false, message: `연결 실패: ${error.error?.message || response.statusText}` },
              }))
            }
            break
          }
          case "replicate": {
            const response = await fetch("/api/test-replicate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: apiKeys.replicate }),
            })
            const result = await response.json()
            setTestResults((prev) => ({ ...prev, [keyType]: { success: result.success, message: result.message } }))
            break
          }
          case "youtubeDataApiKey": {
            const response = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=${apiKeys.youtubeDataApiKey}&maxResults=1`
            )
            if (response.ok) {
              setTestResults((prev) => ({ ...prev, [keyType]: { success: true, message: "연결 성공!" } }))
            } else {
              const error = await response.json()
              setTestResults((prev) => ({
                ...prev,
                [keyType]: { success: false, message: `연결 실패: ${error.error?.message || response.statusText}` },
              }))
            }
            break
          }
          case "apify": {
            const response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(apiKeys.apify)}`)
            if (response.ok) {
              setTestResults((prev) => ({ ...prev, [keyType]: { success: true, message: "Apify API 연결 성공!" } }))
            } else {
              setTestResults((prev) => ({
                ...prev,
                [keyType]: { success: false, message: `연결 실패: ${response.statusText}` },
              }))
            }
            break
          }
          case "vmake": {
            if (!apiKeys.vmake || !apiKeys.vmakeSecret) {
              setTestResults((prev) => ({
                ...prev,
                [keyType]: { success: false, message: "API Key와 Secret Access Key를 모두 입력해 주세요." },
              }))
              break
            }
            const response = await fetch("/api/test-vmake", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: apiKeys.vmake, secretAccessKey: apiKeys.vmakeSecret }),
            })
            const result = await response.json()
            setTestResults((prev) => ({ ...prev, [keyType]: { success: result.success, message: result.message } }))
            break
          }
          case "ttsmaker": {
            const response = await fetch("/api/test-ttsmaker", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: apiKeys.ttsmaker }),
            })
            const result = await response.json()
            setTestResults((prev) => ({ ...prev, [keyType]: { success: result.success, message: result.message } }))
            break
          }
          case "elevenlabs": {
            const response = await fetch(`/api/elevenlabs-voices?apiKey=${encodeURIComponent(apiKeys.elevenlabs)}`)
            const result = await response.json().catch(() => ({}))
            setTestResults((prev) => ({
              ...prev,
              [keyType]: {
                success: response.ok && result.success !== false,
                message: response.ok ? "ElevenLabs 목소리 목록 확인 성공!" : result.error || response.statusText,
              },
            }))
            break
          }
          case "supertone": {
            const response = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(apiKeys.supertone)}`)
            const result = await response.json().catch(() => ({}))
            setTestResults((prev) => ({
              ...prev,
              [keyType]: {
                success: response.ok && result.success !== false,
                message: response.ok ? "수퍼톤 목소리 목록 확인 성공!" : result.error || response.statusText,
              },
            }))
            break
          }
          case "typecast": {
            const response = await fetch(`/api/typecast-voices?apiKey=${encodeURIComponent(apiKeys.typecast)}`)
            const result = await response.json().catch(() => ({}))
            setTestResults((prev) => ({
              ...prev,
              [keyType]: {
                success: response.ok && result.success !== false,
                message: response.ok ? "타입캐스트 목소리 목록 확인 성공!" : result.error || response.statusText,
              },
            }))
            break
          }
          default:
            setTestResults((prev) => ({
              ...prev,
              [keyType]: { success: false, message: "지원하지 않는 API 키입니다." },
            }))
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류"
        setTestResults((prev) => ({ ...prev, [keyType]: { success: false, message: `연결 실패: ${message}` } }))
      } finally {
        setTestingKeys((prev) => ({ ...prev, [keyType]: false }))
      }
    },
    [apiKeys]
  )

  const patchKey = (key: keyof ApiKeysState, value: string) => setApiKeys((prev) => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API 키 설정
          </DialogTitle>
          <DialogDescription>
            AI 서비스 사용을 위한 API 키를 입력해주세요. 키는 브라우저에 안전하게 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto py-4">
          <ApiKeyField
            id="openai-key"
            label="OpenAI API Key"
            value={apiKeys.openai}
            placeholder="sk-..."
            hint="GPT 모델 사용에 필요합니다"
            show={!!showKeys.openai}
            testing={!!testingKeys.openai}
            testResult={testResults.openai}
            onChange={(v) => patchKey("openai", v)}
            onToggleShow={() => toggleShow("openai")}
            onTest={() => void testApiKey("openai")}
          />
          <ApiKeyField
            id="ttsmaker-key"
            label="TTSMaker API Key"
            value={apiKeys.ttsmaker}
            placeholder="입력하세요"
            hint="TTSMaker 음성 합성에 사용됩니다"
            show={!!showKeys.ttsmaker}
            testing={!!testingKeys.ttsmaker}
            testResult={testResults.ttsmaker}
            onChange={(v) => patchKey("ttsmaker", v)}
            onToggleShow={() => toggleShow("ttsmaker")}
            onTest={() => void testApiKey("ttsmaker")}
          />
          <ApiKeyField
            id="elevenlabs-key"
            label="ElevenLabs API Key"
            value={apiKeys.elevenlabs}
            placeholder="입력하세요"
            hint="ElevenLabs 음성 합성에 사용됩니다 (쇼핑 숏폼·AI 쇼핑 숏폼 나레이션)."
            show={!!showKeys.elevenlabs}
            testing={!!testingKeys.elevenlabs}
            testResult={testResults.elevenlabs}
            onChange={(v) => patchKey("elevenlabs", v)}
            onToggleShow={() => toggleShow("elevenlabs")}
            onTest={() => void testApiKey("elevenlabs")}
          />
          <ApiKeyField
            id="supertone-key"
            label="Supertone API Key"
            value={apiKeys.supertone}
            placeholder="입력하세요"
            hint="Supertone 음성 합성에 사용됩니다 (숏폼 스튜디오·쇼핑 숏폼 나레이션)."
            show={!!showKeys.supertone}
            testing={!!testingKeys.supertone}
            testResult={testResults.supertone}
            onChange={(v) => patchKey("supertone", v)}
            onToggleShow={() => toggleShow("supertone")}
            onTest={() => void testApiKey("supertone")}
          />
          <ApiKeyField
            id="typecast-key"
            label="Typecast API Key"
            value={apiKeys.typecast}
            placeholder="입력하세요"
            hint="타입캐스트(TTS) 음성 합성에 사용됩니다 (숏폼 스튜디오 나레이션)."
            show={!!showKeys.typecast}
            testing={!!testingKeys.typecast}
            testResult={testResults.typecast}
            onChange={(v) => patchKey("typecast", v)}
            onToggleShow={() => toggleShow("typecast")}
            onTest={() => void testApiKey("typecast")}
          />
          <ApiKeyField
            id="replicate-key"
            label="Replicate API Key"
            value={apiKeys.replicate}
            placeholder="r8_..."
            hint="AI 모델 실행에 사용됩니다"
            show={!!showKeys.replicate}
            testing={!!testingKeys.replicate}
            testResult={testResults.replicate}
            onChange={(v) => patchKey("replicate", v)}
            onToggleShow={() => toggleShow("replicate")}
            onTest={() => void testApiKey("replicate")}
          />

          <div className="my-4 border-t border-slate-200" />

          <ApiKeyField
            id="youtube-data-api-key"
            label="YouTube Data API Key"
            value={apiKeys.youtubeDataApiKey}
            placeholder="Google Cloud Console에서 발급받은 API Key"
            hint="유튜브 분석, 유튜브 실시간 분석 기능에 사용됩니다."
            show={!!showKeys.youtubeDataApiKey}
            testing={!!testingKeys.youtubeDataApiKey}
            testResult={testResults.youtubeDataApiKey}
            onChange={(v) => patchKey("youtubeDataApiKey", v)}
            onToggleShow={() => toggleShow("youtubeDataApiKey")}
            onTest={() => void testApiKey("youtubeDataApiKey")}
          />
          <ApiKeyField
            id="apify-token"
            label="Apify API"
            value={apiKeys.apify}
            placeholder="Apify Console에서 발급한 API 토큰"
            hint="짜집기·제품 검색에서 TikTok·샤오홍슈·더우인 후보 수집에 사용합니다."
            homepageUrl="https://apify.com"
            show={!!showKeys.apify}
            testing={!!testingKeys.apify}
            testResult={testResults.apify}
            onChange={(v) => patchKey("apify", v)}
            onToggleShow={() => toggleShow("apify")}
            onTest={() => void testApiKey("apify")}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">Vmake AI</Label>
              <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
                <a href="https://vmake.ai" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  홈페이지
                </a>
              </Button>
            </div>
            <Input
              id="vmake-api-key"
              type={showKeys.vmake ? "text" : "password"}
              placeholder="API Key (MT_AK)"
              value={apiKeys.vmake}
              onChange={(e) => patchKey("vmake", e.target.value)}
              className="font-mono text-sm"
            />
            <Input
              id="vmake-secret-access-key"
              type={showKeys.vmakeSecret ? "text" : "password"}
              placeholder="Secret Access Key (MT_SK)"
              value={apiKeys.vmakeSecret}
              onChange={(e) => patchKey("vmakeSecret", e.target.value)}
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  toggleShow("vmake")
                  toggleShow("vmakeSecret")
                }}
                className="shrink-0"
              >
                {showKeys.vmake ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void testApiKey("vmake")}
                disabled={testingKeys.vmake || !apiKeys.vmake || !apiKeys.vmakeSecret}
                className="shrink-0 text-xs"
              >
                {testingKeys.vmake ? "확인 중..." : "연결확인"}
              </Button>
            </div>
            {testResults.vmake ? (
              <p className={`text-xs ${testResults.vmake.success ? "text-green-600" : "text-red-600"}`}>
                {testResults.vmake.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              샤오홍슈·더우인 중국어 하드 자막 제거용. vmake.ai/developers에서 발급한 API Key + Secret을 저장하세요.
            </p>
          </div>
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-green-600">
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>저장되었습니다</span>
              </>
            ) : null}
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>복사되었습니다</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveToNotepad} variant="outline" className="min-w-[140px]">
              <FileText className="mr-2 h-4 w-4" />
              메모장으로 저장
            </Button>
            <Button onClick={handleSave} className="min-w-[100px]">
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
