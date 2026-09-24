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

    /** 軽快で可愛いプロシージャルBGM */
    startBgm() {
        if (this.isMuted || this.isBgmPlaying) return;
        this.ensureContext();
        if (!this.ctx) return;

        this.isBgmPlaying = true;
        let step = 0;
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
            // 通常8bitピコピコレザー
            osc.type = 'square';
            osc.frequency.setValueAtTime(980, t);
            osc.frequency.exponentialRampToValueAtTime(220, t + 0.07);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.08);
        } else if (rank === 2) {
            // 3WAYレーザー（デュアルトーン）
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(320, t + 0.09);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.1);
        } else {
            // ハイパーニャン波リップルレーザー（広がるリング状サウンド）
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1400, t);
            osc.frequency.linearRampToValueAtTime(800, t + 0.06);
            osc.frequency.linearRampToValueAtTime(1600, t + 0.12);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.14);
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
}

const soundEngine = new SoundEngine();
