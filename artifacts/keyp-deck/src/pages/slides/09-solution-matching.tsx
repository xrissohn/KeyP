export default function SlideSolutionMatching() {
  return (
    <div className="slide relative w-screen h-screen overflow-hidden bg-[#0A0E1A] font-body text-white">
      <div className="absolute -top-[18vh] right-[-6vw] w-[44vw] h-[44vw] rounded-full bg-[#FF6B8A] opacity-[0.12] blur-[130px]" />

      <div className="absolute top-[7vh] left-[5vw] flex items-center gap-[1vw]">
        <div className="h-[0.8vh] w-[2.4vw] rounded-full bg-[#FF6B8A]" />
        <span className="font-display text-[1.3vw] font-bold tracking-[0.18em] text-[#FF6B8A]">
          SOLUTION · opt-in 상호매칭
        </span>
      </div>

      <h2 className="absolute top-[13vh] left-[5vw] w-[78vw] text-[3.4vw] font-black leading-[1.22]">
        같은 관심사를 가진 사람과<br />
        양방향 동의 시에만 <span className="text-[#FF6B8A]">안전하게 연결</span>
      </h2>

      <div className="absolute top-[30vh] left-[6vw]">
        <div className="rounded-[3vh] overflow-hidden border-[0.5vh] border-[#26304C] bg-[#05070F] shadow-2xl">
          <img src={`${import.meta.env.BASE_URL}shots/03-match.jpg`} alt="상호매칭 화면" className="block h-[56vh] w-auto" />
        </div>
      </div>

      <div className="absolute top-[31vh] right-[5vw] w-[52vw] flex flex-col gap-[2vh]">
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold text-[#FF6B8A]">opt-in 양방향</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">서로 동의한 경우에만 연결. 원치 않으면 연결되지 않는다.</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold text-[#FF6B8A]">안전 장치</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">신고·차단 지원. 관심사 기반이라 연결의 부담이 적다.</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold text-[#FF6B8A]">네트워크 효과</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">사용자가 늘수록 매칭 가치가 커지는 구조.</p>
        </div>
        <div className="rounded-[1.4vh] border border-[#26304C] bg-[#161C30] p-[2vw]">
          <div className="text-[1.95vw] font-bold text-[#FF6B8A]">알림 + 연결</div>
          <p className="mt-[1vh] text-[1.5vw] leading-[1.45] text-[#9AA4C0]">'정보'와 '사람'을 한 앱에서 모두 제공한다.</p>
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[5vw] right-[5vw] flex items-center justify-between">
        <span className="font-display text-[1.3vw]">
          <span className="font-bold text-[#5B7FFF]">KeyP</span>
          <span className="text-[#6B7596]">  ·  KAIST OverEdge 창업 아이디어</span>
        </span>
        <span className="font-display text-[1.3vw] text-[#6B7596]">Solution · 09</span>
      </div>
    </div>
  );
}
