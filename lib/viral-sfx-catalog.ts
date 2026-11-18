/** 바이럴 숏폼 효과음 묶음 (public/viral-sfx). 수동 선택·자동 배치 공용 목록. 앞 무음 제거, 44.1kHz 스테레오 mp3. */
export type ViralSfxCategory =
  | 'transition' | 'pop' | 'click' | 'emphasis' | 'reaction' | 'money' | 'fail' | 'funny' | 'ambient';

export type ViralSfx = {
  id: string;
  /** public 기준 경로 */
  file: string;
  label: string;
  category: ViralSfxCategory;
  durationSec: number;
  tags: string[];
};

export const VIRAL_SFX = [
  { id: 'among-us-reveal', file: '/viral-sfx/among-us-reveal.mp3', label: '어몽어스 역할 공개', category: 'emphasis', durationSec: 4.39, tags: ['meme', 'reveal'] },
  { id: 'core', file: '/viral-sfx/core.mp3', label: '코어 효과음', category: 'emphasis', durationSec: 0.68, tags: ['meme', 'hit'] },
  { id: 'fahhh', file: '/viral-sfx/fahhh.mp3', label: '파아아아', category: 'fail', durationSec: 1.91, tags: ['meme', 'fail'] },
  { id: 'metallic-riser', file: '/viral-sfx/metallic-riser.mp3', label: '메탈릭 라이저', category: 'transition', durationSec: 2.66, tags: ['riser', 'buildup'] },
  { id: 'simple-whoosh', file: '/viral-sfx/simple-whoosh.mp3', label: '심플 휙', category: 'transition', durationSec: 0.55, tags: ['whoosh'] },
  { id: 'vine-boom', file: '/viral-sfx/vine-boom.mp3', label: '바인 붐', category: 'emphasis', durationSec: 1.23, tags: ['meme', 'boom', 'hook'] },
  { id: 'ddak-best', file: '/viral-sfx/ddak-best.mp3', label: '딱 베스트 효과음', category: 'pop', durationSec: 1.07, tags: ['hit'] },
  { id: 'ddak', file: '/viral-sfx/ddak.mp3', label: '딱!', category: 'pop', durationSec: 1.07, tags: ['hit'] },
  { id: 'question-ding', file: '/viral-sfx/question-ding.mp3', label: '띠동띠동(물음표)', category: 'reaction', durationSec: 0.89, tags: ['question', 'curiosity'] },
  { id: 'ppyong', file: '/viral-sfx/ppyong.mp3', label: '뿅', category: 'pop', durationSec: 0.31, tags: ['cute'] },
  { id: 'swish', file: '/viral-sfx/swish.mp3', label: '쉭', category: 'transition', durationSec: 1.04, tags: ['whoosh'] },
  { id: 'absurd', file: '/viral-sfx/absurd.mp3', label: '어이없음', category: 'fail', durationSec: 5.85, tags: ['reaction', 'absurd'] },
  { id: 'yeee', file: '/viral-sfx/yeee.mp3', label: '예에에', category: 'reaction', durationSec: 2.27, tags: ['cheer'] },
  { id: 'caption-point', file: '/viral-sfx/caption-point.mp3', label: '자막 나올때 포인트 소리', category: 'pop', durationSec: 0.94, tags: ['caption', 'point'] },
  { id: 'caption-ding-dong', file: '/viral-sfx/caption-ding-dong.mp3', label: '자막용 띵동3', category: 'pop', durationSec: 0.76, tags: ['caption', 'ding'] },
  { id: 'heoeong-a', file: '/viral-sfx/heoeong-a.mp3', label: '허엉 효과음', category: 'reaction', durationSec: 12.04, tags: ['surprise'] },
  { id: 'hwiik', file: '/viral-sfx/hwiik.mp3', label: '휘익', category: 'transition', durationSec: 0.81, tags: ['whoosh'] },
  { id: 'ppok', file: '/viral-sfx/ppok.mp3', label: '뽁', category: 'pop', durationSec: 1.2, tags: ['pop'] },
  { id: 'cartoon-whoosh', file: '/viral-sfx/cartoon-whoosh.mp3', label: '휙(만화적)', category: 'transition', durationSec: 0.81, tags: ['whoosh', 'cartoon'] },
  { id: 'money-tiring', file: '/viral-sfx/money-tiring.mp3', label: '띠링(돈)', category: 'money', durationSec: 0.94, tags: ['money', 'price'] },
  { id: 'nope', file: '/viral-sfx/nope.mp3', label: 'nope', category: 'fail', durationSec: 0.68, tags: ['no'] },
  { id: 'yeah', file: '/viral-sfx/yeah.mp3', label: 'YEAH!', category: 'reaction', durationSec: 2.27, tags: ['cheer', 'proof'] },
  { id: 'wow-a', file: '/viral-sfx/wow-a.mp3', label: '와우', category: 'reaction', durationSec: 1.83, tags: ['wow', 'proof'] },
  { id: 'sparkle', file: '/viral-sfx/sparkle.mp3', label: '뾰로롱', category: 'pop', durationSec: 2.35, tags: ['magic', 'intro'] },
  { id: 'surprise-bg', file: '/viral-sfx/surprise-bg.mp3', label: '놀라는배경', category: 'ambient', durationSec: 2.38, tags: ['surprise'] },
  { id: 'money-ching', file: '/viral-sfx/money-ching.mp3', label: '철컥띵(돈)', category: 'money', durationSec: 2.17, tags: ['money', 'price', 'register'] },
  { id: 'transition-hook', file: '/viral-sfx/transition-hook.mp3', label: '훅 소리 (화면전환 효과음)', category: 'transition', durationSec: 0.24, tags: ['whoosh'] },
  { id: 'transition-hook2', file: '/viral-sfx/transition-hook2.mp3', label: '훅~ (화면전환 효과음)', category: 'transition', durationSec: 0.29, tags: ['whoosh'] },
  { id: 'ting', file: '/viral-sfx/ting.mp3', label: '띵', category: 'emphasis', durationSec: 1.23, tags: ['ding', 'idea'] },
  { id: 'heok', file: '/viral-sfx/heok.mp3', label: '헉', category: 'reaction', durationSec: 0.55, tags: ['surprise'] },
  { id: 'heoeolk', file: '/viral-sfx/heoeolk.mp3', label: '허얽!', category: 'reaction', durationSec: 1.1, tags: ['surprise'] },
  { id: 'mouse-click', file: '/viral-sfx/mouse-click.mp3', label: '마우스 클릭 (컴퓨터 효과음)', category: 'click', durationSec: 0.26, tags: ['click', 'cta'] },
  { id: 'discover', file: '/viral-sfx/discover.mp3', label: '놀람.발견', category: 'emphasis', durationSec: 0.81, tags: ['surprise', 'reveal'] },
  { id: 'explosion', file: '/viral-sfx/explosion.mp3', label: '폭발', category: 'emphasis', durationSec: 2.82, tags: ['boom'] },
  { id: 'splash', file: '/viral-sfx/splash.mp3', label: '풍덩', category: 'funny', durationSec: 12.04, tags: ['water'] },
  { id: 'ding-ding-awkward', file: '/viral-sfx/ding-ding-awkward.mp3', label: 'Ding Ding(난감)', category: 'fail', durationSec: 1.52, tags: ['awkward'] },
  { id: 'vine-boom2', file: '/viral-sfx/vine-boom2.mp3', label: 'vine-boom', category: 'emphasis', durationSec: 1.23, tags: ['meme', 'boom'] },
  { id: 'wow-b', file: '/viral-sfx/wow-b.mp3', label: 'WOW 1', category: 'reaction', durationSec: 1.2, tags: ['wow'] },
  { id: 'flashback', file: '/viral-sfx/flashback.mp3', label: '기억 회상 효과음', category: 'transition', durationSec: 4.47, tags: ['flashback'] },
  { id: 'nop', file: '/viral-sfx/nop.mp3', label: '놉', category: 'fail', durationSec: 0.37, tags: ['no'] },
  { id: 'money', file: '/viral-sfx/money.mp3', label: '돈효과음', category: 'money', durationSec: 12.04, tags: ['money'] },
  { id: 'dudung', file: '/viral-sfx/dudung.mp3', label: '두둥', category: 'emphasis', durationSec: 1.65, tags: ['reveal', 'hook'] },
  { id: 'dudung2', file: '/viral-sfx/dudung2.mp3', label: '두둥2', category: 'emphasis', durationSec: 0.78, tags: ['reveal', 'hook'] },
  { id: 'rewind', file: '/viral-sfx/rewind.mp3', label: '뒤로감기', category: 'transition', durationSec: 2.43, tags: ['rewind'] },
  { id: 'drum', file: '/viral-sfx/drum.mp3', label: '드럼', category: 'emphasis', durationSec: 1.07, tags: ['drum', 'badumtss'] },
  { id: 'ddalkkak', file: '/viral-sfx/ddalkkak.mp3', label: '딸깍 클릭', category: 'click', durationSec: 0.29, tags: ['click', 'cta'] },
  { id: 'tturing', file: '/viral-sfx/tturing.mp3', label: '뜨링!', category: 'pop', durationSec: 2.01, tags: ['ding'] },
  { id: 'mwoji', file: '/viral-sfx/mwoji.mp3', label: '뭐지', category: 'reaction', durationSec: 0.71, tags: ['question', 'curiosity'] },
  { id: 'ppok-1', file: '/viral-sfx/ppok-1.mp3', label: '뽁소리 (1)', category: 'pop', durationSec: 0.34, tags: ['pop'] },
  { id: 'ppok-2', file: '/viral-sfx/ppok-2.mp3', label: '뽁소리 (2)', category: 'pop', durationSec: 0.37, tags: ['pop'] },
  { id: 'ppok-3', file: '/viral-sfx/ppok-3.mp3', label: '뽁소리 (3)', category: 'pop', durationSec: 0.42, tags: ['pop'] },
  { id: 'kids-laugh', file: '/viral-sfx/kids-laugh.mp3', label: '아이들 웃음소리', category: 'funny', durationSec: 10.21, tags: ['laugh'] },
  { id: 'baby-laugh', file: '/viral-sfx/baby-laugh.mp3', label: '앙팡치즈 아기 웃음소리', category: 'funny', durationSec: 1.31, tags: ['laugh'] },
  { id: 'duck', file: '/viral-sfx/duck.mp3', label: '오리', category: 'funny', durationSec: 0.5, tags: ['duck'] },
  { id: 'wow-c', file: '/viral-sfx/wow-c.mp3', label: '와우!', category: 'reaction', durationSec: 1.1, tags: ['wow'] },
  { id: 'what', file: '/viral-sfx/what.mp3', label: '왓', category: 'reaction', durationSec: 0.78, tags: ['question'] },
  { id: 'ppok-dull', file: '/viral-sfx/ppok-dull.mp3', label: '조금 둔탁한 뽁 소리', category: 'pop', durationSec: 0.47, tags: ['pop'] },
  { id: 'ppok-clear', file: '/viral-sfx/ppok-clear.mp3', label: '조금 맑은 뽁소리', category: 'pop', durationSec: 0.5, tags: ['pop'] },
  { id: 'glass-break', file: '/viral-sfx/glass-break.mp3', label: '쨍그랑', category: 'fail', durationSec: 1.31, tags: ['break'] },
  { id: 'knife', file: '/viral-sfx/knife.mp3', label: '칼 효과음', category: 'emphasis', durationSec: 11.23, tags: ['slash'] },
  { id: 'click7', file: '/viral-sfx/click7.mp3', label: '클릭소리7', category: 'click', durationSec: 1.41, tags: ['click'] },
  { id: 'keyboard', file: '/viral-sfx/keyboard.mp3', label: '키보드 소리', category: 'click', durationSec: 1.15, tags: ['typing'] },
  { id: 'tara', file: '/viral-sfx/tara.mp3', label: '타라', category: 'emphasis', durationSec: 1.57, tags: ['fanfare', 'reveal'] },
  { id: 'teong', file: '/viral-sfx/teong.mp3', label: '텅(터엉)', category: 'fail', durationSec: 0.89, tags: ['empty'] },
  { id: 'waves', file: '/viral-sfx/waves.mp3', label: '파도소리 효과음', category: 'ambient', durationSec: 12.04, tags: ['sea'] },
  { id: 'finger-snap', file: '/viral-sfx/finger-snap.mp3', label: '핑거스냅', category: 'click', durationSec: 0.86, tags: ['snap'] },
  { id: 'crazy-laugh', file: '/viral-sfx/crazy-laugh.mp3', label: '하하하 정신나간웃는소리', category: 'funny', durationSec: 4.05, tags: ['laugh'] },
  { id: 'phone-vibrate', file: '/viral-sfx/phone-vibrate.mp3', label: '핸드폰 진동', category: 'click', durationSec: 5.98, tags: ['phone'] },
  { id: 'heoeong-b', file: '/viral-sfx/heoeong-b.mp3', label: '허엉 효과음', category: 'reaction', durationSec: 12.04, tags: ['surprise'] },
  { id: 'confusion', file: '/viral-sfx/confusion.mp3', label: '혼란', category: 'reaction', durationSec: 4.23, tags: ['confused'] },
  { id: 'sulky', file: '/viral-sfx/sulky.mp3', label: '히잉 (시무룩)', category: 'fail', durationSec: 0.78, tags: ['sad'] },
] as const satisfies readonly ViralSfx[];

export type ViralSfxId = (typeof VIRAL_SFX)[number]['id'];
