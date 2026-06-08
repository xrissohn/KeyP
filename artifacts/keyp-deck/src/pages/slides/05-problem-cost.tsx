export default function SlideProblemCost() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[16vh] right-[-6vw] w-[42vw] h-[42vw] rounded-full bg-[#FF6B8A] opacity-[0.09] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#FF6B8A]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#FF6B8A]">
          PROBLEM · 그래서 생기는 비용
        </span>
      </div>

      <h2 className="absolute top-[14vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        결국 사용자는 <span className="text-[#FF6B8A]">타이밍·신뢰·시간</span>을 잃는다
      </h2>

      <div className="absolute top-[34vh] left-[5vw] right-[5vw] flex gap-[2vw]">
        <div className="flex-1 rounded-[1.6vh] border border-[#26304C] bg-[#161C30] p-[2.6vw]">
          <div className="font-display text-[3vw] font-extrabold text-[#FF6B8A]">01</div>
          <div className="mt-[1.6vh] text-[2.2vw] font-bold">놓친 타이밍</div>
          <p className="mt-[1.6vh] text-[1.6vw] leading-[1.5] text-[#9AA4C0]">
            결정적 정보를 남보다 늦게 받아 기회를 놓친다.
          </p>
        </div>
        <div className="flex-1 rounded-[1.6vh] border border-[#26304C] bg-[#161C30] p-[2.6vw]">
          <div className="font-display text-[3vw] font-extrabold text-[#FF6B8A]">02</div>
          <div className="mt-[1.6vh] text-[2.2vw] font-bold">정보 과부하</div>
          <p className="mt-[1.6vh] text-[1.6vw] leading-[1.5] text-[#9AA4C0]">
            노이즈에 묻혀 정작 중요한 신호를 못 본다.
          </p>
        </div>
        <div className="flex-1 rounded-[1.6vh] border border-[#26304C] bg-[#161C30] p-[2.6vw]">
          <div className="font-display text-[3vw] font-extrabold text-[#FF6B8A]">03</div>
          <div className="mt-[1.6vh] text-[2.2vw] font-bold">검증 불가</div>
          <p className="mt-[1.6vh] text-[1.6vw] leading-[1.5] text-[#9AA4C0]">
            진위·출처를 직접 확인할 수 없어 신뢰가 떨어진다.
          </p>
        </div>
      </div>

      <p className="absolute bottom-[13vh] left-[5vw] right-[5vw] text-[1.8vw] leading-[1.5] text-[#9AA4C0]">
        세 가지 손실이 쌓일수록, 사용자는 정보를 더 많이 보면서도 점점 더
        <span className="font-bold text-white"> 뒤처지고 불안해진다.</span>
      </p>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Problem · 05</span>
      </div>
    </div>
  );
}
