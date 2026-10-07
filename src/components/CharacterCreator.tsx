import React, { useState, useEffect } from "react";
import { saveAs } from "file-saver";
import {
  PRESET_GENRES,
  DEFAULT_ATTRIBUTE_DEFINITIONS,
  Character,
  Attributes,
  AttributeDefinition,
  getApiConfig,
} from "../types";
import {
  negotiateCharacterAPI,
  generateEventAPI,
  redesignAttributesAPI,
} from "../lib/api";
import {
  Sparkles,
  MessageSquare,
  Check,
  Plus,
  Trash,
  ArrowRight,
  BookOpen,
  Star,
  Briefcase,
  Scroll,
  RefreshCw,
  Wand2,
  X,
  Sliders,
} from "lucide-react";

interface CharacterCreatorProps {
  onComplete: (genre: string, character: Character, initialEvent: any) => void;
  systemPersonality?: string;
}

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);
  return isPortrait;
}

export default function CharacterCreator({
  onComplete,
  systemPersonality,
}: CharacterCreatorProps) {
  const isPortrait = useIsPortrait();
  const [activeStep, setActiveStep] = useState(1);

  // Selection States
  const [selectedGenreId, setSelectedGenreId] = useState(PRESET_GENRES[0].id);
  const [customGenre, setCustomGenre] = useState("");

  // Current preset reference
  const currentPreset =
    PRESET_GENRES.find((g) => g.id === selectedGenreId) || null;

  // Active 6-dimension attribute definitions (worldview-specific or AI-redesigned)
  const [attributeDefinitions, setAttributeDefinitions] = useState<
    AttributeDefinition[]
  >(currentPreset?.attributeDefinitions || DEFAULT_ATTRIBUTE_DEFINITIONS);

  // Flash Redesign Modal State
  const [showRedesignModal, setShowRedesignModal] = useState(false);
  const [redesignDirection, setRedesignDirection] = useState("");
  const [isRedesigning, setIsRedesigning] = useState(false);
  const [redesignNotice, setRedesignNotice] = useState("");

  // Character Sheet States (preserved across worldview changes)
  const [charName, setCharName] = useState("");
  const [charGender, setCharGender] = useState("");
  const [charClass, setCharClass] = useState(
    currentPreset?.defaultClass || "散修",
  );
  const [attributes, setAttributes] = useState<Attributes>({
    strength: 10,
    agility: 12,
    intelligence: 14,
    charisma: 10,
    willpower: 14,
    luck: 10,
  });
  const [traits, setTraits] = useState<string[]>([
    ...(currentPreset?.defaultTraits || []),
  ]);
  const [inventory, setInventory] = useState<string[]>([
    ...(currentPreset?.defaultInventory || []),
  ]);

  // Sync state when preset genre changes - PRESERVES user character inputs!
  const handleGenreChange = (genreId: string) => {
    setSelectedGenreId(genreId);
    const preset = PRESET_GENRES.find((g) => g.id === genreId);
    if (preset) {
      // 1. Update the 6-dimension definitions according to this worldview
      setAttributeDefinitions(preset.attributeDefinitions);

      // 2. Preserve character configurations:
      // Keep charName, charGender, and currently allocated attribute points untouched!
      // Only set class if user hasn't typed anything yet
      if (!charClass.trim()) {
        setCharClass(preset.defaultClass);
      }
      // If traits or inventory were empty, populate with this preset's defaults
      if (traits.length === 0) {
        setTraits([...preset.defaultTraits]);
      }
      if (inventory.length === 0) {
        setInventory([...preset.defaultInventory]);
      }
    } else {
      // Custom worldview: reset to default definitions unless user redesigns
      setAttributeDefinitions(DEFAULT_ATTRIBUTE_DEFINITIONS);
    }
    setSuggestedSetup(null);
    setNegotiationFeedback("");
  };

  // Optional manual sync to preset defaults
  const handleSyncPresetDefaults = () => {
    if (!currentPreset) return;
    setCharClass(currentPreset.defaultClass);
    setTraits([...currentPreset.defaultTraits]);
    setInventory([...currentPreset.defaultInventory]);
    setAttributeDefinitions(currentPreset.attributeDefinitions);
  };

  // Handle Flash Model Redesign of 6 Attributes
  const handleRedesignAttributes = async () => {
    if (isRedesigning) return;
    setIsRedesigning(true);
    setRedesignNotice("");
    try {
      const targetGenre =
        selectedGenreId === "自定义"
          ? customGenre.trim() || "自选奇幻冒险世界"
          : currentPreset?.name || selectedGenreId;

      const newDefs = await redesignAttributesAPI({
        genre: targetGenre,
        direction: redesignDirection.trim() || undefined,
      });

      if (newDefs && newDefs.length === 6) {
        setAttributeDefinitions(newDefs);
        setShowRedesignModal(false);
        setRedesignNotice("六维属性已由 Flash 模型量身设计完成！");
        setTimeout(() => setRedesignNotice(""), 3500);
      } else {
        throw new Error("模型生成的属性数量不符合要求，请重试。");
      }
    } catch (err: any) {
      setRedesignNotice(err.message || "重新设计六维失败，请检查设置。");
    } finally {
      setIsRedesigning(false);
    }
  };

  // Export current starting setup as JSON file
  const handleExportSetup = () => {
    try {
      const setupData = {
        selectedGenreId,
        customGenre,
        charName,
        charGender,
        charClass,
        attributes,
        attributeDefinitions,
        traits,
        inventory,
      };
      const dataStr = JSON.stringify(setupData, null, 2);
      const blob = new Blob([dataStr], {
        type: "application/json;charset=utf-8",
      });
      saveAs(blob, `trpg_setup_${charName || "冒险者"}.json`);
    } catch (err) {
      alert("导出配置失败，请重试。");
    }
  };

  // Import starting setup from a file
  const handleImportSetup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          if (event.target?.result) {
            const imported = JSON.parse(event.target.result as string);

            let genreId = imported.selectedGenreId || imported.genre;
            let customGen = imported.customGenre || "";
            let name = imported.charName || imported.name;
            let cls = imported.charClass || imported.class;
            let attrs = imported.attributes;
            let customDefs = imported.attributeDefinitions;
            let characterTraits = imported.traits;
            let characterInventory = imported.inventory;

            if (imported.character) {
              const char = imported.character;
              if (char.name) name = char.name;
              if (char.class) cls = char.class;
              if (char.attributes) attrs = char.attributes;
              if (char.attributeDefinitions) customDefs = char.attributeDefinitions;
              if (char.traits) characterTraits = char.traits;
              if (char.inventory) characterInventory = char.inventory;
            }

            const targetPreset =
              PRESET_GENRES.find((g) => g.id === genreId) || null;

            if (genreId !== undefined) setSelectedGenreId(genreId);
            if (customGen !== undefined) setCustomGenre(customGen);
            if (name !== undefined) setCharName(name);
            if (cls !== undefined) setCharClass(cls);

            if (attrs) {
              setAttributes((prev) => ({
                ...prev,
                ...attrs,
              }));
            }

            if (customDefs && customDefs.length === 6) {
              setAttributeDefinitions(customDefs);
            } else if (targetPreset) {
              setAttributeDefinitions(targetPreset.attributeDefinitions);
            } else {
              setAttributeDefinitions(DEFAULT_ATTRIBUTE_DEFINITIONS);
            }

            if (characterTraits !== undefined) {
              setTraits([...characterTraits]);
            } else if (targetPreset) {
              setTraits([...targetPreset.defaultTraits]);
            }

            if (characterInventory !== undefined) {
              setInventory([...characterInventory]);
            } else if (targetPreset) {
              setInventory([...targetPreset.defaultInventory]);
            }

            alert("成功导入开局配置！");
          }
        } catch (error) {
          alert("文件解析失败，请确保是一个有效的 JSON 配置文件。");
        } finally {
          e.target.value = "";
        }
      };
    }
  };

  // Attribute allocation system
  const maxAttributePoints = 72;
  const currentPointsSum = (attributeDefinitions || DEFAULT_ATTRIBUTE_DEFINITIONS)
    .map((d) => attributes[d.key] ?? 10)
    .reduce((a, b) => a + b, 0);
  const remainingPoints = maxAttributePoints - currentPointsSum;

  // New item / trait inputs
  const [newTrait, setNewTrait] = useState("");
  const [newItem, setNewItem] = useState("");

  // GM Negotiation state
  const [negotiationInput, setNegotiationInput] = useState("");
  const [negotiationFeedback, setNegotiationFeedback] = useState("");
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [suggestedSetup, setSuggestedSetup] = useState<any>(null);

  // Loading state for game launch
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Adjust attributes with limit checks
  const adjustAttribute = (key: string, amount: number) => {
    const currentValue = attributes[key] ?? 10;
    const newValue = currentValue + amount;

    if (newValue < 4 || newValue > 20) return;
    if (amount > 0 && remainingPoints <= 0) return;

    setAttributes((prev) => ({
      ...prev,
      [key]: newValue,
    }));
  };

  // Trait management
  const handleAddTrait = () => {
    if (newTrait.trim() && !traits.includes(newTrait.trim())) {
      setTraits([...traits, newTrait.trim()]);
      setNewTrait("");
    }
  };

  const handleRemoveTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index));
  };

  // Inventory management
  const handleAddItem = () => {
    if (newItem.trim() && !inventory.includes(newItem.trim())) {
      setInventory([...inventory, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemoveItem = (index: number) => {
    setInventory(inventory.filter((_, i) => i !== index));
  };

  // Negotiate with GM via AI
  const handleNegotiate = async () => {
    if (isNegotiating) return;
    setIsNegotiating(true);
    setErrorMsg("");

    const finalGenre =
      selectedGenreId === "自定义"
        ? customGenre || "自选奇幻冒险背景"
        : selectedGenreId;

    try {
      const characterPayload = {
        name: charName || "冒险者",
        gender: charGender,
        class: charClass,
        attributes,
        attributeDefinitions,
        traits,
        inventory,
        hp: 100,
        maxHp: 100,
        sanity: 100,
        maxSanity: 100,
        resourceName: currentPreset?.resourceName || "生命值",
        secondaryResourceName: currentPreset?.secondaryResourceName || "理智值",
        backstory: "",
      };

      const data = await negotiateCharacterAPI(
        finalGenre,
        characterPayload,
        negotiationInput,
      );

      setNegotiationFeedback(data.feedback);
      setSuggestedSetup({
        attributes: data.suggestedAttributes,
        traits: data.suggestedTraits,
        inventory: data.suggestedInventory,
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "与AI主持人协商时发生未知错误。");
    } finally {
      setIsNegotiating(false);
    }
  };

  // Apply suggested configuration from AI GM
  const applySuggestedSetup = () => {
    if (!suggestedSetup) return;
    if (suggestedSetup.attributes)
      setAttributes({ ...suggestedSetup.attributes });
    if (suggestedSetup.traits) setTraits([...suggestedSetup.traits]);
    if (suggestedSetup.inventory) setInventory([...suggestedSetup.inventory]);
    setSuggestedSetup(null);
  };

  // Final confirmation: Launch game and generate prologue
  const handleLaunchGame = async () => {
    if (isLaunching) return;
    setErrorMsg("");

    if (!charName.trim()) {
      setErrorMsg("请先为你的主角起一个名字！");
      return;
    }

    if (selectedGenreId === "自定义" && !customGenre.trim()) {
      setErrorMsg("请输入你的自定义故事背景世界设定！");
      return;
    }

    setIsLaunching(true);

    const finalGenre =
      selectedGenreId === "自定义" ? customGenre.trim() : selectedGenreId;
    const resourceName = currentPreset?.resourceName || "生命值";
    const secondaryResourceName =
      currentPreset?.secondaryResourceName || "理智值";

    const characterData: Character = {
      name: charName.trim(),
      gender: charGender,
      class: charClass || "冒险者",
      attributes,
      attributeDefinitions,
      traits,
      inventory,
      hp: 100,
      maxHp: 100,
      sanity: 100,
      maxSanity: 100,
      resourceName,
      secondaryResourceName,
      backstory: negotiationFeedback || `在【${finalGenre}】世界开始的冒险。`,
    };

    try {
      const activePersonality =
        systemPersonality || getApiConfig().gmPersonality || "Dramatic";
      const payload = {
        genre: finalGenre,
        character: characterData,
        history: [],
        choiceOrAction: "开启我的宿命之旅",
        gmPersonality: activePersonality,
      };

      const initialEvent = await generateEventAPI(payload);
      onComplete(finalGenre, characterData, initialEvent);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message || "生成初始剧情失败，可能网络中断，请稍后再试。",
      );
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" id="character-creator">
      {/* Header section */}
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-amber-900 dark:text-amber-500 mb-2">
          AI 跑团模拟器与文字 RPG 框架
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          构建专属角色，与 AI 游戏主持人自由协商背景。自定义你的属性、天赋、携带物品，开启命运的掷骰之旅。
        </p>
      </div>

      {isPortrait && (
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-6 border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
              activeStep === 1
                ? "bg-white dark:bg-zinc-850 text-amber-800 dark:text-amber-400 shadow-sm"
                : "text-zinc-500"
            }`}
          >
            1. 世界观与背景设定
          </button>
          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
              activeStep === 2
                ? "bg-white dark:bg-zinc-850 text-amber-800 dark:text-amber-400 shadow-sm"
                : "text-zinc-500"
            }`}
          >
            2. 角色卡与属性加点
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Setup (Genre Selection) - 5 Cols */}
        <div
          className={`${isPortrait ? (activeStep === 1 ? "block w-full" : "hidden") : "lg:col-span-5"} space-y-6`}
        >
          {/* Card 1: Select Genre */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600" />
                第1步：协商背景设定
              </h2>
              {currentPreset && (
                <button
                  type="button"
                  onClick={handleSyncPresetDefaults}
                  title="将职业、推荐特质与物品重置为该世界观默认"
                  className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium"
                >
                  重置推荐特质与物品
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                选择故事背景分类
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_GENRES.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => handleGenreChange(genre.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedGenreId === genre.id
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-400 font-medium"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{genre.name}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      {genre.desc}
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => handleGenreChange("自定义")}
                  className={`p-3 rounded-xl border text-left transition-all col-span-2 ${
                    selectedGenreId === "自定义"
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-400 font-medium"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <div className="text-sm font-semibold">
                    自定义自创背景
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    自由编写任意奇幻、科幻、同人世界观设定，完全打破条条框框。
                  </div>
                </button>
              </div>

              {/* Custom Genre Textbox */}
              {selectedGenreId === "自定义" && (
                <div className="space-y-2 pt-2 animate-fadeIn">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                    输入你的故事背景设定
                  </label>
                  <textarea
                    rows={4}
                    value={customGenre}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    placeholder="例如：在被异能黑雾笼罩的近未来学园都市，学生们依靠精神具象武装抵抗从异次元裂隙渗透的蚀心巨兽……"
                    className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRedesignModal(true)}
                      className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      重新设计六维
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Display Active Worldview Attributes Overview */}
            <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  当前世界观特色六维：
                </span>
                <button
                  type="button"
                  onClick={() => setShowRedesignModal(true)}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  Flash 重构六维
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {attributeDefinitions.map((def) => (
                  <div
                    key={def.key}
                    className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/70"
                  >
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                      <span>{def.name}</span>
                      <span className="text-[10px] text-amber-600 font-mono">
                        {def.abbr}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-400 line-clamp-1 mt-0.5">
                      {def.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Character Sheet & Customizer - 7 Cols */}
        <div
          className={`${isPortrait ? (activeStep === 2 ? "block w-full" : "hidden") : "lg:col-span-7"} space-y-6`}
        >
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-4">
              <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-600" />
                第2步：设定主角卡
              </h2>
              <div className="flex items-center gap-2">
                <div className="text-xs px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 rounded-full font-semibold tabular-nums">
                  可用属性点: {remainingPoints}
                </div>
              </div>
            </div>

            {/* Export / Import Config Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-semibold">开局配置:</span>
                <button
                  type="button"
                  onClick={handleExportSetup}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 rounded-lg font-bold transition-colors flex items-center gap-1"
                >
                  <Scroll className="w-3.5 h-3.5 text-amber-600" />
                  导出配置 JSON
                </button>
                <label className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  导入配置 JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSetup}
                    className="hidden"
                  />
                </label>
              </div>
              {redesignNotice && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {redesignNotice}
                </span>
              )}
            </div>

            {/* Input name, gender and class */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  主角名字
                </label>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="输入主角名字"
                  className="w-full text-sm p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  性别 (选填)
                </label>
                <input
                  type="text"
                  value={charGender}
                  onChange={(e) => setCharGender(e.target.value)}
                  placeholder="例：女、男、未知"
                  className="w-full text-sm p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  职业身份 / 流派
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={charClass}
                    onChange={(e) => setCharClass(e.target.value)}
                    placeholder="输入职业，如：散修剑客、荒野法师"
                    className="w-full text-sm p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {currentPreset?.classes && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {currentPreset.classes.map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setCharClass(cls)}
                          className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-400 transition-colors"
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Slider Attributes - DYNAMIC SIX DIMENSIONS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  六维属性加点（根据【{selectedGenreId}】世界观特色量身划分）
                </label>
                <button
                  type="button"
                  onClick={() => setShowRedesignModal(true)}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  重新设计六维
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-900">
                {attributeDefinitions.map((def) => {
                  const val = attributes[def.key] ?? 10;
                  return (
                    <div
                      key={def.key}
                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800 shadow-xs"
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                            {def.name}
                          </span>
                        </div>
                        <span className="text-[10px] block text-zinc-400 mt-0.5 line-clamp-1">
                          {def.desc}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => adjustAttribute(def.key, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold transition-colors"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500 tabular-nums">
                          {val}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustAttribute(def.key, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Items and Traits List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Traits section */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>角色特质 / 天赋</span>
                  <span className="text-[10px] text-zinc-400">可在故事中动态演变</span>
                </label>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950 space-y-2 min-h-[140px] max-h-[220px] overflow-y-auto">
                  {traits.length === 0 ? (
                    <div className="text-xs text-zinc-400 text-center py-8">
                      暂无特质，请在下方添加或与主持人协商。
                    </div>
                  ) : (
                    traits.map((trait, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-150 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        <span className="font-medium flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          {trait}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTrait(index)}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTrait}
                    onChange={(e) => setNewTrait(e.target.value)}
                    placeholder="新增特质（例：百毒不侵）"
                    className="flex-1 text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleAddTrait()}
                  />
                  <button
                    type="button"
                    onClick={handleAddTrait}
                    className="p-2.5 bg-zinc-800 dark:bg-zinc-700 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inventory section */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>初始携带物品</span>
                  <span className="text-[10px] text-zinc-400">可自定义装备</span>
                </label>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950 space-y-2 min-h-[140px] max-h-[220px] overflow-y-auto">
                  {inventory.length === 0 ? (
                    <div className="text-xs text-zinc-400 text-center py-8">
                      包囊空空如也...请添加一些生存装备！
                    </div>
                  ) : (
                    inventory.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-150 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        <span className="font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="新增物品（例：神秘的吊坠）"
                    className="flex-1 text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="p-2.5 bg-zinc-800 dark:bg-zinc-700 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* NEGOTIATION SECTION - PLAYER TALK WITH GM */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  与 AI 跑团主持人互动协商
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                觉得设定不够丰满？输入你想扮演的人设（例如：“我想要一个武艺高强但胆小怕死的道士，能不能给我推荐一些特色装备和属性分配？”），AI 主持人会为您润色并重新推荐最适合您的角色卡配置！
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={negotiationInput}
                  onChange={(e) => setNegotiationInput(e.target.value)}
                  placeholder="在此写下对角色的畅想或想法..."
                  className="flex-1 text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleNegotiate()}
                />
                <button
                  type="button"
                  onClick={handleNegotiate}
                  disabled={isNegotiating}
                  className="px-4 py-3 bg-amber-500 text-zinc-900 rounded-xl font-semibold hover:bg-amber-600 transition-colors text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isNegotiating ? "正在思考建议..." : "发送协商请求"}
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>

              {/* Negotiation AI Response */}
              {negotiationFeedback && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/30 text-xs leading-relaxed space-y-3 animate-fadeIn text-zinc-700 dark:text-zinc-300">
                  <div className="font-bold text-amber-900 dark:text-amber-500">
                    主持人的协商建议：
                  </div>
                  <p>{negotiationFeedback}</p>

                  {suggestedSetup && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-amber-200/20">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        主持人提供了一套匹配此设定的属性、天赋与装备：
                      </span>
                      <button
                        type="button"
                        onClick={applySuggestedSetup}
                        className="px-2.5 py-1 bg-green-600 text-white font-medium hover:bg-green-700 transition-colors rounded text-[10px] flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> 采用推荐配置
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Launch / Error block */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              {errorMsg && (
                <div className="text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg border border-red-200/30">
                  {errorMsg}
                </div>
              )}
              <div className="flex-1"></div>
              <button
                type="button"
                onClick={handleLaunchGame}
                disabled={isLaunching || isNegotiating}
                className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm cursor-pointer"
              >
                {isLaunching ? "正在生成序章事件..." : "开启我的宿命之旅"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FLASH REDESIGN 6D ATTRIBUTES MODAL */}
      {showRedesignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                重新设计六维属性体系
              </h3>
              <button
                type="button"
                onClick={() => setShowRedesignModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              根据当前世界观设定【
              <span className="font-semibold text-amber-600">
                {selectedGenreId === "自定义"
                  ? customGenre || "自定义世界"
                  : selectedGenreId}
              </span>
              】，调用 Flash 模型深度定制 6 个独一无二的专属属性维度与释义。
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                设计倾向 / 风格方向（选填，可留空）：
              </label>
              <textarea
                rows={3}
                value={redesignDirection}
                onChange={(e) => setRedesignDirection(e.target.value)}
                placeholder="例如：东方修真灵气心法流、克苏鲁诡异调查员、废土机甲肉身改造、日系二次元魔女契约……也可以留空，模型将根据背景自由发挥。"
                className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setAttributeDefinitions(DEFAULT_ATTRIBUTE_DEFINITIONS);
                  setShowRedesignModal(false);
                  setRedesignNotice("已重置为通用经典六维属性。");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium"
              >
                恢复默认经典六维
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRedesignModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isRedesigning}
                  onClick={handleRedesignAttributes}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isRedesigning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Flash 构思设计中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      立即生成定制六维
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
