let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
// 浏览器自动播放策略：AudioContext 必须在用户手势后才能启动/恢复
let unlocked = false;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();

    // Create soft brown noise buffer for a "whoosh" sound
    const bufferSize = audioCtx.sampleRate * 0.2; // 0.2 seconds
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // brown noise
      lastOut = output[i]!;
      output[i]! *= 3.5; // Compensate gain
    }
  }
  return audioCtx;
}

function unlock() {
  try {
    const ctx = ensureContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    unlocked = true;
  } catch {
    /* 浏览器不支持 AudioContext 时忽略 */
  } finally {
    detachUnlockListeners();
  }
}

function detachUnlockListeners() {
  if (typeof window === "undefined") return;
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("keydown", unlock);
  window.removeEventListener("touchstart", unlock);
}

if (typeof window !== "undefined") {
  // 只在首次用户交互时才创建 AudioContext，避免 Chrome 自动播放警告
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

export function playPageTurnSound(isMuted: boolean) {
  // 尚未有用户交互 / 已静音 / 音频不可用时，直接跳过（不产生警告）
  if (isMuted || !unlocked || !audioCtx || !noiseBuffer) return;
  try {
    const ctx = audioCtx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseSource.start();
    noiseSource.stop(ctx.currentTime + 0.15);
  } catch (err) {
    // 浏览器不支持 AudioContext 或音频被策略阻止时，不应影响页面逻辑
    console.warn("Audio unavailable", err);
  }
}

// 新消息/新订单提示音（复用共享的、已解锁的 AudioContext）
export function playNotificationBeep() {
  if (!unlocked || !audioCtx) return;
  try {
    const ctx = audioCtx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1);
    osc.stop(ctx.currentTime + 1);
  } catch {
    /* ignore */
  }
}
