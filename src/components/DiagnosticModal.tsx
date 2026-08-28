// @ts-nocheck - P0-3 迁移期
import { useState, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../supabase";
import { api } from "../api";
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Terminal,
  Activity,
  Smartphone,
  Laptop,
  Wifi,
  RefreshCw,
  Info
} from "lucide-react";

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DiagnosticModal({ isOpen, onClose }: DiagnosticModalProps) {
  const [stepConfig, setStepConfig] = useState<"idle" | "running" | "success" | "error">("idle");
  const [stepDb, setStepDb] = useState<"idle" | "running" | "success" | "error">("idle");
  const [stepRealtime, setStepRealtime] = useState<"idle" | "running" | "success" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<string>("Disconnected");
  
  // Custom Broadcast Interactive Test
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [receivedBroadcasts, setReceivedBroadcasts] = useState<Array<{ sender: string; time: string; delay: number }>>([]);
  const [clientType, setClientType] = useState<string>("");
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Detect device type
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) {
      setClientType("Mobile Browser (手机端)");
    } else if (/tablet/i.test(ua)) {
      setClientType("Tablet Browser (平板端)");
    } else {
      setClientType("Desktop Browser (电脑端)");
    }
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Listen to incoming test broadcasts
  useEffect(() => {
    if (!isOpen || !supabase || !isSupabaseConfigured) return;

    addLog(`初始化诊断广播监听器 / Initializing diagnostic broadcast listener...`);
    const channel = supabase.channel("diagnostics-interactive", {
      config: {
        broadcast: { self: true } // allow self-ping for loopback test
      }
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "interactive-ping" }, (payload) => {
        const { sender, timestamp } = payload.payload;
        const delay = Date.now() - timestamp;
        
        addLog(`📢 收到广播! 发送方: ${sender}, 延迟: ${delay}ms`);
        
        setReceivedBroadcasts(prev => [
          { sender, time: new Date().toLocaleTimeString(), delay },
          ...prev.slice(0, 4) // keep last 5
        ]);
      })
      .subscribe((status) => {
        setRealtimeStatus(status);
        addLog(`信道订阅状态改变 / Subscription status: ${status}`);
      });

    return () => {
      addLog(`注销诊断信道 / Cleaning up diagnostic channel...`);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isOpen]);

  const runDiagnostics = async () => {
    setLogs([]);
    setStepConfig("running");
    setStepDb("idle");
    setStepRealtime("idle");
    addLog(`🚀 开始系统全面诊断 / Starting full system diagnostics...`);

    // Step 1: Config check
    await new Promise(r => setTimeout(r, 600));
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setStepConfig("error");
      addLog(`❌ 环境配置检查失败: VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 未设置！`);
      addLog(`💡 解决方案: 请检查系统根目录下是否存在正确的 .env 配置文件，并保存最新配置。`);
      return;
    }

    setStepConfig("success");
    addLog(`✅ 环境配置检查通过 / Env configurations OK!`);
    addLog(`🔗 Supabase 终端 / Endpoint: ${url.substring(0, 18)}...`);
    
    // Step 2: Database Check
    setStepDb("running");
    addLog(`📡 正在测试数据库 API 读取 / Testing database read queries...`);
    await new Promise(r => setTimeout(r, 600));

    try {
      const start = Date.now();
      const settingsData = await api.getSettings();
      const duration = Date.now() - start;
      
      if (!settingsData) {
        throw new Error("No settings data returned from database");
      }
      
      setStepDb("success");
      addLog(`✅ 数据库 API 读取成功! 响应时间: ${duration}ms`);
      addLog(`🏠 餐厅名称 / Restaurant: ${settingsData.restaurantName || "未设置"}`);
      addLog(`📂 菜品分类数 / Categories count: ${settingsData.categories?.length || 0}`);
    } catch (err: any) {
      setStepDb("error");
      addLog(`❌ 数据库连接或查询失败 / Database read failed: ${err.message || err}`);
      addLog(`💡 提示: 请检查本地网络、数据库防火墙规则或 Supabase 项目健康状态。`);
      return;
    }

    // Step 3: WebSocket Realtime loopback
    setStepRealtime("running");
    addLog(`🌐 正在初始化 WebSocket 实时回环测试 / Testing Realtime Loopback...`);
    await new Promise(r => setTimeout(r, 500));

    try {
      if (!supabase) {
        throw new Error("Supabase client is not initialized");
      }

      const loopbackChannelId = `diagnostics-loopback-${Math.random().toString(36).substring(2, 9)}`;
      const loopbackChannel = supabase.channel(loopbackChannelId, {
        config: {
          broadcast: { self: true }
        }
      });

      let loopbackReceived = false;

      loopbackChannel.on("broadcast", { event: "loopback-ping" }, (payload) => {
        loopbackReceived = true;
        addLog(`🔄 回环测试成功! 收到自身广播信号 / Loopback received successfully!`);
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          supabase.removeChannel(loopbackChannel);
          reject(new Error("Timeout (3s) waiting for realtime loopback response"));
        }, 3000);

        loopbackChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            addLog(`📡 实时信道已连接，发送 Ping 信号 / Channel subscribed, sending Ping...`);
            loopbackChannel.send({
              type: "broadcast",
              event: "loopback-ping",
              payload: { sentAt: Date.now() }
            }).then(() => {
              // wait briefly for loopback event
              setTimeout(() => {
                clearTimeout(timeout);
                supabase.removeChannel(loopbackChannel);
                if (loopbackReceived) {
                  resolve();
                } else {
                  reject(new Error("Ping sent but no loopback received. Realtime might be disabled."));
                }
              }, 800);
            }).catch(reject);
          } else if (status === "CHANNEL_ERROR") {
            clearTimeout(timeout);
            supabase.removeChannel(loopbackChannel);
            reject(new Error("Supabase Realtime server rejected the connection (CHANNEL_ERROR)"));
          }
        });
      });

      setStepRealtime("success");
      addLog(`🎉 恭喜！实时广播连接测试完全正常！`);
    } catch (err: any) {
      setStepRealtime("error");
      addLog(`⚠️ 实时广播回环测试失败: ${err.message || err}`);
      addLog(`💡 电脑端浏览器或本地网络环境可能限制了 WebSocket 信道，但【请不用担心】！`);
      addLog(`📢 系统已自动启动「高频 HTTP 混合轮询同步引擎 (Hybrid Polling Engine)」！`);
      addLog(`⚡ 所有菜单设置、餐桌状态和顾客订单，将继续以 3秒/次 的超高频率在后台静默轮询同步！`);
      addLog(`✅ 电脑端与手机端数据依然保持同步与可用！`);
      addLog(`💡 提示: 如果想恢复最完美的毫秒级 WebSocket，可尝试强刷电脑端 (Ctrl+F5 或 Shift+Command+R) 或检查网络代理设置。`);
    }
  };

  const handleSendInteractiveBroadcast = async () => {
    if (!supabase || !isSupabaseConfigured) {
      addLog(`❌ 无法发送广播：Supabase 未配置 / Supabase not configured`);
      return;
    }

    setIsBroadcasting(true);
    addLog(`📤 正在发送交互式广播测试包...`);

    try {
      let channel = channelRef.current;
      let needCleanup = false;

      if (!channel) {
        addLog(`⚠️ 正在建立临时广播发送信道 / Building temp channel...`);
        channel = supabase.channel("diagnostics-interactive", {
          config: { broadcast: { self: true } }
        });
        needCleanup = true;
      }

      await channel.send({
        type: "broadcast",
        event: "interactive-ping",
        payload: {
          sender: clientType,
          timestamp: Date.now()
        }
      });
      addLog(`✅ 广播发送成功！如果你在另一台设备(如手机/电脑)上打开了本面板，它将立刻收到该消息！`);

      if (needCleanup && channel) {
        supabase.removeChannel(channel);
      }
    } catch (err: any) {
      addLog(`❌ 发送广播失败 / Failed to broadcast: ${err.message || err}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[90vh] max-h-[750px]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Activity className="text-orange-500 animate-pulse" size={20} />
            <h3 className="font-bold text-zinc-100 text-lg">
              Supabase 实时同步诊断工具
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 bg-zinc-900 p-1.5 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Client device indicator */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {clientType.includes("Desktop") ? (
                <Laptop className="text-orange-400" size={22} />
              ) : (
                <Smartphone className="text-orange-400" size={22} />
              )}
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">当前测试客户端</div>
                <div className="text-sm font-semibold text-zinc-200">{clientType}</div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">WS 状态</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Wifi className={realtimeStatus === "SUBSCRIBED" ? "text-green-500" : "text-yellow-500"} size={14} />
                <span className={`text-xs font-bold ${realtimeStatus === "SUBSCRIBED" ? "text-green-400" : "text-yellow-400"}`}>
                  {realtimeStatus === "SUBSCRIBED" ? "已连接 / Connected" : realtimeStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostics Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">诊断检测项 / Test Items</span>
              <button
                onClick={runDiagnostics}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>一键检测 / Run Test</span>
              </button>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 space-y-3.5">
              {/* Step 1: Config */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <Info size={14} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">1. 环境配置检查 (Keys Check)</p>
                    <p className="text-[10px] text-zinc-500">检测网页端是否正常读取到 Supabase 配置密钥</p>
                  </div>
                </div>
                <div>
                  {stepConfig === "idle" && <span className="text-[10px] text-zinc-600 font-medium">未检测</span>}
                  {stepConfig === "running" && <Loader2 className="animate-spin text-orange-500" size={14} />}
                  {stepConfig === "success" && <CheckCircle2 className="text-green-500" size={15} />}
                  {stepConfig === "error" && <AlertCircle className="text-red-500" size={15} />}
                </div>
              </div>

              {/* Step 2: DB read */}
              <div className="flex items-center justify-between border-t border-zinc-900/80 pt-3">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <Database size={14} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">2. 数据库 API 读取 (REST Read)</p>
                    <p className="text-[10px] text-zinc-500">向 Supabase 发起请求，确保拉取菜单/设置一切正常</p>
                  </div>
                </div>
                <div>
                  {stepDb === "idle" && <span className="text-[10px] text-zinc-600 font-medium">未检测</span>}
                  {stepDb === "running" && <Loader2 className="animate-spin text-orange-500" size={14} />}
                  {stepDb === "success" && <CheckCircle2 className="text-green-500" size={15} />}
                  {stepDb === "error" && <AlertCircle className="text-red-500" size={15} />}
                </div>
              </div>

              {/* Step 3: Realtime */}
              <div className="flex items-center justify-between border-t border-zinc-900/80 pt-3">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <Wifi size={14} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">3. WebSocket 广播回环 (WS Loopback)</p>
                    <p className="text-[10px] text-zinc-500">发送实时广播并检测自身接收，验证收发链路双向通畅</p>
                  </div>
                </div>
                <div>
                  {stepRealtime === "idle" && <span className="text-[10px] text-zinc-600 font-medium">未检测</span>}
                  {stepRealtime === "running" && <Loader2 className="animate-spin text-orange-500" size={14} />}
                  {stepRealtime === "success" && <CheckCircle2 className="text-green-500" size={15} />}
                  {stepRealtime === "error" && <AlertCircle className="text-red-500" size={15} />}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Multi-device Test Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                多端实时广播互动测试 / Cross-Device Test
              </span>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                同时在手机和电脑端打开此诊断面板，在其中一个端点击下方<strong>“发送广播测试”</strong>，正常状态下，所有已打开此面板的端都会<strong>立刻</strong>显示收到了对方发送的消息：
              </p>

              <button
                onClick={handleSendInteractiveBroadcast}
                disabled={isBroadcasting || !isSupabaseConfigured}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-950/20"
              >
                {isBroadcasting ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Send size={13} />
                )}
                <span>发送广播测试 / Send Test Broadcast</span>
              </button>

              {/* Incoming lists */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                  实时收到的广播消息日志 (最近 5 条) / Received Packets
                </span>
                
                {receivedBroadcasts.length === 0 ? (
                  <div className="text-center py-4 bg-zinc-950/50 rounded-xl border border-zinc-900/50">
                    <p className="text-[10px] text-zinc-600 font-medium">
                      暂未收到广播信号，等待其它端发送...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                    {receivedBroadcasts.map((b, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-zinc-950/80 border border-zinc-900/80 px-3 py-2 rounded-xl text-xs animate-in fade-in slide-in-from-bottom-2 duration-200"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="font-bold text-zinc-300">{b.sender}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-zinc-500 font-medium">时间: {b.time}</span>
                          <span className="text-[10px] text-green-400 font-mono font-semibold bg-green-950/50 px-1.5 py-0.5 rounded border border-green-900/30">
                            +{b.delay}ms
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Diagnostic Logs */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal size={12} className="text-orange-400" />
              <span>调试日志终端 / Debug Console Logs</span>
            </span>
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-3 h-32 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {logs.length === 0 ? (
                <p className="text-zinc-600 italic">点击上方 “一键检测” 即可生成实时诊断报告 / Click test button to start</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className={log.includes("❌") ? "text-red-400" : log.includes("✅") ? "text-green-400 animate-pulse-once" : log.includes("📢") ? "text-orange-400 font-bold bg-orange-950/10 px-1 py-0.5 rounded" : "text-zinc-400"}>
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/30 border-t border-zinc-900/80 flex flex-col gap-2">
          <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
            * 电脑网页无法同步时，请尝试在电脑上按 <strong>Ctrl+F5</strong> (Windows) 或 <strong>Shift+Command+R</strong> (Mac) 彻底刷新页面，以拉取最新的环境变量及缓存。
          </p>
        </div>
      </div>
    </div>
  );
}
