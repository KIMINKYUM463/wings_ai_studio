function wavData(buf: Buffer): { fmt: Buffer; pcm: Buffer } {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("아담 TTS 응답이 wav가 아닙니다.")
  }
  let offset = 12
  let fmt: Buffer | null = null
  let pcm: Buffer | null = null
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const chunk = buf.subarray(offset + 8, offset + 8 + size)
    if (id === "fmt ") fmt = Buffer.from(chunk)
    if (id === "data") pcm = Buffer.from(chunk)
    offset += 8 + size + (size % 2)
  }
  if (!fmt || !pcm) throw new Error("wav 청크를 읽지 못했습니다.")
  return { fmt, pcm }
}

/** 같은 형식의 wav 여러 개를 하나로 이어 붙인다. */
export function concatWav(buffers: Buffer[]): Buffer {
  if (!buffers.length) throw new Error("합칠 오디오가 없습니다.")
  if (buffers.length === 1) return buffers[0]!
  const parsed = buffers.map(wavData)
  const fmt = parsed[0]!.fmt
  if (parsed.some((p) => !p.fmt.equals(fmt))) {
    throw new Error("아담 TTS 조각의 오디오 형식이 서로 다릅니다.")
  }
  const pcm = Buffer.concat(parsed.map((p) => p.pcm))
  const out = Buffer.alloc(12 + 8 + fmt.length + 8 + pcm.length)
  out.write("RIFF", 0)
  out.writeUInt32LE(out.length - 8, 4)
  out.write("WAVE", 8)
  out.write("fmt ", 12)
  out.writeUInt32LE(fmt.length, 16)
  fmt.copy(out, 20)
  const dataAt = 20 + fmt.length
  out.write("data", dataAt)
  out.writeUInt32LE(pcm.length, dataAt + 4)
  pcm.copy(out, dataAt + 8)
  return out
}
