export default function SlideProblemFour() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] left-[-8vw] w-[44vw] h-[44vw] rounded-full bg-[#FF6B8A] opacity-[0.08] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#FF6B8A]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#FF6B8A]">
          PROBLEM · 무엇이 문제인가
        </span>
      </div>

      <h2 className="absolute top-[13vh] left-[5vw] text-[3.4vw] font-black leading-[1.2]">
        지금의 방식은 <span className="text-[#FF6B8A]">네 가지</span>가 막혀 있다
      </h2>

      <div className="absolute top-[28vh] left-[5vw] right-[5vw] grid grid-cols-2 gap-[2vw]">
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="flex items-center gap-[1.2vw]">
            <div className="flex h-[3.2vw] w-[3.2vw] items-center justify-center rounded-[1vh] bg-[#FF6B8A] font-display text-[1.8vw] font-extrabold">1</div>
            <div className="text-[2vw] font-bold">검색은 직접 찾아야 한다</div>
          </div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            매번 사람이 키워드를 넣고 뒤져야 한다. 실시간성도, 미래 신호도 없다.
          </p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="flex items-center gap-[1.2vw]">
            <div className="flex h-[3.2vw] w-[3.2vw] items-center justify-center rounded-[1vh] bg-[#FF6B8A] font-display text-[1.8vw] font-extrabold">2</div>
            <div className="text-[2vw] font-bold">키워드 알림은 노이즈</div>
          </div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            단순 일치만 하면 중복·광고가 쌓이고, 한국어·로컬 출처는 약하다.
          </p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="flex items-center gap-[1.2vw]">
            <div className="flex h-[3.2vw] w-[3.2vw] items-center justify-center rounded-[1vh] bg-[#FF6B8A] font-display text-[1.8vw] font-extrabold">3</div>
            <div className="text-[2vw] font-bold">SNS는 광고·체류용</div>
          </div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            참여·광고 중심 피드는 플랫폼 이익이 우선. 내 관심사보다 알고리즘이 먼저다.
          </p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="flex items-center gap-[1.2vw]">
            <div className="flex h-[3.2vw] w-[3.2vw] items-center justify-center rounded-[1vh] bg-[#FF6B8A] font-display text-[1.8vw] font-extrabold">4</div>
            <div className="text-[2vw] font-bold">흩어진 출처, 검증 불가</div>
          </div>
          <p className="mt-[1.8vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            여러 출처를 개인이 일일이 모니터링·교차검증하는 것은 시간·비용상 불가능하다.
          </p>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Problem · 04</span>
      </div>
    </div>
  );
}
