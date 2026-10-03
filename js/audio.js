/**
 * audio.js - Web Audio API による完全内蔵サウンドエンジン
 * 外部音声ファイル不要で動作し、低遅延でポップな効果音を生成します。
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.isInitialized = false;
        this.bgmTimer = null;
        this.isBgmPlaying = false;
        
        // localStorageからミュート設定を復元
        try {
            this.isMuted = localStorage.getItem('neko_muted') === 'true';
        } catch (e) {
            this.isMuted = false;
        }
    }

    init() {
        if (this.isInitialized && this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.isInitialized = true;
    }

    ensureContext() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        try {
            localStorage.setItem('neko_muted', this.isMuted);
        } catch (e) {}
        if (this.isMuted) {
            this.stopBgm();
        } else {
            this.startBgm();
        }
        return this.isMuted;
    }

    // --- 効果音群 ---

    /** 猫の鳴き声（にゃーん） */
    playMeow() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        // 抑揚のある鳴き声ピッチ変化 (420Hz -> 740Hz -> 480Hz)
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.linearRampToValueAtTime(740, t + 0.15);
        osc.frequency.exponentialRampToValueAtTime(480, t + 0.42);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t);
        filter.frequency.linearRampToValueAtTime(2200, t + 0.15);
        filter.frequency.exponentialRampToValueAtTime(800, t + 0.42);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.45);
    }

    /** 飛びつき・ダッシュの風切り音 */
    playPounce() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, t);
        filter.frequency.exponentialRampToValueAtTime(1800, t + 0.15);
        filter.Q.value = 3.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(t);
    }

    /** ネズミ捕獲音（ポンッ！） */
    playCatch(type = 'normal') {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        const baseFreq = type === 'golden' ? 900 : type === 'speedy' ? 680 : type === 'giant' ? 320 : 540;
        
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.08);

        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.13);

        // ゴールデンネズミ捕獲時のボーナスベル音
        if (type === 'golden') {
            this.playSparkle(t + 0.05);
        }
    }

    /** キラキラ音（ゴールドネズミ・フィーバー） */
    playSparkle(startTime = null) {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = startTime || this.ctx.currentTime;
        const freqs = [1046.5, 1318.5, 1567.9, 2093.0]; // C6, E6, G6, C7
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.05);

            gain.gain.setValueAtTime(0.12, t + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t + idx * 0.05);
            osc.stop(t + idx * 0.05 + 0.22);
        });
    }

    /** ネズミの鳴き声（チュウ！） */
    playSqueak() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, t);
        osc.frequency.exponentialRampToValueAtTime(2900, t + 0.04);
        osc.frequency.exponentialRampToValueAtTime(2100, t + 0.08);

        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.09);
    }

    /** コンボ音（コンボ数に応じてペンタトニックスケールで音程上昇） */
    playCombo(comboCount) {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51]; // C5〜E6
        const noteIndex = Math.min(comboCount - 1, scale.length - 1);
        const freq = scale[Math.max(0, noteIndex)];

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.24);
    }

    /** フィーバーモード突入ファンファーレ */
    playFever() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const chords = [
            { f: 523.25, dur: 0.1, delay: 0 },
            { f: 659.25, dur: 0.1, delay: 0.08 },
            { f: 783.99, dur: 0.1, delay: 0.16 },
            { f: 1046.50, dur: 0.35, delay: 0.24 }
        ];

        chords.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.f, t + note.delay);

            gain.gain.setValueAtTime(0.2, t + note.delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + note.delay + note.dur);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t + note.delay);
            osc.stop(t + note.delay + note.dur + 0.05);
        });
    }

    /** チーズかじられアラート音 */
    playNibble() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.06);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.08);
    }

    /** ゲームオーバー音 */
    playGameOver() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const notes = [440, 415, 392, 349];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t + idx * 0.18);

            gain.gain.setValueAtTime(0.15, t + idx * 0.18);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.18 + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t + idx * 0.18);
            osc.stop(t + idx * 0.18 + 0.28);
        });
    }

    /** プロシージャルBGM（通常 / ニャ界村） */
    startBgm(mode = 'normal') {
        if (this.isMuted) return;
        this.stopBgm();
        this.ensureContext();
        if (!this.ctx) return;

        this.isBgmPlaying = true;
        let step = 0;

        if (mode === 'nyakaimura') {
            // 魔界村 ステージ1「平原・墓場」ファミコン（FC）音源完全再現
            // 原曲: G#マイナー / 12小節・192ステップ (16分音符ループ)
            // 参照音源: STAGE 1 (魔界村) by FM.006-KAZE (https://youtu.be/hVVxaWzCAF8)
            // 編成: Pulse 1 (主旋律), Pulse 2 (和音・対旋律), Triangle (アルペジオベース), Noise/Sine (ドラム)
            const tempo = 165; // 約91 BPM (16分音符 = 165ms, 1周約31.7秒)
            const TOTAL_STEPS = 192;

            const leadF = new Float32Array([0.0, 0.0, 830.61, 0.0, 0.0, 0.0, 783.99, 0.0, 739.99, 0.0, 0.0, 0.0, 698.46, 0.0, 659.26, 0.0, 587.33, 622.25, 0.0, 587.33, 622.25, 0.0, 587.33, 622.25, 0.0, 277.18, 311.13, 277.18, 311.13, 0.0, 392.0, 0.0, 0.0, 0.0, 830.61, 0.0, 0.0, 0.0, 783.99, 0.0, 739.99, 0.0, 0.0, 0.0, 698.46, 0.0, 659.26, 0.0, 587.33, 622.25, 0.0, 587.33, 622.25, 0.0, 587.33, 622.25, 0.0, 277.18, 311.13, 277.18, 311.13, 0.0, 466.16, 0.0, 783.99, 830.61, 0.0, 783.99, 830.61, 0.0, 493.88, 0.0, 783.99, 830.61, 0.0, 783.99, 830.61, 0.0, 493.88, 0.0, 783.99, 830.61, 0.0, 783.99, 830.61, 0.0, 523.25, 0.0, 783.99, 830.61, 0.0, 783.99, 830.61, 0.0, 587.33, 0.0, 622.25, 622.25, 622.25, 0.0, 0.0, 0.0, 783.99, 0.0, 622.25, 622.25, 622.25, 0.0, 0.0, 0.0, 830.61, 0.0, 622.25, 622.25, 622.25, 0.0, 0.0, 0.0, 587.33, 0.0, 622.25, 311.13, 329.63, 349.23, 369.99, 392.0, 415.3, 466.16, 415.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 587.33, 622.25, 0.0, 587.33, 622.25, 0.0, 392.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 587.33, 622.25, 0.0, 587.33, 622.25, 0.0, 493.88, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 659.26, 739.99, 0.0, 659.26, 739.99, 0.0, 622.25, 0.0, 0.0, 311.13, 0.0, 0.0, 622.25, 0.0, 0.0, 523.25, 523.25, 523.25, 466.16, 466.16, 392.0, 392.0]);
            const leadD = new Uint8Array([0, 0, 4, 0, 0, 0, 2, 0, 4, 0, 0, 0, 2, 0, 2, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 2, 0, 2, 0, 0, 0, 4, 0, 0, 0, 2, 0, 4, 0, 0, 0, 2, 0, 2, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 2, 0, 2, 0, 1, 1, 0, 1, 1, 0, 2, 0, 1, 1, 0, 1, 1, 0, 2, 0, 1, 1, 0, 1, 1, 0, 2, 0, 1, 1, 0, 1, 1, 0, 2, 0, 1, 1, 2, 0, 0, 0, 2, 0, 1, 1, 2, 0, 0, 0, 2, 0, 1, 1, 2, 0, 0, 0, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 3, 0, 0, 3, 0, 0, 2, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
            const harmF = new Float32Array([0.0, 0.0, 622.25, 0.0, 0.0, 0.0, 622.25, 0.0, 622.25, 0.0, 0.0, 0.0, 622.25, 0.0, 466.16, 0.0, 466.16, 0.0, 0.0, 466.16, 0.0, 0.0, 466.16, 0.0, 0.0, 233.08, 0.0, 0.0, 233.08, 0.0, 311.13, 0.0, 0.0, 0.0, 622.25, 0.0, 0.0, 0.0, 622.25, 0.0, 622.25, 0.0, 0.0, 0.0, 622.25, 0.0, 466.16, 0.0, 466.16, 0.0, 0.0, 466.16, 0.0, 0.0, 466.16, 0.0, 0.0, 233.08, 0.0, 0.0, 233.08, 0.0, 311.13, 0.0, 246.94, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 261.63, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 277.18, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 293.66, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 392.0, 392.0, 392.0, 0.0, 0.0, 0.0, 311.13, 0.0, 392.0, 392.0, 392.0, 0.0, 0.0, 0.0, 311.13, 0.0, 466.16, 466.16, 466.16, 0.0, 0.0, 0.0, 415.3, 0.0, 392.0, 261.63, 246.94, 246.94, 233.08, 220.0, 207.65, 196.0, 311.13, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 415.3, 0.0, 0.0, 415.3, 0.0, 0.0, 311.13, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 466.16, 0.0, 0.0, 466.16, 0.0, 0.0, 329.63, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 493.88, 0.0, 0.0, 493.88, 0.0, 0.0, 466.16, 0.0, 0.0, 233.08, 0.0, 0.0, 466.16, 0.0, 0.0, 466.16, 466.16, 466.16, 392.0, 392.0, 261.63, 261.63]);
            const harmD = new Uint8Array([0, 0, 4, 0, 0, 0, 2, 0, 4, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2, 0, 0, 0, 4, 0, 0, 0, 2, 0, 4, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2, 0, 8, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 0, 0, 0, 2, 0, 1, 1, 2, 0, 0, 0, 2, 0, 1, 1, 2, 0, 0, 0, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 3, 0, 0, 3, 0, 0, 2, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
            const bassF = new Float32Array([103.83, 123.47, 155.56, 77.78, 103.83, 155.56, 155.56, 0.0, 103.83, 123.47, 155.56, 77.78, 103.83, 155.56, 155.56, 0.0, 116.54, 130.81, 155.56, 77.78, 116.54, 155.56, 155.56, 0.0, 116.54, 130.81, 155.56, 77.78, 116.54, 155.56, 155.56, 0.0, 103.83, 123.47, 155.56, 77.78, 103.83, 155.56, 155.56, 0.0, 103.83, 123.47, 155.56, 77.78, 103.83, 155.56, 155.56, 0.0, 116.54, 130.81, 155.56, 77.78, 116.54, 155.56, 155.56, 0.0, 116.54, 130.81, 155.56, 77.78, 116.54, 155.56, 155.56, 0.0, 103.83, 123.47, 155.56, 77.78, 103.83, 123.47, 155.56, 77.78, 103.83, 130.81, 164.81, 65.41, 103.83, 130.81, 164.81, 65.41, 103.83, 164.81, 207.65, 65.41, 103.83, 164.81, 207.65, 65.41, 103.83, 164.81, 207.65, 69.3, 103.83, 164.81, 207.65, 69.3, 155.56, 155.56, 155.56, 0.0, 98.0, 0.0, 77.78, 0.0, 155.56, 155.56, 155.56, 0.0, 103.83, 0.0, 77.78, 0.0, 155.56, 155.56, 155.56, 0.0, 0.0, 0.0, 155.56, 155.56, 103.83, 155.56, 164.81, 174.61, 185.0, 196.0, 207.65, 233.08, 103.83, 0.0, 155.56, 155.56, 0.0, 103.83, 123.47, 155.56, 103.83, 0.0, 155.56, 155.56, 0.0, 103.83, 146.83, 155.56, 98.0, 0.0, 155.56, 155.56, 0.0, 98.0, 155.56, 155.56, 98.0, 0.0, 155.56, 155.56, 0.0, 98.0, 146.83, 155.56, 82.41, 0.0, 123.47, 123.47, 0.0, 82.41, 103.83, 123.47, 82.41, 0.0, 123.47, 123.47, 0.0, 82.41, 103.83, 123.47, 98.0, 0.0, 155.56, 155.56, 0.0, 98.0, 130.81, 155.56, 0.0, 155.56, 146.83, 130.81, 123.47, 123.47, 116.54, 98.0]);
            const bassD = new Uint8Array([1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 2, 0, 2, 0, 1, 1, 2, 0, 2, 0, 2, 0, 1, 1, 2, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1]);

            // 8-bit ノイズドラム用ホワイトノイズバッファ (0.5秒分を事前生成)
            const noiseBuf = (() => {
                const len = Math.floor(this.ctx.sampleRate * 0.5);
                const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                const ch = buf.getChannelData(0);
                for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
                return buf;
            })();

            const playSnare = (gainVal = 0.08, dur = 0.08) => {
                const src = this.ctx.createBufferSource();
                src.buffer = noiseBuf;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(800, this.ctx.currentTime);
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
                src.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                src.start(this.ctx.currentTime);
                src.stop(this.ctx.currentTime + dur + 0.01);
            };

            const playKick = (gainVal = 0.14, dur = 0.07) => {
                const kOsc = this.ctx.createOscillator();
                const kGain = this.ctx.createGain();
                kOsc.type = 'sine';
                kOsc.frequency.setValueAtTime(130, this.ctx.currentTime);
                kOsc.frequency.exponentialRampToValueAtTime(32, this.ctx.currentTime + dur);
                kGain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                kGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
                kOsc.connect(kGain);
                kGain.connect(this.ctx.destination);
                kOsc.start(this.ctx.currentTime);
                kOsc.stop(this.ctx.currentTime + dur + 0.01);
            };

            const playHiHat = (gainVal = 0.02, dur = 0.03) => {
                const src = this.ctx.createBufferSource();
                src.buffer = noiseBuf;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(4000, this.ctx.currentTime);
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
                src.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                src.start(this.ctx.currentTime);
                src.stop(this.ctx.currentTime + dur + 0.01);
            };

            this.bgmTimer = setInterval(() => {
                if (this.isMuted || !this.isBgmPlaying || !this.ctx) return;
                const t = this.ctx.currentTime;
                const currentStep = step % TOTAL_STEPS;

                const bFreq = bassF[currentStep];
                const bSteps = bassD[currentStep];
                const lFreq = leadF[currentStep];
                const lSteps = leadD[currentStep];
                const hFreq = harmF[currentStep];
                const hSteps = harmD[currentStep];

                // 1. FC音源仕様 トライアングルベース (Triangle)
                if (bFreq > 0) {
                    const bOsc = this.ctx.createOscillator();
                    const bGain = this.ctx.createGain();
                    bOsc.type = 'triangle';
                    bOsc.frequency.setValueAtTime(bFreq, t);
                    const bDur = Math.max(0.09, bSteps * (tempo / 1000) * 0.92);
                    bGain.gain.setValueAtTime(0.18, t);
                    bGain.gain.exponentialRampToValueAtTime(0.001, t + bDur);
                    bOsc.connect(bGain);
                    bGain.connect(this.ctx.destination);
                    bOsc.start(t);
                    bOsc.stop(t + bDur + 0.01);
                }

                // 2. FC音源仕様 パルス1 主旋律 (Square)
                if (lFreq > 0) {
                    const lOsc = this.ctx.createOscillator();
                    const lGain = this.ctx.createGain();
                    lOsc.type = 'square';
                    lOsc.frequency.setValueAtTime(lFreq, t);
                    const lDur = Math.max(0.08, lSteps * (tempo / 1000) * 0.88);
                    lGain.gain.setValueAtTime(0.085, t);
                    lGain.gain.exponentialRampToValueAtTime(0.001, t + lDur);
                    lOsc.connect(lGain);
                    lGain.connect(this.ctx.destination);
                    lOsc.start(t);
                    lOsc.stop(t + lDur + 0.01);
                }

                // 3. FC音源仕様 パルス2 対旋律・和音 (Square)
                if (hFreq > 0) {
                    const hOsc = this.ctx.createOscillator();
                    const hGain = this.ctx.createGain();
                    hOsc.type = 'square';
                    hOsc.frequency.setValueAtTime(hFreq, t);
                    const hDur = Math.max(0.08, hSteps * (tempo / 1000) * 0.88);
                    hGain.gain.setValueAtTime(0.048, t);
                    hGain.gain.exponentialRampToValueAtTime(0.001, t + hDur);
                    hOsc.connect(hGain);
                    hGain.connect(this.ctx.destination);
                    hOsc.start(t);
                    hOsc.stop(t + hDur + 0.01);
                }

                // 4. FCドラム（ノイズスネア、キック、ハイハット、展開部ロール）
                const beatInBar = currentStep % 16;
                const isSpecialRoll = (
                    (currentStep >= 96 && currentStep <= 98) ||
                    (currentStep >= 104 && currentStep <= 106) ||
                    (currentStep >= 112 && currentStep <= 114) ||
                    (currentStep >= 120 && currentStep <= 127) ||
                    (currentStep >= 185 && currentStep <= 191)
                );

                if (isSpecialRoll) {
                    playSnare(0.07, 0.06);
                } else if (beatInBar === 4 || beatInBar === 12) {
                    // 2拍目・4拍目：スネア
                    playSnare(0.08, 0.09);
                } else if (beatInBar === 0 || beatInBar === 8) {
                    // 1拍目・3拍目：キックドラム
                    playKick(0.14, 0.07);
                } else if (beatInBar % 2 === 0) {
                    // 8分刻み：ハイハット
                    playHiHat(0.02, 0.03);
                }

                step++;
            }, tempo);
            return;
        }

        // 通常モードBGM
        const bassLine = [261.63, 0, 329.63, 0, 392.00, 0, 329.63, 0, 293.66, 0, 349.23, 0, 392.00, 0, 349.23, 0];
        const tempo = 160;

        this.bgmTimer = setInterval(() => {
            if (this.isMuted || !this.isBgmPlaying || !this.ctx) return;
            const t = this.ctx.currentTime;
            const freq = bassLine[step % bassLine.length];
            if (freq > 0) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq / 2, t);

                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(t);
                osc.stop(t + 0.15);
            }
            step++;
        }, tempo);
    }

    stopBgm() {
        this.isBgmPlaying = false;
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    // --- シューティングモード用レトロサウンド ---

    /** 兵装に応じたレーザー発射音 */
    playShootingLaser(rank = 1) {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (rank === 1) {
            // Rank 1: 通常8bitツインビーム
            osc.type = 'square';
            osc.frequency.setValueAtTime(980, t);
            osc.frequency.exponentialRampToValueAtTime(240, t + 0.07);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.08);
        } else if (rank === 2) {
            // Rank 2: 直線ロングレーザー（シャープな高出力レーザー音）
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1550, t);
            osc.frequency.exponentialRampToValueAtTime(420, t + 0.10);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.11);
        } else {
            // Rank 3: 超極太ハイパーロングレーザー（重低音＋高エネルギーメガビーム）
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1800, t);
            osc.frequency.exponentialRampToValueAtTime(160, t + 0.15);
            gain.gain.setValueAtTime(0.16, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.16);
        }
    }

    /** レトロ敵爆発音 */
    playShootingExplosion(isBoss = false) {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const dur = isBoss ? 0.65 : 0.22;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, isBoss ? 1.5 : 2.5);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isBoss ? 450 : 800, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isBoss ? 0.35 : 0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(t);
    }

    /** アイテムポッド取得音（グラディウス風パワーアップ音） */
    playItemGet() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t + idx * 0.04);
            gain.gain.setValueAtTime(0.12, t + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.09);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + idx * 0.04);
            osc.stop(t + idx * 0.04 + 0.1);
        });
    }

    /** 回復アイテム取得音（心地よいヒーリングチャイム音） */
    playHealSound() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        // F5, A5, C6, F6 の澄んだアルペジオ
        const notes = [698.46, 880.00, 1046.50, 1396.91];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + idx * 0.05);
            gain.gain.setValueAtTime(0.18, t + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.22);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + idx * 0.05);
            osc.stop(t + idx * 0.05 + 0.24);
        });
    }

    /** 兵装 ⇄ オプションのトレード音 */
    playTradeSound() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        // サイバーなワープ・変形音 (ピッチ急上昇＆急降下)
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.18);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    /** ボス警報サイレン音（WARNING!） */
    playWarningSiren() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            const startTime = t + i * 0.28;
            osc.frequency.setValueAtTime(740, startTime);
            osc.frequency.linearRampToValueAtTime(520, startTime + 0.22);

            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        }
    }

    /** 武器オーバーヒート警報音 (ブザー＋蒸気噴出) */
    playOverheatWarning() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        // 警告低音ブザー
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            const startTime = t + i * 0.14;
            osc.frequency.setValueAtTime(320, startTime);
            osc.frequency.setValueAtTime(200, startTime + 0.06);

            gain.gain.setValueAtTime(0.18, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.13);
        }

        // 蒸気プシュー音 (ノイズ＋バンドパスフィルター)
        const dur = 0.35;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(500, t + dur);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    }

    /** クールダウン完了・リチャージ完了チャイム */
    playCooldownReady() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const notes = [440, 659.25, 880]; // A4, E5, A5
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const startTime = t + idx * 0.06;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.13);
        });
    }

    /** 対地ミサイル発射音 (シュパーン！) */
    playMissileLaunch() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
    }

    /** 対地兵器解放・装備音 (カチャッ・ピキーン！) */
    playMissileEquip() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.setValueAtTime(520, t + 0.05);
        osc.frequency.setValueAtTime(1046.5, t + 0.10);

        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
    }

    // --- ニャ界村（魔界村風アクション）用サウンドエフェクト ---

    /** 猫騎士ジャンプ音（8-bitレトロジャンプ） */
    playKnightJump() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(420, t + 0.14);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
    }

    /** 槍投げ音 (シュバッ！) */
    playThrowSpear() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.10);

        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.11);
    }

    /** 短剣投げ音 (ピシュンッ！) */
    playThrowDagger() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(740, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.08);

        gain.gain.setValueAtTime(0.13, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    /** 松明投擲・着火炎上音 (ボウッ！) */
    playThrowTorch() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        // 火炎ノイズ
        const dur = 0.28;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(220, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    }

    /** 鎧粉砕音（ガシャンガラガラッ！魔界村おなじみの鎧ブレイク音） */
    playArmorBreak() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        // 金属衝撃音
        [220, 311, 466, 622].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            const start = t + idx * 0.04;
            osc.frequency.setValueAtTime(freq, start);
            osc.frequency.exponentialRampToValueAtTime(80, start + 0.25);
            gain.gain.setValueAtTime(0.25, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.26);
        });
    }

    /** 鎧再装備音 (シャキーン！) */
    playArmorEquip() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            const start = t + idx * 0.05;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.18, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.17);
        });
    }

    /** ゾンビネズミ出現音 (ズズズ…) */
    playZombieRise() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(95, t);
        osc.frequency.linearRampToValueAtTime(140, t + 0.18);
        osc.frequency.linearRampToValueAtTime(85, t + 0.35);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
    }

    /** カラスの鳴き声 (カーッ！) */
    playCrowCaw() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, t);
        osc.frequency.exponentialRampToValueAtTime(420, t + 0.16);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.17);
    }

    /** 赤いコウモリネズミ咆哮＆急降下 (キエエェッ！) */
    playArremerScreech() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(980, t);
        osc.frequency.linearRampToValueAtTime(1450, t + 0.12);
        osc.frequency.exponentialRampToValueAtTime(380, t + 0.38);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.40);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.42);
    }

    /** 武器壺取得音 (パリンッ・ファンファーレ！) */
    playWeaponGet() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            const start = t + idx * 0.05;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.16, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.15);
        });
    }

    /** 攻撃ヒット音（ザシュッ！レトロ打撃音） */
    playHit() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(460, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);

        gain.gain.setValueAtTime(0.20, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.09);
    }

    /** 敵撃破音（ドガァン！8bit爆発・消滅音） */
    playEnemyDestroy() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const dur = 0.22;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);

        // トーン成分
        const osc = this.ctx.createOscillator();
        const tGain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
        tGain.gain.setValueAtTime(0.14, t);
        tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(tGain);
        tGain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.19);
    }

    /** 壁衝突・トレード不可警告音（鈍い打撃音） */
    playWallBump() {
        if (this.isMuted) return;
        this.ensureContext();
        if (!this.ctx) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.09);
    }
}

const soundEngine = new SoundEngine();
