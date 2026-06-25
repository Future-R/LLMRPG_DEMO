import React, { useState, useEffect } from "react";
import { GameState, Character, HistoryTurn } from "./types";
import CharacterCreator from "./components/CharacterCreator";
import GameScreen from "./components/GameScreen";
import {
  Sparkles,
  BookOpen,
  Scroll,
  HelpCircle,
  Swords,
  Award,
  FileText,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  Cpu,
  Download,
  Upload,
} from "lucide-react";

export default function App() {
  // Navigation: "home" | "creator" | "game"
  const [currentScreen, setCurrentScreen] = useState<
    "home" | "creator" | "game"
  >("home");

  // Game configuration states
  const [activeGenre, setActiveGenre] = useState("");
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(
    null,
  );
  const [activePersonality, setActivePersonality] = useState("Dramatic");
  const [activeInitialEvent, setActiveInitialEvent] = useState<any>(null);
  const [activeHistory, setActiveHistory] = useState<HistoryTurn[]>([]);
  const [activeLongTermHistory, setActiveLongTermHistory] = useState<string[]>(
    [],
  );
  const [activeTurnCount, setActiveTurnCount] = useState<number>(1);
  const [activeLastActionText, setActiveLastActionText] = useState<string>("");
  const [activeLastDiceRoll, setActiveLastDiceRoll] = useState<any>(null);

  // Archive Slots
  const [hasAutosave, setHasAutosave] = useState(false);
  const [manualSaveData, setManualSaveData] = useState<any>(null);
  const [showArchivedSaves, setShowArchivedSaves] = useState(false);

  // Custom Confirmation Dialog State
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

  // API settings states
  const [modelEngine, setModelEngine] = useState<"gemini" | "deepseek" | "openai">(
    "gemini",
  );
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [deepseekApiUrl, setDeepseekApiUrl] = useState(
    "https://api.deepseek.com",
  );
  const [deepseekModel, setDeepseekModel] = useState("deepseek-v4-pro");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiApiUrl, setOpenaiApiUrl] = useState("https://api.openai.com/v1");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showDsKey, setShowDsKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [connCheckStatus, setConnCheckStatus] = useState<
    "idle" | "checking" | "success" | "error"
  >("idle");
  const [connCheckMsg, setConnCheckMsg] = useState("");

  // Load API config on mount
  useEffect(() => {
    try {
      const configStr = localStorage.getItem("trpg_api_config");
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.modelEngine) setModelEngine(config.modelEngine);
        if (config.geminiApiKey) setGeminiApiKey(config.geminiApiKey);
        if (config.deepseekApiKey) setDeepseekApiKey(config.deepseekApiKey);
        if (config.deepseekApiUrl) setDeepseekApiUrl(config.deepseekApiUrl);
        if (config.deepseekModel) setDeepseekModel(config.deepseekModel);
        if (config.openaiApiKey) setOpenaiApiKey(config.openaiApiKey);
        if (config.openaiApiUrl) setOpenaiApiUrl(config.openaiApiUrl);
        if (config.openaiModel) setOpenaiModel(config.openaiModel);
      }
    } catch (e) {
      console.error("Error loading API config", e);
    }
  }, []);

  const handleSaveApiConfig = () => {
    try {
      const config = {
        modelEngine,
        geminiApiKey,
        deepseekApiKey,
        deepseekApiUrl: deepseekApiUrl || "https://api.deepseek.com",
        deepseekModel: deepseekModel || "deepseek-v4-pro",
        openaiApiKey,
        openaiApiUrl: openaiApiUrl || "https://api.openai.com/v1",
        openaiModel: openaiModel || "gpt-4o",
      };
      localStorage.setItem("trpg_api_config", JSON.stringify(config));
      setApiSaveSuccess(true);
      setTimeout(() => setApiSaveSuccess(false), 3000);
    } catch (err) {
      alert("保存设置失败，请检查浏览器存储权限。");
    }
  };

  const handleCheckConnection = async () => {
    setConnCheckStatus("checking");
    setConnCheckMsg("");
    try {
      const { checkConnectivity } = await import("./lib/api");
      const ok = await checkConnectivity({
        modelEngine,
        geminiApiKey,
        deepseekApiKey,
        deepseekApiUrl,
        deepseekModel,
        openaiApiKey,
        openaiApiUrl,
        openaiModel,
      });
      if (ok) {
        setConnCheckStatus("success");
        setConnCheckMsg("连接成功！引擎配置可用。");
      } else {
        setConnCheckStatus("error");
        setConnCheckMsg("连接失败：API 无有效返回。");
      }
    } catch (err: any) {
      setConnCheckStatus("error");
      setConnCheckMsg(err.message || "连接失败");
    }
  };

  // Check for saves on mount and when returning to home
  useEffect(() => {
    checkSaves();
  }, [currentScreen]);

  const checkSaves = () => {
    try {
      const autosave = localStorage.getItem("trpg_autosave");
      setHasAutosave(!!autosave);

      const manualSave = localStorage.getItem("trpg_manual_save");
      if (manualSave) {
        setManualSaveData(JSON.parse(manualSave));
      } else {
        setManualSaveData(null);
      }
    } catch (e) {
      console.error("Error loading saves", e);
    }
  };

  // Launch from autosave
  const handleLoadAutosave = () => {
    try {
      const savedStr = localStorage.getItem("trpg_autosave");
      if (!savedStr) return;

      const savedState = JSON.parse(savedStr);
      setActiveGenre(savedState.genre);
      setActiveCharacter(savedState.character);
      setActivePersonality(savedState.gmPersonality || "Dramatic");
      setActiveHistory(savedState.history || []);
      setActiveLongTermHistory(savedState.longTermHistory || []);
      setActiveTurnCount(savedState.turnCount || 1);
      setActiveLastActionText(savedState.lastActionText || "");
      setActiveLastDiceRoll(savedState.lastDiceRoll || null);

      // Mimic an initial event format from current state
      setActiveInitialEvent({
        storyText: savedState.currentEventText,
        gmCommentary: savedState.currentGmCommentary,
        recommendedChoices: savedState.currentChoices,
        isGameOver: savedState.isGameOver,
        gameEndingType: savedState.gameEndingType,
      });

      setCurrentScreen("game");
    } catch (err) {
      alert("读取自动存档失败，存档可能已损坏。");
    }
  };

  // Launch from manual slot
  const handleLoadManualSave = () => {
    if (!manualSaveData) return;
    try {
      setActiveGenre(manualSaveData.genre);
      setActiveCharacter(manualSaveData.character);
      setActivePersonality(manualSaveData.gmPersonality || "Dramatic");
      setActiveHistory(manualSaveData.history || []);
      setActiveLongTermHistory(manualSaveData.longTermHistory || []);
      setActiveTurnCount(manualSaveData.turnCount || 1);
      setActiveLastActionText(manualSaveData.lastActionText || "");
      setActiveLastDiceRoll(manualSaveData.lastDiceRoll || null);

      setActiveInitialEvent({
        storyText: manualSaveData.currentEventText,
        gmCommentary: manualSaveData.currentGmCommentary,
        recommendedChoices: manualSaveData.currentChoices,
        isGameOver: manualSaveData.isGameOver,
        gameEndingType: manualSaveData.gameEndingType,
      });

      setCurrentScreen("game");
    } catch (err) {
      alert("读取手动存档失败。");
    }
  };

  // Start new setup
  const handleStartNewGame = () => {
    setCurrentScreen("creator");
  };

  // Callback from CharacterCreator on completion
  const handleCreatorComplete = (
    genre: string,
    character: Character,
    gmPersonality: string,
    initialEvent: any,
  ) => {
    setActiveGenre(genre);
    setActiveCharacter(character);
    setActivePersonality(gmPersonality);
    setActiveInitialEvent(initialEvent);
    setActiveHistory([]);
    setActiveLongTermHistory([]);
    setActiveTurnCount(1);
    setActiveLastActionText("");
    setActiveLastDiceRoll(null);
    setCurrentScreen("game");
  };

  // Delete saves
  const handleDeleteAllSaves = () => {
    setConfirmDialog({
      isOpen: true,
      title: "清除所有存档",
      message: "确定要删除所有本地游玩进度和存档吗？此操作无法撤销。",
      confirmText: "确定删除",
      cancelText: "取消",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        localStorage.removeItem("trpg_autosave");
        localStorage.removeItem("trpg_manual_save");
        setHasAutosave(false);
        setManualSaveData(null);
        checkSaves();
      },
    });
  };

  // Export saves
  const handleExportSaves = () => {
    try {
      const autosave = localStorage.getItem("trpg_autosave");
      const manualSave = localStorage.getItem("trpg_manual_save");
      const apiConfig = localStorage.getItem("trpg_api_config");

      const backupData = {
        type: "ai_trpg_backup",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        saves: {
          trpg_autosave: autosave,
          trpg_manual_save: manualSave,
          trpg_api_config: apiConfig,
        },
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = `ai_trpg_backup_${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      alert("导出存档失败：" + err);
    }
  };

  // Import saves
  const handleImportSaves = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = event.target.files?.[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== "string") return;

        const parsed = JSON.parse(content);
        if (parsed.type !== "ai_trpg_backup" && !parsed.saves) {
          alert("导入失败：该文件不是合法的 AI 跑团存档备份文件。");
          return;
        }

        const saves = parsed.saves;
        let importedCount = 0;

        if (saves.trpg_autosave) {
          localStorage.setItem("trpg_autosave", saves.trpg_autosave);
          importedCount++;
        }
        if (saves.trpg_manual_save) {
          localStorage.setItem("trpg_manual_save", saves.trpg_manual_save);
          importedCount++;
        }
        if (saves.trpg_api_config) {
          localStorage.setItem("trpg_api_config", saves.trpg_api_config);
          try {
            const config = JSON.parse(saves.trpg_api_config);
            if (config.engine) setModelEngine(config.engine);
            if (config.geminiApiKey) setGeminiApiKey(config.geminiApiKey);
            if (config.deepseekApiKey) setDeepseekApiKey(config.deepseekApiKey);
            if (config.deepseekModel) setDeepseekModel(config.deepseekModel);
          } catch (e) {}
        }

        if (importedCount > 0) {
          setConfirmDialog({
            isOpen: true,
            title: "导入存档成功",
            message: `成功导入了 ${importedCount} 个存档插槽！你可以继续上次的冒险了。`,
            confirmText: "太好了",
            onConfirm: () => {
              setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
              checkSaves();
            },
          });
          checkSaves();
        } else {
          alert("未在备份文件中找到可导入的有效存档。");
        }
      } catch (err) {
        alert("导入存档解析失败：" + err);
      }
    };

    fileReader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-amber-200 selection:text-amber-900">
      {/* Top beautiful nav banner */}
      <header className="border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-900/60 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => setCurrentScreen("home")}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-zinc-950 font-serif font-extrabold text-lg shadow-inner">
              魂
            </div>
            <span className="font-serif font-extrabold tracking-tight text-lg text-zinc-900 dark:text-zinc-50">
              AI 跑团模拟器
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {currentScreen !== "home" && (
              <button
                onClick={() => setCurrentScreen("home")}
                className="text-zinc-500 hover:text-amber-800 dark:hover:text-amber-400 transition-colors"
              >
                主页大厅
              </button>
            )}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
              className="text-zinc-400 hover:text-zinc-600 transition-colors hidden sm:block"
            >
              开源框架
            </a>
          </div>
        </div>
      </header>

      {/* Main body content area */}
      <main className="flex-1 flex flex-col justify-center">
        {currentScreen === "home" && (
          <div
            className="max-w-4xl mx-auto px-6 py-12 space-y-12 animate-fadeIn"
            id="home-screen"
          >
            {/* HERO LANDING SLIDE */}
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 rounded-full text-xs font-bold shadow-sm mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                简体中文纯AI跑团宿命之旅
              </div>
              <h1 className="font-serif text-5xl md:text-6xl font-extrabold tracking-tight text-amber-900 dark:text-amber-500 leading-tight">
                掌握你自己的命运
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm md:text-base leading-relaxed">
                这是一个完全运行于本地浏览器的单人跑团模拟器与文字角色扮演游戏框架。通过将角色设定、属性数值与强大的
                Gemini AI 相融合，为您动态铺开浩瀚的多维世界。
              </p>
            </div>

            {/* ACTION TRIGGERS PANEL */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-lg max-w-xl mx-auto space-y-4">
              <button
                onClick={handleStartNewGame}
                className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-between group text-sm"
              >
                <div className="flex items-center gap-3">
                  <Swords className="w-5 h-5 text-zinc-950" />
                  <span>开启全新跑团冒险 (New Adventure)</span>
                </div>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              {hasAutosave && (
                <button
                  onClick={handleLoadAutosave}
                  className="w-full py-4 px-6 bg-zinc-100 dark:bg-zinc-850 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-zinc-800 dark:text-zinc-200 font-extrabold rounded-2xl transition-all border border-zinc-200 dark:border-zinc-800 flex items-center justify-between group text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Scroll className="w-5 h-5 text-amber-600" />
                    <span>继续上次的自动存档 (Autosave)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              )}

              {manualSaveData && (
                <button
                  onClick={handleLoadManualSave}
                  className="w-full py-4 px-6 bg-zinc-100 dark:bg-zinc-850 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-zinc-800 dark:text-zinc-200 font-extrabold rounded-2xl transition-all border border-zinc-200 dark:border-zinc-800 flex items-center justify-between group text-sm"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <span>
                      载入手动存档 ({manualSaveData.character?.name} -{" "}
                      {manualSaveData.genre})
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              )}

              {/* SAVE MANAGEMENT COLLAPSIBLE */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowArchivedSaves(!showArchivedSaves)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 font-semibold inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showArchivedSaves
                    ? "隐藏存档与备份管理"
                    : "显示存档与备份管理"}
                </button>

                {showArchivedSaves && (
                  <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-left space-y-3 animate-fadeIn text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-500">
                        自动存档状态:
                      </span>
                      <span
                        className={
                          hasAutosave
                            ? "text-green-600 font-bold"
                            : "text-zinc-400"
                        }
                      >
                        {hasAutosave ? "已就绪" : "无数据"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-2">
                      <span className="font-bold text-zinc-500">
                        手动存档主角:
                      </span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {manualSaveData
                          ? `${manualSaveData.character?.name} (${manualSaveData.genre})`
                          : "无存档"}
                      </span>
                    </div>
                    {manualSaveData?.saveDate && (
                      <div className="text-[10px] text-zinc-400 text-right">
                        保存时间: {manualSaveData.saveDate}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                      <button
                        onClick={handleExportSaves}
                        disabled={!hasAutosave && !manualSaveData}
                        className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg font-bold text-center transition-colors flex items-center justify-center gap-1"
                        title="导出所有游玩数据为 JSON 备份文件"
                      >
                        <Download className="w-3.5 h-3.5" />
                        导出备份
                      </button>
                      <label className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-bold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        导入备份
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportSaves}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {(hasAutosave || manualSaveData) && (
                      <button
                        onClick={handleDeleteAllSaves}
                        className="w-full mt-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg font-bold text-center transition-colors block"
                      >
                        清空所有本地数据
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* API ENGINE CONFIGURATION */}
              <div className="pt-2 text-center border-t border-zinc-100 dark:border-zinc-800/60 mt-4 pt-4">
                <button
                  onClick={() => setShowApiSettings(!showApiSettings)}
                  className="text-xs text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 font-semibold inline-flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {showApiSettings
                    ? "隐藏高级接口配置"
                    : "自选 DeepSeek / 高级接口配置"}
                </button>

                {showApiSettings && (
                  <div className="mt-4 p-5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-left space-y-4 animate-fadeIn text-xs">
                    <div className="flex items-center gap-2 pb-1 border-b border-zinc-150 dark:border-zinc-900">
                      <Cpu className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                        大模型引擎配置
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        选择 AI 引擎
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setModelEngine("gemini")}
                          className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                            modelEngine === "gemini"
                              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/15 text-amber-800 dark:text-amber-400"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          }`}
                        >
                          Gemini (官方默认)
                        </button>
                        <button
                          type="button"
                          onClick={() => setModelEngine("deepseek")}
                          className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                            modelEngine === "deepseek"
                              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/15 text-amber-800 dark:text-amber-400"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          }`}
                        >
                          DeepSeek
                        </button>
                        <button
                          type="button"
                          onClick={() => setModelEngine("openai")}
                          className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                            modelEngine === "openai"
                              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/15 text-amber-800 dark:text-amber-400"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          }`}
                        >
                          OpenAI / GPT
                        </button>
                      </div>
                    </div>

                    {modelEngine === "deepseek" ? (
                      <div className="space-y-3 pt-1 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            DeepSeek API 密钥 (Key)
                          </label>
                          <div className="relative">
                            <input
                              type={showDsKey ? "text" : "password"}
                              value={deepseekApiKey}
                              onChange={(e) =>
                                setDeepseekApiKey(e.target.value)
                              }
                              placeholder="sk-..."
                              className="w-full text-xs p-2.5 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowDsKey(!showDsKey)}
                              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                            >
                              {showDsKey ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            API 节点请求地址 (Base URL)
                          </label>
                          <input
                            type="text"
                            value={deepseekApiUrl}
                            onChange={(e) => setDeepseekApiUrl(e.target.value)}
                            placeholder="https://api.deepseek.com"
                            className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            模型名称 (Model)
                          </label>
                          <input
                            type="text"
                            value={deepseekModel}
                            onChange={(e) => setDeepseekModel(e.target.value)}
                            placeholder="deepseek-v4-pro"
                            className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    ) : modelEngine === "openai" ? (
                      <div className="space-y-3 pt-1 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            OpenAI API 密钥 (Key)
                          </label>
                          <div className="relative">
                            <input
                              type={showOpenaiKey ? "text" : "password"}
                              value={openaiApiKey}
                              onChange={(e) =>
                                setOpenaiApiKey(e.target.value)
                              }
                              placeholder="sk-..."
                              className="w-full text-xs p-2.5 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                            >
                              {showOpenaiKey ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            API 节点请求地址 (Base URL)
                          </label>
                          <input
                            type="text"
                            value={openaiApiUrl}
                            onChange={(e) => setOpenaiApiUrl(e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            模型名称 (Model)
                          </label>
                          <input
                            type="text"
                            value={openaiModel}
                            onChange={(e) => setOpenaiModel(e.target.value)}
                            placeholder="gpt-4o"
                            className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Gemini API 密钥 (Key)
                          </label>
                          <div className="relative">
                            <input
                              type={showGeminiKey ? "text" : "password"}
                              value={geminiApiKey}
                              onChange={(e) => setGeminiApiKey(e.target.value)}
                              placeholder="AIza..."
                              className="w-full text-xs p-2.5 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowGeminiKey(!showGeminiKey)}
                              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                            >
                              {showGeminiKey ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            需前往 Google AI Studio 免费申请 API 密钥。
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCheckConnection}
                          disabled={connCheckStatus === "checking"}
                          className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-bold text-center transition-colors text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {connCheckStatus === "checking" ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          测试连接
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveApiConfig}
                          className="flex-[2] py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg font-bold text-center transition-colors text-xs"
                        >
                          保存接口配置到本地
                        </button>
                      </div>

                      {connCheckMsg && (
                        <div
                          className={`mt-2 text-[11px] font-bold text-center animate-fadeIn ${connCheckStatus === "success" ? "text-green-600" : "text-red-500"}`}
                        >
                          {connCheckMsg}
                        </div>
                      )}
                      {apiSaveSuccess && (
                        <div className="mt-2 text-[11px] text-green-600 font-bold text-center animate-fadeIn">
                          ✓ 配置已成功缓存于本地浏览器！
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FEATURES SHOWCASE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-500 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                  智能协商设定
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  提供玄幻修仙、赛博朋克等多种世界模板，亦能定制背景，让 AI
                  主持人对你的人设进行点评、润色和配置建议。
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-500 flex items-center justify-center mx-auto mb-3">
                  <Swords className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                  真实 DND 骰点
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  经典 DND 力量、敏捷等六维属性。包含 D20
                  掷骰和属性加成修正机制。骰运高低真实干预剧情。
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-500 flex items-center justify-center mx-auto mb-3">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                  无限可能分支
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  除推荐行动外，支持完全自由输入你想执行的任何脑洞操作，AI
                  主持人将无缝接轨编织属于你的专属篇章。
                </p>
              </div>
            </div>
          </div>
        )}

        {currentScreen === "creator" && (
          <CharacterCreator onComplete={handleCreatorComplete} />
        )}

        {currentScreen === "game" && activeCharacter && activeInitialEvent && (
          <GameScreen
            genre={activeGenre}
            initialCharacter={activeCharacter}
            initialEvent={activeInitialEvent}
            gmPersonality={activePersonality}
            initialHistory={activeHistory}
            initialLongTermHistory={activeLongTermHistory}
            initialTurnCount={activeTurnCount}
            initialLastActionText={activeLastActionText}
            initialLastDiceRoll={activeLastDiceRoll}
            onExit={() => setCurrentScreen("home")}
          />
        )}
      </main>

      {/* Decorative footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-6 text-center text-[10px] text-zinc-400">
        <p>
          © 2026 AI跑团模拟器与文字RPG游戏框架 | 纯真中式跑团乐趣与无限叙事引擎
        </p>
      </footer>

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
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {confirmDialog.confirmText || "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
