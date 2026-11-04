const groupThousands = (numberText) => {
  const digits = numberText.replace(/,/g, "");
  return digits.length > 4 ? digits.replace(/\B(?=(\d{3})+$)/g, " ") : digits;
};
const localizeNumberGrouping = (text) =>
  text.replace(
    new RegExp("(?<![\\d,])\\d{1,3}(?:,\\d{3})+(?![\\d,])", "g"),
    groupThousands,
  );
const applyFrenchSpacing = (text) =>
  text.replace(/ ([:;?!»%])/g, " $1").replace(/« /g, "« ");
const groupIndianNumber = (numberText) => {
  const digits = numberText.replace(/,/g, "");
  return digits.length > 5
    ? digits.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ",") +
        "," +
        digits.slice(-3)
    : numberText;
};
const localizeIndianGrouping = (text) =>
  text.replace(
    new RegExp("(?<![\\d,])\\d{1,3}(?:,\\d{3})+(?![\\d,])", "g"),
    groupIndianNumber,
  );
const RTL_CHARACTERS = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const LTR_RUN_PATTERN =
  /(?:[A-Za-z0-9.\/\\#@+"'(\[<*]|-(?=[A-Za-z]))[A-Za-z0-9.\/\\#@+\-"'’()\[\]<>*_:=,;&?%!$~{}^|×–− ]*[A-Za-z0-9)\]>%+*"'’~]|[A-Za-z0-9]/g;
const OPENING_BRACKETS = {
  ")": "(",
  "]": "[",
};
/** Keep bracket pairs inside a left-to-right run, excluding unmatched punctuation. */
function trimUnbalancedBrackets(text) {
  const openingPositions = [];
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === "(" || character === "[") {
      openingPositions.push(index);
    } else if (OPENING_BRACKETS[character]) {
      if (
        !openingPositions.length ||
        text[openingPositions.at(-1)] !== OPENING_BRACKETS[character]
      ) {
        return trimTrailingPunctuation(text.slice(0, index));
      }
      openingPositions.pop();
    }
  }
  return trimTrailingPunctuation(
    openingPositions.length ? text.slice(0, openingPositions[0]) : text,
  );
}
const trimTrailingPunctuation = (text) =>
  text.replace(/[^A-Za-z0-9)\]>%+*"'’~]+$/, "");
/** Isolate protocol names, addresses and numbers within Arabic or Hebrew text. */
function isolateLtrRuns(text) {
  const runPattern = new RegExp(LTR_RUN_PATTERN.source, "g");
  let result = "";
  let copiedThrough = 0;
  for (let match; (match = runPattern.exec(text));) {
    let run = trimUnbalancedBrackets(match[0]);
    const trailingNumber = /^(.*[A-Za-z)\]]),\s+\d[\d.,]*$/.exec(run);
    if (
      trailingNumber &&
      RTL_CHARACTERS.test(
        text.slice(match.index + run.length).trimStart()[0] ?? "",
      )
    ) {
      run = trailingNumber[1];
    }
    if (!run) {
      runPattern.lastIndex = match.index + 1;
      continue;
    }
    result += `${text.slice(copiedThrough, match.index)}⁦${run}⁩`;
    copiedThrough = match.index + run.length;
    runPattern.lastIndex = copiedThrough;
  }
  return result + text.slice(copiedThrough);
}
const isolateBidirectionalText = (text) =>
  RTL_CHARACTERS.test(text) ? `⁧${isolateLtrRuns(text)}⁩` : `⁦${text}⁩`;
export {
  isolateBidirectionalText as a,
  applyFrenchSpacing as f,
  localizeIndianGrouping as i,
  localizeNumberGrouping as n,
};
