export default function SlideSummary() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[20vh] right-[-8vw] w-[48vw] h-[48vw] rounded-full bg-[#4F46E5] opacity-[0.14] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#5B7FFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#5B7FFF]">
          SUMMARY · 한눈에 보기
        </span>
      </div>

      <h2 className="absolute top-[13vh] left-[5vw] w-[80vw] text-[3.6vw] font-black leading-[1.2]">
        KeyP는 <span className="text-[#5B7FFF]">'정보'</span>와 <span className="text-[#FF6B8A]">'사람'</span>을
        동시에 연결하는 서비스
      </h2>

      <div className="absolute top-[34vh] left-[5vw] right-[5vw] flex gap-[2vw]">
        <div className="flex-1 rounded-[1.6vh] border border-[#26304C] bg-[#161C30] p-[2.6vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#FF6B8A]">PROBLEM</div>
          <div className="mt-[1.4vh] text-[2.2vw] font-bold leading-[1.3]">정보는 넘치지만 늦다</div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            내 관심사의 결정적 신호는 늘 늦게 도착하고, 검증할 방법도 없다.
          </p>
        </div>
        <div className="flex-1 rounded-[1.6vh] border border-[#26304C] bg-[#161C30] p-[2.6vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#5B7FFF]">SOLUTION</div>
          <div className="mt-[1.4vh] text-[2.2vw] font-bold leading-[1.3]">AI가 대신 찾아준다</div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            등록만 하면 4개 AI 에이전트가 찾아 검증해 속보로 보내고, 사람까지 연결한다.
          </p>
        </div>
        <div className="flex-1 rounded-[1.6vh] border border-[#26304C] bg-[#161C30] p-[2.6vw]">
          <div className="font-display text-[1.2vw] font-bold tracking-widest text-[#7C6BFF]">AI 활용 역량</div>
          <div className="mt-[1.4vh] text-[2.2vw] font-bold leading-[1.3]">1인이 직접 구현</div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            멀티 에이전트 오케스트레이션을 별도 팀 없이 실제 코드로 구축했다.
          </p>
        </div>
      </div>

      <div className="absolute bottom-[12vh] left-[5vw] right-[5vw] flex items-center justify-between rounded-[1.4vh] border border-[#5B7FFF]/40 bg-[#0E1530] px-[3vw] py-[3vh]">
        <span className="text-[1.7vw] font-bold text-[#34D399]">MVP 이미 작동 중</span>
        <span className="text-[1.6vw] text-[#6B7596]">·</span>
        <span className="text-[1.7vw] font-bold text-[#5B7FFF]">구독 BM (Free → Power)</span>
        <span className="text-[1.6vw] text-[#6B7596]">·</span>
        <span className="text-[1.7vw] font-bold text-[#FF6B8A]">opt-in 상호매칭</span>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">요약 · 02</span>
      </div>
    </div>
  );
}
