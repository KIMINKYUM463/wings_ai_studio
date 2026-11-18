'use client';
import StartPage from '@/components/wings-shopping-v2/StartPage';

export default function Home() {
  return (
    <StartPage
      pill="윙스쇼핑숏폼 버전2"
      title={
        <>
          쇼츠 하나 넣으면,
          <br />
          <em>새 쇼츠 하나</em>
        </>
      }
      subtitle="참고할 쇼핑 쇼츠 주소를 넣으세요. 같은 상품 영상을 모아 대본·음성·자막까지 맞춥니다."
      projectsBase="/WingsAIStudioShotForm/wings-shopping-v2"
    />
  );
}
