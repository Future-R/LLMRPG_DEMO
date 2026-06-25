import React, { useState, useRef, useEffect } from "react";
import { Character, HistoryTurn, RecommendedChoice } from "../types";
import { generateEventAPI, compressHistoryAPI } from "../lib/api";
import { Dice5, User, Briefcase, ChevronRight, HelpCircle, AlertCircle, Save, ArrowLeft, RefreshCw, Sparkles, Scroll, Heart, Edit3, RotateCcw } from "lucide-react";
import Markdown from "react-markdown";

interface GameScreenProps {
  genre: string;
  initialCharacter: Character;
  initialEvent: any;
  gmPersonality: string;
  initialHistory?: HistoryTurn[];
  initialLongTermHistory?: string[];
  initialTurnCount?: number;
  initialLastActionText?: string;
  initialLastDiceRoll?: any;
  onExit: () => void;
}

export default function GameScreen({
  genre,
  initialCharacter,
  initialEvent,
  gmPersonality,
  initialHistory = [],
  initialLongTermHistory = [],
  initialTurnCount = 1,
  initialLastActionText = "",
  initialLastDiceRoll = null,
  onExit,
}: GameScreenProps) {
  // Game states
  const [character, setCharacter] = useState<Character>({ ...initialCharacter });
  const [history, setHistory] = useState<HistoryTurn[]>(initialHistory);
  const [longTermHistory, setLongTermHistory] = useState<string[]>(initialLongTermHistory);
  const [currentEventText, setCurrentEventText] = useState<string>(initialEvent.storyText);
  const [currentGmCommentary, setCurrentGmCommentary] = useState<string>(initialEvent.gmCommentary);
  const [currentChoices, setCurrentChoices] = useState<RecommendedChoice[]>(initialEvent.recommendedChoices);
  const [isGameOver, setIsGameOver] = useState<boolean>(initialEvent.isGameOver);
  const [gameEndingType, setGameEndingType] = useState<string>(initialEvent.gameEndingType);
  const [turnCount, setTurnCount] = useState<number>(initialTurnCount);

  // States to facilitate paragraph regeneration
  const [lastActionText, setLastActionText] = useState<string>(initialLastActionText);
  const [lastDiceRoll, setLastDiceRoll] = useState<any>(initialLastDiceRoll);

  // Edit mode states
  const [isEditingCurrentText, setIsEditingCurrentText] = useState(false);
  const [editedCurrentText, setEditedCurrentText] = useState("");
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [editingHistoryText, setEditingHistoryText] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({});

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Custom regeneration dialog state
  const [regenDialog, setRegenDialog] = useState<{
    isOpen: boolean;
    promptText: string;
  }>({
    isOpen: false,
    promptText: "",
  });

  // Active inputs
  const [customActionText, setCustomActionText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Save / Load status notifications
  const [saveStatus, setSaveStatus] = useState("");

  // Dice rolling state machine
  const [diceRollStage, setDiceRollStage] = useState<"idle" | "preparing" | "rolling" | "rolled">("idle");
  const [activeChoiceForRoll, setActiveChoiceForRoll] = useState<RecommendedChoice | null>(null);
  const [diceValue, setDiceValue] = useState(20);
  const [totalRollResult, setTotalRollResult] = useState(20);
  const [rollSuccess, setRollSuccess] = useState<boolean | null>(null);
  const [isCustomActionRoll, setIsCustomActionRoll] = useState(false);

  // Active view tabs on sidebar/mobile (e.g., "story", "history", "character")
  const [activeTab, setActiveTab] = useState<"story" | "history" | "character">("story");

  // Screen orientation detection for adaptive layout
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  // Bottom scroll reference for narrative area
  const storyEndRef = useRef<HTMLDivElement>(null);

  // Autosave to localStorage on state changes
  useEffect(() => {
    const saveState = {
      genre,
      character,
      history,
      longTermHistory,
      currentEventText,
      currentGmCommentary,
      currentChoices,
      isGameOver,
      gameEndingType,
      gmPersonality,
      turnCount,
      lastActionText,
      lastDiceRoll,
    };
    localStorage.setItem("trpg_autosave", JSON.stringify(saveState));
  }, [character, history, longTermHistory, currentEventText, currentGmCommentary, currentChoices, isGameOver, gameEndingType, turnCount, lastActionText, lastDiceRoll]);

  // Calculate standard DND modifier based on attribute score
  const getModifier = (score: number) => {
    return Math.floor((score - 10) / 2);
  };

  // Human readable attribute names
  const ATTRIBUTE_LABELS: Record<string, string> = {
    strength: "力量 (STR)",
    agility: "敏捷 (AGI)",
    intelligence: "智力 (INT)",
    charisma: "魅力 (CHA)",
    willpower: "意志 (WIL)",
    luck: "运气 (LCK)",
  };

  // Save game slot manually
  const handleSaveGame = () => {
    try {
      const saveState = {
        genre,
        character,
        history,
        longTermHistory,
        currentEventText,
        currentGmCommentary,
        currentChoices,
        isGameOver,
        gameEndingType,
        gmPersonality,
        turnCount,
        lastActionText,
        lastDiceRoll,
        saveDate: new Date().toLocaleString(),
      };
      localStorage.setItem("trpg_manual_save", JSON.stringify(saveState));
      setSaveStatus("游戏已手动保存到浏览器中！");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (e) {
      setSaveStatus("保存失败，浏览器缓存空间不足。");
    }
  };

  // Perform event progression (calls /api/trpg/generate-event)
  const executeTurn = async (
    actionText: string,
    finalRoll?: any,
    overrideHistory?: HistoryTurn[],
    overrideTurnCount?: number,
    overrideCurrentEventText?: string,
    overrideGmCommentary?: string,
    guidancePrompt?: string
  ) => {
    setIsLoading(true);
    setErrorMsg("");
    setDiceRollStage("idle");

    const activeHistory = overrideHistory !== undefined ? overrideHistory : history;
    const activeTurnCount = overrideTurnCount !== undefined ? overrideTurnCount : turnCount;
    const activeCurrentEventText = overrideCurrentEventText !== undefined ? overrideCurrentEventText : currentEventText;
    const activeGmCommentary = overrideGmCommentary !== undefined ? overrideGmCommentary : currentGmCommentary;

    try {
      const payload = {
        genre,
        character,
        history: activeHistory,
        longTermHistory,
        choiceOrAction: actionText,
        diceRoll: finalRoll || null,
        gmPersonality,
        guidancePrompt,
      };

      const data = await generateEventAPI(payload);

      // Formulate history turn to append
      const newHistoryTurn: HistoryTurn = {
        turn: activeTurnCount,
        narrative: activeCurrentEventText,
        choiceOrAction: actionText,
        rollResult: finalRoll
          ? `[${ATTRIBUTE_LABELS[finalRoll.attributeMatched] || finalRoll.attributeMatched} 检定：掷骰 ${finalRoll.rollValue} + 修正 ${finalRoll.modifier} = ${finalRoll.total} vs 难度 ${finalRoll.targetDc}] -> ${finalRoll.isSuccess ? "成功" : "失败"}`
          : undefined,
        gmCommentary: activeGmCommentary,
        diceRoll: finalRoll || null, // Store raw dice roll for regeneration support
      };

      // Process inventory items additions / removals
      let updatedInventory = [...character.inventory];
      if (data.inventoryChanges) {
        if (data.inventoryChanges.added && data.inventoryChanges.added.length > 0) {
          updatedInventory = [...updatedInventory, ...data.inventoryChanges.added];
        }
        if (data.inventoryChanges.removed && data.inventoryChanges.removed.length > 0) {
          updatedInventory = updatedInventory.filter(
            (item) => !data.inventoryChanges.removed.includes(item)
          );
        }
      }

      // Update character sheet stats with constraints
      const updatedCharacter: Character = {
        ...character,
        hp: Math.max(0, Math.min(data.characterStatus?.maxHp || 100, data.characterStatus?.hp ?? character.hp)),
        sanity: Math.max(0, Math.min(data.characterStatus?.maxSanity || 100, data.characterStatus?.sanity ?? character.sanity)),
        inventory: updatedInventory,
      };

      // Set new page states
      const nextHistory = [...activeHistory, newHistoryTurn];
      setHistory(nextHistory);
      setCharacter(updatedCharacter);
      setCurrentEventText(data.storyText);
      setCurrentGmCommentary(data.gmCommentary);
      setCurrentChoices(data.recommendedChoices);
      setIsGameOver(data.isGameOver || updatedCharacter.hp <= 0);
      setGameEndingType(updatedCharacter.hp <= 0 ? "death" : data.gameEndingType);
      setTurnCount(activeTurnCount + 1);
      setCustomActionText("");

      setLastActionText(actionText);
      setLastDiceRoll(finalRoll || null);

      if (isPortrait) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // If user switched tabs during generation, prompt to return
      if (activeTab !== "story") {
        setConfirmDialog({
          isOpen: true,
          title: "新剧情已生成",
          message: "AI主持人已为您构思好了后续剧情！要现在切换回【当前故事】页签，查看最新的遭遇发展吗？",
          confirmText: "立即前往",
          cancelText: "留在原地",
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            setActiveTab("story");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        });
      }

      // Trigger memory compression if short-term history reaches 30
      if (nextHistory.length >= 30) {
        checkAndCompressHistory(nextHistory);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "请求新事件失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAndCompressHistory = async (currentHistory: HistoryTurn[]) => {
    if (currentHistory.length < 30) return;

    try {
      const turnsToCompress = currentHistory.slice(0, 20);
      const remainingHistory = currentHistory.slice(20);

      setSaveStatus("正在将前20轮记忆压缩并归档至长期冒险编年史...");

      const payload = {
        genre,
        character,
        turnsToCompress,
      };

      const data = await compressHistoryAPI(payload);
      if (data.summary) {
        setLongTermHistory(prev => [...prev, data.summary]);
        setHistory(remainingHistory);
        setSaveStatus("历史记忆压缩归档成功！");
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch (err) {
      console.error("Failed to compress history:", err);
      setSaveStatus("记忆整理失败，将在下回合重试。");
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  const handleRegenerateCurrentTurn = () => {
    setRegenDialog({
      isOpen: true,
      promptText: "",
    });
  };

  const performRegeneration = (guidancePrompt?: string) => {
    setRegenDialog(prev => ({ ...prev, isOpen: false }));
    
    if (history.length === 0) {
      // Regenerate Turn 1 (Prologue)
      setCurrentEventText("");
      setCurrentGmCommentary("");
      setHistory([]);
      setTurnCount(1);

      executeTurn(
        "开启我的宿命之旅",
        null,
        [],
        1,
        "",
        "",
        guidancePrompt
      );
    } else {
      // Regenerate subsequent turns
      const updatedHistory = [...history];
      const lastTurn = updatedHistory.pop();
      if (!lastTurn) return;

      // Revert states
      setCurrentEventText(lastTurn.narrative);
      setCurrentGmCommentary(lastTurn.gmCommentary || "");
      setHistory(updatedHistory);
      setTurnCount(lastTurn.turn);

      // Re-run
      executeTurn(
        lastTurn.choiceOrAction,
        lastTurn.diceRoll,
        updatedHistory,
        lastTurn.turn,
        lastTurn.narrative,
        lastTurn.gmCommentary,
        guidancePrompt
      );
    }
  };

  // Handle standard option selection
  const handleSelectChoice = (choice: RecommendedChoice) => {
    if (isLoading) return;

    if (choice.actionType === "check") {
      // Trigger dice roll interface first
      setActiveChoiceForRoll(choice);
      setIsCustomActionRoll(false);
      setDiceRollStage("preparing");
    } else {
      // Execute normal progress immediately
      executeTurn(choice.text);
    }
  };

  // Execute custom free text actions
  const handleCustomActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !customActionText.trim()) return;

    // Optional: Ask if the player wants to do a Luck/Luck check for custom action or just roll
    // Let's prompt a custom check based on "Luck" attribute for custom actions, which is incredibly fun!
    const customChoice: RecommendedChoice = {
      text: customActionText.trim(),
      difficulty: "运气 检定 (DC 12)",
      actionType: "check",
      attribute: "luck",
      targetDc: 12,
    };

    setActiveChoiceForRoll(customChoice);
    setIsCustomActionRoll(true);
    setDiceRollStage("preparing");
  };

  // Dice roll simulation animation
  const handleStartDiceRoll = () => {
    if (diceRollStage !== "preparing" || !activeChoiceForRoll) return;

    setDiceRollStage("rolling");

    let counter = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 20) + 1);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        finishDiceRoll();
      }
    }, 80);
  };

  // Resolve dice roll outcome
  const finishDiceRoll = () => {
    if (!activeChoiceForRoll) return;

    const finalD20 = Math.floor(Math.random() * 20) + 1;
    const attributeKey = activeChoiceForRoll.attribute;
    const attributeScore = attributeKey !== "none" ? character.attributes[attributeKey as keyof Character["attributes"]] || 10 : 10;
    const modifier = getModifier(attributeScore);
    const total = finalD20 + modifier;
    const isSuccess = total >= activeChoiceForRoll.targetDc;

    setDiceValue(finalD20);
    setTotalRollResult(total);
    setRollSuccess(isSuccess);
    setDiceRollStage("rolled");
  };

  // Continue narrative after seeing roll result
  const handleContinueAfterRoll = () => {
    if (!activeChoiceForRoll) return;

    const attributeKey = activeChoiceForRoll.attribute;
    const attributeScore = attributeKey !== "none" ? character.attributes[attributeKey as keyof Character["attributes"]] || 10 : 10;
    const modifier = getModifier(attributeScore);

    const rollData = {
      rollValue: diceValue,
      modifier: modifier,
      total: totalRollResult,
      targetDc: activeChoiceForRoll.targetDc,
      attributeMatched: attributeKey,
      isSuccess: rollSuccess,
    };

    executeTurn(activeChoiceForRoll.text, rollData);
  };

  // Fast bypass for normal choice on custom action (skip roll)
  const handleSkipRollCustomAction = () => {
    if (!customActionText.trim()) return;
    executeTurn(customActionText.trim());
  };

  // Restart from beginning / fresh slate
  const handleRestart = () => {
    setConfirmDialog({
      isOpen: true,
      title: "重置游戏进度",
      message: "确定要重新开始吗？当前剧情档案将被重置。",
      confirmText: "确定重置",
      cancelText: "取消",
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        localStorage.removeItem("trpg_autosave");
        onExit();
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" id="trpg-game-screen">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 text-zinc-500 hover:text-amber-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="返回主页"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 rounded">
              {genre}
            </span>
            <span className="text-xs text-zinc-500 ml-2">回合: #{turnCount - 1}</span>
            {isLoading && (
              <span className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                AI构思中...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-green-600 bg-green-50 dark:bg-green-950/20 px-3 py-1.5 rounded-lg border border-green-200/30">
              {saveStatus}
            </span>
          )}
          <button
            onClick={handleSaveGame}
            className="p-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-amber-500 hover:text-zinc-900 transition-all flex items-center gap-1.5 font-semibold"
          >
            <Save className="w-4 h-4" />
            保存进度
          </button>
          <button
            onClick={handleRestart}
            className="p-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5 font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            重置游戏
          </button>
        </div>
      </div>

      {/* Main Grid: Info Sidebar (3 Cols) vs Narrative Area (9 Cols) */}
      <div className={`grid grid-cols-1 ${isPortrait ? "w-full" : "lg:grid-cols-12"} gap-6`}>
        
        {/* SIDEBAR: Character Sheet (Static on large screens, tabbed on mobile) */}
        <div className={`${isPortrait ? "w-full" : "lg:col-span-4"} space-y-6`}>
          
          {/* Navigation tabs for mobile screen sizing */}
          <div className={`flex ${isPortrait ? "flex" : "lg:hidden"} bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800`}>
            <button
              onClick={() => setActiveTab("story")}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "story" ? "bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-400 shadow-sm" : "text-zinc-500"
              }`}
            >
              当前故事
            </button>
            <button
              onClick={() => setActiveTab("character")}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "character" ? "bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-400 shadow-sm" : "text-zinc-500"
              }`}
            >
              人物属性卡
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "history" ? "bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-400 shadow-sm" : "text-zinc-500"
              }`}
            >
              冒险编年史 ({history.length})
            </button>
          </div>

          {/* Character attributes and stats panel */}
          <div className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-5 ${
            activeTab === "character" ? "block" : (isPortrait ? "hidden" : "hidden lg:block")
          }`}>
            <div className="flex items-center gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-800 dark:text-amber-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">{character.name}</h3>
                <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md font-semibold">
                  {character.class}
                </span>
              </div>
            </div>

            {/* Health & Sanity progress bars */}
            <div className="space-y-3">
              {/* Primary resource bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>{character.resourceName || "主要资源"}</span>
                  <span className="text-amber-700 dark:text-amber-500">{character.hp} / {character.maxHp}</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-900">
                  <div
                    className="bg-red-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                  />
                </div>
              </div>

              {/* Secondary resource bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>{character.secondaryResourceName || "次要资源"}</span>
                  <span className="text-purple-700 dark:text-purple-400">{character.sanity} / {character.maxSanity}</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-900">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(character.sanity / character.maxSanity) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Attributes modifiers list */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">核心技能与属性检定修正</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(character.attributes).map(([key, val]) => {
                  const mod = getModifier(val);
                  return (
                    <div key={key} className="p-2 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150/40 dark:border-zinc-900/60 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-zinc-400 font-bold">{ATTRIBUTE_LABELS[key] || key}</div>
                        <div className="text-zinc-800 dark:text-zinc-200 font-extrabold text-sm">{val}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs ${
                        mod >= 0 ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                      }`}>
                        {mod >= 0 ? `+${mod}` : mod}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inventory list */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                背囊物品 ({character.inventory.length})
              </span>
              {character.inventory.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed">
                  行囊空无一物
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {character.inventory.map((item, index) => (
                    <span
                      key={index}
                      className="text-[11px] px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-300 rounded-lg border border-zinc-150 dark:border-zinc-800 font-medium hover:border-amber-300 dark:hover:border-amber-900/40 transition-colors"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Character Traits */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">天赋特质</span>
              <div className="space-y-1.5">
                {character.traits.map((trait, index) => (
                  <div
                    key={index}
                    className="text-xs p-2 bg-amber-50/20 dark:bg-amber-950/5 text-amber-900 dark:text-amber-400 rounded-lg border border-amber-200/20 font-medium"
                  >
                    ✦ {trait}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* History / Adventure Log */}
          <div className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-4 max-h-[500px] overflow-y-auto ${
            activeTab === "history" ? "block" : (isPortrait ? "hidden" : "hidden lg:block")
          }`}>
            <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b">
              <Scroll className="w-5 h-5 text-amber-600" />
              冒险编年史 ({history.length + (longTermHistory ? longTermHistory.length * 20 : 0)})
            </h3>
            {history.length === 0 && (!longTermHistory || longTermHistory.length === 0) ? (
              <div className="text-xs text-zinc-400 text-center py-10">故事刚刚开始，还没有留下历史足迹...</div>
            ) : (
              <div className="space-y-4">
                {longTermHistory && longTermHistory.length > 0 && (
                  <div className="space-y-2 border-b pb-3 border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">长期史编年提要</span>
                    {longTermHistory.map((summary, idx) => (
                      <div key={`long-${idx}`} className="p-2.5 bg-amber-50/30 dark:bg-amber-950/10 text-amber-900/90 dark:text-amber-400/90 text-xs rounded-lg border border-amber-200/20 leading-relaxed">
                        ✦ 阶段 {idx + 1}: {summary}
                      </div>
                    ))}
                  </div>
                )}

                {history.length > 0 && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">近期详细历史</span>
                    {history.map((turn, index) => (
                      <div key={index} className="space-y-1.5 border-l-2 border-amber-200 dark:border-amber-950 pl-3 py-1 text-xs relative group">
                        <div className="flex items-center justify-between font-bold text-zinc-400 text-[10px]">
                          <span>回合 #{turn.turn}</span>
                          <button
                            onClick={() => {
                              setEditingHistoryIndex(index);
                              setEditingHistoryText(turn.narrative);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 px-1.5 bg-zinc-100 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[9px] text-zinc-500 hover:text-amber-700 rounded transition-all"
                            title="编辑此回合叙事"
                          >
                            编辑
                          </button>
                        </div>

                        {editingHistoryIndex === index ? (
                          <div className="space-y-2 mt-1 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                            <textarea
                              value={editingHistoryText}
                              onChange={(e) => setEditingHistoryText(e.target.value)}
                              rows={4}
                              className="w-full text-[11px] p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-normal"
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setEditingHistoryIndex(null)}
                                className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-[10px] font-semibold transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => {
                                  const updatedHistory = [...history];
                                  updatedHistory[index] = {
                                    ...updatedHistory[index],
                                    narrative: editingHistoryText,
                                  };
                                  setHistory(updatedHistory);
                                  setEditingHistoryIndex(null);
                                }}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-900 rounded text-[10px] font-bold transition-colors"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              onClick={() => {
                                setExpandedHistory(prev => ({
                                  ...prev,
                                  [index]: !prev[index]
                                }));
                              }}
                              className={`text-zinc-800 dark:text-zinc-300 leading-relaxed cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
                                expandedHistory[index] ? "" : "line-clamp-3"
                              }`}
                              title="点击展开/收起完整内容"
                            >
                              {turn.narrative.replace(/[#*`>]/g, "")}
                            </div>
                            <button
                              onClick={() => {
                                setExpandedHistory(prev => ({
                                  ...prev,
                                  [index]: !prev[index]
                                }));
                              }}
                              className="text-[10px] text-amber-600 dark:text-amber-500 hover:underline font-semibold mt-0.5 block"
                            >
                              {expandedHistory[index] ? "收起" : "展开完整文本"}
                            </button>
                            <div className="text-amber-700 dark:text-amber-500 font-semibold flex items-center gap-1 mt-1">
                              <ChevronRight className="w-3.5 h-3.5" />
                              行动: {turn.choiceOrAction}
                            </div>
                            {turn.rollResult && (
                              <div className="text-purple-600 dark:text-purple-400 font-mono text-[10px] bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded border border-purple-200/10 inline-block">
                                {turn.rollResult}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MAIN GAME PROGRESSION: Narrative Story text and choices */}
        <div className={`${isPortrait ? "w-full" : "lg:col-span-8"} space-y-6 ${activeTab === "story" ? "block" : (isPortrait ? "hidden" : "hidden lg:block")}`}>
          
          {/* Main narrative block */}
          <div className="bg-amber-50/20 dark:bg-zinc-900 border border-amber-900/10 dark:border-zinc-800/80 rounded-2xl shadow-sm p-6 space-y-6 min-h-[400px] flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Turn title indicator */}
              <div className="flex items-center justify-between pb-3 border-b border-amber-900/5 flex-wrap gap-2">
                <span className="font-serif text-amber-800 dark:text-amber-500 font-bold tracking-wider text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  AI 跑团主持人叙述
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-400 mr-2">TURN {turnCount - 1}</span>
                  {!isGameOver && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setIsEditingCurrentText(true);
                          setEditedCurrentText(currentEventText);
                        }}
                        disabled={isLoading}
                        className="p-1 px-2 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1 font-semibold"
                        title="编辑当前段落"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        编辑段落
                      </button>

                      <button
                        onClick={handleRegenerateCurrentTurn}
                        disabled={isLoading}
                        className="p-1 px-2 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1 font-semibold"
                        title="重新生成当前剧情"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        重新生成
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Narrated Story content in Markdown / Edit Mode */}
              {isEditingCurrentText ? (
                <div className="space-y-3 bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
                  <textarea
                    value={editedCurrentText}
                    onChange={(e) => setEditedCurrentText(e.target.value)}
                    rows={8}
                    className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans"
                    placeholder="编辑当前剧情描述..."
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsEditingCurrentText(false)}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        setCurrentEventText(editedCurrentText);
                        setIsEditingCurrentText(false);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-900 rounded-lg text-xs font-bold transition-colors"
                    >
                      保存修改
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-stone prose-em:not-italic dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed text-sm space-y-4">
                  <Markdown>{currentEventText}</Markdown>
                </div>
              )}

              {/* AI GM Commentary whisper box */}
              {currentGmCommentary && (
                <div className="bg-amber-100/30 dark:bg-amber-950/5 p-4 rounded-xl border border-amber-200/20 text-xs text-amber-900 dark:text-amber-400/90 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    主持人悄悄话 (GM Whispers):
                  </div>
                  <p>{currentGmCommentary}</p>
                </div>
              )}
            </div>

            <div ref={storyEndRef} />
          </div>

          {/* DICE ROLLING STAGE overlay if active */}
          {diceRollStage !== "idle" && activeChoiceForRoll && (
            <div className="bg-zinc-900 text-white rounded-2xl border-2 border-amber-500/40 p-6 space-y-6 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Dice5 className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h4 className="text-sm font-bold tracking-wide uppercase">TRPG 骰点判定：D20 掷骰挑战</h4>
                </div>
                <button
                  onClick={() => setDiceRollStage("idle")}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  取消
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                
                {/* Roll mechanics details */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-bold uppercase">你尝试执行的行动</span>
                    <p className="text-sm font-semibold text-amber-300">“{activeChoiceForRoll.text}”</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">检定属性</span>
                      <strong className="text-sm text-zinc-100">{ATTRIBUTE_LABELS[activeChoiceForRoll.attribute] || activeChoiceForRoll.attribute}</strong>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">目标难度 DC</span>
                      <strong className="text-sm text-amber-400 font-bold">{activeChoiceForRoll.targetDc}</strong>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">属性加成修正</span>
                      <strong className="text-sm text-green-400 font-mono font-bold">
                        +{getModifier(character.attributes[activeChoiceForRoll.attribute as keyof Character["attributes"]] || 10)}
                      </strong>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">通过概率提示</span>
                      <strong className="text-sm text-zinc-300">
                        {Math.max(5, Math.min(95, (21 - (activeChoiceForRoll.targetDc - getModifier(character.attributes[activeChoiceForRoll.attribute as keyof Character["attributes"]] || 10))) * 5))}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Animated D20 dice model */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    
                    {/* SVG D20 Dice Outline with rotation animation */}
                    <svg
                      className={`absolute inset-0 w-full h-full text-zinc-800 ${
                        diceRollStage === "rolling" ? "animate-spin text-amber-600" : "text-zinc-700"
                      }`}
                      viewBox="0 0 100 100"
                      fill="currentColor"
                    >
                      <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
                      <polygon points="50,5 50,95" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2,2" />
                      <polygon points="5,25 95,25" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2,2" />
                      <polygon points="5,75 95,75" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2,2" />
                      <polygon points="50,30 25,75 75,75" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
                      <polygon points="50,30 50,5" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
                      <polygon points="25,25 50,30" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
                      <polygon points="75,25 50,30" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
                    </svg>

                    {/* Numeric display overlay */}
                    <div className="z-10 text-center space-y-1">
                      <span className={`text-4xl font-extrabold tracking-tight block ${
                        diceRollStage === "rolled"
                          ? rollSuccess ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]" : "text-red-400"
                          : "text-amber-400"
                      }`}>
                        {diceValue}
                      </span>
                      {diceRollStage === "rolled" && (
                        <span className="text-[10px] text-zinc-400 block font-bold font-mono">
                          修正后: {totalRollResult}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 w-full text-center">
                    {diceRollStage === "preparing" && (
                      <button
                        onClick={handleStartDiceRoll}
                        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-900 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all animate-bounce"
                      >
                        🎲 掷出 D20 骰子！
                      </button>
                    )}

                    {diceRollStage === "rolling" && (
                      <span className="text-xs text-amber-400 font-semibold tracking-widest animate-pulse block">
                        命运之骰旋转中...
                      </span>
                    )}

                    {diceRollStage === "rolled" && (
                      <div className="space-y-3">
                        <div className={`text-sm font-bold ${rollSuccess ? "text-green-400" : "text-red-400"}`}>
                          {rollSuccess ? "【 检定成功！ 】" : "【 检定失败！ 】"}
                        </div>
                        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                          你掷出了 {diceValue} 点，加上属性修正值 {getModifier(character.attributes[activeChoiceForRoll.attribute as keyof Character["attributes"]] || 10)}，最终成绩为 {totalRollResult} （难度 DC {activeChoiceForRoll.targetDc}）。
                        </p>
                        <button
                          onClick={handleContinueAfterRoll}
                          className="px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl font-bold text-sm shadow-md transition-colors"
                        >
                          继续接受命运叙述
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CH OICES AND INTERACTION TERMINAL if not rolling */}
          {diceRollStage === "idle" && (
            <div className="space-y-4 relative">
              
              {/* Game Over / Ending screen block */}
              {isGameOver ? (
                <div className="bg-zinc-900 text-zinc-100 p-8 rounded-2xl border-2 border-amber-600 text-center space-y-6">
                  <h3 className="font-serif text-3xl font-extrabold text-amber-500">
                    {gameEndingType === "victory" ? "🎉 达成辉煌结局" : "💀 冒险在此终结"}
                  </h3>
                  <p className="text-sm max-w-xl mx-auto leading-relaxed text-zinc-300">
                    {gameEndingType === "victory"
                      ? "你跨越了重重险阻，战胜了不可名状的危机，最终在这个世界的史册中镌刻下了属于你的名字。你的英名流传千古！"
                      : "你的生命值已耗尽或心智已完全崩溃。在残酷无情的法则面前，你无力再抵挡暗影的侵蚀。你的躯壳或灵魂永远地遗失在了这片异乡沙土..."}
                  </p>
                  
                  <div className="flex justify-center gap-4 pt-2">
                    <button
                      onClick={handleRestart}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-900 font-bold rounded-xl text-sm transition-all shadow-md"
                    >
                      再次踏上旅程 (新建主角)
                    </button>
                    <button
                      onClick={onExit}
                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-sm transition-all"
                    >
                      返回大厅
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Recommended Action choices */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      选择推荐行动选项：
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentChoices.map((choice, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectChoice(choice)}
                          disabled={isLoading}
                          className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 text-left transition-all hover:bg-amber-50/25 dark:hover:bg-amber-950/5 group disabled:opacity-60 disabled:hover:border-zinc-200"
                        >
                          <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-relaxed group-hover:text-amber-900 dark:group-hover:text-amber-400">
                            {choice.text}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              choice.actionType === "check"
                                ? "bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-400"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                            }`}>
                              {choice.difficulty}
                            </span>
                            {choice.actionType === "check" && (
                              <Dice5 className="w-3.5 h-3.5 text-purple-500 group-hover:animate-spin" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CUSTOM ACTION ENTRY BOX */}
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      自主决定行动（输入任何你想执行的创造性行动）：
                    </span>

                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-500 animate-pulse">
                          AI 主持人正在构思剧情，描摹命运的下一笔...
                        </div>
                        <p className="text-[10px] text-zinc-400">“骰子在毛毡上翻滚，齿轮在阴影中轰鸣。”</p>
                      </div>
                    ) : (
                      <form onSubmit={handleCustomActionSubmit} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={customActionText}
                          onChange={(e) => setCustomActionText(e.target.value)}
                          placeholder="例：我拿出生锈的飞剑撬开祭坛上的石板，并寻找隐藏机关..."
                          disabled={isLoading}
                          className="flex-1 text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isLoading || !customActionText.trim()}
                            className="flex-1 sm:flex-initial px-4 py-3 bg-amber-500 text-zinc-900 font-bold rounded-xl text-xs hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            title="触发运气检定并执行"
                          >
                            <Dice5 className="w-4 h-4" />
                            运气掷骰执行
                          </button>
                          <button
                            type="button"
                            onClick={handleSkipRollCustomAction}
                            disabled={isLoading || !customActionText.trim()}
                            className="px-3 py-3 bg-zinc-800 text-white font-bold rounded-xl text-xs hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            title="直接执行常规行动，无须预先掷骰"
                          >
                            直接执行
                          </button>
                        </div>
                      </form>
                    )}
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      提示：“运气掷骰执行”会预先掷 D20 并附加运气修正，判定是否能顺利完成该意图；“直接执行”会把行动文字直接交给 AI 主持人，由其根据角色的智力/敏捷等属性及逻辑进行剧情后果叙述。
                    </p>
                  </div>
                </>
              )}

              {/* Error boundary feedback */}
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-xs text-red-500 rounded-xl border border-red-200/30 flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 animate-scaleUp space-y-4">
            <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 border-b pb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                {confirmDialog.cancelText || "取消"}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-900 rounded-xl text-xs font-bold transition-colors"
              >
                {confirmDialog.confirmText || "确定"}
              </button>
            </div>
          </div>
        </div>
      )}

      {regenDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setRegenDialog(prev => ({ ...prev, isOpen: false }))} />
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative z-10 animate-scaleUp space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <RotateCcw className="w-5 h-5 text-purple-500" />
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
                重新生成当前剧情
              </h3>
            </div>
            
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              确定要抹除当前展现的剧情，并让 AI 主持人重新为您构思、撰写这一轮的遭遇吗？
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 block">
                输入故事走向提示词（选填，不填则直接重新生成）：
              </label>
              <textarea
                value={regenDialog.promptText}
                onChange={(e) => setRegenDialog(prev => ({ ...prev, promptText: e.target.value }))}
                placeholder="例如：'让环境气氛更惊悚'、'不遇到怪物而是发现神秘解密机关'、'加大动作感官的细致刻画'、'多一些Galgame心跳红晕暗示' 等..."
                rows={4}
                className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-normal resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setRegenDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => performRegeneration(regenDialog.promptText)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-purple-500/10 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                确认重新生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
