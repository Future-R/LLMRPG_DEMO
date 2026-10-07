import { AttributeDefinition } from "../types";

export interface TriggeredTrait {
  name: string;
  bonus: number;
  reason: string;
}

export interface TraitEvaluationResult {
  totalBonus: number;
  triggeredTraits: TriggeredTrait[];
}

/**
 * 智能评估角色持有的天赋特质对当前检定属性及行动的实际加成
 */
export function evaluateTraitBonus(
  traits: string[],
  attributeKey: string,
  attrDef: AttributeDefinition,
  actionText: string,
): TraitEvaluationResult {
  if (!traits || traits.length === 0) {
    return { totalBonus: 0, triggeredTraits: [] };
  }

  const triggered: TriggeredTrait[] = [];
  const normalizedAction = (actionText || "").toLowerCase();
  const attrName = attrDef?.name || "";
  const key = (attributeKey || "").toLowerCase();

  // 属性维度的语义关联词库，支持各世界观题材下的同义检定匹配
  const attributeKeywords: Record<string, string[]> = {
    strength: [
      "力量",
      "体魄",
      "肉身",
      "蛮力",
      "近战",
      "厮杀",
      "猛将",
      "冲阵",
      "白刃",
      "重甲",
      "强韧",
      "柔韧",
      "体格",
      "勇武",
      "搏击",
      "破坏",
      "挣脱",
      "束缚",
      "突围",
      "蛮勇",
    ],
    agility: [
      "敏捷",
      "身法",
      "速度",
      "闪避",
      "先攻",
      "反应",
      "逃跑",
      "骑射",
      "飞将",
      "神速",
      "灵敏",
      "脱身",
      "机动",
      "轻功",
      "翻滚",
      "潜行",
      "暗杀",
      "步法",
      "射术",
    ],
    intelligence: [
      "智力",
      "神识",
      "计谋",
      "法术",
      "学识",
      "破解",
      "分析",
      "战术",
      "神秘",
      "道法",
      "博览",
      "搜寻",
      "谋士",
      "符箓",
      "奥术",
      "智械",
      "推演",
      "洞察",
      "推理",
      "代码",
    ],
    charisma: [
      "魅力",
      "交涉",
      "说服",
      "欺瞒",
      "人望",
      "威慑",
      "社交",
      "领袖",
      "号召",
      "仁德",
      "雄主",
      "守护",
      "威信",
      "谈判",
      "劝降",
      "声望",
      "结盟",
      "名望",
    ],
    willpower: [
      "意志",
      "定力",
      "道心",
      "气节",
      "抗性",
      "不屈",
      "理智",
      "抗辐",
      "坚毅",
      "信仰",
      "洗脑",
      "诱惑",
      "抵御",
      "不退",
      "沉沦",
      "净化",
      "镇定",
      "精神",
    ],
    luck: [
      "运气",
      "气运",
      "天命",
      "直觉",
      "奇迹",
      "第六感",
      "拾荒",
      "边缘",
      "福缘",
      "幸存",
      "侥幸",
      "避险",
      "天时",
      "转机",
      "机缘",
    ],
  };

  const currentSlotKeywords = attributeKeywords[key] || [];

  for (const rawTrait of traits) {
    if (!rawTrait || typeof rawTrait !== "string") continue;

    // 解析 "名称：描述" 结构
    let title = rawTrait;
    let description = rawTrait;
    if (rawTrait.includes("：")) {
      const parts = rawTrait.split("：");
      title = parts[0].trim();
      description = parts.slice(1).join("：").trim();
    } else if (rawTrait.includes(":")) {
      const parts = rawTrait.split(":");
      title = parts[0].trim();
      description = parts.slice(1).join(":").trim();
    }

    const fullTraitText = rawTrait.toLowerCase();

    // 1. 检查是否与当前检定属性直接或间接匹配
    let isMatched = false;
    let matchReason = "";

    // 属性名称直接出现
    if (attrName && fullTraitText.includes(attrName.toLowerCase())) {
      isMatched = true;
      matchReason = `契合【${attrName}】属性检定`;
    }

    // 槽位关键词匹配
    if (!isMatched) {
      for (const kw of currentSlotKeywords) {
        if (fullTraitText.includes(kw)) {
          isMatched = true;
          matchReason = `针对【${kw}】相关行动提供加成`;
          break;
        }
      }
    }

    // 行动上下文关键词匹配 (若行动内容与特质直接相关)
    if (!isMatched && normalizedAction) {
      const actionKeywords = [
        "突围",
        "单挑",
        "斩将",
        "破阵",
        "飞射",
        "骑射",
        "逃跑",
        "闪避",
        "埋伏",
        "火攻",
        "水攻",
        "计策",
        "劝降",
        "招揽",
        "谈判",
        "说服",
        "死战",
        "不屈",
        "抵抗",
        "脱身",
        "挣脱",
        "变身",
        "施法",
        "念咒",
        "骇入",
        "入侵",
        "射击",
        "潜行",
        "偷袭",
        "搜寻",
        "调查",
      ];
      for (const akw of actionKeywords) {
        if (normalizedAction.includes(akw) && fullTraitText.includes(akw)) {
          isMatched = true;
          matchReason = `行动触发【${akw}】专属特质效果`;
          break;
        }
      }
    }

    if (isMatched) {
      // 2. 解析加成数值大小
      let bonus = 2; // 默认特质加成

      // 提取显式数字加成，如 "+3", "+2", "-2"
      const numberMatch = fullTraitText.match(/([+-]\d+)/);
      if (numberMatch) {
        bonus = parseInt(numberMatch[1], 10);
      } else if (
        fullTraitText.includes("大幅加成") ||
        fullTraitText.includes("极大加成") ||
        fullTraitText.includes("大幅提升") ||
        fullTraitText.includes("大加成")
      ) {
        bonus = 3;
      } else if (
        fullTraitText.includes("小幅加成") ||
        fullTraitText.includes("微加成") ||
        fullTraitText.includes("略微加成")
      ) {
        bonus = 1;
      } else if (
        fullTraitText.includes("惩罚") ||
        fullTraitText.includes("负面") ||
        fullTraitText.includes("削弱") ||
        fullTraitText.includes("不利")
      ) {
        bonus = -2;
      }

      triggered.push({
        name: title,
        bonus,
        reason: matchReason || "提供检定加成",
      });
    }
  }

  // 累计所有生效特质加成，设置安全区间 (-5 ~ +8) 防止失衡
  const rawSum = triggered.reduce((acc, t) => acc + t.bonus, 0);
  const totalBonus = Math.max(-5, Math.min(8, rawSum));

  return {
    totalBonus,
    triggeredTraits: triggered,
  };
}
