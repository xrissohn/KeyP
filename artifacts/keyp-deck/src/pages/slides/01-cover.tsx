export default function SlideCover() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[22vh] -right-[8vw] w-[55vw] h-[55vw] rounded-full bg-[#4F46E5] opacity-[0.18] blur-[130px]" />
      <div className="absolute bottom-[-18vh] left-[-10vw] w-[42vw] h-[42vw] rounded-full bg-[#FF6B8A] opacity-[0.08] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1.2vw]">
        <img
          src={`${import.meta.env.BASE_URL}keyp-icon-mark.png`}
          alt="KeyP"
          className="w-[4.6vw] h-[4.6vw] rounded-[1.2vw]"
        />
        <div className="leading-tight">
          <div className="font-display text-[2.4vw] font-extrabold tracking-tight">KeyP</div>
          <div className="font-display text-[0.95vw] font-bold tracking-[0.25em] text-[#5B7FFF]">
            REAL-TIME INTEREST ALERTS · AI AGENTS
          </div>
        </div>
      </div>

      <div className="absolute top-[26vh] left-[5vw] w-[54vw]">
        <div className="font-display text-[1.4vw] font-bold tracking-wide text-[#5B7FFF]">
          2026 KAIST OverEdge (오엣) · 창업 아이디어
        </div>
        <h1 className="mt-[2.5vh] text-[4.3vw] font-black leading-[1.16]">
          관심사를 등록만 하면,<br />
          AI 에이전트 팀이 대신<br />
          찾아 알려주는 <span className="text-[#5B7FFF]">속보 앱</span>
        </h1>
        <p className="mt-[3.5vh] w-[48vw] text-[1.7vw] leading-[1.5] text-[#9AA4C0]">
          자연어 관심사 → 4개 AI 에이전트 파이프라인 → 신뢰도 검증된 알림.
          거기에 <span className="font-bold text-[#FF6B8A]">opt-in 상호매칭</span>으로 사람까지 연결한다.
        </p>
      </div>

      <div className="absolute bottom-[10vh] left-[5vw] flex gap-[1.4vw]">
        <div className="w-[14vw] rounded-[1.4vh] border border-[#26304C] bg-[#161C30] px-[1.5vw] py-[2vh]">
          <div className="font-display text-[2.6vw] font-extrabold text-[#5B7FFF]">4개</div>
          <div className="mt-[0.5vh] text-[1.3vw] text-[#9AA4C0]">전문 AI 에이전트</div>
        </div>
        <div className="w-[14vw] rounded-[1.4vh] border border-[#26304C] bg-[#161C30] px-[1.5vw] py-[2vh]">
          <div className="font-display text-[2.6vw] font-extrabold text-[#7C6BFF]">1인</div>
          <div className="mt-[0.5vh] text-[1.3vw] text-[#9AA4C0]">AI 파트너십 창업</div>
        </div>
        <div className="w-[14vw] rounded-[1.4vh] border border-[#26304C] bg-[#161C30] px-[1.5vw] py-[2vh]">
          <div className="font-display text-[2.6vw] font-extrabold text-[#34D399]">MVP</div>
          <div className="mt-[0.5vh] text-[1.3vw] text-[#9AA4C0]">이미 작동 중</div>
        </div>
      </div>

      <div className="absolute top-[14vh] right-[6vw]">
        <div className="rounded-[3vh] overflow-hidden border-[0.5vh] border-[#26304C] bg-[#05070F] shadow-2xl">
          <img
            src={`${import.meta.env.BASE_URL}shots/01-onboarding.jpg`}
            alt="KeyP 온보딩 화면"
            className="block h-[72vh] w-auto"
          />
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">요약 · 01</span>
      </div>
    </div>
  );
}
