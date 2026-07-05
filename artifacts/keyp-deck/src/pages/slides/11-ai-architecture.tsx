export default function SlideAiArchitecture() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute bottom-[-18vh] right-[-6vw] w-[48vw] h-[48vw] rounded-full bg-[#4F46E5] opacity-[0.16] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#7C6BFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#7C6BFF]">
          AI CAPABILITY · 멀티 에이전트 아키텍처
        </span>
      </div>

      <h2 className="absolute top-[14vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        '검색'이 아니라 <span className="text-[#5B7FFF]">'추론 후 좌표 찾기'</span>
      </h2>

      <div className="absolute top-[33vh] left-[5vw] right-[5vw] flex items-stretch justify-between gap-[1.2vw]">
        <div className="flex-1 rounded-[1.5vh] border border-[#5B7FFF] bg-[#161C30] p-[1.8vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#5B7FFF]">STEP 1</div>
          <div className="mt-[1vh] text-[2vw] font-bold">Planner</div>
          <p className="mt-[1vh] text-[1.4vw] leading-[1.4] text-[#9AA4C0]">관심사 구조화 · 검색 전략 수립</p>
        </div>
        <div className="flex items-center font-display text-[2.4vw] font-bold text-[#5B7FFF]">→</div>
        <div className="flex-1 rounded-[1.5vh] border border-[#4F46E5] bg-[#161C30] p-[1.8vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#4F46E5]">STEP 2</div>
          <div className="mt-[1vh] text-[2vw] font-bold">Collector</div>
          <p className="mt-[1vh] text-[1.4vw] leading-[1.4] text-[#9AA4C0]">전략대로 유망 출처만 실제 수집</p>
        </div>
        <div className="flex items-center font-display text-[2.4vw] font-bold text-[#7C6BFF]">→</div>
        <div className="flex-1 rounded-[1.5vh] border border-[#7C6BFF] bg-[#161C30] p-[1.8vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#7C6BFF]">STEP 3</div>
          <div className="mt-[1vh] text-[2vw] font-bold">Verifier</div>
          <p className="mt-[1vh] text-[1.4vw] leading-[1.4] text-[#9AA4C0]">출처 교차검증 · 신뢰도 점수</p>
        </div>
        <div className="flex items-center font-display text-[2.4vw] font-bold text-[#FF6B8A]">→</div>
        <div className="flex-1 rounded-[1.5vh] border border-[#FF6B8A] bg-[#161C30] p-[1.8vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#FF6B8A]">STEP 4</div>
          <div className="mt-[1vh] text-[2vw] font-bold">Deliverer</div>
          <p className="mt-[1vh] text-[1.4vw] leading-[1.4] text-[#9AA4C0]">최신성·신뢰도 정렬 · 중복제거</p>
        </div>
      </div>

      <div className="absolute bottom-[12vh] left-[5vw] right-[5vw] rounded-[1.6vh] border border-[#34D399]/50 bg-[#101A14] px-[3vw] py-[3.2vh]">
        <div className="text-[1.7vw] font-bold text-[#34D399]">핵심 철학 — AlphaGo식 후보 축소</div>
        <p className="mt-[1.2vh] text-[1.6vw] leading-[1.45] text-[#9AA4C0]">
          모든 키워드를 모든 곳에 계속 긁지 않는다. 가능성 높은 후보부터 좌표를 찾아
          <span className="font-bold text-white"> 비용은 낮추고, 속도·정확도는 높인다.</span>
        </p>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">AI 활용 역량 · 11</span>
      </div>
    </div>
  );
}
