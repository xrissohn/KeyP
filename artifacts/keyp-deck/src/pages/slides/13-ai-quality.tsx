export default function SlideAiQuality() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] left-[-6vw] w-[44vw] h-[44vw] rounded-full bg-[#34D399] opacity-[0.10] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#7C6BFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#7C6BFF]">
          AI CAPABILITY · 품질과 비용 설계
        </span>
      </div>

      <h2 className="absolute top-[14vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        쓸수록 똑똑해지고, <span className="text-[#34D399]">싸지는</span> 구조
      </h2>

      <div className="absolute top-[33vh] left-[5vw] right-[5vw] grid grid-cols-2 gap-[2vw]">
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.2vw]">
          <div className="text-[2vw] font-bold text-white">의미 기반 중복제거</div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">Jaccard 유사도로 같은 소식을 한 번만. 클라이언트·서버 양쪽에서 적용.</p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.2vw]">
          <div className="text-[2vw] font-bold text-white">출처 교차검증</div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">URL 도달성 게이트 + 죽은 링크 블랙리스트 + 클릭 시 안전망.</p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.2vw]">
          <div className="text-[2vw] font-bold text-white">피드백 학습</div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">좋아요/별로예요로 선별·프롬프트를 개인화. 가중치 감쇠로 최신 취향 반영.</p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.2vw]">
          <div className="text-[2vw] font-bold text-white">비용 최적화</div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">스펙 버킷 캐싱 · in-flight 코얼레싱 · 월 부스트 쿼터로 LLM 비용 관리.</p>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">AI 활용 역량 · 13</span>
      </div>
    </div>
  );
}
