import { describe, it, expect } from "vitest";
import { govStatusScore, govAverage, govPctOf } from "./gov-likert";
import { GOV_TEXT_SCORE, textToScore } from "./uploads.functions";
describe("GOV_LIKERT", () => {
  it("maps statuses to 5/4/3/2/0", () => { expect(["active","inactive","review","inDev","missing"].map(govStatusScore)).toEqual([5,4,3,2,0]); });
  it("excludes pending", () => { expect(govStatusScore("pending")).toBeNull(); expect(govAverage([null, null])).toBeNull(); expect(govAverage([5, null, 3])).toBe(4); });
  it("percent = avg/5*100", () => { expect(govPctOf(2)).toBe(40); expect(govPctOf(null)).toBeNull(); });
  it("file text uses same scale; empty cell excluded", () => {
    expect(["موجود ومفعّل","موجود وغير مفعّل","بحاجة إلى تحديث ومراجعة","قيد الإعداد","غير موجود"].map((s) => textToScore(s, GOV_TEXT_SCORE))).toEqual([5,4,3,2,0]);
    expect(textToScore("", GOV_TEXT_SCORE)).toBeNull();
  });
});
