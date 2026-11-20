// The page's fixed wording (from memory/src/main.js): the five sub-stages of
// one access, the 범위 tab's terms and model rules, and the 프레임 tab notes.
import { RULES } from "./lessons.ts";
import type { Algorithm, Lesson } from "./types.ts";

/** The sub-stages of one access, shown in the stage head's status capsule. */
export const STAGES = ["조회", "판정", "프레임 선택", "적재", "CPU 읽기"];

export const TERMS: [string, string][] = [
  ["가상 주소", "프로그램이 보는 주소. 실제 RAM 위치와 따로 매겨집니다."],
  ["페이지", "가상 주소 공간을 같은 크기로 나눈 단위. A~E 다섯 개"],
  ["프레임", "RAM을 같은 크기로 나눈 칸. 프레임 0부터 번호를 매깁니다(F0, F1 …)."],
  ["페이지 테이블", "페이지마다 상주 여부와 프레임 번호를 적은 표"],
  ["MMU", "주소 변환 장치. 접근마다 페이지 테이블로 가상 주소를 RAM 주소로 바꿉니다."],
  ["상주·미상주", "페이지가 지금 RAM 프레임에 있으면 상주, 없으면 미상주(—)"],
  ["적중", "상주 페이지에 접근. 저장장치를 읽지 않습니다."],
  ["페이지 부재", "page fault. 미상주 페이지에 접근해 운영체제가 저장장치에서 읽어 옵니다."],
  [
    "부재 비용",
    "RAM 접근은 약 100ns, 저장장치 읽기는 SSD 수십 µs 이상·HDD 수 ms. 그동안 프로세스는 기다립니다.",
  ],
  [
    "강제 부재",
    "compulsory miss. 그 페이지를 처음 참조할 때의 부재. RAM이 가득 차 있으면 교체도 일어날 수 있습니다.",
  ],
  ["용량 부재", "capacity miss. 프레임이 모자라 내보냈던 페이지를 다시 읽는 부재"],
  ["교체", "빈 프레임이 없을 때 한 페이지를 내보내고 그 프레임을 재사용하는 일"],
  ["적중률", "적중 횟수 ÷ 전체 접근 횟수"],
  ["FIFO", RULES.fifo],
  ["LRU", RULES.lru],
  [
    "OPT(MIN)",
    "앞으로 가장 늦게 쓰일 페이지를 내보내는 이론상 최적 정책. 미래를 알아야 해 기준선으로만 씁니다.",
  ],
  [
    "참조 비트",
    "use bit. 페이지에 접근하면 하드웨어가 1로 켜는 비트. 운영체제는 이 비트로 LRU를 근사합니다.",
  ],
  ["클럭", `second chance. ${RULES.clock}`],
  ["Belady의 모순", "Belady's anomaly. FIFO에서 프레임을 늘렸는데 부재가 늘어나는 현상"],
  [
    "스택 알고리즘",
    "프레임 n개일 때 RAM의 페이지가 n+1개일 때도 늘 RAM에 있는 정책. LRU와 OPT가 그렇고, Belady의 모순이 없습니다.",
  ],
];

/** 이 실험의 규칙: the lesson's own rules, then the model's limits. */
export const modelRules = (lesson: Lesson): [string, string][] => [
  ...lesson.rules,
  ["원본", "A~E는 저장장치(SSD)에 원본이 있는 읽기 전용 페이지입니다."],
  ["빈 칸", "빈 프레임이 있으면 교체 없이 적재합니다."],
  ["쓰기", "내보내는 사본은 수정되지 않아 저장장치에 다시 쓰지 않습니다."],
  [
    "제외",
    "TLB·수정 페이지는 다루지 않습니다. 시뮬레이션은 지연 시간을 재지 않습니다. 한 번 넘기면 한 번의 접근입니다.",
  ],
];

/** The 프레임 tab's sentence once the next victim may be shown. */
export const NEXT_NOTE: Record<Algorithm, string> = {
  fifo: "적재 순서가 가장 앞선 페이지가 다음 교체",
  lru: "마지막 접근이 가장 이른 페이지가 다음 교체",
  opt: "다음 접근이 가장 늦은 페이지가 다음 교체",
  clock: "바늘부터 돌며 참조 비트 0인 페이지에서 멈춥니다",
};
