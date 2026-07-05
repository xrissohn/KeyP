export default function SlideSolutionPricing() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] left-[-6vw] w-[44vw] h-[44vw] rounded-full bg-[#5B7FFF] opacity-[0.14] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#5B7FFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#5B7FFF]">
          BUSINESS · 수익 모델
        </span>
      </div>

      <h2 className="absolute top-[13vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        구독 4단계 — <span className="text-[#5B7FFF]">Free → Power</span>
      </h2>

      <div className="absolute top-[28vh] left-[6vw]">
        <div className="rounded-[3vh] overflow-hidden border-[0.5vh] border-[#26304C] bg-[#05070F] shadow-2xl">
          <img src={`${import.meta.env.BASE_URL}shots/04-pricing.jpg`} alt="요금제 화면" className="block h-[54vh] w-auto" />
        </div>
      </div>

      <div className="absolute top-[29vh] right-[5vw] w-[52vw] flex flex-col gap-[1.8vh]">
        <div className="rounded-[1.4vh] border border-[#9AA4C0]/40 bg-[#161C30] px-[2.2vw] py-[2vh]">
          <div className="text-[2vw] font-bold text-[#9AA4C0]">Free</div>
          <p className="mt-[0.6vh] text-[1.5vw] text-[#9AA4C0]">관심사 1 · 1시간 주기</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#5B7FFF]/60 bg-[#161C30] px-[2.2vw] py-[2vh]">
          <div className="text-[2vw] font-bold text-[#5B7FFF]">Basic</div>
          <p className="mt-[0.6vh] text-[1.5vw] text-[#9AA4C0]">관심사 5 · 15분 주기</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#7C6BFF]/60 bg-[#161C30] px-[2.2vw] py-[2vh]">
          <div className="text-[2vw] font-bold text-[#7C6BFF]">Pro</div>
          <p className="mt-[0.6vh] text-[1.5vw] text-[#9AA4C0]">고빈도 · 속보 알림</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#FF6B8A]/60 bg-[#161C30] px-[2.2vw] py-[2vh]">
          <div className="text-[2vw] font-bold text-[#FF6B8A]">Power</div>
          <p className="mt-[0.6vh] text-[1.5vw] text-[#9AA4C0]">최대 · 최고빈도 + 부스트</p>
        </div>
      </div>

      <p className="absolute bottom-[8vh] right-[5vw] w-[52vw] text-[1.4vw] leading-[1.4] text-[#6B7596]">
        관심사 수·알림 빈도로 차등. 업셀 구조로 OverEdge 시드·스케일 연계 가능.
      </p>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Solution · 10</span>
      </div>
    </div>
  );
}
