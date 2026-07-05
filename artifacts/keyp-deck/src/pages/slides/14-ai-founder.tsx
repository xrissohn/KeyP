export default function SlideAiFounder() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute top-[-10vh] left-1/2 -translate-x-1/2 w-[70vw] h-[60vw] rounded-full bg-[#4F46E5] opacity-[0.16] blur-[140px]" />
      <div className="absolute bottom-[-20vh] left-1/2 -translate-x-1/2 w-[44vw] h-[44vw] rounded-full bg-[#FF6B8A] opacity-[0.08] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#5B7FFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#5B7FFF]">
          WHY KeyP · 1인 창업 × AI
        </span>
      </div>

      <h2 className="absolute top-[15vh] left-[5vw] w-[88vw] text-[3.4vw] font-black leading-[1.25]">
        KeyP 자체가 <span className="text-[#5B7FFF]">'AI를 공동창업팀으로 삼은 1인 창업'</span>의 사례
      </h2>

      <p className="absolute top-[33vh] left-[5vw] w-[88vw] text-[1.8vw] leading-[1.5] text-[#9AA4C0]">
        창업자는 별도 팀 없이 AI 에이전트를 실질적 동료로 삼아 모바일 앱 · 백엔드 · AI 파이프라인 전체를 혼자 구축했다.
      </p>

      <div className="absolute top-[46vh] left-[5vw] right-[5vw] grid grid-cols-5 gap-[1.4vw]">
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[1.5vw]">
          <div className="text-[1.55vw] font-bold text-[#5B7FFF]">문제 인식</div>
          <p className="mt-[1vh] text-[1.3vw] leading-[1.35] text-[#9AA4C0]">정보 과잉 속 발견 부족을 구조적으로 정의</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[1.5vw]">
          <div className="text-[1.55vw] font-bold text-[#5B7FFF]">실현 가능</div>
          <p className="mt-[1vh] text-[1.3vw] leading-[1.35] text-[#9AA4C0]">기획이 아닌 작동하는 MVP + 구독 BM</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[1.5vw]">
          <div className="text-[1.55vw] font-bold text-[#7C6BFF]">AI 활용 역량</div>
          <p className="mt-[1vh] text-[1.3vw] leading-[1.35] text-[#9AA4C0]">AI를 제품 엔진이자 공동창업팀으로 동시 활용</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[1.5vw]">
          <div className="text-[1.55vw] font-bold text-[#7C6BFF]">AX 구현</div>
          <p className="mt-[1vh] text-[1.3vw] leading-[1.35] text-[#9AA4C0]">멀티 에이전트 오케스트레이션을 실제 코드로</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[1.5vw]">
          <div className="text-[1.55vw] font-bold text-[#FF6B8A]">확장 경로</div>
          <p className="mt-[1vh] text-[1.3vw] leading-[1.35] text-[#9AA4C0]">비용 최적화 + 네트워크 효과형 확장</p>
        </div>
      </div>

      <div className="absolute bottom-[12vh] left-1/2 -translate-x-1/2 w-[64vw] rounded-[1.6vh] border border-[#5B7FFF]/60 bg-[#0E1530] px-[3vw] py-[3vh] text-center">
        <div className="text-[2vw] font-bold leading-[1.4]">
          내 관심사를 가장 먼저·정확하게 알려주는 <span className="text-[#5B7FFF]">글로벌 서비스</span>로,
          OverEdge의 기술·네트워크·투자와 함께 성장한다.
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">AI 활용 역량 · 14</span>
      </div>
    </div>
  );
}
