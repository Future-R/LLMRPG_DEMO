import React, { useState, useEffect } from "react";
import { saveAs } from "file-saver";
import { PRESET_GENRES, PERSONALITIES, Character, Attributes } from "../types";
import { negotiateCharacterAPI, generateEventAPI } from "../lib/api";
import { Sparkles, MessageSquare, Check, RotateCcw, Plus, Trash, ArrowRight, User, BookOpen, Star, Briefcase, Scroll, RefreshCw } from "lucide-react";

interface CharacterCreatorProps {
  onComplete: (genre: string, character: Character, gmPersonality: string, initialEvent: any) => void;
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

export default function CharacterCreator({ onComplete }: CharacterCreatorProps) {
  const isPortrait = useIsPortrait();
  const [activeStep, setActiveStep] = useState(1);

  // Selection States
  const [selectedGenreId, setSelectedGenreId] = useState(PRESET_GENRES[0].id);
  const [customGenre, setCustomGenre] = useState("");
  const [selectedPersonality, setSelectedPersonality] = useState(PERSONALITIES[0].id);

  // Character Sheet States (initially loaded from preset)
  const currentPreset = PRESET_GENRES.find(g => g.id === selectedGenreId) || PRESET_GENRES[0];
  const [charName, setCharName] = useState("");
  const [charGender, setCharGender] = useState("");
  const [charClass, setCharClass] = useState(currentPreset.defaultClass);
  const [attributes, setAttributes] = useState<Attributes>({ ...currentPreset.defaultAttributes });
  const [traits, setTraits] = useState<string[]>([...currentPreset.defaultTraits]);
  const [inventory, setInventory] = useState<string[]>([...currentPreset.defaultInventory]);

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
        traits,
        inventory,
        selectedPersonality
      };
      const dataStr = JSON.stringify(setupData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
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
            
            // Support both standard starting setup and game save formats
            let genreId = imported.selectedGenreId || imported.genre;
            let customGen = imported.customGenre || "";
            let name = imported.charName || imported.name;
            let cls = imported.charClass || imported.class;
            let attrs = imported.attributes;
            let characterTraits = imported.traits;
            let characterInventory = imported.inventory;
            let personality = imported.selectedPersonality || imported.gmPersonality;

            // If it's a full game save format (contains a character sub-object)
            if (imported.character) {
              const char = imported.character;
              if (char.name) name = char.name;
              if (char.class) cls = char.class;
              if (char.attributes) attrs = char.attributes;
              if (char.traits) characterTraits = char.traits;
              if (char.inventory) characterInventory = char.inventory;
            }

            // Fallback to presets if some fields are missing
            const targetPreset = PRESET_GENRES.find(g => g.id === genreId) || PRESET_GENRES[0];

            if (genreId !== undefined) setSelectedGenreId(genreId);
            if (customGen !== undefined) setCustomGenre(customGen);
            if (name !== undefined) setCharName(name);
            if (cls !== undefined) setCharClass(cls);
            
            // For attributes, merge with target default attributes to prevent any missing keys
            const mergedAttributes = {
              ...(targetPreset?.defaultAttributes || { strength: 10, agility: 10, intelligence: 10, charisma: 10, willpower: 10, luck: 10 }),
              ...(attrs || {})
            };
            setAttributes(mergedAttributes);

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

            if (personality !== undefined) setSelectedPersonality(personality);

            alert("成功导入开局配置！");
          }
        } catch (error) {
          alert("文件解析失败，请确保是一个有效的 JSON 配置文件。");
        } finally {
          // Reset file input value to allow importing the same file again
          e.target.value = "";
        }
      };
    }
  };

  // Attribute allocation system
  const maxAttributePoints = 72;
  const currentPointsSum = Object.values(attributes).reduce((a, b) => a + b, 0);
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

  // Sync state when preset genre changes
  const handleGenreChange = (genreId: string) => {
    setSelectedGenreId(genreId);
    const preset = PRESET_GENRES.find(g => g.id === genreId);
    if (preset) {
      setCharClass(preset.defaultClass);
      setAttributes({ ...preset.defaultAttributes });
      setTraits([...preset.defaultTraits]);
      setInventory([...preset.defaultInventory]);
      setSuggestedSetup(null);
      setNegotiationFeedback("");
    }
  };

  // Adjust attributes with limit checks
  const adjustAttribute = (key: keyof Attributes, amount: number) => {
    const currentValue = attributes[key];
    const newValue = currentValue + amount;

    // Minimum stat of 4, max 20, and respect remaining points if increasing
    if (newValue < 4 || newValue > 20) return;
    if (amount > 0 && remainingPoints <= 0) return;

    setAttributes(prev => ({
      ...prev,
      [key]: newValue
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

    const finalGenre = selectedGenreId === "自定义" ? customGenre || "自选奇幻冒险背景" : selectedGenreId;

    try {
      const characterPayload = {
        name: charName || "冒险者",
        gender: charGender,
        class: charClass,
        attributes,
        traits,
        inventory,
        hp: 100, maxHp: 100, sanity: 100, maxSanity: 100, resourceName: "生命值", secondaryResourceName: "理智值", backstory: ""
      };

      const data = await negotiateCharacterAPI(finalGenre, characterPayload, negotiationInput);

      setNegotiationFeedback(data.feedback);
      setSuggestedSetup({
        attributes: data.suggestedAttributes,
        traits: data.suggestedTraits,
        inventory: data.suggestedInventory
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
    if (suggestedSetup.attributes) setAttributes({ ...suggestedSetup.attributes });
    if (suggestedSetup.traits) setTraits([...suggestedSetup.traits]);
    if (suggestedSetup.inventory) setInventory([...suggestedSetup.inventory]);
    setSuggestedSetup(null); // Clear suggestion after application
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

    const finalGenre = selectedGenreId === "自定义" ? customGenre.trim() : selectedGenreId;
    const resourceName = currentPreset.resourceName || "生命值";
    const secondaryResourceName = currentPreset.secondaryResourceName || "理智值";

    const characterData: Character = {
      name: charName.trim(),
      gender: charGender,
      class: charClass || "冒险者",
      attributes,
      traits,
      inventory,
      hp: 100,
      maxHp: 100,
      sanity: 100,
      maxSanity: 100,
      resourceName,
      secondaryResourceName,
      backstory: negotiationFeedback || `在【${finalGenre}】世界开始的冒险。`
    };

    try {
      // Generate initial event (Turn 1 / Prologue)
      const payload = {
        genre: finalGenre,
        character: characterData,
        history: [],
        choiceOrAction: "开启我的宿命之旅",
        gmPersonality: selectedPersonality
      };

      const initialEvent = await generateEventAPI(payload);
      onComplete(finalGenre, characterData, selectedPersonality, initialEvent);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "生成初始剧情失败，可能网络中断，请稍后再试。");
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
            1. 背景分类与宿命性格
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
            2. 属性、天赋与GM协商
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Setup (Genre & Personality Selection) - 5 Cols */}
        <div className={`${isPortrait ? (activeStep === 1 ? "block w-full" : "hidden") : "lg:col-span-5"} space-y-6`}>
          {/* Card 1: Select Genre */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              第1步：协商背景设定
            </h2>

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
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedGenreId === "自定义"
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-400 font-medium"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <div className="text-sm font-semibold">自定义背景</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                    完全由玩家写下独特的世界观背景
                  </div>
                </button>
              </div>
            </div>

            {selectedGenreId === "自定义" && (
              <div className="space-y-2 pt-2 animate-fadeIn">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block">
                  输入你的自定义世界观背景
                </label>
                <textarea
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  placeholder="例如：一个失落的蒸汽朋克飞空艇国度，空中满是飞空巨兽，玩家要寻找天空岛的古老能量石..."
                  rows={3}
                  className="w-full text-sm p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            <div className="p-3 bg-amber-50/40 dark:bg-amber-950/10 rounded-xl border border-amber-200/30 text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
              <strong>世界观简介:</strong> {PRESET_GENRES.find(g => g.id === selectedGenreId)?.desc || "自由书写你的故事。在此世界，你作为冒险者的生死存亡全凭属性和随机的骰运定夺。"}
            </div>
          </div>

          {/* Card 2: Select GM Personality */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              第2步：选择主持人性格
            </h2>
            <div className="space-y-3">
              {PERSONALITIES.map((pers) => (
                <button
                  key={pers.id}
                  onClick={() => setSelectedPersonality(pers.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all block ${
                    selectedPersonality === pers.id
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-400"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    {pers.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {pers.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Character Sheet & Customizer - 7 Cols */}
        <div className={`${isPortrait ? (activeStep === 2 ? "block w-full" : "hidden") : "lg:col-span-7"} space-y-6`}>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-4">
              <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-600" />
                第3步：设定主角卡
              </h2>
              <div className="text-xs px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 rounded-full font-semibold">
                可用属性点: {remainingPoints}
              </div>
            </div>

            {/* Export / Import Config Buttons */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-4 text-xs">
              <span className="text-zinc-500 font-semibold">开局配置备份:</span>
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
                  placeholder="例：男、女、神秘"
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
                  {currentPreset.classes && (
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

            {/* Slider Attributes */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                属性加点（合理属性让你在后续骰点检定中占据极大优势）
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-900">
                
                {/* Strength */}
                <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">力量 (STR)</span>
                    <span className="text-[10px] block text-zinc-400">肉搏、破门、负重</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustAttribute("strength", -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500">{attributes.strength}</span>
                    <button
                      onClick={() => adjustAttribute("strength", 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Agility */}
                <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">敏捷 (AGI)</span>
                    <span className="text-[10px] block text-zinc-400">躲避、潜行、盗窃</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustAttribute("agility", -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500">{attributes.agility}</span>
                    <button
                      onClick={() => adjustAttribute("agility", 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Intelligence */}
                <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">智力 (INT)</span>
                    <span className="text-[10px] block text-zinc-400">魔法、知识、侦察解密</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustAttribute("intelligence", -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500">{attributes.intelligence}</span>
                    <button
                      onClick={() => adjustAttribute("intelligence", 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Charisma */}
                <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">魅力 (CHA)</span>
                    <span className="text-[10px] block text-zinc-400">说服、威吓、交涉、交易</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustAttribute("charisma", -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500">{attributes.charisma}</span>
                    <button
                      onClick={() => adjustAttribute("charisma", 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Willpower */}
                <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">意志 (WIL)</span>
                    <span className="text-[10px] block text-zinc-400">精神防御、坚韧、法防</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustAttribute("willpower", -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500">{attributes.willpower}</span>
                    <button
                      onClick={() => adjustAttribute("willpower", 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Luck */}
                <div className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">运气 (LCK)</span>
                    <span className="text-[10px] block text-zinc-400">寻宝、绝地逢生、暴击</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustAttribute("luck", -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold text-amber-700 dark:text-amber-500">{attributes.luck}</span>
                    <button
                      onClick={() => adjustAttribute("luck", 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Dynamic Items and Traits List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Traits section */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>角色特质 / 天赋</span>
                  <span className="text-[10px] text-zinc-400">可自由增删</span>
                </label>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-950 space-y-2 min-h-[140px] max-h-[220px] overflow-y-auto">
                  {traits.length === 0 ? (
                    <div className="text-xs text-zinc-400 text-center py-8">暂无特质，请在下方添加或与主持人协商。</div>
                  ) : (
                    traits.map((trait, index) => (
                      <div key={index} className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-150 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200">
                        <span className="font-medium flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          {trait}
                        </span>
                        <button
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
                    <div className="text-xs text-zinc-400 text-center py-8">包囊空空如也...请添加一些生存装备！</div>
                  ) : (
                    inventory.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-150 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200">
                        <span className="font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                          {item}
                        </span>
                        <button
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
                    onClick={handleAddItem}
                    className="p-2.5 bg-zinc-800 dark:bg-zinc-700 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* NEGO TIATION SECTION - PLAYER TALK WITH GM */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  与 AI 游戏主持人(GM) 互动协商
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
                  <div className="font-bold text-amber-900 dark:text-amber-500">主持人的协商建议：</div>
                  <p>{negotiationFeedback}</p>

                  {suggestedSetup && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-amber-200/20">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        主持人提供了一套匹配此设定的属性、天赋与装备：
                      </span>
                      <button
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
                onClick={handleLaunchGame}
                disabled={isLaunching || isNegotiating}
                className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {isLaunching ? "正在生成序章事件..." : "开启我的宿命之旅"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
