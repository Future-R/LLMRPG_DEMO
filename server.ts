import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Google GenAI Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("Warning: GEMINI_API_KEY environment variable is missing.");
}

// A highly resilient helper to fetch content from DeepSeek or compatible OpenAI-like APIs
async function generateContentWithDeepSeek(config: {
  contents: string;
  systemInstruction: string;
  responseSchema: any;
  apiKey: string;
  apiUrl: string;
  model: string;
}) {
  const cleanUrl = config.apiUrl.trim().replace(/\/$/, "");
  const endpoint = `${cleanUrl}/chat/completions`;
  const systemPrompt = `${config.systemInstruction}\n\n您【必须】返回一个符合以下 JSON 架构的 JSON 对象。不要输出任何解释或 Markdown 格式包裹（如 \`\`\`json）：\n${JSON.stringify(config.responseSchema)}`;

  console.log(`[DeepSeek AI] Routing request to: ${endpoint} | Model: ${config.model}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey.trim()}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: config.contents }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`DeepSeek API 请求失败 (HTTP ${response.status}): ${errBody || "未返回详情"}`);
  }

  const result: any = await response.json();
  const content = result?.choices?.[0]?.message?.content || "";
  
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[DeepSeek AI] JSON parsing failed. Content:", cleaned);
    throw new Error("DeepSeek 接口没有返回有效的符合要求的 JSON 对象，请重试。");
  }
}

// A highly resilient helper to fetch content from Gemini with auto-retry and fallback models
async function generateContentWithFallback(config: {
  contents: any;
  systemInstruction: string;
  responseMimeType: string;
  responseSchema: any;
}) {
  if (!ai) {
    throw new Error("Gemini API client is not initialized.");
  }

  // List of models to try in order of priority/robustness
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[TRPG AI] Attempting with model: ${model} (attempt ${attempt}/2)`);
        const response = await ai.models.generateContent({
          model: model,
          contents: config.contents,
          config: {
            systemInstruction: config.systemInstruction,
            responseMimeType: config.responseMimeType,
            responseSchema: config.responseSchema,
          },
        });

        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`[TRPG AI] Model ${model} failed:`, err.message || err);
        // Sleep briefly before retrying
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  throw lastError || new Error("All fallback models and retries failed to return content.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API: Get current status / check if key works
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasApiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // API: TRPG Character Negotiation
  app.post("/api/trpg/negotiate", async (req, res) => {
    const apiEngine = (req.headers["x-api-engine"] as string) || "gemini";
    const dsKey = req.headers["x-deepseek-api-key"] as string | undefined;
    const dsUrl = (req.headers["x-deepseek-api-url"] as string) || "https://api.deepseek.com/v1";
    const dsModel = (req.headers["x-deepseek-model"] as string) || "deepseek-chat";

    if (apiEngine === "gemini" && !ai) {
      return res.status(500).json({ error: "Gemini API client is not initialized. Please configure GEMINI_API_KEY." });
    }
    if (apiEngine === "deepseek" && !dsKey) {
      return res.status(400).json({ error: "请先在主页设置中填写并配置您的 DeepSeek API Key。" });
    }

    try {
      const { genre, character, chatMessage } = req.body;

      const systemInstruction = `你是一位专业、风趣且富有创意的跑团游戏主持人（Game Master，简称GM）。
当前游戏背景题材是：【${genre}】。
玩家正在进行角色设定与背景协商。你需要根据玩家的想法、当前角色卡信息以及他们发送的信息，提供专业的建议、润色背景，并推荐适合这个设定的属性分配、2-3个初始天赋/特质（Traits），以及3-4件合理的初始携带物品（Inventory）。
请用非常友好且充满跑团仪式感的简短中文口吻进行回复。
你必须返回符合指定 JSON 格式的数据。`;

      const prompt = `玩家当前的属性分配是：
- 力量(STR): ${character.attributes.strength}
- 敏捷(AGI): ${character.attributes.agility}
- 智力(INT): ${character.attributes.intelligence}
- 魅力(CHA): ${character.attributes.charisma}
- 意志(WIL): ${character.attributes.willpower}
- 运气(LCK): ${character.attributes.luck}

角色名字: ${character.name || "未命名"}
角色职业/身份: ${character.class || "未设定"}
初始天赋/特质: ${JSON.stringify(character.traits || [])}
初始携带物品: ${JSON.stringify(character.inventory || [])}

玩家给你的协商留言/要求: "${chatMessage || "请帮我润色当前的背景与设定，给出推荐的属性与物品"}"

请提供协商反馈、推荐的属性配置（总和保持与当前一致，或根据特色建议微调）、推荐的天赋（至少2个）、推荐的初始携带物品（至少3件）。`;

      const responseSchema = {
        type: "object",
        properties: {
          feedback: {
            type: "string",
            description: "GM对玩家背景和设定的中文点评、润色建议和跑团引入词，字数控制在150-250字内。",
          },
          suggestedAttributes: {
            type: "object",
            properties: {
              strength: { type: "integer" },
              agility: { type: "integer" },
              intelligence: { type: "integer" },
              charisma: { type: "integer" },
              willpower: { type: "integer" },
              luck: { type: "integer" },
            },
            description: "GM推荐的最契合该人设的属性分配数值。",
          },
          suggestedTraits: {
            type: "array",
            items: { type: "string" },
            description: "GM推荐的2-3个中文天赋/特质名称（附带简短效果描述，例如：'过目不忘：智力检定获得微幅加成'）。",
          },
          suggestedInventory: {
            type: "array",
            items: { type: "string" },
            description: "GM推荐的3-4件有趣的初始携带物品（例如：'破旧的牛皮日记本'、'附魔的黄铜指北针'）。",
          },
        },
        required: ["feedback", "suggestedAttributes", "suggestedTraits", "suggestedInventory"],
      };

      if (apiEngine === "deepseek") {
        const result = await generateContentWithDeepSeek({
          contents: prompt,
          systemInstruction,
          responseSchema,
          apiKey: dsKey!,
          apiUrl: dsUrl,
          model: dsModel,
        });
        return res.json(result);
      } else {
        const response = await generateContentWithFallback({
          contents: prompt,
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feedback: {
                type: Type.STRING,
                description: "GM对玩家背景和设定的中文点评、润色建议和跑团引入词，字数控制在150-250字内。",
              },
              suggestedAttributes: {
                type: Type.OBJECT,
                properties: {
                strength: { type: Type.INTEGER },
                agility: { type: Type.INTEGER },
                intelligence: { type: Type.INTEGER },
                charisma: { type: Type.INTEGER },
                willpower: { type: Type.INTEGER },
                luck: { type: Type.INTEGER },
              },
              description: "GM推荐的最契合该人设的属性分配数值。",
            },
            suggestedTraits: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "GM推荐的2-3个中文天赋/特质名称（附带简短效果描述）。",
            },
            suggestedInventory: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "GM推荐 of 3-4件有趣的初始携带物品。",
            },
          },
          required: ["feedback", "suggestedAttributes", "suggestedTraits", "suggestedInventory"],
        },
      });

      const parsed = JSON.parse(response.text!);
      return res.json(parsed);
    }
  } catch (error: any) {
    console.error("Negotiate API error:", error);
    return res.status(500).json({ error: error.message || "Negotiate API error" });
  }
});

// API: TRPG Compress History
app.post("/api/trpg/compress", async (req, res) => {
    const apiEngine = (req.headers["x-api-engine"] as string) || "gemini";
    const dsKey = req.headers["x-deepseek-api-key"] as string | undefined;
    const dsUrl = (req.headers["x-deepseek-api-url"] as string) || "https://api.deepseek.com/v1";
    const dsModel = (req.headers["x-deepseek-model"] as string) || "deepseek-chat";

    if (apiEngine === "gemini" && !ai) {
      return res.status(500).json({ error: "Gemini API client is not initialized. Please configure GEMINI_API_KEY." });
    }
    if (apiEngine === "deepseek" && !dsKey) {
      return res.status(400).json({ error: "请先在主页设置中填写并配置您的 DeepSeek API Key。" });
    }

    try {
      const {
        genre,
        character,
        turnsToCompress,
      } = req.body;

      const systemInstruction = `你是一位高水平的跑团故事编辑与历史记录官。你的任务是将玩家过去经历的 20 个跑团回合合并，提炼并总结成一段 150-300 字左右、流畅连贯、文笔极佳且契合题材（${genre}）的【编年史摘要（前情提要）】。
核心要求：
1. 用一段话/几句非常连贯生动的中文概括，绝对不要使用列表形式。
2. 保留玩家取得的核心成就、战斗结果、重大损伤、获得的重要物品或角色成长。
3. 保持史史、跌宕起伏的叙事风格，使玩家和未来的大语言模型主持人能通过此摘要记起该阶段的关键经过。`;

      const turnsText = turnsToCompress.map((h: any) => {
        return `【回合 ${h.turn}】
场景: ${h.narrative}
行动: ${h.choiceOrAction}
${h.rollResult ? `判定: ${h.rollResult}` : ""}`;
      }).join("\n\n");

      const prompt = `以下是过去 20 个回合的跑团记录：
${turnsText}

请为这 20 个回合撰写一气呵成的故事编年史阶段总结。`;

      if (apiEngine === "deepseek") {
        const response = await fetch(`${dsUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${dsKey}`
          },
          body: JSON.stringify({
            model: dsModel,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt }
            ],
            temperature: 0.6
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`DeepSeek API 请求失败 (HTTP ${response.status}): ${errBody}`);
        }
        const result: any = await response.json();
        const content = result?.choices?.[0]?.message?.content || "";
        return res.json({ summary: content.trim() });
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.6
          }
        });

        return res.json({ summary: response.text?.trim() || "" });
      }
    } catch (error: any) {
      console.error("Compression error:", error);
      res.status(500).json({ error: error.message || "History compression error" });
    }
});

// API: TRPG Next Event / Choice Generation
app.post("/api/trpg/generate-event", async (req, res) => {
    const apiEngine = (req.headers["x-api-engine"] as string) || "gemini";
    const dsKey = req.headers["x-deepseek-api-key"] as string | undefined;
    const dsUrl = (req.headers["x-deepseek-api-url"] as string) || "https://api.deepseek.com/v1";
    const dsModel = (req.headers["x-deepseek-model"] as string) || "deepseek-chat";

    if (apiEngine === "gemini" && !ai) {
      return res.status(500).json({ error: "Gemini API client is not initialized. Please configure GEMINI_API_KEY." });
    }
    if (apiEngine === "deepseek" && !dsKey) {
      return res.status(400).json({ error: "请先在主页设置中填写并配置您的 DeepSeek API Key。" });
    }

    try {
      const {
        genre,
        character,
        history,
        longTermHistory,
        choiceOrAction,
        diceRoll,
        gmPersonality,
        guidancePrompt,
      } = req.body;

      // Map personality to narrative guidance
      let personalityGuide = "";
      if (gmPersonality === "Cold Rules-Stickler") {
        personalityGuide = "你的风格是【冷酷无情的守规人】。描述笔触冰冷、残酷。剧情强调环境的危险性，任何失误都会面临严重的致命后果或严苛的惩罚，极度注重属性契合度和合理性。";
      } else if (gmPersonality === "Poetic Bard") {
        personalityGuide = "你的风格是【注重描写的诗人和歌者】。使用极具文学美感、优美、充满细节和诗意的句子。强调氛围感、角色的心理活动、光影、气味、宿命感，给玩家极强的沉浸式叙事体验。";
      } else if (gmPersonality === "ErogeGalgame") {
        personalityGuide = "你的风格是【日式色情游戏/绅士Galgame深夜档主持人】。叙事极具日式AVG/Galgame文字冒险感，文笔极其暧昧、诱惑和挑逗。极力描摹感官细节、心跳加速（如‘咚咚’、‘噗通’）、面红耳赤的羞耻瞬间、眼神拉扯与肢体碰触，带有戏剧化的二次元吐槽和令人浮想联翩的台词，语气中带着一丝挑弄和玩味，为玩家营造荷尔蒙飙升的绅士向恋爱与脸红心跳的日系Galgame跑团互动氛围。在描述各种检定和事件时，多加入面部红晕、衣衫不整、耳畔低语、体温升高等轻小说/绅士向感官元素。";
      } else {
        personalityGuide = "你的风格是【幽默风趣的戏剧家】。充满黑色幽默、戏剧性转折和意想不到的惊喜。偶尔会有GM与玩家的有趣吐槽（Meta元素），让跑团过程充满欢声笑语和精彩的巧合。";
      }

      const systemInstruction = `你是一位传奇级的跑团模拟主持人（Game Master）。当前的游戏题材背景为：【${genre}】。
你负责为玩家撰写精彩、动态、高响应性的剧情，并生成推荐选择。

核心规则：
1. 【高反馈度】：必须完全契合玩家选择或输入的行动（"${choiceOrAction}"）。如果玩家掷骰了（diceRoll），你必须将掷骰结果（例如：${diceRoll ? `掷骰值为 ${diceRoll.rollValue}，难度DC为 ${diceRoll.targetDc}，判定为 ${diceRoll.rollValue >= diceRoll.targetDc ? "成功" : "失败"}` : "无骰点"}）写进故事的发展里！
   - 骰点成功：玩家帅气、精彩地达成了目的，或者获得了意料之外的好处。
   - 骰点失败：玩家遭遇挫折、陷入窘境、受伤、失去物品，或引发了更复杂的矛盾，但游戏绝不能在此戛然而止，必须有新的危机引导他们前进。
2. 【属性与资源】：根据剧情发展，玩家的生命值(HP)、理智/资源值(Sanity)应当有动态增减，但不要直接让角色死亡，除非玩家生命归零（归零则判定为游戏结束，并给出相应的悲壮结局）。
3. 【推荐选择生成】：你必须生成 3-4 个后续的推荐行动选项：
   - 至少一个常规安全选项（正常观察或对话，不需要检定，或极低难度）。
   - 至少两个需要进行属性检定（Skill Check）的高风险/高回报行动。每个检定选项必须写明检定的属性（力量、敏捷、智力、魅力、意志、运气中的一种）和建议的目标难度DC（8到18之间）。
4. 【汉化风格】：完全采用简体中文，遣词造句极具跑团代入感，使用Markdown排版。

当前GM人设指南：${personalityGuide}`;

      // Build context of previous story turns
      let historyContext = "";
      if (longTermHistory && longTermHistory.length > 0) {
        historyContext += "长期冒险编年史阶段总结（前情往事提要）：\n" + longTermHistory.map((lh: string, idx: number) => {
          return `阶段 ${idx + 1}: ${lh}`;
        }).join("\n") + "\n\n";
      }

      if (history && history.length > 0) {
        historyContext += "近期故事详细纪实（微观动作与发生）：\n" + history.map((h: any) => {
          return `【回合 ${h.turn}】
场景描述: ${h.narrative}
玩家行动: ${h.choiceOrAction}
${h.rollResult ? `判定结果: ${h.rollResult}` : ""}`;
        }).join("\n\n") + "\n\n";
      }

      const currentAttributes = character.attributes;
      const characterContext = `当前角色卡信息：
- 名字: ${character.name}
- 职业: ${character.class}
- 状态: ${character.resourceName || "生命值"}: ${character.hp}/${character.maxHp || 100}, ${character.secondaryResourceName || "理智值"}: ${character.sanity}/${character.maxSanity || 100}
- 携带物品: ${JSON.stringify(character.inventory || [])}
- 天赋特质: ${JSON.stringify(character.traits || [])}
- 属性值: 力量:${currentAttributes.strength}, 敏捷:${currentAttributes.agility}, 智力:${currentAttributes.intelligence}, 魅力:${currentAttributes.charisma}, 意志:${currentAttributes.willpower}, 运气:${currentAttributes.luck}`;

      const actionContext = `【当前玩家的最新行动】
行动: "${choiceOrAction}"
${diceRoll ? `【骰点结果反馈】
进行【${diceRoll.attributeMatched}】检定：
玩家掷出了：D20 = ${diceRoll.rollValue}
难度DC为：${diceRoll.targetDc}
判定结果：${diceRoll.rollValue >= diceRoll.targetDc ? "【成功】" : "【失败】"}` : "（此行动为常规行动，无须骰点）"}`;

      const prompt = `${historyContext}
${characterContext}

${actionContext}
${guidancePrompt ? `\n【玩家对本回合故事走向的期望/提示词（请高度参考并体现在新剧情中）】：\n"${guidancePrompt}"` : ""}

请基于以上所有上下文，撰写下一个回合的剧情事件，并输出状态变化、新选项及物品变动。`;

      const responseSchema = {
        type: "object",
        properties: {
          storyText: {
            type: "string",
            description: "本回合的中文场景与剧情事件描述，要求生动形象、画面感强，字数在200-400字之间，使用Markdown排版。包含对上回合玩家行动（以及骰点结果）的影响描述。",
          },
          gmCommentary: {
            type: "string",
            description: "GM作为旁白主持人的中文悄悄话、点评或纯粹系统提示（例如：'在黑暗中，你敏锐地听到了水滴声。敏捷检定通过让你避免了这一记重击！'），字数在50字内。",
          },
          characterStatus: {
            type: "object",
            properties: {
              hp: { type: "integer", description: "变化后的生命值/主要资源值。" },
              sanity: { type: "integer", description: "变化后的理智值/次要资源值。" },
              maxHp: { type: "integer" },
              maxSanity: { type: "integer" },
              resourceName: { type: "string", description: "主要资源名（如：生命值、元气等）" },
              secondaryResourceName: { type: "string", description: "次要资源名（如：理智值、精神力等）" },
            },
            description: "根据本次事件受到的伤害或恢复，更新角色的当前数值。",
            required: ["hp", "sanity", "maxHp", "maxSanity", "resourceName", "secondaryResourceName"],
          },
          recommendedChoices: {
            type: "array",
            description: "推荐给玩家的3-4个行动选项，每个必须包含可能引发的属性检定信息。",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "选项文字描述（例如：'悄悄潜行穿过沉睡的恶龙'）。" },
                difficulty: { type: "string", description: "对该选项的难度说明（例如：'敏捷 检定 (DC 13)' 或 '常规观察'）。" },
                actionType: { type: "string", description: "必须 is 'check'（需要骰点检定）或 'normal'（常规无须检定）之一。" },
                attribute: { type: "string", description: "检定对应的属性，必须是：'strength', 'agility', 'intelligence', 'charisma', 'willpower', 'luck', 'none' 之一。" },
                targetDc: { type: "integer", description: "检定目标DC（如果是check类型，范围在8-18；如果是normal，设为0）。" },
              },
              required: ["text", "difficulty", "actionType", "attribute", "targetDc"],
            },
          },
          inventoryChanges: {
            type: "object",
            properties: {
              added: {
                type: "array",
                items: { type: "string" },
                description: "本回合玩家获得的新物品列表（没有则为空数组）。",
              },
              removed: {
                type: "array",
                items: { type: "string" },
                description: "本回合玩家失去的物品列表（没有则为空数组）。",
              },
            },
            required: ["added", "removed"],
          },
          isGameOver: {
            type: "boolean",
            description: "游戏是否在此回合彻底结束（如主角光荣牺牲、彻底疯狂、或达成终极胜利）。",
          },
          gameEndingType: {
            type: "string",
            description: "游戏结局类型：'victory'（成功通关/生还）、'death'（主角死亡/失败）或 'none'（继续游玩）。",
          },
        },
        required: [
          "storyText",
          "gmCommentary",
          "characterStatus",
          "recommendedChoices",
          "inventoryChanges",
          "isGameOver",
          "gameEndingType",
        ],
      };

      if (apiEngine === "deepseek") {
        const result = await generateContentWithDeepSeek({
          contents: prompt,
          systemInstruction,
          responseSchema,
          apiKey: dsKey!,
          apiUrl: dsUrl,
          model: dsModel,
        });
        return res.json(result);
      } else {
        const response = await generateContentWithFallback({
          contents: prompt,
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              storyText: {
                type: Type.STRING,
                description: "本回合的中文场景与剧情事件描述，要求生动形象、画面感强，字数在200-400字之间，使用Markdown排版。包含对上回合玩家行动（以及骰点结果）的影响描述。",
              },
              gmCommentary: {
                type: Type.STRING,
                description: "GM作为旁白主持人的中文悄悄话、点评或纯粹系统提示（例如：'在黑暗中，你敏锐地听到了水滴声。敏捷检定通过让你避免了这一记重击！'），字数在50字内。",
              },
              characterStatus: {
                type: Type.OBJECT,
                properties: {
                  hp: { type: Type.INTEGER, description: "变化后的生命值/主要资源值。" },
                  sanity: { type: Type.INTEGER, description: "变化后的理智值/次要资源值。" },
                  maxHp: { type: Type.INTEGER },
                  maxSanity: { type: Type.INTEGER },
                  resourceName: { type: Type.STRING, description: "主要资源名（如：生命值、元气等）" },
                  secondaryResourceName: { type: Type.STRING, description: "次要资源名（如：理智值、精神力等）" },
                },
                description: "根据本次事件受到的伤害或恢复，更新角色的当前数值。",
                required: ["hp", "sanity", "maxHp", "maxSanity", "resourceName", "secondaryResourceName"],
              },
              recommendedChoices: {
                type: Type.ARRAY,
                description: "推荐给玩家的3-4个行动选项，每个必须包含可能引发的属性检定信息。",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "选项文字描述（例如：'悄悄潜行穿过沉睡的恶龙'）。" },
                    difficulty: { type: Type.STRING, description: "对该选项的难度说明（例如：'敏捷 检定 (DC 13)' 或 '常规观察'）。" },
                    actionType: { type: Type.STRING, description: "必须 is 'check'（需要骰点检定）或 'normal'（常规无须检定）之一。" },
                    attribute: { type: Type.STRING, description: "检定对应的属性，必须是：'strength', 'agility', 'intelligence', 'charisma', 'willpower', 'luck', 'none' 之一。" },
                    targetDc: { type: Type.INTEGER, description: "检定目标DC（如果是check类型，范围在8-18；如果是normal，设为0）。" },
                  },
                  required: ["text", "difficulty", "actionType", "attribute", "targetDc"],
                },
              },
              inventoryChanges: {
                type: Type.OBJECT,
                properties: {
                  added: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "本回合玩家获得的新物品列表（没有则为空数组）。",
                  },
                  removed: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "本回合玩家失去的物品列表（没有则为空数组）。",
                },
                },
                required: ["added", "removed"],
              },
              isGameOver: {
                type: Type.BOOLEAN,
                description: "游戏是否在此回合彻底结束（如主角光荣牺牲、彻底疯狂、或达成终极胜利）。",
              },
              gameEndingType: {
                type: Type.STRING,
                description: "游戏结局类型：'victory'（成功通关/生还）、'death'（主角死亡/失败）或 'none'（继续游玩）。",
              },
            },
            required: [
              "storyText",
              "gmCommentary",
              "characterStatus",
              "recommendedChoices",
              "inventoryChanges",
              "isGameOver",
              "gameEndingType",
            ],
          },
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("No response text from Gemini.");
        }

        return res.json(JSON.parse(responseText.trim()));
      }
    } catch (error: any) {
      console.error("Error in generate-event API:", error);
      res.status(500).json({ error: error.message || "Event generation error" });
    }
  });

  // Serve static assets in production, and handle Vite dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TRPG Server] running on http://localhost:${PORT}`);
  });
}

startServer();
