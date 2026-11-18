import fs from 'node:fs/promises';
import path from 'node:path';
import { getLang } from './languages';

const FONTS_DIR = () => process.env.FONTS_DIR || path.join(process.cwd(), 'public', 'fonts');
const SYSTEM_FONTS = () => process.env.SYSTEM_FONTS_DIR || (process.platform === 'win32' ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts') : '/usr/share/fonts');

/**
 * 한글 폰트(Pretendard)에 없는 글자(일본어 가나·번체·태국어)는 OS 폰트를 렌더 폴더에 복사해 쓴다.
 * (폰트 파일은 저장소에 넣지 않는다 — 라이선스)
 * 폰트를 못 찾으면 Pretendard 그대로 (글자가 깨질 수 있음 → notes에 안내)
 */
export async function langFonts(lang: string | undefined, workDir: string): Promise<{ dir?: string; font?: string; missing?: boolean }> {
  const l = getLang(lang);
  if (!l?.font) return {};
  const dir = path.join(workDir, 'fonts');
  await fs.mkdir(dir, { recursive: true });
  for (const f of await fs.readdir(FONTS_DIR()).catch(() => [] as string[])) await fs.copyFile(path.join(FONTS_DIR(), f), path.join(dir, f));
  let found = 0;
  for (const f of l.font.files) {
    const src = path.join(SYSTEM_FONTS(), f);
    if (await fs.access(src).then(() => true, () => false)) { await fs.copyFile(src, path.join(dir, f)); found++; }
  }
  return found ? { dir, font: l.font.family } : { missing: true };
}

/** ASS 스타일·인라인 폰트 이름을 언어 폰트로 바꾼다 */
export const withLangFont = (ass: string, font?: string) => (font ? ass.replace(/,Pretendard,/g, `,${font},`).replace(/\\fnPretendard/g, `\\fn${font}`) : ass);
