import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Character,
  HistoryTurn,
  RecommendedChoice,
  PERSONALITIES,
  AttributeDefinition,
  DEFAULT_ATTRIBUTE_DEFINITIONS,
  CustomStatusBar,
} from "../types";
import { generateEventAPI, compressHistoryAPI } from "../lib/api";
import { evaluateTraitBonus, TraitEvaluationResult } from "../lib/traitBonus";
import {
  Dice5,
  User,
  Briefcase,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  Save,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Scroll,
  Heart,
  Edit3,
  RotateCcw,
  Settings,
  X,
  Star,
  Trash,
  Plus,
  Trash2,
  Terminal,
  Check,
  Minus,
  Wrench,
  Sliders,
} from "lucide-react";
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
  onChangePersonality?: (pers: string) => void;
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
  onChangePersonality,
}: GameScreenProps) {
  // Game states
  const [character, setCharacter] = useState<Character>({
    ...initialCharacter,
  });
  const [history, setHistory] = useState<HistoryTurn[]>(initialHistory);
  const [longTermHistory, setLongTermHistory] = useState<string[]>(
    initialLongTermHistory,
  );
  const [currentEventText, setCurrentEventText] = useState<string>(
    initialEvent.storyText,
  );
  const [currentGmCommentary, setCurrentGmCommentary] = useState<string>(
    initialEvent.gmCommentary,
  );
  const [currentChoices, setCurrentChoices] = useState<RecommendedChoice[]>(
    initialEvent.recommendedChoices,
  );
  const [isGameOver, setIsGameOver] = useState<boolean>(
    initialEvent.isGameOver,
  );
  const [gameEndingType, setGameEndingType] = useState<string>(
    initialEvent.gameEndingType,
  );
  const [turnCount, setTurnCount] = useState<number>(initialTurnCount);

  // States to facilitate paragraph regeneration
  const [lastActionText, setLastActionText] = useState<string>(
    initialLastActionText,
  );
  const [lastDiceRoll, setLastDiceRoll] = useState<any>(initialLastDiceRoll);

  // Edit mode states
  const [isEditingCurrentText, setIsEditingCurrentText] = useState(false);
  const [editedCurrentText, setEditedCurrentText] = useState("");
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(
    null,
  );
  const [editingHistoryText, setEditingHistoryText] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<
    Record<number, boolean>
  >({});

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

  // GM personality & System settings
  const [activeGmPersonality, setActiveGmPersonality] = useState<string>(
    gmPersonality || "Dramatic",
  );
  const [showGmSettingsModal, setShowGmSettingsModal] = useState(false);

  // Dynamic Trait Evolution Notification State
  const [traitNotice, setTraitNotice] = useState<{
    isOpen: boolean;
    added: string[];
    removed: string[];
    reason: string;
  } | null>(null);

  // Save / Load status notifications
  const [saveStatus, setSaveStatus] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSlots, setSaveSlots] = useState<(any | null)[]>(new Array(9).fill(null));

  // Developer Mode (隐蔽入口与增删改状态条/特质)
  const [isDevMode, setIsDevMode] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);

  // 3-click secret trigger for developer mode (无悬浮提示，需连击3下才切换)
  const devClickCountRef = useRef(0);
  const devClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTurnCounterClick = () => {
    devClickCountRef.current += 1;
    if (devClickTimerRef.current) {
      clearTimeout(devClickTimerRef.current);
    }

    if (devClickCountRef.current >= 3) {
      devClickCountRef.current = 0;
      setIsDevMode((prev) => !prev);
    } else {
      devClickTimerRef.current = setTimeout(() => {
        devClickCountRef.current = 0;
      }, 1000);
    }
  };

  // Trait editing in Dev Mode
  const [isAddingTrait, setIsAddingTrait] = useState(false);
  const [newTraitText, setNewTraitText] = useState("");
  const [editingTraitIndex, setEditingTraitIndex] = useState<number | null>(null);
  const [editingTraitText, setEditingTraitText] = useState("");

  // Status Bar editing in Dev Mode
  const [editingStatusBarId, setEditingStatusBarId] = useState<string | null>(null);
  const [editingBarForm, setEditingBarForm] = useState<{
    name: string;
    current: number;
    max: number;
    color: string;
  }>({ name: "", current: 100, max: 100, color: "blue" });

  const [isAddingStatusBar, setIsAddingStatusBar] = useState(false);
  const [newBarForm, setNewBarForm] = useState<{
    name: string;
    current: number;
    max: number;
    color: string;
  }>({ name: "行动点 (AP)", current: 3, max: 3, color: "blue" });

  const getStatusBarColorConfig = (colorName?: string) => {
    switch (colorName) {
      case "red":
        return {
          bar: "bg-red-500",
          text: "text-red-700 dark:text-red-400",
          border: "border-red-500/30",
          bg: "bg-red-500/10",
        };
      case "purple":
        return {
          bar: "bg-purple-500",
          text: "text-purple-700 dark:text-purple-400",
          border: "border-purple-500/30",
          bg: "bg-purple-500/10",
        };
      case "blue":
        return {
          bar: "bg-blue-500",
          text: "text-blue-700 dark:text-blue-400",
          border: "border-blue-500/30",
          bg: "bg-blue-500/10",
        };
      case "emerald":
      case "green":
        return {
          bar: "bg-emerald-500",
          text: "text-emerald-700 dark:text-emerald-400",
          border: "border-emerald-500/30",
          bg: "bg-emerald-500/10",
        };
      case "amber":
      case "yellow":
        return {
          bar: "bg-amber-500",
          text: "text-amber-700 dark:text-amber-400",
          border: "border-amber-500/30",
          bg: "bg-amber-500/10",
        };
      case "cyan":
        return {
          bar: "bg-cyan-500",
          text: "text-cyan-700 dark:text-cyan-400",
          border: "border-cyan-500/30",
          bg: "bg-cyan-500/10",
        };
      default:
        return {
          bar: "bg-blue-500",
          text: "text-blue-700 dark:text-blue-400",
          border: "border-blue-500/30",
          bg: "bg-blue-500/10",
        };
    }
  };

  // Status Bar management handlers
  const handleUpdatePrimaryBar = (name: string, current: number, max: number) => {
    setCharacter((prev) => ({
      ...prev,
      resourceName: name.trim() || "主要资源",
      hp: Math.max(0, Number(current)),
      maxHp: Math.max(1, Number(max)),
    }));
    setEditingStatusBarId(null);
  };

  const handleUpdateSecondaryBar = (name: string, current: number, max: number) => {
    setCharacter((prev) => ({
      ...prev,
      secondaryResourceName: name.trim() || "次要资源",
      sanity: Math.max(0, Number(current)),
      maxSanity: Math.max(1, Number(max)),
    }));
    setEditingStatusBarId(null);
  };

  const handleDeleteSecondaryBar = () => {
    setCharacter((prev) => ({
      ...prev,
      secondaryResourceName: "",
      maxSanity: 0,
      sanity: 0,
    }));
    if (editingStatusBarId === "secondary") setEditingStatusBarId(null);
  };

  const handleAddCustomStatusBar = (
    name: string,
    current: number,
    max: number,
    color = "blue",
  ) => {
    if (!name.trim()) return;
    const newBar: CustomStatusBar = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      current: Number(current),
      max: Math.max(1, Number(max)),
      color,
    };
    setCharacter((prev) => ({
      ...prev,
      customStatusBars: [...(prev.customStatusBars || []), newBar],
    }));
    setIsAddingStatusBar(false);
    setNewBarForm({ name: "行动点 (AP)", current: 3, max: 3, color: "blue" });
  };

  const handleUpdateCustomStatusBar = (
    id: string,
    name: string,
    current: number,
    max: number,
    color: string,
  ) => {
    setCharacter((prev) => ({
      ...prev,
      customStatusBars: (prev.customStatusBars || []).map((b) =>
        b.id === id
          ? {
              ...b,
              name: name.trim() || b.name,
              current: Number(current),
              max: Math.max(1, Number(max)),
              color: color || b.color,
            }
          : b,
      ),
    }));
    setEditingStatusBarId(null);
  };

  const handleDeleteCustomStatusBar = (id: string) => {
    setCharacter((prev) => ({
      ...prev,
      customStatusBars: (prev.customStatusBars || []).filter((b) => b.id !== id),
    }));
    if (editingStatusBarId === id) setEditingStatusBarId(null);
  };

  const stepStatusBarValue = (id: string, delta: number) => {
    if (id === "primary") {
      setCharacter((prev) => ({
        ...prev,
        hp: Math.max(0, Math.min(prev.maxHp, prev.hp + delta)),
      }));
    } else if (id === "secondary") {
      setCharacter((prev) => ({
        ...prev,
        sanity: Math.max(0, Math.min(prev.maxSanity, prev.sanity + delta)),
      }));
    } else {
      setCharacter((prev) => ({
        ...prev,
        customStatusBars: (prev.customStatusBars || []).map((b) =>
          b.id === id
            ? { ...b, current: Math.max(0, Math.min(b.max, b.current + delta)) }
            : b,
        ),
      }));
    }
  };

  // Trait management handlers
  const handleAddTrait = (traitName: string) => {
    if (!traitName.trim()) return;
    if (character.traits.includes(traitName.trim())) return;
    setCharacter((prev) => ({
      ...prev,
      traits: [...prev.traits, traitName.trim()],
    }));
    setNewTraitText("");
    setIsAddingTrait(false);
  };

  const handleUpdateTrait = (index: number, newName: string) => {
    if (!newName.trim()) return;
    setCharacter((prev) => {
      const nextTraits = [...prev.traits];
      nextTraits[index] = newName.trim();
      return {
        ...prev,
        traits: nextTraits,
      };
    });
    setEditingTraitIndex(null);
    setEditingTraitText("");
  };

  const handleDeleteTrait = (index: number) => {
    setCharacter((prev) => ({
      ...prev,
      traits: prev.traits.filter((_, idx) => idx !== index),
    }));
    if (editingTraitIndex === index) {
      setEditingTraitIndex(null);
      setEditingTraitText("");
    }
  };

  useEffect(() => {
    if (showSaveModal) {
      const slots = [];
      for (let i = 1; i <= 9; i++) {
        const slotData = localStorage.getItem(`trpg_manual_save_${i}`);
        slots.push(slotData ? JSON.parse(slotData) : null);
      }
      setSaveSlots(slots);
    }
  }, [showSaveModal]);

  // Dice rolling state machine
  const [diceRollStage, setDiceRollStage] = useState<
    "idle" | "preparing" | "rolling" | "rolled"
  >("idle");
  const [activeChoiceForRoll, setActiveChoiceForRoll] =
    useState<RecommendedChoice | null>(null);
  const [diceValue, setDiceValue] = useState(20);
  const [totalRollResult, setTotalRollResult] = useState(20);
  const [rollSuccess, setRollSuccess] = useState<boolean | null>(null);
  const [isCustomActionRoll, setIsCustomActionRoll] = useState(false);

  // Active view tabs on sidebar/mobile (e.g., "story", "history", "character")
  const [activeTab, setActiveTab] = useState<"story" | "history" | "character">(
    "story",
  );

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

  // Dynamic Attribute definition lookup
  const getAttrDef = (key: string): AttributeDefinition => {
    const list =
      character.attributeDefinitions || DEFAULT_ATTRIBUTE_DEFINITIONS;
    return (
      list.find((d) => d.key === key) || {
        key,
        name: key === "none" ? "常规" : key,
        abbr: key === "none" ? "常" : key.slice(0, 2),
        desc: "",
      }
    );
  };

  const getAttrLabel = (key: string): string => {
    const def = getAttrDef(key);
    return def.name;
  };

  // 实时评估当前判定行动所激活的天赋特质与数值加成
  const activeTraitResult: TraitEvaluationResult = useMemo(() => {
    if (!activeChoiceForRoll) return { totalBonus: 0, triggeredTraits: [] };
    return evaluateTraitBonus(
      character.traits,
      activeChoiceForRoll.attribute,
      getAttrDef(activeChoiceForRoll.attribute),
      activeChoiceForRoll.text,
    );
  }, [character.traits, activeChoiceForRoll]);

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
      gmPersonality: activeGmPersonality,
      turnCount,
      lastActionText,
      lastDiceRoll,
    };
    localStorage.setItem("trpg_autosave", JSON.stringify(saveState));
  }, [
    character,
    history,
    longTermHistory,
    currentEventText,
    currentGmCommentary,
    currentChoices,
    isGameOver,
    gameEndingType,
    activeGmPersonality,
    turnCount,
    lastActionText,
    lastDiceRoll,
  ]);

  // Calculate standard DND modifier based on attribute score
  const getModifier = (score: number) => {
    return Math.floor((score - 10) / 2);
  };

  // Save game slot manually
  const handleSaveGame = (slotIndex: number) => {
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
        gmPersonality: activeGmPersonality,
        turnCount,
        lastActionText,
        lastDiceRoll,
        saveDate: new Date().toLocaleString(),
      };
      localStorage.setItem(`trpg_manual_save_${slotIndex + 1}`, JSON.stringify(saveState));
      
      const newSaveSlots = [...saveSlots];
      newSaveSlots[slotIndex] = saveState;
      setSaveSlots(newSaveSlots);

      setSaveStatus(`游戏已保存至插槽 ${slotIndex + 1}！`);
      setTimeout(() => setSaveStatus(""), 3000);
      setShowSaveModal(false);
    } catch (e) {
      setSaveStatus("保存失败，浏览器缓存空间不足。");
      setTimeout(() => setSaveStatus(""), 3000);
      setShowSaveModal(false);
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
    guidancePrompt?: string,
  ) => {
    setIsLoading(true);
    setErrorMsg("");
    setDiceRollStage("idle");

    const activeHistory =
      overrideHistory !== undefined ? overrideHistory : history;
    const activeTurnCount =
      overrideTurnCount !== undefined ? overrideTurnCount : turnCount;
    const activeCurrentEventText =
      overrideCurrentEventText !== undefined
        ? overrideCurrentEventText
        : currentEventText;
    const activeGmCommentary =
      overrideGmCommentary !== undefined
        ? overrideGmCommentary
        : currentGmCommentary;

    try {
      const payload = {
        genre,
        character,
        history: activeHistory,
        longTermHistory,
        choiceOrAction: actionText,
        diceRoll: finalRoll || null,
        gmPersonality: activeGmPersonality,
        guidancePrompt,
      };

      const data = await generateEventAPI(payload);

      // Formulate history turn to append
      const traitBonusInfo =
        finalRoll && finalRoll.traitBonus
          ? ` + 天赋修正 ${finalRoll.traitBonus > 0 ? "+" : ""}${finalRoll.traitBonus}${finalRoll.triggeredTraits?.length ? ` [${finalRoll.triggeredTraits.map((t: any) => t.name).join("、")}]` : ""}`
          : "";

      const newHistoryTurn: HistoryTurn = {
        turn: activeTurnCount,
        narrative: activeCurrentEventText,
        choiceOrAction: actionText,
        rollResult: finalRoll
          ? `[${getAttrLabel(finalRoll.attributeMatched)} 检定：掷骰 ${finalRoll.rollValue} + 属性修正 ${finalRoll.modifier >= 0 ? "+" : ""}${finalRoll.modifier}${traitBonusInfo} = ${finalRoll.total} vs 难度 ${finalRoll.targetDc}] -> ${finalRoll.isSuccess ? "成功" : "失败"}`
          : undefined,
        gmCommentary: activeGmCommentary,
        diceRoll: finalRoll || null, // Store raw dice roll for regeneration support
      };

      // Process inventory items additions / removals
      let updatedInventory = [...character.inventory];
      if (data.inventoryChanges) {
        if (
          data.inventoryChanges.added &&
          data.inventoryChanges.added.length > 0
        ) {
          updatedInventory = [
            ...updatedInventory,
            ...data.inventoryChanges.added,
          ];
        }
        if (
          data.inventoryChanges.removed &&
          data.inventoryChanges.removed.length > 0
        ) {
          updatedInventory = updatedInventory.filter(
            (item) => !data.inventoryChanges.removed.includes(item),
          );
        }
      }

      // Process dynamic trait evolution from story
      let updatedTraits = [...character.traits];
      if (data.traitChanges) {
        const added = data.traitChanges.added || [];
        const removed = data.traitChanges.removed || [];
        if (added.length > 0) {
          added.forEach((t: string) => {
            if (!updatedTraits.includes(t)) {
              updatedTraits.push(t);
            }
          });
        }
        if (removed.length > 0) {
          updatedTraits = updatedTraits.filter(
            (item) =>
              !removed.some(
                (rem: string) => item.includes(rem) || rem.includes(item),
              ),
          );
        }
        if (added.length > 0 || removed.length > 0) {
          setTraitNotice({
            isOpen: true,
            added,
            removed,
            reason: data.traitChanges.reason || "在跌宕起伏的冒险中触发了心智特质变迁",
          });
        }
      }

      // Update character sheet stats with constraints
      const updatedCharacter: Character = {
        ...character,
        hp: Math.max(
          0,
          Math.min(
            data.characterStatus?.maxHp || 100,
            data.characterStatus?.hp ?? character.hp,
          ),
        ),
        sanity: Math.max(
          0,
          Math.min(
            data.characterStatus?.maxSanity || 100,
            data.characterStatus?.sanity ?? character.sanity,
          ),
        ),
        inventory: updatedInventory,
        traits: updatedTraits,
      };

      // Set new page states
      const nextHistory = [...activeHistory, newHistoryTurn];
      setHistory(nextHistory);
      setCharacter(updatedCharacter);
      setCurrentEventText(data.storyText);
      setCurrentGmCommentary(data.gmCommentary);
      setCurrentChoices(data.recommendedChoices);
      setIsGameOver(data.isGameOver || updatedCharacter.hp <= 0);
      setGameEndingType(
        updatedCharacter.hp <= 0 ? "death" : data.gameEndingType,
      );
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
          message:
            "AI主持人已为您构思好了后续剧情！要现在切换回【当前故事】页签，查看最新的遭遇发展吗？",
          confirmText: "立即前往",
          cancelText: "留在原地",
          onConfirm: () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            setActiveTab("story");
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
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

      const data = await compressHistoryAPI(genre, character, turnsToCompress);
      if (data.summary) {
        setLongTermHistory((prev) => [...prev, data.summary]);
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
    setRegenDialog((prev) => ({ ...prev, isOpen: false }));

    if (history.length === 0) {
      // Regenerate Turn 1 (Prologue)
      setCurrentEventText("");
      setCurrentGmCommentary("");
      setHistory([]);
      setTurnCount(1);

      executeTurn("开启我的宿命之旅", null, [], 1, "", "", guidancePrompt);
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
        guidancePrompt,
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

    const luckDef = getAttrDef("luck");
    const customChoice: RecommendedChoice = {
      text: customActionText.trim(),
      difficulty: `${luckDef.name} 检定（难度 12）`,
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
    const attributeScore =
      attributeKey !== "none"
        ? character.attributes[attributeKey] ?? 10
        : 10;
    const modifier = getModifier(attributeScore);
    const traitBonus = activeTraitResult.totalBonus;
    const total = finalD20 + modifier + traitBonus;
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
    const attributeScore =
      attributeKey !== "none"
        ? character.attributes[attributeKey] ?? 10
        : 10;
    const modifier = getModifier(attributeScore);

    const rollData = {
      rollValue: diceValue,
      modifier: modifier,
      traitBonus: activeTraitResult.totalBonus,
      triggeredTraits: activeTraitResult.triggeredTraits,
      total: totalRollResult,
      targetDc: activeChoiceForRoll.targetDc,
      attributeMatched: attributeKey,
      attributeName: getAttrLabel(attributeKey),
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
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        localStorage.removeItem("trpg_autosave");
        onExit();
      },
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
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 rounded">
              {genre}
            </span>
            <span
              onClick={handleTurnCounterClick}
              className="text-xs text-zinc-500 ml-2 select-none cursor-pointer"
            >
              回合: #{turnCount - 1}
            </span>
            {isDevMode && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold font-mono animate-fadeIn ml-1">
                <Wrench className="w-3 h-3 text-amber-500" />
                开发者模式
                <button
                  type="button"
                  onClick={() => setShowDevModal(true)}
                  className="px-1.5 py-0.5 bg-amber-500 text-zinc-950 rounded hover:bg-amber-400 text-[9px] font-bold cursor-pointer"
                >
                  控制台
                </button>
                <button
                  type="button"
                  onClick={() => setIsDevMode(false)}
                  className="text-zinc-400 hover:text-red-500 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold animate-pulse">
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
            onClick={() => setShowGmSettingsModal(true)}
            className="p-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-amber-500 hover:text-zinc-900 transition-all flex items-center gap-1.5 font-semibold cursor-pointer"
            title="查看或调整当前AI主持人人设风格"
          >
            <Settings className="w-4 h-4 text-amber-600" />
            主持人风格
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="p-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-amber-500 hover:text-zinc-900 transition-all flex items-center gap-1.5 font-semibold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            保存进度
          </button>
          <button
            onClick={handleRestart}
            className="p-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            重置游戏
          </button>
        </div>
      </div>

      {/* Main Grid: Info Sidebar (3 Cols) vs Narrative Area (9 Cols) */}
      <div
        className={`grid grid-cols-1 ${isPortrait ? "w-full" : "lg:grid-cols-12"} gap-6`}
      >
        {/* SIDEBAR: Character Sheet (Static on large screens, tabbed on mobile) */}
        <div className={`${isPortrait ? "w-full" : "lg:col-span-4"} space-y-6`}>
          {/* Navigation tabs for mobile screen sizing */}
          <div
            className={`flex ${isPortrait ? "flex" : "lg:hidden"} bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800`}
          >
            <button
              onClick={() => setActiveTab("story")}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "story"
                  ? "bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-400 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              当前故事
            </button>
            <button
              onClick={() => setActiveTab("character")}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "character"
                  ? "bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-400 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              人物属性卡
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-400 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              冒险编年史 ({history.length})
            </button>
          </div>

          {/* Character attributes and stats panel */}
          <div
            className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-5 ${
              activeTab === "character"
                ? "block"
                : isPortrait
                  ? "hidden"
                  : "hidden lg:block"
            }`}
          >
            <div className="flex items-center gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-800 dark:text-amber-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {character.name}
                </h3>
                <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md font-semibold">
                  {character.class}
                </span>
              </div>
            </div>

            {/* Health & Sanity & Custom status progress bars (支持开发者模式增删改) */}
            <div className="space-y-3">
              {isDevMode && (
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    状态条管理
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStatusBar(true);
                      setNewBarForm({ name: "行动点 (AP)", current: 3, max: 3, color: "blue" });
                    }}
                    className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    新增状态条
                  </button>
                </div>
              )}

              {/* Inline Add Status Bar Form */}
              {isDevMode && isAddingStatusBar && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border-2 border-dashed border-amber-500/50 space-y-2.5 text-xs animate-fadeIn">
                  <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Plus className="w-3.5 h-3.5" /> 新建状态条 (如 AP / 护盾 / 气力)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingStatusBar(false)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">状态名</label>
                    <input
                      type="text"
                      value={newBarForm.name}
                      onChange={(e) => setNewBarForm({ ...newBarForm, name: e.target.value })}
                      placeholder="如: 行动点 (AP), 护盾, 气力, 怒气..."
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">当前值</label>
                      <input
                        type="number"
                        value={newBarForm.current}
                        onChange={(e) => setNewBarForm({ ...newBarForm, current: Number(e.target.value) })}
                        className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">上限</label>
                      <input
                        type="number"
                        value={newBarForm.max}
                        onChange={(e) => setNewBarForm({ ...newBarForm, max: Number(e.target.value) })}
                        className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">色彩</label>
                      <select
                        value={newBarForm.color}
                        onChange={(e) => setNewBarForm({ ...newBarForm, color: e.target.value })}
                        className="w-full px-1.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="blue">蓝色 (AP/法力)</option>
                        <option value="amber">琥珀 (气力/怒气)</option>
                        <option value="cyan">青色 (护盾/灵力)</option>
                        <option value="emerald">翠绿 (体力/韧性)</option>
                        <option value="purple">紫色 (理智/真元)</option>
                        <option value="red">红色 (生命/血量)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingStatusBar(false)}
                      className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs font-semibold"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCustomStatusBar(newBarForm.name, newBarForm.current, newBarForm.max, newBarForm.color)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded text-xs"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              )}

              {/* 1. Primary resource bar (HP) */}
              {(character.resourceName !== "" || character.maxHp > 0) && (
                <div className="space-y-1 bg-zinc-50/50 dark:bg-zinc-950/40 p-2 rounded-xl border border-zinc-150 dark:border-zinc-850">
                  {editingStatusBarId === "primary" ? (
                    <div className="space-y-2 p-1">
                      <div className="text-[10px] font-bold text-red-600 dark:text-red-400">编辑主状态条</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={editingBarForm.name}
                            onChange={(e) => setEditingBarForm({ ...editingBarForm, name: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            placeholder="主状态名称"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={editingBarForm.current}
                            onChange={(e) => setEditingBarForm({ ...editingBarForm, current: Number(e.target.value) })}
                            className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            placeholder="当前值"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={editingBarForm.max}
                            onChange={(e) => setEditingBarForm({ ...editingBarForm, max: Number(e.target.value) })}
                            className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            placeholder="上限"
                          />
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleUpdatePrimaryBar(editingBarForm.name, editingBarForm.current, editingBarForm.max)}
                            className="p-1 bg-green-600 hover:bg-green-700 text-white rounded"
                            title="保存修改"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStatusBarId(null)}
                            className="p-1 bg-zinc-400 hover:bg-zinc-500 text-white rounded"
                            title="取消"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          {character.resourceName || "主要资源"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-red-700 dark:text-red-400 font-mono font-bold">
                            {character.hp} / {character.maxHp}
                          </span>
                          {isDevMode && (
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("primary", -5)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-red-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="-5"
                              >
                                -5
                              </button>
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("primary", -1)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-red-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="-1"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("primary", 1)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-green-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="+1"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("primary", 5)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-green-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="+5"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStatusBarId("primary");
                                  setEditingBarForm({
                                    name: character.resourceName || "生命值",
                                    current: character.hp,
                                    max: character.maxHp,
                                    color: "red",
                                  });
                                }}
                                className="p-0.5 text-zinc-400 hover:text-amber-500 rounded"
                                title="编辑此状态条"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-900">
                        <div
                          className="bg-red-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, (character.hp / Math.max(1, character.maxHp)) * 100))}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 2. Secondary resource bar (Sanity / MP) */}
              {(character.secondaryResourceName !== "" && character.maxSanity > 0) && (
                <div className="space-y-1 bg-zinc-50/50 dark:bg-zinc-950/40 p-2 rounded-xl border border-zinc-150 dark:border-zinc-850">
                  {editingStatusBarId === "secondary" ? (
                    <div className="space-y-2 p-1">
                      <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400">编辑次状态条</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={editingBarForm.name}
                            onChange={(e) => setEditingBarForm({ ...editingBarForm, name: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            placeholder="次状态名称"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={editingBarForm.current}
                            onChange={(e) => setEditingBarForm({ ...editingBarForm, current: Number(e.target.value) })}
                            className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            placeholder="当前值"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={editingBarForm.max}
                            onChange={(e) => setEditingBarForm({ ...editingBarForm, max: Number(e.target.value) })}
                            className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            placeholder="上限"
                          />
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleUpdateSecondaryBar(editingBarForm.name, editingBarForm.current, editingBarForm.max)}
                            className="p-1 bg-green-600 hover:bg-green-700 text-white rounded"
                            title="保存修改"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStatusBarId(null)}
                            className="p-1 bg-zinc-400 hover:bg-zinc-500 text-white rounded"
                            title="取消"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          {character.secondaryResourceName || "次要资源"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-700 dark:text-purple-400 font-mono font-bold">
                            {character.sanity} / {character.maxSanity}
                          </span>
                          {isDevMode && (
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("secondary", -5)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-purple-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="-5"
                              >
                                -5
                              </button>
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("secondary", -1)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-purple-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="-1"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("secondary", 1)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-green-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="+1"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => stepStatusBarValue("secondary", 5)}
                                className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-green-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400"
                                title="+5"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStatusBarId("secondary");
                                  setEditingBarForm({
                                    name: character.secondaryResourceName || "理智值",
                                    current: character.sanity,
                                    max: character.maxSanity,
                                    color: "purple",
                                  });
                                }}
                                className="p-0.5 text-zinc-400 hover:text-amber-500 rounded"
                                title="编辑此状态条"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={handleDeleteSecondaryBar}
                                className="p-0.5 text-zinc-400 hover:text-red-500 rounded"
                                title="删除/隐藏次状态条"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-900">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, (character.sanity / Math.max(1, character.maxSanity)) * 100))}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 3. Custom status bars (AP, 护盾, 气力等，支持增删改) */}
              {(character.customStatusBars || []).map((bar) => {
                const colorCfg = getStatusBarColorConfig(bar.color);
                const isEditing = editingStatusBarId === bar.id;
                return (
                  <div
                    key={bar.id}
                    className="space-y-1 bg-zinc-50/50 dark:bg-zinc-950/40 p-2 rounded-xl border border-zinc-150 dark:border-zinc-850"
                  >
                    {isEditing ? (
                      <div className="space-y-2 p-1">
                        <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">编辑状态条: {bar.name}</div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={editingBarForm.name}
                              onChange={(e) => setEditingBarForm({ ...editingBarForm, name: e.target.value })}
                              className="w-full px-2 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                              placeholder="状态名"
                            />
                          </div>
                          <div>
                            <select
                              value={editingBarForm.color}
                              onChange={(e) => setEditingBarForm({ ...editingBarForm, color: e.target.value })}
                              className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                            >
                              <option value="blue">蓝色</option>
                              <option value="amber">琥珀</option>
                              <option value="cyan">青色</option>
                              <option value="emerald">翠绿</option>
                              <option value="purple">紫色</option>
                              <option value="red">红色</option>
                            </select>
                          </div>
                          <div>
                            <input
                              type="number"
                              value={editingBarForm.current}
                              onChange={(e) => setEditingBarForm({ ...editingBarForm, current: Number(e.target.value) })}
                              className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                              placeholder="当前值"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={editingBarForm.max}
                              onChange={(e) => setEditingBarForm({ ...editingBarForm, max: Number(e.target.value) })}
                              className="w-full px-1.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                              placeholder="上限"
                            />
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleUpdateCustomStatusBar(bar.id, editingBarForm.name, editingBarForm.current, editingBarForm.max, editingBarForm.color)}
                              className="p-1 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer"
                              title="保存修改"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStatusBarId(null)}
                              className="p-1 bg-zinc-400 hover:bg-zinc-500 text-white rounded cursor-pointer"
                              title="取消"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          <span className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${colorCfg.bar}`} />
                            {bar.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`${colorCfg.text} font-mono font-bold`}>
                              {bar.current} / {bar.max}
                            </span>
                            {isDevMode && (
                              <div className="flex items-center gap-0.5 ml-1">
                                <button
                                  type="button"
                                  onClick={() => stepStatusBarValue(bar.id, -1)}
                                  className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-amber-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400 cursor-pointer"
                                  title="-1"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => stepStatusBarValue(bar.id, 1)}
                                  className="p-0.5 px-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-green-200 text-[10px] rounded text-zinc-600 dark:text-zinc-400 cursor-pointer"
                                  title="+1"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStatusBarId(bar.id);
                                    setEditingBarForm({
                                      name: bar.name,
                                      current: bar.current,
                                      max: bar.max,
                                      color: bar.color || "blue",
                                    });
                                  }}
                                  className="p-0.5 text-zinc-400 hover:text-amber-500 rounded cursor-pointer"
                                  title="编辑此状态条"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomStatusBar(bar.id)}
                                  className="p-0.5 text-zinc-400 hover:text-red-500 rounded cursor-pointer"
                                  title="删除此状态条"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-900">
                          <div
                            className={`${colorCfg.bar} h-full rounded-full transition-all duration-500`}
                            style={{
                              width: `${Math.min(100, Math.max(0, (bar.current / Math.max(1, bar.max)) * 100))}%`,
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Attributes modifiers list */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                核心技能与属性检定修正
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(character.attributeDefinitions || DEFAULT_ATTRIBUTE_DEFINITIONS).map((def) => {
                  const val = character.attributes[def.key] ?? 10;
                  const mod = getModifier(val);
                  return (
                    <div
                      key={def.key}
                      className="p-2 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150/40 dark:border-zinc-900/60 flex items-center justify-between"
                      title={def.desc}
                    >
                      <div>
                        <div className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
                          <span>{def.name}</span>
                        </div>
                        <div className="text-zinc-800 dark:text-zinc-200 font-extrabold text-sm tabular-nums">
                          {val}
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs ${
                          mod >= 0
                            ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                        }`}
                      >
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

            {/* Character Traits (支持开发者模式增删改) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  天赋特质 ({character.traits.length})
                </span>
                {isDevMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTrait(true);
                      setNewTraitText("");
                    }}
                    className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    添加特质
                  </button>
                )}
              </div>

              {/* Inline Add Trait Form */}
              {isDevMode && isAddingTrait && (
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-amber-500/40 space-y-2 animate-fadeIn">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>添加新天赋特质</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingTrait(false)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newTraitText}
                    onChange={(e) => setNewTraitText(e.target.value)}
                    placeholder="如: 百步穿杨、天生神力、洞察先机..."
                    className="w-full px-2.5 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTrait(newTraitText);
                    }}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingTrait(false)}
                      className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-[11px]"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTrait(newTraitText)}
                      className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded text-[11px]"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              )}

              {/* Trait items list */}
              {character.traits.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed">
                  暂无天赋特质
                </div>
              ) : (
                <div className="space-y-1.5">
                  {character.traits.map((trait, index) => {
                    const isEditing = editingTraitIndex === index;
                    return (
                      <div
                        key={index}
                        className="text-xs p-2 bg-amber-50/20 dark:bg-amber-950/5 text-amber-900 dark:text-amber-400 rounded-lg border border-amber-200/20 font-medium group transition-all"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingTraitText}
                              onChange={(e) => setEditingTraitText(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateTrait(index, editingTraitText);
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateTrait(index, editingTraitText)}
                              className="p-1 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer"
                              title="保存修改"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTraitIndex(null)}
                              className="p-1 bg-zinc-400 hover:bg-zinc-500 text-white rounded cursor-pointer"
                              title="取消"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span>✦ {trait}</span>
                            {isDevMode && (
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTraitIndex(index);
                                    setEditingTraitText(trait);
                                  }}
                                  className="p-0.5 text-zinc-400 hover:text-amber-500 rounded cursor-pointer"
                                  title="编辑特质"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTrait(index)}
                                  className="p-0.5 text-zinc-400 hover:text-red-500 rounded cursor-pointer"
                                  title="删除特质"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* History / Adventure Log */}
          <div
            className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-4 max-h-[500px] overflow-y-auto ${
              activeTab === "history"
                ? "block"
                : isPortrait
                  ? "hidden"
                  : "hidden lg:block"
            }`}
          >
            <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 pb-2 border-b">
              <Scroll className="w-5 h-5 text-amber-600" />
              冒险编年史 (
              {history.length +
                (longTermHistory ? longTermHistory.length * 20 : 0)}
              )
            </h3>
            {history.length === 0 &&
            (!longTermHistory || longTermHistory.length === 0) ? (
              <div className="text-xs text-zinc-400 text-center py-10">
                故事刚刚开始，还没有留下历史足迹...
              </div>
            ) : (
              <div className="space-y-4">
                {longTermHistory && longTermHistory.length > 0 && (
                  <div className="space-y-2 border-b pb-3 border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      长期史编年提要
                    </span>
                    {longTermHistory.map((summary, idx) => (
                      <div
                        key={`long-${idx}`}
                        className="p-2.5 bg-amber-50/30 dark:bg-amber-950/10 text-amber-900/90 dark:text-amber-400/90 text-xs rounded-lg border border-amber-200/20 leading-relaxed"
                      >
                        ✦ 阶段 {idx + 1}: {summary}
                      </div>
                    ))}
                  </div>
                )}

                {history.length > 0 && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      近期详细历史
                    </span>
                    {history.map((turn, index) => (
                      <div
                        key={index}
                        className="space-y-1.5 border-l-2 border-amber-200 dark:border-amber-950 pl-3 py-1 text-xs relative group"
                      >
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
                              onChange={(e) =>
                                setEditingHistoryText(e.target.value)
                              }
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
                                setExpandedHistory((prev) => ({
                                  ...prev,
                                  [index]: !prev[index],
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
                                setExpandedHistory((prev) => ({
                                  ...prev,
                                  [index]: !prev[index],
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
        <div
          className={`${isPortrait ? "w-full" : "lg:col-span-8"} space-y-6 ${activeTab === "story" ? "block" : isPortrait ? "hidden" : "hidden lg:block"}`}
        >
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

              {/* Dynamic Trait Evolution Notice (移至文末，无标题、无关闭按钮) */}
              {traitNotice && (traitNotice.added.length > 0 || traitNotice.removed.length > 0) && (
                <div className="mt-4 pt-3 border-t border-amber-900/10 dark:border-zinc-800/80 space-y-2">
                  {traitNotice.reason && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 italic leading-relaxed">
                      ✦ {traitNotice.reason}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {traitNotice.added.map((trait, idx) => (
                      <span
                        key={`add-${idx}`}
                        className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-lg font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Star className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        获得：{trait}
                      </span>
                    ))}
                    {traitNotice.removed.map((trait, idx) => (
                      <span
                        key={`rem-${idx}`}
                        className="px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 rounded-lg font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Trash className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        失去/转化：{trait}
                      </span>
                    ))}
                  </div>
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
                  <h4 className="text-sm font-bold tracking-wide uppercase">
                    跑团检定：二十面骰挑战
                  </h4>
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
                    <span className="text-[10px] text-zinc-400 block font-bold uppercase">
                      你尝试执行的行动
                    </span>
                    <p className="text-sm font-semibold text-amber-300">
                      “{activeChoiceForRoll.text}”
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">检定属性</span>
                      <strong className="text-sm text-zinc-100">
                        {getAttrLabel(activeChoiceForRoll.attribute)}
                      </strong>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">目标难度</span>
                      <strong className="text-sm text-amber-400 font-bold">
                        {activeChoiceForRoll.targetDc}
                      </strong>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">属性加成修正</span>
                      <strong className="text-sm text-green-400 font-mono font-bold">
                        {getModifier(
                          character.attributes[
                            activeChoiceForRoll.attribute as keyof Character["attributes"]
                          ] || 10,
                        ) >= 0
                          ? `+${getModifier(
                              character.attributes[
                                activeChoiceForRoll.attribute as keyof Character["attributes"]
                              ] || 10,
                            )}`
                          : getModifier(
                              character.attributes[
                                activeChoiceForRoll.attribute as keyof Character["attributes"]
                              ] || 10,
                            )}
                      </strong>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400 block">天赋特质加成</span>
                      <strong
                        className={`text-sm font-mono font-bold ${
                          activeTraitResult.totalBonus > 0
                            ? "text-amber-400"
                            : activeTraitResult.totalBonus < 0
                              ? "text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {activeTraitResult.totalBonus > 0
                          ? `+${activeTraitResult.totalBonus}`
                          : activeTraitResult.totalBonus}
                      </strong>
                    </div>
                  </div>

                  {/* Triggered Traits Pill Banner */}
                  {activeTraitResult.triggeredTraits.length > 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1.5 animate-fadeIn">
                      <div className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>已触发天赋特质修正：</span>
                      </div>
                      <div className="space-y-1 text-zinc-300">
                        {activeTraitResult.triggeredTraits.map((t, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px]"
                          >
                            <span>• 【{t.name}】{t.reason}</span>
                            <span className="font-mono font-bold text-amber-400">
                              {t.bonus > 0 ? `+${t.bonus}` : t.bonus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comprehensive pass probability hint */}
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
                    <span className="text-zinc-400">综合通过概率提示</span>
                    <strong className="text-sm text-zinc-200 font-mono">
                      {Math.max(
                        5,
                        Math.min(
                          95,
                          (21 -
                            (activeChoiceForRoll.targetDc -
                              (getModifier(
                                character.attributes[
                                  activeChoiceForRoll.attribute as keyof Character["attributes"]
                                ] || 10,
                              ) +
                                activeTraitResult.totalBonus))) *
                            5,
                        ),
                      )}
                      %
                    </strong>
                  </div>
                </div>

                {/* Animated D20 dice model */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    {/* SVG D20 Dice Outline with rotation animation */}
                    <svg
                      className={`absolute inset-0 w-full h-full text-zinc-800 ${
                        diceRollStage === "rolling"
                          ? "animate-spin text-amber-600"
                          : "text-zinc-700"
                      }`}
                      viewBox="0 0 100 100"
                      fill="currentColor"
                    >
                      <polygon
                        points="50,5 95,25 95,75 50,95 5,75 5,25"
                        stroke="#F59E0B"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <polygon
                        points="50,5 50,95"
                        stroke="#F59E0B"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <polygon
                        points="5,25 95,25"
                        stroke="#F59E0B"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <polygon
                        points="5,75 95,75"
                        stroke="#F59E0B"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <polygon
                        points="50,30 25,75 75,75"
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <polygon
                        points="50,30 50,5"
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <polygon
                        points="25,25 50,30"
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <polygon
                        points="75,25 50,30"
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        fill="none"
                      />
                    </svg>

                    {/* Numeric display overlay */}
                    <div className="z-10 text-center space-y-1">
                      <span
                        className={`text-4xl font-extrabold tracking-tight block ${
                          diceRollStage === "rolled"
                            ? rollSuccess
                              ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                              : "text-red-400"
                            : "text-amber-400"
                        }`}
                      >
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
                        <div
                          className={`text-sm font-bold ${rollSuccess ? "text-green-400" : "text-red-400"}`}
                        >
                          {rollSuccess
                            ? "【 检定成功！ 】"
                            : "【 检定失败！ 】"}
                        </div>
                        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                          你掷出了 {diceValue} 点，加上属性修正值{" "}
                          {getModifier(
                            character.attributes[
                              activeChoiceForRoll.attribute as keyof Character["attributes"]
                            ] || 10,
                          ) >= 0
                            ? `+${getModifier(
                                character.attributes[
                                  activeChoiceForRoll.attribute as keyof Character["attributes"]
                                ] || 10,
                              )}`
                            : getModifier(
                                character.attributes[
                                  activeChoiceForRoll.attribute as keyof Character["attributes"]
                                ] || 10,
                              )}
                          {activeTraitResult.totalBonus !== 0 && (
                            <>
                              ，以及天赋特质修正{" "}
                              {activeTraitResult.totalBonus > 0
                                ? `+${activeTraitResult.totalBonus}`
                                : activeTraitResult.totalBonus}
                            </>
                          )}
                          ，最终成绩为 {totalRollResult}（目标难度{" "}
                          {activeChoiceForRoll.targetDc}）。
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
                    {gameEndingType === "victory"
                      ? "🎉 达成辉煌结局"
                      : "💀 冒险在此终结"}
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
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                choice.actionType === "check"
                                  ? "bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-400"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                              }`}
                            >
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
                        <p className="text-[10px] text-zinc-400">
                          “骰子在毛毡上翻滚，齿轮在阴影中轰鸣。”
                        </p>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleCustomActionSubmit}
                        className="flex flex-col sm:flex-row gap-2"
                      >
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
                      提示：“运气掷骰执行”会预先掷 D20
                      并附加运气修正，判定是否能顺利完成该意图；“直接执行”会把行动文字直接交给
                      AI
                      主持人，由其根据角色的智力/敏捷等属性及逻辑进行剧情后果叙述。
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
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
            }
          />
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl relative z-10 animate-scaleUp space-y-4">
            <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 border-b pb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() =>
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
                }
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
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={() =>
              setRegenDialog((prev) => ({ ...prev, isOpen: false }))
            }
          />
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative z-10 animate-scaleUp space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <RotateCcw className="w-5 h-5 text-purple-500" />
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
                重新生成当前剧情
              </h3>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              确定要抹除当前展现的剧情，并让 AI
              主持人重新为您构思、撰写这一轮的遭遇吗？
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 block">
                输入故事走向提示词（选填，不填则直接重新生成）：
              </label>
              <textarea
                value={regenDialog.promptText}
                onChange={(e) =>
                  setRegenDialog((prev) => ({
                    ...prev,
                    promptText: e.target.value,
                  }))
                }
                placeholder="例如：'让环境气氛更惊悚'、'不遇到怪物而是发现神秘解密机关'、'加大动作感官的细致刻画'、'多一些Galgame心跳红晕暗示' 等..."
                rows={4}
                className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-normal resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() =>
                  setRegenDialog((prev) => ({ ...prev, isOpen: false }))
                }
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
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-fadeIn">
            <h3 className="font-serif font-bold text-xl text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
              <Save className="w-5 h-5 text-amber-500" />
              选择手动存档槽位
            </h3>
            <p className="text-xs text-zinc-500 mb-6">
              请选择一个插槽来保存当前的游戏进度。
            </p>

            <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {Array.from({ length: 9 }).map((_, index) => {
                const slotData = saveSlots[index];
                return (
                  <button
                    key={index}
                    onClick={() => handleSaveGame(index)}
                    className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-amber-50 dark:bg-zinc-950 dark:hover:bg-amber-950/20 text-left transition-colors group flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-amber-600 dark:group-hover:text-amber-500">
                        插槽 {index + 1}
                      </span>
                      {slotData ? (
                        <span className="text-[10px] text-zinc-400">
                          {slotData.saveDate || "已知存档"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-medium">空位</span>
                      )}
                    </div>
                    {slotData && (
                      <div className="text-xs text-zinc-500">
                        角色: {slotData.character?.name} | {slotData.genre} (回合: {slotData.turnCount})
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showGmSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-fadeIn space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="font-serif font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                系统设置：AI 主持人人设风格
              </h3>
              <button
                type="button"
                onClick={() => setShowGmSettingsModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              主持人人设已从开局创建转移至系统设置。你可以随时在游戏中无损切换叙述调性：
            </p>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {PERSONALITIES.map((pers) => {
                const isActive = activeGmPersonality === pers.id;
                return (
                  <button
                    key={pers.id}
                    type="button"
                    onClick={() => {
                      setActiveGmPersonality(pers.id);
                      if (onChangePersonality) onChangePersonality(pers.id);
                      try {
                        const curCfg = JSON.parse(
                          localStorage.getItem("trpg_api_config") || "{}",
                        );
                        curCfg.gmPersonality = pers.id;
                        localStorage.setItem(
                          "trpg_api_config",
                          JSON.stringify(curCfg),
                        );
                      } catch (e) {}
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all block cursor-pointer ${
                      isActive
                        ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-400"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isActive ? "bg-amber-500" : "bg-zinc-400"
                          }`}
                        />
                        {pers.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] text-amber-600 font-semibold bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                          生效中
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {pers.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowGmSettingsModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-900 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER MODE CONSOLE MODAL */}
      {showDevModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-amber-500/30 animate-fadeIn space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif font-bold text-lg text-zinc-900 dark:text-zinc-100">
                  开发者模式调试控制台
                </h3>
                <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 rounded text-[10px] font-mono font-bold">
                  DEV ACTIVE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDevModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
              {/* Quick Presets */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl space-y-2">
                <span className="font-bold text-amber-800 dark:text-amber-400 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  快捷预设与一键注入
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCharacter((prev) => ({
                        ...prev,
                        hp: prev.maxHp,
                        sanity: prev.maxSanity,
                        customStatusBars: (prev.customStatusBars || []).map((b) => ({
                          ...b,
                          current: b.max,
                        })),
                      }));
                    }}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    ⚡ 全状态回满
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomStatusBar("行动点 (AP)", 3, 3, "blue")}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    ＋ 添加 AP (3/3)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomStatusBar("护盾", 30, 30, "cyan")}
                    className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    ＋ 添加 护盾 (30/30)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomStatusBar("气力/怒气", 100, 100, "amber")}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    ＋ 添加 气力 (100/100)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddTrait("天生命定机缘")}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    ＋ 赐予特质: 天生命定机缘
                  </button>
                </div>
              </div>

              {/* Status Bars Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-500" />
                    当前所有状态条 ({1 + (character.secondaryResourceName ? 1 : 0) + (character.customStatusBars?.length || 0)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStatusBar(true);
                      setShowDevModal(false);
                      setActiveTab("character");
                    }}
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    ＋ 新建状态条
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Primary */}
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {character.resourceName || "主要资源"} (主状态条)
                      </span>
                      <div className="text-zinc-500 text-[11px] font-mono">
                        当前值: {character.hp} / 上限: {character.maxHp}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => stepStatusBarValue("primary", -10)}
                        className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-xs cursor-pointer"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() => stepStatusBarValue("primary", 10)}
                        className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-xs cursor-pointer"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  {/* Secondary */}
                  {character.secondaryResourceName && character.maxSanity > 0 && (
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {character.secondaryResourceName} (次状态条)
                        </span>
                        <div className="text-zinc-500 text-[11px] font-mono">
                          当前值: {character.sanity} / 上限: {character.maxSanity}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => stepStatusBarValue("secondary", -10)}
                          className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-xs cursor-pointer"
                        >
                          -10
                        </button>
                        <button
                          type="button"
                          onClick={() => stepStatusBarValue("secondary", 10)}
                          className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-xs cursor-pointer"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSecondaryBar}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-zinc-800 rounded cursor-pointer"
                          title="删除次状态条"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Bars */}
                  {(character.customStatusBars || []).map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {b.name} (自定义状态条)
                        </span>
                        <div className="text-zinc-500 text-[11px] font-mono">
                          当前值: {b.current} / 上限: {b.max} ({b.color || "blue"})
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => stepStatusBarValue(b.id, -1)}
                          className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-xs cursor-pointer"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => stepStatusBarValue(b.id, 1)}
                          className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-xs cursor-pointer"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomStatusBar(b.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-zinc-800 rounded cursor-pointer"
                          title="删除状态条"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traits Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    当前天赋特质 ({character.traits.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {character.traits.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-amber-50 dark:bg-zinc-950 border border-amber-200/40 text-amber-900 dark:text-amber-400 rounded-lg flex items-center gap-1.5 font-medium"
                    >
                      ✦ {t}
                      <button
                        type="button"
                        onClick={() => handleDeleteTrait(idx)}
                        className="text-zinc-400 hover:text-red-500 ml-1 cursor-pointer"
                        title="删除特质"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-400">
                提示：在侧栏“人物属性卡”中也可以随时直接点击铅笔或加减按钮进行实时编辑
              </span>
              <button
                type="button"
                onClick={() => setShowDevModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                完成退出控制台
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
