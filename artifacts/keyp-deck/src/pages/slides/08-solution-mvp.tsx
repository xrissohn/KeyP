export default function SlideSolutionMvp() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] right-[-6vw] w-[44vw] h-[44vw] rounded-full bg-[#5B7FFF] opacity-[0.14] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#5B7FFF]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#5B7FFF]">
          SOLUTION · 이미 작동하는 제품
        </span>
      </div>

      <h2 className="absolute top-[13vh] left-[5vw] text-[3.6vw] font-black leading-[1.2]">
        기획안이 아니라, <span className="text-[#5B7FFF]">작동하는 MVP</span>
      </h2>

      <div className="absolute top-[28vh] left-[6vw] flex gap-[2.5vw]">
        <div className="text-center">
          <div className="rounded-[2.4vh] overflow-hidden border-[0.5vh] border-[#26304C] bg-[#05070F] shadow-2xl">
            <img src={`${import.meta.env.BASE_URL}shots/05-interests.jpg`} alt="관심사 관리" className="block h-[52vh] w-auto" />
          </div>
          <div className="mt-[1.4vh] text-[1.45vw] text-[#9AA4C0]">관심사 관리 · 자동 수집</div>
        </div>
        <div className="text-center">
          <div className="rounded-[2.4vh] overflow-hidden border-[0.5vh] border-[#26304C] bg-[#05070F] shadow-2xl">
            <img src={`${import.meta.env.BASE_URL}shots/02-add.jpg`} alt="AI 관심사 분석" className="block h-[52vh] w-auto" />
          </div>
          <div className="mt-[1.4vh] text-[1.45vw] text-[#9AA4C0]">AI 에이전트 관심사 분석</div>
        </div>
      </div>

      <div className="absolute top-[30vh] right-[5vw] w-[42vw] grid grid-cols-1 gap-[1.6vh]">
        <div className="flex items-center gap-[1.2vw] rounded-[1.2vh] border border-[#26304C] bg-[#161C30] px-[1.8vw] py-[1.8vh]">
          <span className="font-display text-[1.8vw] font-extrabold text-[#34D399]">✓</span>
          <span className="text-[1.55vw]">4개 AI 에이전트 실시간 파이프라인</span>
        </div>
        <div className="flex items-center gap-[1.2vw] rounded-[1.2vh] border border-[#26304C] bg-[#161C30] px-[1.8vw] py-[1.8vh]">
          <span className="font-display text-[1.8vw] font-extrabold text-[#34D399]">✓</span>
          <span className="text-[1.55vw]">실시간 푸시 알림 (PWA Web Push)</span>
        </div>
        <div className="flex items-center gap-[1.2vw] rounded-[1.2vh] border border-[#26304C] bg-[#161C30] px-[1.8vw] py-[1.8vh]">
          <span className="font-display text-[1.8vw] font-extrabold text-[#34D399]">✓</span>
          <span className="text-[1.55vw]">의미 기반 중복제거 · 죽은 링크 차단</span>
        </div>
        <div className="flex items-center gap-[1.2vw] rounded-[1.2vh] border border-[#26304C] bg-[#161C30] px-[1.8vw] py-[1.8vh]">
          <span className="font-display text-[1.8vw] font-extrabold text-[#34D399]">✓</span>
          <span className="text-[1.55vw]">좋아요/별로예요 피드백 학습</span>
        </div>
        <div className="flex items-center gap-[1.2vw] rounded-[1.2vh] border border-[#26304C] bg-[#161C30] px-[1.8vw] py-[1.8vh]">
          <span className="font-display text-[1.8vw] font-extrabold text-[#34D399]">✓</span>
          <span className="text-[1.55vw]">한국어 UI + 글로벌 검색·번역</span>
        </div>
        <div className="flex items-center gap-[1.2vw] rounded-[1.2vh] border border-[#26304C] bg-[#161C30] px-[1.8vw] py-[1.8vh]">
          <span className="font-display text-[1.8vw] font-extrabold text-[#34D399]">✓</span>
          <span className="text-[1.55vw]">비용 최적화 (캐싱 · 코얼레싱)</span>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Solution · 08</span>
      </div>
    </div>
  );
}
