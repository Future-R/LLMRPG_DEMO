export interface AttributeDefinition {
  key: string;         // 属性标识键，如 "strength"、"agility" 或自定义键
  name: string;        // 中文属性名称，如 "根骨"、"体魄"、"力量"
  abbr: string;        // 单字/双字简称，如 "骨"、"体"、"力"
  desc: string;        // 属性释义
}

export const DEFAULT_ATTRIBUTE_DEFINITIONS: AttributeDefinition[] = [
  { key: "strength", name: "力量", abbr: "力", desc: "决定肉身蛮力、负重与物理破坏" },
  { key: "agility", name: "敏捷", abbr: "敏", desc: "决定动作敏捷、闪避反应与潜行速度" },
  { key: "intelligence", name: "智力", abbr: "智", desc: "决定知识储备、逻辑推演与洞察解析" },
  { key: "charisma", name: "魅力", abbr: "魅", desc: "决定言语交涉、人际吸引与领袖威信" },
  { key: "willpower", name: "意志", abbr: "志", desc: "决定精神坚毅、抵御诱惑与逆境决断" },
  { key: "luck", name: "运气", abbr: "运", desc: "决定天命福运、危急转机与意外眷顾" },
];

export interface Attributes {
  strength: number;     // 维度1
  agility: number;      // 维度2
  intelligence: number; // 维度3
  charisma: number;     // 维度4
  willpower: number;    // 维度5
  luck: number;         // 维度6
  [key: string]: number; // 支持扩展键
}

export interface CustomStatusBar {
  id: string;
  name: string;
  current: number;
  max: number;
  color?: string; // 状态条颜色主题: 如 "red", "purple", "blue", "emerald", "amber", "cyan"
}

export interface Character {
  name: string;
  gender?: string;
  class: string;
  attributes: Attributes;
  attributeDefinitions?: AttributeDefinition[]; // 当前世界观或自定义六维配置
  traits: string[];
  inventory: string[];
  hp: number;
  maxHp: number;
  sanity: number;
  maxSanity: number;
  resourceName: string;          // 主要资源名，如 "生命值" / "气血值"
  secondaryResourceName: string; // 次要资源名，如 "理智值" / "真元值"
  customStatusBars?: CustomStatusBar[]; // 额外或自定义状态条（如 AP、护盾、气力等，支持增删改）
  backstory: string;
}

export interface HistoryTurn {
  turn: number;
  narrative: string;
  choiceOrAction: string;
  rollResult?: string; // 如 "D20 = 15 vs DC 12 (成功)"
  gmCommentary?: string;
  diceRoll?: any;
}

export interface RecommendedChoice {
  text: string;
  difficulty: string; // 如 "身法 检定 (DC 12)" 或 "常规行动"
  actionType: "check" | "normal";
  attribute: string; // 对应属性 key 或 "none"
  targetDc: number;
}

export interface GameState {
  genre: string; // "修仙", "赛博朋克", "克苏鲁迷雾", "剑与魔法", "末日废土", "女主角危机", "自定义"
  customGenreText?: string;
  gmPersonality: string; // "Dramatic", "Cold Rules-Stickler", "Poetic Bard", "ErogeGalgame"
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

export interface GenrePreset {
  id: string;
  name: string;
  desc: string;
  resourceName: string;
  secondaryResourceName: string;
  defaultClass: string;
  classes: string[];
  attributeDefinitions: AttributeDefinition[];
  defaultAttributes: Attributes;
  defaultTraits: string[];
  defaultInventory: string[];
}

export const PRESET_GENRES: GenrePreset[] = [
  {
    id: "修仙仙侠",
    name: "玄幻修仙",
    desc: "踏天道，逆乾坤。吸纳天地灵气，渡劫炼魄，御剑乘风斩尽世间妖魔。",
    resourceName: "气血值",
    secondaryResourceName: "真元值",
    defaultClass: "散修",
    classes: ["御剑修真者", "炼体狂战士", "符箓天师", "散修药师"],
    attributeDefinitions: [
      { key: "strength", name: "根骨", abbr: "骨", desc: "决定肉身强韧、气血负荷与承受打击能力" },
      { key: "agility", name: "身法", abbr: "身", desc: "决定御剑飞遁、腾挪闪避与出招迅捷" },
      { key: "intelligence", name: "神识", abbr: "识", desc: "决定灵觉探查、法宝驭使与洞见隐秘" },
      { key: "charisma", name: "悟性", abbr: "悟", desc: "决定道法参悟、功法进境与破除虚妄" },
      { key: "willpower", name: "定力", abbr: "定", desc: "决定道心稳固、抵抗心魔与逆境意志" },
      { key: "luck", name: "气运", abbr: "运", desc: "决定福缘机遇、天材地宝发现与死中求活" },
    ],
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
    classes: ["独行义侠", "网络黑客", "街头义医", "企业叛逃者"],
    attributeDefinitions: [
      { key: "strength", name: "体魄", abbr: "体", desc: "决定义体承载、肉身抗揍与蛮力破坏" },
      { key: "agility", name: "反应", abbr: "敏", desc: "决定神经反射、拔枪射击与闪避机动" },
      { key: "intelligence", name: "智械", abbr: "械", desc: "决定黑客入侵、硬件破解与网络协议" },
      { key: "charisma", name: "声望", abbr: "名", desc: "决定街头信誉、谈判话术与地下黑市威望" },
      { key: "willpower", name: "镇定", abbr: "冷", desc: "决定赛博精神病抗性与重压下的冷静" },
      { key: "luck", name: "边缘", abbr: "命", desc: "决定孤注一掷的胜算与绝境险胜转机" },
    ],
    defaultAttributes: { strength: 12, agility: 14, intelligence: 12, charisma: 10, willpower: 10, luck: 12 },
    defaultTraits: ["神经反射加速：敏捷检定微加成", "数据直觉：代码破解更加容易"],
    defaultInventory: ["电磁振动短刀", "战术护目镜", "高容量数据存储器"],
  },
  {
    id: "克苏鲁迷雾",
    name: "克苏鲁迷雾",
    desc: "迷雾笼罩的维多利亚小镇，不可名状的古老存在。理智是你唯一的武器，亦是你的牢笼。",
    resourceName: "体质健康",
    secondaryResourceName: "理智值",
    defaultClass: "私家侦探",
    classes: ["私家侦探", "神秘学教授", "虔诚神父", "古董收藏家"],
    attributeDefinitions: [
      { key: "strength", name: "体格", abbr: "体", desc: "决定肉身力量、负重与抵御物理创伤能力" },
      { key: "agility", name: "敏捷", abbr: "敏", desc: "决定逃跑脱身、灵巧闪避与潜行匿迹" },
      { key: "intelligence", name: "智识", abbr: "智", desc: "决定神秘学知识、古代文献解读与逻辑推理" },
      { key: "charisma", name: "社交", abbr: "交", desc: "决定交涉盘问、欺瞒掩饰与获取情报信任" },
      { key: "willpower", name: "意志", abbr: "心", desc: "决定抵御不可名状理智流失与心智崩溃抗性" },
      { key: "luck", name: "幸运", abbr: "运", desc: "决定命运偶然的眷顾与关键线索偶得" },
    ],
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
    attributeDefinitions: [
      { key: "strength", name: "力量", abbr: "力", desc: "决定近战威力、重甲穿戴与物理负重" },
      { key: "agility", name: "敏捷", abbr: "敏", desc: "决定身手敏捷、暗中潜行与远程命中" },
      { key: "intelligence", name: "智力", abbr: "智", desc: "决定奥术造诣、古代符文认知与学识" },
      { key: "charisma", name: "魅力", abbr: "魅", desc: "决定领袖号召、贵族交涉与神圣信服力" },
      { key: "willpower", name: "意志", abbr: "志", desc: "决定精神抵抗、信念坚持与抵御恐惧" },
      { key: "luck", name: "运气", abbr: "运", desc: "决定暴击机遇、奇迹发生与流浪冒险吉凶" },
    ],
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
    attributeDefinitions: [
      { key: "strength", name: "强韧", abbr: "韧", desc: "决定废土搏击、重装搬运与抗辐肉身" },
      { key: "agility", name: "机动", abbr: "动", desc: "决定废土逃逸、枪械反应与隐蔽迂回" },
      { key: "intelligence", name: "搜寻", abbr: "搜", desc: "决定机械改装、废料辨识与科技遗物修复" },
      { key: "charisma", name: "威慑", abbr: "威", desc: "决定物物交换谈判、流民营交涉与震慑强盗" },
      { key: "willpower", name: "坚毅", abbr: "毅", desc: "决定废土求生意志、抗饥渴脱水与精神坚持" },
      { key: "luck", name: "拾荒", abbr: "运", desc: "决定开箱收获、未爆弹避险与稀有补给发现" },
    ],
    defaultAttributes: { strength: 14, agility: 12, intelligence: 10, charisma: 8, willpower: 14, luck: 12 },
    defaultTraits: ["抗辐射体质：抵抗毒素检定加成", "精明交易者：擅长物物交换"],
    defaultInventory: ["自制霰弹枪", "过期防辐射药片", "多功能罐头刀"],
  },
  {
    id: "女主角危机",
    name: "女主角危机",
    desc: "正义的美少女战士/魔法少女跌入反派设下的致命危局。战服受损、魔力流失、重重束缚、怪人捕捉、或心灵低语……在极度凶险与绝对危难中，你是坚守信念华丽逆转，还是在绝对力量面前彻底沉沦？（高张力、强代入感的二次元二重状态危机跑团体验）",
    resourceName: "生命与衣装完好度",
    secondaryResourceName: "意志与净化抗性",
    defaultClass: "魔法少女",
    classes: ["星空魔法少女", "重装钢之姬", "异能防卫特工", "圣洁光辉神姬"],
    attributeDefinitions: [
      { key: "strength", name: "柔韧", abbr: "柔", desc: "决定力量对抗、挣脱触手或绳索束缚的身体柔韧度" },
      { key: "agility", name: "脱身", abbr: "敏", desc: "决定敏捷闪避、危局脱身与身手灵敏" },
      { key: "intelligence", name: "战术", abbr: "谋", desc: "决定危机战术判断、弱点侦析与智斗反派陷阱" },
      { key: "charisma", name: "守护", abbr: "魅", desc: "决定心智光彩、纯洁信念号召与救赎之光" },
      { key: "willpower", name: "坚毅", abbr: "毅", desc: "决定抵御沉沦诱惑、心理洗脑与意志抗性" },
      { key: "luck", name: "奇迹", abbr: "迹", desc: "决定绝境爆发、战服神圣逆转与命运奇迹" },
    ],
    defaultAttributes: { strength: 10, agility: 14, intelligence: 10, charisma: 14, willpower: 12, luck: 10 },
    defaultTraits: ["不屈信念：深陷险境或束缚挣扎时，意志与挣脱检定获得大幅加成", "华丽变身：可在危急关头激发生命潜能、恢复神圣衣饰完好度"],
    defaultInventory: ["契约变身吊坠", "残损战衣防尘修补贴", "微弱的圣光守护符印"],
  },
  {
    id: "三国演义",
    name: "三国演义",
    desc: "东汉末年，天下大乱，群雄并起。是跃马横枪斩将夺旗，还是运筹帷幄决胜千里？在波澜壮阔的三国大争之世，书写属于你的忠义传奇与王霸之业。",
    resourceName: "气血体魄",
    secondaryResourceName: "计略军心",
    defaultClass: "破阵猛将",
    classes: ["破阵猛将", "帷幄谋士", "仁德雄主", "百步飞将"],
    attributeDefinitions: [
      { key: "strength", name: "勇武", abbr: "武", desc: "决定沙场冲阵、单挑斩将、重甲负重与近身白刃厮杀" },
      { key: "agility", name: "骑射", abbr: "骑", desc: "决定纵马奔驰、开弓飞射、阵前脱险与机动作战" },
      { key: "intelligence", name: "计谋", abbr: "谋", desc: "决定识破埋伏、行军布局、水火攻心与临机应变" },
      { key: "charisma", name: "人望", abbr: "望", desc: "决定招贤纳士、激励军心、阵前劝降与诸侯交涉" },
      { key: "willpower", name: "气节", abbr: "节", desc: "决定誓死不降、抵抗动摇离间、逆境坚守与威武不屈" },
      { key: "luck", name: "天命", abbr: "命", desc: "决定风云际会、绝境转机、天时借东风与吉凶宿命" },
    ],
    defaultAttributes: { strength: 14, agility: 12, intelligence: 10, charisma: 12, willpower: 12, luck: 10 },
    defaultTraits: ["万夫莫开：乱军突围或单挑对决时获得加成", "兵贵神速：先发制人与机动追击能力出众"],
    defaultInventory: ["点钢镔铁枪", "精制皮甲", "金疮散二瓶", "行军干粮"],
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
    name: "日式恋爱冒险深夜档",
    desc: "挑逗感官、高糖暧昧的日系互动体验。文笔充满心跳细节、眼神拉扯与令人面红耳赤的亲密互动。"
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
  gmPersonality?: string; // 系统级主持人人设设置
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
    openaiModel: "gpt-4o",
    gmPersonality: "Dramatic"
  };
}

