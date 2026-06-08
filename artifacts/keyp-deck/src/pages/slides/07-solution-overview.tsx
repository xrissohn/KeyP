export default function SlideSolutionOverview() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[20vh] left-[-8vw] w-[48vw] h-[48vw] rounded-full bg-[#5B7FFF] opacity-[0.16] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#5B7FFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#5B7FFF]">
          SOLUTION · 해결책
        </span>
      </div>

      <h2 className="absolute top-[13vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        등록만 하면, AI가 <span className="text-[#5B7FFF]">대신 찾아 알려준다</span>
      </h2>

      <div className="absolute top-[27vh] left-[6vw]">
        <div className="rounded-[3vh] overflow-hidden border-[0.5vh] border-[#26304C] bg-[#05070F] shadow-2xl">
          <img
            src={`${import.meta.env.BASE_URL}shots/01-onboarding.jpg`}
            alt="KeyP 온보딩"
            className="block h-[58vh] w-auto"
          />
        </div>
      </div>

      <div className="absolute top-[27vh] right-[5vw] w-[52vw] flex flex-col gap-[2vh]">
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold"><span className="text-[#5B7FFF]">1. </span>자연어로 관심사 등록</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">"몇 키워드"가 아니라 일상 문장으로 적으면 된다.</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold"><span className="text-[#5B7FFF]">2. </span>구조화 · 전략 수립</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">AI가 의도를 읽고 '어디서 어떻게 찾을지' 계획을 세운다.</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold"><span className="text-[#5B7FFF]">3. </span>신뢰도 검증된 알림</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">출처 교차검증 후 점수 높은 것만 요약해 전달한다.</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold"><span className="text-[#5B7FFF]">4. </span>그대로 속보 피드</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">새 소식이 오면 푸시 알림. 직접 찾지 않아도 된다.</p>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Solution · 07</span>
      </div>
    </div>
  );
}
