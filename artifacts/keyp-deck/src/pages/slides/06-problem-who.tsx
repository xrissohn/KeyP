export default function SlideProblemWho() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[16vh] left-[-8vw] w-[42vw] h-[42vw] rounded-full bg-[#FF6B8A] opacity-[0.08] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#FF6B8A]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#FF6B8A]">
          PROBLEM · 누가 절실한가
        </span>
      </div>

      <h2 className="absolute top-[14vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        빠르고 정확한 신호가 <span className="text-[#FF6B8A]">돈·시간</span>이 되는 사람들
      </h2>

      <div className="absolute top-[34vh] left-[5vw] right-[5vw] grid grid-cols-2 gap-[2vw]">
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="text-[2vw] font-bold text-white">투자·시장 추적자</div>
          <p className="mt-[1.4vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            종목·산업·정책 신호를 남보다 먼저 받아야 하는 사람.
          </p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="text-[2vw] font-bold text-white">특정 분야 팬·덕후</div>
          <p className="mt-[1.4vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            좋아하는 대상의 새 소식을 절대 놓치고 싶지 않은 사람.
          </p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="text-[2vw] font-bold text-white">연구자·전문가</div>
          <p className="mt-[1.4vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            분야의 최신 논문·동향을 자동으로 받고 싶은 사람.
          </p>
        </div>
        <div className="rounded-[1.5vh] border border-[#26304C] bg-[#161C30] p-[2.4vw]">
          <div className="text-[2vw] font-bold text-white">채용·이직 탐색자</div>
          <p className="mt-[1.4vh] text-[1.55vw] leading-[1.5] text-[#9AA4C0]">
            기업·공고·업계 변화를 실시간으로 추적해야 하는 사람.
          </p>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Problem · 06</span>
      </div>
    </div>
  );
}
