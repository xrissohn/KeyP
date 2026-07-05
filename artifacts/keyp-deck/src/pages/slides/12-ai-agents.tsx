export default function SlideAiAgents() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] right-[-6vw] w-[44vw] h-[44vw] rounded-full bg-[#7C6BFF] opacity-[0.14] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#7C6BFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#7C6BFF]">
          AI CAPABILITY · 에이전트별 역할과 모델
        </span>
      </div>

      <h2 className="absolute top-[14vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        4개 에이전트, <span className="text-[#7C6BFF]">각자의 전문 모델</span>
      </h2>

      <div className="absolute top-[33vh] left-[5vw] right-[5vw] grid grid-cols-2 gap-[2vw]">
        <div className="rounded-[1.5vh] border-l-[0.6vw] border border-[#5B7FFF] bg-[#161C30] p-[2.2vw]">
          <div className="flex items-baseline gap-[1vw]">
            <span className="text-[2.1vw] font-bold">Planner</span>
            <span className="font-display text-[1.4vw] font-bold text-[#5B7FFF]">GPT</span>
          </div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">관심사 구조화·검색 전략 수립. 의도와 타깃 페르소나를 추론한다.</p>
        </div>
        <div className="rounded-[1.5vh] border-l-[0.6vw] border border-[#4F46E5] bg-[#161C30] p-[2.2vw]">
          <div className="flex items-baseline gap-[1vw]">
            <span className="text-[2.1vw] font-bold">Collector</span>
            <span className="font-display text-[1.4vw] font-bold text-[#4F46E5]">Perplexity sonar-pro</span>
          </div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">전략대로 실제 웹을 검색해 유망한 출처 후보만 수집한다.</p>
        </div>
        <div className="rounded-[1.5vh] border-l-[0.6vw] border border-[#7C6BFF] bg-[#161C30] p-[2.2vw]">
          <div className="flex items-baseline gap-[1vw]">
            <span className="text-[2.1vw] font-bold">Verifier</span>
            <span className="font-display text-[1.4vw] font-bold text-[#7C6BFF]">Claude</span>
          </div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">출처를 교차검증하고 신뢰도·관련성 점수를 매긴다.</p>
        </div>
        <div className="rounded-[1.5vh] border-l-[0.6vw] border border-[#FF6B8A] bg-[#161C30] p-[2.2vw]">
          <div className="flex items-baseline gap-[1vw]">
            <span className="text-[2.1vw] font-bold">Deliverer</span>
            <span className="font-display text-[1.4vw] font-bold text-[#FF6B8A]">Sort · Dedup</span>
          </div>
          <p className="mt-[1.2vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">최신성·신뢰도로 정렬하고 의미 기반 중복을 제거해 전달한다.</p>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">AI 활용 역량 · 12</span>
      </div>
    </div>
  );
}
