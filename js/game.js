/**
 * game.js - メインゲームループ、当たり判定、スポーン管理、ステート制御
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // キャンバス解像度（基準サイズ）
        this.width = 900;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // ゲーム状態
        this.state = 'title'; // 'title', 'playing', 'paused', 'gameover'
        this.mode = 'endless'; // 'endless' (チーズ防衛), 'timeattack' (60秒アタック)

        // スコア・コンボ・フィーバー
        this.score = 0;
        this.highScoreEndless = parseInt(localStorage.getItem('neko_hs_endless') || '0', 10);
        this.highScoreTimeAttack = parseInt(localStorage.getItem('neko_hs_timeattack') || '0', 10);
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.comboDuration = 2.2; // コンボ継続秒数

        this.feverGauge = 0;
        this.isFever = false;
        this.feverTimer = 0;
        this.feverDuration = 8.5; // フィーバー継続時間

        this.gameTime = 0;
        this.timeRemaining = 60.0; // タイムアタック用

        // 統計カウンター
        this.caughtStats = {
            normal: 0,
            speedy: 0,
            golden: 0,
            giant: 0,
            total: 0
        };

        // エンティティ
        this.cat = new Cat(this.width / 2, this.height / 2);
        this.cheese = null;
        this.mice = [];
        this.particles = [];
        this.floatingTexts = [];
        this.holes = [];

        // スポーンタイマー
        this.spawnTimer = 0;
        this.baseSpawnInterval = 1.1;

        // 入力管理
        this.input = {
            type: 'mouse', // 'mouse' or 'keyboard'
            pointerActive: false,
            targetX: this.width / 2,
            targetY: this.height / 2,
            left: false,
            right: false,
            up: false,
            down: false,
            pounceRequested: false
        };

        this.setupHoles();
        this.setupInputs();
        this.setupUI();

        this.lastTimestamp = 0;
        requestAnimationFrame(this.loop.bind(this));
    }

    setupHoles() {
        // 部屋の壁際のネズミの穴（6箇所）
        this.holes = [
            new MouseHole(35, 120, 0),
            new MouseHole(35, this.height - 120, 0),
            new MouseHole(this.width - 35, 120, Math.PI),
            new MouseHole(this.width - 35, this.height - 120, Math.PI),
            new MouseHole(this.width / 3, 35, Math.PI / 2),
            new MouseHole((this.width / 3) * 2, this.height - 35, -Math.PI / 2),
        ];
    }

    setupInputs() {
        // キャンバスの拡大率考慮座標変換
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        // マウス操作
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state !== 'playing') return;
            this.input.type = 'mouse';
            this.input.pointerActive = true;
            const coords = getCanvasCoords(e);
            this.input.targetX = coords.x;
            this.input.targetY = coords.y;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            soundEngine.ensureContext();
            if (this.state !== 'playing') return;
            if (e.button === 0) { // 左クリックで飛びつき
                this.input.pounceRequested = true;
            }
        });

        // タッチ操作（スマホ・タブレット対応）
        this.canvas.addEventListener('touchstart', (e) => {
            soundEngine.ensureContext();
            if (this.state !== 'playing') return;
            e.preventDefault();
            this.input.type = 'mouse';
            this.input.pointerActive = true;
            const touch = e.touches[0];
            const coords = getCanvasCoords(touch);
            this.input.targetX = coords.x;
            this.input.targetY = coords.y;
            this.input.pounceRequested = true;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.state !== 'playing') return;
            e.preventDefault();
            const touch = e.touches[0];
            const coords = getCanvasCoords(touch);
            this.input.targetX = coords.x;
            this.input.targetY = coords.y;
        }, { passive: false });

        // キーボード操作
        window.addEventListener('keydown', (e) => {
            soundEngine.ensureContext();
            if (e.repeat) return;

            const code = e.code;
            if (['KeyW', 'ArrowUp'].includes(code)) { this.input.up = true; this.input.type = 'keyboard'; }
            if (['KeyS', 'ArrowDown'].includes(code)) { this.input.down = true; this.input.type = 'keyboard'; }
            if (['KeyA', 'ArrowLeft'].includes(code)) { this.input.left = true; this.input.type = 'keyboard'; }
            if (['KeyD', 'ArrowRight'].includes(code)) { this.input.right = true; this.input.type = 'keyboard'; }
            if (code === 'Space') {
                if (this.state === 'playing') {
                    e.preventDefault();
                    this.input.pounceRequested = true;
                }
            }
            if (code === 'KeyP' || code === 'Escape') {
                if (this.state === 'playing') this.pauseGame();
                else if (this.state === 'paused') this.resumeGame();
            }
            if (code === 'KeyF') {
                this.toggleFullscreen();
            }
        });

        window.addEventListener('keyup', (e) => {
            const code = e.code;
            if (['KeyW', 'ArrowUp'].includes(code)) this.input.up = false;
            if (['KeyS', 'ArrowDown'].includes(code)) this.input.down = false;
            if (['KeyA', 'ArrowLeft'].includes(code)) this.input.left = false;
            if (['KeyD', 'ArrowRight'].includes(code)) this.input.right = false;
        });
    }

    setupUI() {
        // ボタンイベント
        document.getElementById('btnStartEndless').addEventListener('click', () => {
            this.startGame('endless');
        });
        document.getElementById('btnStartTimeAttack').addEventListener('click', () => {
            this.startGame('timeattack');
        });
        document.getElementById('btnRetry').addEventListener('click', () => {
            this.startGame(this.mode);
        });
        document.getElementById('btnTitle').addEventListener('click', () => {
            this.showTitleScreen();
        });
        document.getElementById('btnResume').addEventListener('click', () => {
            this.resumeGame();
        });
        document.getElementById('btnPause').addEventListener('click', () => {
            this.pauseGame();
        });
        document.getElementById('btnMute').addEventListener('click', () => {
            soundEngine.ensureContext();
            const isMuted = soundEngine.toggleMute();
            document.getElementById('btnMute').textContent = isMuted ? '🔇' : '🔊';
        });
        document.getElementById('btnFullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 初期ミュートアイコン更新
        document.getElementById('btnMute').textContent = soundEngine.isMuted ? '🔇' : '🔊';
        this.updateHighScoreDisplay();
    }

    toggleFullscreen() {
        const wrapper = document.getElementById('gameWrapper');
        if (!document.fullscreenElement) {
            if (wrapper.requestFullscreen) {
                wrapper.requestFullscreen().catch(() => {});
            } else if (wrapper.webkitRequestFullscreen) {
                wrapper.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    updateHighScoreDisplay() {
        document.getElementById('hudHighScore').textContent = (
            this.mode === 'endless' ? this.highScoreEndless : this.highScoreTimeAttack
        ).toLocaleString();
    }

    startGame(mode) {
        soundEngine.ensureContext();
        soundEngine.playMeow();
        soundEngine.startBgm();

        this.mode = mode;
        this.state = 'playing';
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.feverGauge = 0;
        this.isFever = false;
        this.feverTimer = 0;
        this.gameTime = 0;
        this.timeRemaining = 60.0;
        this.spawnTimer = 0;

        this.caughtStats = { normal: 0, speedy: 0, golden: 0, giant: 0, total: 0 };
        this.mice = [];
        this.particles = [];
        this.floatingTexts = [];

        // 猫の初期化
        this.cat = new Cat(this.width / 2, this.height / 2);
        this.input.targetX = this.width / 2;
        this.input.targetY = this.height / 2;

        // チーズ初期化（エンドレス防衛時）
        if (this.mode === 'endless') {
            this.cheese = new Cheese(this.width / 2, this.height / 2);
        } else {
            this.cheese = null;
        }

        // 初期ネズミを数匹スポーン
        for (let i = 0; i < 4; i++) {
            this.spawnMouse();
        }

        // UI切り替え
        document.getElementById('titleModal').classList.add('hidden');
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('pauseModal').classList.add('hidden');
        document.getElementById('hudStatusLabel').textContent = (this.mode === 'endless' ? '🧀 チーズHP' : '⏱️ 残り時間');

        this.updateHighScoreDisplay();
    }

    pauseGame() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        document.getElementById('pauseModal').classList.remove('hidden');
    }

    resumeGame() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        document.getElementById('pauseModal').classList.add('hidden');
    }

    showTitleScreen() {
        this.state = 'title';
        document.getElementById('titleModal').classList.remove('hidden');
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('pauseModal').classList.add('hidden');
        soundEngine.stopBgm();
    }

    gameOver() {
        this.state = 'gameover';
        soundEngine.stopBgm();
        soundEngine.playGameOver();

        // ハイスコア判定
        let isNewHigh = false;
        if (this.mode === 'endless') {
            if (this.score > this.highScoreEndless) {
                this.highScoreEndless = this.score;
                localStorage.setItem('neko_hs_endless', this.highScoreEndless);
                isNewHigh = true;
            }
        } else {
            if (this.score > this.highScoreTimeAttack) {
                this.highScoreTimeAttack = this.score;
                localStorage.setItem('neko_hs_timeattack', this.highScoreTimeAttack);
                isNewHigh = true;
            }
        }

        // ランク判定
        let rank = 'C';
        let rankComment = 'まだまだネズミはお盛んです！修行あるのみ！';
        if (this.score >= 20000) {
            rank = 'S';
            rankComment = '神話級のネコ大名！部屋のネズミは全滅の危機！';
        } else if (this.score >= 10000) {
            rank = 'A';
            rankComment = '敏腕キャット！ネズミ界の伝説として恐れられる！';
        } else if (this.score >= 4000) {
            rank = 'B';
            rankComment = '優秀なにゃんこ！ごほうびのちゅ〜る確定！';
        }

        // リザルトUI更新
        document.getElementById('resultScore').textContent = this.score.toLocaleString();
        document.getElementById('resultRank').textContent = rank;
        document.getElementById('resultComment').textContent = rankComment;
        document.getElementById('newRecordBadge').style.display = isNewHigh ? 'inline-block' : 'none';

        document.getElementById('statNormal').textContent = this.caughtStats.normal;
        document.getElementById('statSpeedy').textContent = this.caughtStats.speedy;
        document.getElementById('statGolden').textContent = this.caughtStats.golden;
        document.getElementById('statGiant').textContent = this.caughtStats.giant;
        document.getElementById('statMaxCombo').textContent = this.maxCombo;

        document.getElementById('gameOverModal').classList.remove('hidden');
    }

    spawnMouse() {
        if (this.holes.length === 0) return;
        const hole = this.holes[Math.floor(Math.random() * this.holes.length)];

        // タイプ抽選
        const rand = Math.random();
        let type = 'normal';
        if (rand < 0.08) {
            type = 'golden'; // 8%
        } else if (rand < 0.22) {
            type = 'giant';  // 14%
        } else if (rand < 0.52) {
            type = 'speedy'; // 30%
        } else {
            type = 'normal'; // 48%
        }

        // 穴の少し内側から出現
        const spawnX = hole.x + Math.cos(hole.angle) * 20;
        const spawnY = hole.y + Math.sin(hole.angle) * 20;

        const mouse = new Mouse(spawnX, spawnY, type);
        mouse.angle = hole.angle + (Math.random() - 0.5) * 0.8;
        this.mice.push(mouse);

        // 出現土煙エフェクト
        for (let i = 0; i < 4; i++) {
            this.particles.push(new Particle(spawnX, spawnY, 'dust', '#a4b0be'));
        }
    }

    loop(timestamp) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1); // 最大デルタ制限
        this.lastTimestamp = timestamp;

        this.update(dt);
        this.render();

        requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
        if (this.state !== 'playing') return;

        this.gameTime += dt;

        // タイムアタック時間の減少
        if (this.mode === 'timeattack') {
            this.timeRemaining -= dt;
            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
                this.gameOver();
                return;
            }
        }

        // チーズ耐久度判定（エンドレス防衛）
        if (this.mode === 'endless' && this.cheese && !this.cheese.alive) {
            this.gameOver();
            return;
        }

        // コンボタイマー更新
        if (this.combo > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.comboTimer = 0;
            }
        }

        // フィーバーモード更新
        if (this.isFever) {
            this.feverTimer -= dt;
            this.feverGauge = (this.feverTimer / this.feverDuration) * 100;
            if (this.feverTimer <= 0) {
                this.isFever = false;
                this.feverGauge = 0;
            }
        }

        // プレイヤー（猫）更新
        this.cat.update(dt, this.input, this.width, this.height, this.isFever);

        // 足跡（肉球スタンプ）
        this.cat.pawPrintTimer += dt;
        if (this.cat.isMoving && this.cat.pawPrintTimer > (this.isFever ? 0.08 : 0.18)) {
            this.cat.pawPrintTimer = 0;
            this.particles.push(new Particle(this.cat.x, this.cat.y, 'paw'));
        }

        // スポーン間隔の動的計算（時間とスコアに応じて頻度UP）
        const speedUp = Math.min(this.gameTime * 0.012 + this.score * 0.00004, 0.7);
        const currentSpawnInterval = Math.max(0.35, this.baseSpawnInterval - speedUp);
        const maxMiceCount = this.isFever ? 24 : Math.min(8 + Math.floor(this.gameTime * 0.15), 18);

        this.spawnTimer += dt;
        if (this.spawnTimer >= currentSpawnInterval && this.mice.length < maxMiceCount) {
            this.spawnTimer = 0;
            this.spawnMouse();
        }

        // ネズミ更新＆当たり判定
        for (let i = this.mice.length - 1; i >= 0; i--) {
            const m = this.mice[i];
            m.update(dt, this.cat, this.cheese, this.width, this.height);

            // 猫との当たり判定
            const d = distance(this.cat.x, this.cat.y, m.x, m.y);
            const catchRadius = (this.cat.isPouncing || this.isFever)
                ? (this.cat.radius + m.radius + 22)
                : (this.cat.radius + m.radius + 6);

            // ①「猫は自分の正面でだけネズミを捕まえられるようにする」
            const toMouseAngle = Math.atan2(m.y - this.cat.y, m.x - this.cat.x);
            const angleDiff = Math.abs(normalizeAngle(toMouseAngle - this.cat.angle));

            // 正面判定の最大許容角度（ラジアン）
            // 通常時: ±60° (120°扇形)、飛びつき時: ±75° (150°扇形)、フィーバー時: ±90° (前方180°)
            const maxCatchAngle = this.isFever
                ? Math.PI * 0.50
                : (this.cat.isPouncing ? Math.PI * 0.42 : Math.PI * 0.33);

            const isInFront = angleDiff <= maxCatchAngle;

            if (d < catchRadius && isInFront) {
                // デカネズミのHP削り判定
                if (m.type === 'giant' && m.hp > 1 && !this.isFever) {
                    m.hp -= 1;
                    soundEngine.playCatch('giant');
                    this.floatingTexts.push(new FloatingText(m.x, m.y - 10, 'HIT!', '#e74c3c', 1.1));
                    // 吹き飛ばし
                    m.x += Math.cos(this.cat.angle) * 25;
                    m.y += Math.sin(this.cat.angle) * 25;
                    continue;
                }

                // 捕獲成立！
                this.catchMouse(m);
                this.mice.splice(i, 1);
            }
        }

        // パーティクル更新
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // 浮遊テキスト更新
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        this.updateHUD();
    }

    catchMouse(m) {
        // コンボ更新
        this.combo++;
        this.comboTimer = this.comboDuration;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }

        // コンボ倍率（最大5倍）
        const comboMultiplier = 1.0 + Math.min((this.combo - 1) * 0.25, 4.0);
        const feverMultiplier = this.isFever ? 2.0 : 1.0;
        const earnedScore = Math.round(m.points * comboMultiplier * feverMultiplier);
        this.score += earnedScore;

        // 統計加算
        this.caughtStats[m.type]++;
        this.caughtStats.total++;

        // サウンド
        soundEngine.playCatch(m.type);
        soundEngine.playCombo(this.combo);

        // フィーバーゲージ蓄積
        if (!this.isFever) {
            this.feverGauge = Math.min(100, this.feverGauge + m.feverCharge);
            if (this.feverGauge >= 100) {
                this.triggerFever();
            }
        }

        // 浮遊テキスト表示
        const bonusText = (this.combo > 1 ? ` (+${this.combo}COMBO!)` : '');
        this.floatingTexts.push(new FloatingText(
            m.x, m.y, `+${earnedScore}${bonusText}`,
            m.type === 'golden' ? '#f1c40f' : '#2ecc71',
            m.type === 'golden' ? 1.3 : 1.0
        ));

        // パーティクル発生
        const starColor = m.type === 'golden' ? '#f1c40f' : (m.type === 'speedy' ? '#e17055' : '#74b9ff');
        for (let p = 0; p < (m.type === 'golden' ? 14 : 7); p++) {
            this.particles.push(new Particle(m.x, m.y, 'star', starColor));
        }
    }

    triggerFever() {
        this.isFever = true;
        this.feverTimer = this.feverDuration;
        soundEngine.playFever();

        this.floatingTexts.push(new FloatingText(
            this.cat.x, this.cat.y - 30, '★マタタビ FEVER!!★', '#ff9ff3', 1.6
        ));

        // 画面全体にハートと星エフェクト
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(
                this.cat.x + (Math.random() - 0.5) * 80,
                this.cat.y + (Math.random() - 0.5) * 80,
                'star', '#ff7675'
            ));
        }
    }

    updateHUD() {
        document.getElementById('hudScore').textContent = this.score.toLocaleString();
        
        // コンボHUD
        const comboDisplay = document.getElementById('hudComboWrap');
        if (this.combo > 1) {
            comboDisplay.classList.remove('hidden');
            document.getElementById('hudComboCount').textContent = `${this.combo}`;
            const percent = (this.comboTimer / this.comboDuration) * 100;
            document.getElementById('hudComboBar').style.width = `${percent}%`;
        } else {
            comboDisplay.classList.add('hidden');
        }

        // フィーバーゲージHUD
        const feverBar = document.getElementById('hudFeverBar');
        feverBar.style.width = `${this.feverGauge}%`;
        const feverWrap = document.getElementById('hudFeverWrap');
        if (this.isFever) {
            feverWrap.classList.add('fever-active');
        } else {
            feverWrap.classList.remove('fever-active');
        }

        // モード別ステータスバー（チーズHP or 残り時間）
        const statusVal = document.getElementById('hudStatusValue');
        const statusBar = document.getElementById('hudStatusBar');
        if (this.mode === 'endless' && this.cheese) {
            const hpInt = Math.ceil(this.cheese.hp);
            statusVal.textContent = `${hpInt}%`;
            statusBar.style.width = `${hpInt}%`;
            statusBar.style.background = hpInt > 50 ? '#2ecc71' : (hpInt > 25 ? '#f39c12' : '#e74c3c');
        } else if (this.mode === 'timeattack') {
            const sec = Math.ceil(this.timeRemaining);
            statusVal.textContent = `${sec}秒`;
            const pct = (this.timeRemaining / 60.0) * 100;
            statusBar.style.width = `${pct}%`;
            statusBar.style.background = sec > 20 ? '#3498db' : (sec > 10 ? '#f39c12' : '#e74c3c');
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 部屋の床（木目フローリング）の描画
        this.renderBackground();

        // ネズミの巣穴
        this.holes.forEach(hole => hole.draw(this.ctx));

        // チーズ（防衛モード時）
        if (this.cheese) {
            this.cheese.draw(this.ctx);
        }

        // 肉球スタンプやダストパーティクル（キャラクターの下に描画）
        this.particles.forEach(p => {
            if (p.type === 'paw' || p.type === 'dust') p.draw(this.ctx);
        });

        // ネズミたち
        this.mice.forEach(m => m.draw(this.ctx));

        // プレイヤー（猫）
        this.cat.draw(this.ctx, this.isFever);

        // 光・星パーティクル（キャラクターの上に描画）
        this.particles.forEach(p => {
            if (p.type !== 'paw' && p.type !== 'dust') p.draw(this.ctx);
        });

        // 浮遊スコアテキスト
        this.floatingTexts.forEach(ft => ft.draw(this.ctx));

        // フィーバー時の画面枠イルミネーション
        if (this.isFever) {
            this.ctx.save();
            this.ctx.strokeStyle = `hsl(${(this.gameTime * 360) % 360}, 90%, 65%)`;
            this.ctx.lineWidth = 10;
            this.ctx.strokeRect(5, 5, this.width - 10, this.height - 10);
            this.ctx.restore();
        }
    }

    renderBackground() {
        // 温かみのあるフローリング
        this.ctx.fillStyle = '#f7d794';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 板目のライン
        this.ctx.strokeStyle = 'rgba(205, 133, 63, 0.25)';
        this.ctx.lineWidth = 1.5;
        const plankHeight = 48;
        for (let y = plankHeight; y < this.height; y += plankHeight) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();

            // 板の継ぎ目
            const shift = (y / plankHeight) % 2 === 0 ? 0 : 70;
            for (let x = shift; x < this.width; x += 140) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - plankHeight);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }
        }

        // 中央の可愛い円形ラグマット
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 234, 167, 0.45)';
        this.ctx.beginPath();
        this.ctx.arc(this.width / 2, this.height / 2, 110, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(243, 156, 18, 0.35)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([6, 6]);
        this.ctx.stroke();
        this.ctx.restore();

        // 部屋の外枠壁板
        this.ctx.strokeStyle = '#d35400';
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
    }
}

// ゲーム起動
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
});
