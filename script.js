// 단어, 짧은 문장, 긴 문장을 골고루 담은 연습 문항입니다.
const PRACTICE_ITEMS = [
  { type: "단어", text: "가을바람" },
  { type: "단어", text: "반짝임" },
  { type: "단어", text: "도서관" },
  { type: "단어", text: "마음가짐" },
  { type: "단어", text: "푸른하늘" },
  { type: "짧은 문장", text: "오늘도 힘차게 시작합니다." },
  { type: "짧은 문장", text: "따뜻한 말은 힘이 됩니다." },
  { type: "짧은 문장", text: "작은 습관이 변화를 만듭니다." },
  { type: "짧은 문장", text: "천천히 정확하게 입력해 보세요." },
  { type: "짧은 문장", text: "꾸준한 연습은 배신하지 않습니다." },
  { type: "긴 문장", text: "맑은 아침 햇살이 창가에 조용히 내려앉아 새로운 하루를 밝혀 줍니다." },
  { type: "긴 문장", text: "조금 느리더라도 포기하지 않고 나아가면 원하는 곳에 반드시 도착할 수 있습니다." },
  { type: "긴 문장", text: "좋은 생각을 따뜻한 말로 표현하는 습관은 주변 사람들에게 행복을 전합니다." },
  { type: "긴 문장", text: "매일 짧은 시간이라도 집중해서 연습하면 타자 속도와 정확도가 함께 좋아집니다." },
  { type: "긴 문장", text: "창밖으로 불어오는 선선한 바람을 느끼며 오늘 해야 할 일을 차분히 시작합니다." }
];

const QUESTION_COUNT = 10;
const TIME_LIMIT_SECONDS = 60;
const STORAGE_KEY = "sogonsogon-typing-records";

const targetSentence = document.querySelector("#target-sentence");
const typingInput = document.querySelector("#typing-input");
const liveTime = document.querySelector("#live-time");
const liveCpm = document.querySelector("#live-cpm");
const liveAccuracy = document.querySelector("#live-accuracy");
const resultCard = document.querySelector("#result-card");
const matchIndicator = document.querySelector("#match-indicator");
const retryButton = document.querySelector("#retry-button");
const historyList = document.querySelector("#history-list");
const historyTemplate = document.querySelector("#history-item-template");
const inputHelp = document.querySelector("#input-help");

let questions = [];
let questionIndex = 0;
let currentItem = null;
let questionStartTime = null;
let timerId = null;
let totalTypedStrokes = 0;
let previousStrokeCount = 0;
let questionFinished = false;
let sessionTotals = null;

// 완성형 한글을 초성·중성·종성 단위로 계산합니다. 예: '가'=2타, '각'=3타
function countJamoStrokes(text) {
  return [...text].reduce((total, character) => {
    const code = character.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      return total + ((code - 0xac00) % 28 !== 0 ? 3 : 2);
    }
    return character === "\n" || character === "\r" ? total : total + 1;
  }, 0);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

// 세 유형이 모두 포함되도록 3개, 3개, 4개를 뽑은 뒤 순서를 다시 섞습니다.
function createQuestionSet() {
  const words = shuffle(PRACTICE_ITEMS.filter((item) => item.type === "단어")).slice(0, 3);
  const shortSentences = shuffle(PRACTICE_ITEMS.filter((item) => item.type === "짧은 문장")).slice(0, 3);
  const longSentences = shuffle(PRACTICE_ITEMS.filter((item) => item.type === "긴 문장")).slice(0, 4);
  return shuffle([...words, ...shortSentences, ...longSentences]);
}

function getElapsedSeconds() {
  return questionStartTime ? (performance.now() - questionStartTime) / 1000 : 0;
}

function getMatchingStrokes(value = typingInput.value) {
  let matchingLength = 0;
  while (
    matchingLength < value.length &&
    value[matchingLength] === currentItem.text[matchingLength]
  ) {
    matchingLength += 1;
  }
  return countJamoStrokes(currentItem.text.slice(0, matchingLength));
}

function calculateAccuracy(correctStrokes, typedStrokes, emptyValue = 100) {
  if (typedStrokes === 0) return emptyValue;
  return Math.min(100, Math.round((correctStrokes / typedStrokes) * 100));
}

function updateTimer() {
  const elapsed = getElapsedSeconds();
  const remaining = Math.max(0, Math.ceil(TIME_LIMIT_SECONDS - elapsed));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  liveTime.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const correctStrokes = getMatchingStrokes();
  liveCpm.textContent = `${elapsed > 0 ? Math.round((correctStrokes / elapsed) * 60) : 0} CPM`;

  if (remaining <= 0) advanceQuestion("timeout");
}

function startTimer() {
  if (questionStartTime !== null || questionFinished) return;
  questionStartTime = performance.now();
  timerId = window.setInterval(updateTimer, 100);
}

function updateInputState(event) {
  const value = typingInput.value;
  const isComposing = event?.isComposing === true;
  const isCorrectPrefix = currentItem.text.startsWith(value);

  typingInput.classList.toggle("has-error", !isComposing && value.length > 0 && !isCorrectPrefix);
  typingInput.setAttribute("aria-invalid", String(!isComposing && value.length > 0 && !isCorrectPrefix));

  const currentStrokes = countJamoStrokes(value);
  if (currentStrokes > previousStrokeCount) {
    totalTypedStrokes += currentStrokes - previousStrokeCount;
  }
  previousStrokeCount = currentStrokes;

  if (value.length > 0) startTimer();
  if (!isComposing) {
    const accuracy = calculateAccuracy(getMatchingStrokes(value), totalTypedStrokes);
    liveAccuracy.textContent = `${accuracy}%`;
  }

  if (!isComposing && value === currentItem.text) completeQuestion();
}

function completeQuestion() {
  if (questionFinished) return;
  questionFinished = true;
  window.clearInterval(timerId);
  updateTimer();
  typingInput.readOnly = true;
  matchIndicator.style.display = "grid";
  inputHelp.textContent = "정확히 입력했어요! Enter를 눌러 다음 문항으로 이동하세요.";
}

function collectCurrentResult(reason) {
  const elapsed = questionStartTime
    ? Math.min(TIME_LIMIT_SECONDS, getElapsedSeconds())
    : 0;
  const correctStrokes = getMatchingStrokes();

  sessionTotals.seconds += elapsed;
  sessionTotals.correctStrokes += correctStrokes;
  sessionTotals.typedStrokes += totalTypedStrokes;
  if (reason === "complete" || typingInput.value === currentItem.text) {
    sessionTotals.completed += 1;
  }
}

function advanceQuestion(reason = "skip") {
  window.clearInterval(timerId);
  collectCurrentResult(questionFinished ? "complete" : reason);

  if (questionIndex >= QUESTION_COUNT - 1) {
    finishSession();
    return;
  }

  questionIndex += 1;
  showQuestion();
}

function showQuestion() {
  currentItem = questions[questionIndex];
  questionStartTime = null;
  timerId = null;
  totalTypedStrokes = 0;
  previousStrokeCount = 0;
  questionFinished = false;

  document.querySelector("#current-number").textContent = String(questionIndex + 1);
  document.querySelector("#sentence-label").textContent = currentItem.type;
  targetSentence.textContent = currentItem.text;
  typingInput.readOnly = false;
  typingInput.disabled = false;
  typingInput.value = "";
  typingInput.classList.remove("has-error");
  typingInput.setAttribute("aria-invalid", "false");
  matchIndicator.style.display = "none";
  liveTime.textContent = "1:00";
  liveCpm.textContent = "0 CPM";
  liveAccuracy.textContent = "100%";
  inputHelp.textContent = "문항마다 1분이 주어집니다. 완료하거나 건너뛰려면 Enter를 누르세요.";
  typingInput.focus();
}

function finishSession() {
  const seconds = sessionTotals.seconds;
  const cpm = seconds > 0
    ? Math.round((sessionTotals.correctStrokes / seconds) * 60)
    : 0;
  const accuracy = calculateAccuracy(
    sessionTotals.correctStrokes,
    sessionTotals.typedStrokes,
    0
  );
  const record = {
    sentence: `10문항 중 ${sessionTotals.completed}문항 완성`,
    seconds: Number(seconds.toFixed(1)),
    cpm,
    accuracy,
    createdAt: new Date().toISOString()
  };

  typingInput.disabled = true;
  typingInput.readOnly = true;
  document.querySelector("#result-time").textContent = `${record.seconds.toFixed(1)}초`;
  document.querySelector("#result-cpm").textContent = `${record.cpm} CPM`;
  document.querySelector("#result-accuracy").textContent = `${record.accuracy}%`;
  resultCard.hidden = false;
  saveRecord(record);
  renderHistory();
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function getRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function saveRecord(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...getRecords()].slice(0, 5)));
  } catch {
    // 저장소를 사용할 수 없는 환경에서도 연습은 계속할 수 있습니다.
  }
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
}

function renderHistory() {
  const records = getRecords();
  historyList.replaceChildren();

  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-history";
    empty.textContent = "아직 기록이 없어요. 10문항 연습을 시작해 보세요!";
    historyList.append(empty);
    return;
  }

  records.forEach((record, index) => {
    const item = historyTemplate.content.cloneNode(true);
    item.querySelector(".history-rank").textContent = String(index + 1).padStart(2, "0");
    item.querySelector(".history-sentence").textContent = record.sentence;
    item.querySelector(".history-date").textContent = formatDate(record.createdAt);
    item.querySelector(".history-time").textContent = `${Number(record.seconds).toFixed(1)}초`;
    item.querySelector(".history-cpm").textContent = `${record.cpm} CPM`;
    item.querySelector(".history-accuracy").textContent = `${record.accuracy}%`;
    historyList.append(item);
  });
}

function startSession() {
  window.clearInterval(timerId);
  questions = createQuestionSet();
  questionIndex = 0;
  sessionTotals = {
    seconds: 0,
    correctStrokes: 0,
    typedStrokes: 0,
    completed: 0
  };
  resultCard.hidden = true;
  showQuestion();
}

typingInput.addEventListener("input", updateInputState);
typingInput.addEventListener("compositionend", updateInputState);
typingInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  advanceQuestion();
});
retryButton.addEventListener("click", startSession);

renderHistory();
startSession();
