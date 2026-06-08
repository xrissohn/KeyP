export default function SlideProblemCore() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] right-[-6vw] w-[46vw] h-[46vw] rounded-full bg-[#FF6B8A] opacity-[0.10] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#FF6B8A]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#FF6B8A]">
          PROBLEM · 풀고자 하는 문제
        </span>
      </div>

      <h2 className="absolute top-[18vh] left-[5vw] w-[70vw] text-[4vw] font-black leading-[1.22]">
        정보는 넘치는데,<br />
        '내 관심사'의 <span className="text-[#FF6B8A]">결정적 신호</span>는<br />
        항상 늦게 도착한다.
      </h2>

      <p className="absolute top-[58vh] left-[5vw] w-[60vw] text-[1.9vw] leading-[1.55] text-[#9AA4C0]">
        세상의 정보량은 폭발적으로 늘었지만, 정작 나에게 중요한 신호를
        제때·정확하게 받는 일은 오히려 더 어려워졌다.
      </p>

      <div className="absolute bottom-[12vh] left-[5vw] right-[5vw] rounded-[1.6vh] border border-[#FF6B8A]/50 bg-[#14112A] px-[3vw] py-[3.5vh]">
        <p className="text-[2.2vw] font-bold leading-[1.4]">
          "흩어진 세상의 정보 속에서, 내 관심사의 결정적 신호를
          가장 먼저·정확하게 받을 방법이 없다."
        </p>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Problem · 03</span>
      </div>
    </div>
  );
}
