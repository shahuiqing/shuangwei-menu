// @ts-nocheck - P0-3 迁移期
let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create soft brown noise buffer for a "whoosh" sound
    const bufferSize = audioCtx.sampleRate * 0.2; // 0.2 seconds
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; // brown noise
        lastOut = output[i];
        output[i] *= 3.5; // Compensate gain
    }
  }
  return audioCtx;
}

export function playPageTurnSound(isMuted: boolean) {
  if (isMuted) return;
  const ctx = initAudio();
  if (ctx.state === 'suspended') {
    ctx.resume().catch((err) => console.warn('Audio resume blocked', err));
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
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
}
