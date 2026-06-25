export interface Attributes {
  strength: number;     // 力量
  agility: number;      // 敏捷
  intelligence: number; // 智力
  charisma: number;     // 魅力
  willpower: number;    // 意志
  luck: number;         // 运气
}

export interface Character {
  name: string;
  gender?: string;
  class: string;
  attributes: Attributes;
  traits: string[];
  inventory: string[];
  hp: number;
  maxHp: number;
  sanity: number;
  maxSanity: number;
  resourceName: string;          // Major resource, e.g. "生命值" (HP) / "内力" (Qi)
  secondaryResourceName: string; // Minor resource, e.g. "理智值" (Sanity) / "精力" (Energy)
  backstory: string;
}

export interface HistoryTurn {
  turn: number;
  narrative: string;
  choiceOrAction: string;
  rollResult?: string; // e.g. "D20 = 15 vs DC 12 (成功)"
  gmCommentary?: string;
  diceRoll?: any;
}

export interface RecommendedChoice {
  text: string;
  difficulty: string; // e.g. "敏捷 检定 (DC 12)" or "常规行动"
  actionType: "check" | "normal";
  attribute: "strength" | "agility" | "intelligence" | "charisma" | "willpower" | "luck" | "none";
  targetDc: number;
}

export interface GameState {
  genre: string; // "修仙", "赛博朋克", "克苏鲁迷雾", "剑与魔法", "末日废土", "自定义"
  customGenreText?: string;
  gmPersonality: string; // "Cold Rules-Stickler", "Dramatic", "Poetic Bard"
  character: Character;
  history: HistoryTurn[];
  currentEventText: string;
  currentGmCommentary: string;
  currentChoices: RecommendedChoice[];
  isGameOver: boolean;
  gameEndingType: "victory" | "death" | "none";
  isNegotiating: boolean;
  negotiationFeedback: string;
  turnCount: number;
}

export const PRESET_GENRES = [
  {
    id: "修仙仙侠",
    name: "玄幻修仙",
    desc: "踏天道，逆乾坤。吸纳天地灵气，渡劫炼魄，御剑乘风斩尽世间妖魔。",
    resourceName: "气血值",
    secondaryResourceName: "真元值",
    defaultClass: "散修",
    classes: ["御剑修真者", "炼体狂战士", "符箓天师", "散修药师"],
    defaultAttributes: { strength: 10, agility: 12, intelligence: 14, charisma: 10, willpower: 14, luck: 10 },
    defaultTraits: ["九阳神脉：体魄极强", "道法自然：法术检定获得加成"],
    defaultInventory: ["下品飞剑", "辟谷丹二丸", "聚灵草"],
  },
  {
    id: "赛博朋克",
    name: "赛博朋克",
    desc: "高科技，低生活。在霓虹交错的雨夜都市，用机械义肢与网络芯片反抗寡头垄断。",
    resourceName: "健康值",
    secondaryResourceName: "网络心智",
    defaultClass: "街头浪人",
    classes: ["独行侠 (Solo)", "网络黑客 (Netrunner)", "街头义医", "公司叛逃者"],
    defaultAttributes: { strength: 12, agility: 14, intelligence: 12, charisma: 10, willpower: 10, luck: 12 },
    defaultTraits: ["神经反射加速：敏捷检定微加成", "数据直觉：代码破解更加容易"],
    defaultInventory: ["电磁振动短刀", "战术护目镜", "高容量数据存储器"],
  },
  {
    id: "克苏鲁迷雾",
    name: "克苏鲁迷雾",
    desc: "迷雾笼罩的维多利亚小镇，不可名状的古老存在。理智是你唯一的武器，亦是你的牢笼。",
    resourceName: "体质健康",
    secondaryResourceName: "理智值(SAN)",
    defaultClass: "私家侦探",
    classes: ["私家侦探", "神秘学教授", "虔诚神父", "古董收藏家"],
    defaultAttributes: { strength: 8, agility: 10, intelligence: 14, charisma: 12, willpower: 14, luck: 12 },
    defaultTraits: ["第六感：对潜伏危机有极高直觉", "坚忍心智：理智检定获得小幅加成"],
    defaultInventory: ["防风煤油灯", "点45口径左轮手枪", "泛黄的古怪笔记本"],
  },
  {
    id: "剑与魔法",
    name: "中世纪幻想",
    desc: "巨龙咆哮，王国争霸。在精灵遗迹与矮人矿坑间冒险，书写专属于你的史诗之歌。",
    resourceName: "生命值",
    secondaryResourceName: "魔力值",
    defaultClass: "流浪冒险者",
    classes: ["圣殿骑士", "奥术法师", "荒野巡林客", "阴影刺客"],
    defaultAttributes: { strength: 14, agility: 12, intelligence: 10, charisma: 10, willpower: 12, luck: 12 },
    defaultTraits: ["神眷之子：运气检定有保底加成", "精巧潜行：不易被敌人发觉"],
    defaultInventory: ["精钢长剑", "治疗药水", "冒险家便携睡袋"],
  },
  {
    id: "末日废土",
    name: "核后废土",
    desc: "狂风卷着辐射黄沙。在废弃避难所与变异生物之间寻觅微薄的生存物资。",
    resourceName: "生命体征",
    secondaryResourceName: "抗辐射度",
    defaultClass: "废土拾荒者",
    classes: ["辐射游侠", "废土医生", "重装流浪汉", "变异半兽人"],
    defaultAttributes: { strength: 14, agility: 12, intelligence: 10, charisma: 8, willpower: 14, luck: 12 },
    defaultTraits: ["抗辐射体质：抵抗毒素检定加成", "精明交易者：擅长物物交换"],
    defaultInventory: ["自制霰弹枪", "过期防辐射药片", "多功能罐头刀"],
  }
];

export const PERSONALITIES = [
  {
    id: "Dramatic",
    name: "幽默风趣的戏剧家",
    desc: "充满幽默与意外转折，热衷于制造绝妙的巧合或奇幻笑料，跑团体验轻松诙谐。"
  },
  {
    id: "Cold Rules-Stickler",
    name: "冷酷无情的守规人",
    desc: "硬核求生风格。笔触冷峻，环境严苛凶险，对失败惩罚毫不手软，步步危机。"
  },
  {
    id: "Poetic Bard",
    name: "注重描写的诗人和歌者",
    desc: "文字如诗如画，细腻的景物描摹与人物内心宿命感的叹息，追求极高代入感和文笔。"
  },
  {
    id: "ErogeGalgame",
    name: "日式Galgame深夜档",
    desc: "挑逗感官、高糖暧昧的日系AVG体验。文笔充满心跳细节、眼神拉扯与令人面红耳赤的亲密互动。"
  }
];

export interface ApiConfig {
  modelEngine: "gemini" | "deepseek" | "openai";
  geminiApiKey: string;
  deepseekApiKey: string;
  deepseekApiUrl: string;
  deepseekModel: string;
  openaiApiKey: string;
  openaiApiUrl: string;
  openaiModel: string;
}

export function getApiConfig(): ApiConfig {
  try {
    const configStr = localStorage.getItem("trpg_api_config");
    if (configStr) {
      return JSON.parse(configStr) as ApiConfig;
    }
  } catch (err) {
    console.error("Error loading API config", err);
  }
  return {
    modelEngine: "gemini",
    geminiApiKey: "",
    deepseekApiKey: "",
    deepseekApiUrl: "https://api.deepseek.com",
    deepseekModel: "deepseek-v4-pro",
    openaiApiKey: "",
    openaiApiUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-4o"
  };
}

