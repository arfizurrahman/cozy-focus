// A soft two-note chime synthesised with WebAudio: falling after focus, rising after a break.

let ctx: AudioContext | null = null;

export function chime(kind: 'focus' | 'break') {
  ctx ??= new AudioContext();
  const ac = ctx;
  if (ac.state === 'suspended') ac.resume();
  const notes = kind === 'focus' ? [659.25, 523.25] : [523.25, 659.25];
  notes.forEach((freq, i) => {
    const t = ac.currentTime + i * 0.28;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 1.5);
  });
}
