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
        this.highScoreShooting = parseInt(localStorage.getItem('neko_hs_shooting') || '0', 10);
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

        // 統計カウンター（通常モード用）
        this.caughtStats = {
            normal: 0,
            speedy: 0,
            golden: 0,
            giant: 0,
            total: 0
        };

        // シューティングモード用ステート
        this.starfield = new Starfield(this.width, this.height);
        this.shootingTerrain = new ShootingTerrain(this.width, this.height);
        this.shootingPlayer = null;
        this.shootingBullets = [];
        this.shootingGroundMissiles = [];
        this.shootingEnemies = [];
        this.shootingCrawlers = [];
        this.itemPods = [];
        this.shootingBoss = null;
        this.distanceLY = 0;
        this.nextBossDistance = 1500;
        this.warningTimer = 0;
        this.bossQueueIndex = 0;
        this.shootingSpawnTimer = 0;
        this.shootingStats = {
            kills: 0,
            pods: 0,
            bosses: 0
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
            pounceRequested: false,
            shootingFire: false,
            groundFireRequested: false
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
            if (this.mode === 'shooting') {
                this.input.shootingFire = true;
                this.input.groundFireRequested = true;
            } else if (e.button === 0) { // 左クリックで飛びつき
                this.input.pounceRequested = true;
            }
        });

        window.addEventListener('mouseup', () => {
            this.input.shootingFire = false;
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
            if (this.mode === 'shooting') {
                this.input.shootingFire = true;
                this.input.groundFireRequested = true;
            } else {
                this.input.pounceRequested = true;
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.input.shootingFire = false;
        });

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
                    if (this.mode === 'shooting') {
                        this.input.shootingFire = true;
                        this.input.groundFireRequested = true;
                    } else {
                        this.input.pounceRequested = true;
                    }
                }
            }
            if (code === 'KeyQ') {
                if (this.mode === 'shooting' && this.state === 'playing') {
                    e.preventDefault();
                    this.tradeWeaponToOption();
                }
            }
            if (code === 'KeyE') {
                if (this.mode === 'shooting' && this.state === 'playing') {
                    e.preventDefault();
                    this.tradeOptionToWeapon();
                }
            }
            if (code === 'KeyR') {
                if (this.mode === 'shooting' && this.state === 'playing') {
                    e.preventDefault();
                    this.toggleGroundWeapon();
                }
            }
            if (code === 'KeyP' || code === 'Escape') {
                if (this.state === 'playing') this.pauseGame();
                else if (this.state === 'paused') this.resumeGame();
            }
            if (code === 'KeyH') {
                if (this.state === 'playing') this.pauseGame(true);
                else if (this.state === 'paused') this.resumeGame();
                else if (this.state === 'title') this.showHelpModal();
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
            if (code === 'Space') this.input.shootingFire = false;
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
        document.getElementById('btnStartShooting').addEventListener('click', () => {
            this.startGame('shooting');
        });
        document.getElementById('btnTradeToOpt').addEventListener('click', () => {
            this.tradeWeaponToOption();
        });
        document.getElementById('btnTradeToWpn').addEventListener('click', () => {
            this.tradeOptionToWeapon();
        });
        const btnGnd = document.getElementById('btnGroundWeapon');
        if (btnGnd) {
            btnGnd.addEventListener('click', () => {
                this.toggleGroundWeapon();
            });
        }
        document.getElementById('btnRetry').addEventListener('click', () => {
            this.startGame(this.mode);
        });
        document.getElementById('btnTitle').addEventListener('click', () => {
            this.showTitleScreen();
        });
        document.getElementById('btnResume').addEventListener('click', () => {
            this.resumeGame();
        });
        const btnPauseToTitle = document.getElementById('btnPauseToTitle');
        if (btnPauseToTitle) {
            btnPauseToTitle.addEventListener('click', () => {
                this.showTitleScreen();
            });
        }
        document.getElementById('btnPause').addEventListener('click', () => {
            this.pauseGame();
        });
        const btnHelp = document.getElementById('btnHelp');
        if (btnHelp) {
            btnHelp.addEventListener('click', () => {
                if (this.state === 'playing') {
                    this.pauseGame(true);
                } else if (this.state === 'paused') {
                    this.resumeGame();
                } else if (this.state === 'title') {
                    this.showHelpModal();
                }
            });
        }
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

    tradeWeaponToOption() {
        if (this.mode !== 'shooting' || !this.shootingPlayer || this.state !== 'playing') return;
        const success = this.shootingPlayer.tradeWeaponToOption();
        if (success) {
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'TRADE: OPTION +1', '#2ecc71', 1.3));
            for (let i = 0; i < 12; i++) {
                this.particles.push(new Particle(this.shootingPlayer.x, this.shootingPlayer.y, 'star', '#2ecc71'));
            }
            this.updateShootingHUD();
        } else {
            soundEngine.playWallBump();
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'CANNOT TRADE!', '#e74c3c', 1.0));
        }
    }

    tradeOptionToWeapon() {
        if (this.mode !== 'shooting' || !this.shootingPlayer || this.state !== 'playing') return;
        const success = this.shootingPlayer.tradeOptionToWeapon();
        if (success) {
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'TRADE: WEAPON UP', '#f1c40f', 1.3));
            for (let i = 0; i < 12; i++) {
                this.particles.push(new Particle(this.shootingPlayer.x, this.shootingPlayer.y, 'star', '#f1c40f'));
            }
            this.updateShootingHUD();
        } else {
            soundEngine.playWallBump();
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'CANNOT TRADE!', '#e74c3c', 1.0));
        }
    }

    toggleGroundWeapon() {
        if (this.mode !== 'shooting' || !this.shootingPlayer || this.state !== 'playing') return;
        const res = this.shootingPlayer.toggleGroundWeapon();
        if (res.success) {
            if (res.status === 'unlocked') {
                this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'MISSILE UNLOCKED!', '#00d2d3', 1.4));
                for (let i = 0; i < 15; i++) {
                    this.particles.push(new Particle(this.shootingPlayer.x, this.shootingPlayer.y, 'star', '#00d2d3'));
                }
            } else if (res.status === 'on') {
                this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'MISSILE: ON', '#2ecc71', 1.1));
            } else {
                this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'MISSILE: OFF', '#95a5a6', 1.1));
            }
            this.updateShootingHUD();
        } else {
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'NEED WEAPON LV.2!', '#e74c3c', 1.1));
        }
    }

    updateHighScoreDisplay() {
        let hs = this.highScoreEndless;
        if (this.mode === 'shooting') hs = this.highScoreShooting;
        else if (this.mode === 'timeattack') hs = this.highScoreTimeAttack;
        document.getElementById('hudHighScore').textContent = hs.toLocaleString();
    }

    updateShootingHUD() {
        if (this.mode !== 'shooting' || !this.shootingPlayer) return;
        document.getElementById('hudScore').textContent = this.score.toLocaleString();

        const wpnText = this.shootingPlayer.weaponRank === 1 ? 'Lv.1 ビーム'
                      : (this.shootingPlayer.weaponRank === 2 ? 'Lv.2 レーザー' : 'Lv.3 極太レーザー');
        document.getElementById('hudWeaponRank').textContent = wpnText;
        document.getElementById('hudOptionCount').textContent = `${this.shootingPlayer.options.length} / 3`;

        // エネルギー・オーバーヒート状態表示
        const energyWrap = document.getElementById('hudEnergyWrap');
        const energyLabel = document.getElementById('hudEnergyLabel');
        const energyCount = document.getElementById('hudEnergyCount');
        const energyBar = document.getElementById('hudEnergyBar');

        if (energyWrap && energyCount && energyBar) {
            if (this.shootingPlayer.overheatTimer > 0) {
                energyWrap.classList.add('overheat-active');
                if (energyLabel) energyLabel.textContent = '🔥 COOLING';
                energyCount.textContent = `${this.shootingPlayer.overheatTimer.toFixed(1)}s`;
                const progress = ((this.shootingPlayer.overheatDuration - this.shootingPlayer.overheatTimer) / this.shootingPlayer.overheatDuration) * 100;
                energyBar.style.width = `${progress}%`;
            } else {
                energyWrap.classList.remove('overheat-active');
                if (energyLabel) energyLabel.textContent = '⚡ ENERGY';
                const remaining = Math.max(0, this.shootingPlayer.maxShots - this.shootingPlayer.shotCount);
                energyCount.textContent = `${remaining} / ${this.shootingPlayer.maxShots}`;
                const pct = (remaining / this.shootingPlayer.maxShots) * 100;
                energyBar.style.width = `${pct}%`;
            }
        }

        // トレードボタン有効/無効制御
        const btnOpt = document.getElementById('btnTradeToOpt');
        const btnWpn = document.getElementById('btnTradeToWpn');
        if (btnOpt) btnOpt.disabled = !(this.shootingPlayer.weaponRank > 1 && this.shootingPlayer.options.length < 3);
        if (btnWpn) btnWpn.disabled = !(this.shootingPlayer.options.length > 0 && this.shootingPlayer.weaponRank < 3);

        // 対地兵器ボタン制御
        const btnGnd = document.getElementById('btnGroundWeapon');
        if (btnGnd) {
            if (!this.shootingPlayer.hasGroundWeapon) {
                if (this.shootingPlayer.weaponRank > 1) {
                    btnGnd.textContent = 'R: 対地解放 (兵-1)';
                    btnGnd.disabled = false;
                    btnGnd.className = 'trade-btn btn-gnd-ready';
                    btnGnd.title = '兵装を1ランク消費して対地ミサイルを解放 (Rキー)';
                } else {
                    btnGnd.textContent = 'R: 対地兵器 (要Lv.2)';
                    btnGnd.disabled = true;
                    btnGnd.className = 'trade-btn';
                    btnGnd.title = '兵装Lv.2以上で解放可能';
                }
            } else {
                if (this.shootingPlayer.groundWeaponActive) {
                    btnGnd.textContent = 'R: 対地ミサイル [ON]';
                    btnGnd.disabled = false;
                    btnGnd.className = 'trade-btn btn-gnd-active';
                    btnGnd.title = '対地ミサイル装備中 (クリック/RキーでOFF)';
                } else {
                    btnGnd.textContent = 'R: 対地ミサイル [OFF]';
                    btnGnd.disabled = false;
                    btnGnd.className = 'trade-btn';
                    btnGnd.title = '対地ミサイル停止中 (クリック/RキーでON)';
                }
            }
        }

        const livesHearts = '❤️'.repeat(Math.max(0, this.shootingPlayer.lives));
        document.getElementById('hudLives').textContent = livesHearts || '💀';
        document.getElementById('hudDistance').textContent = `${Math.floor(this.distanceLY)} LY`;
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
        this.particles = [];
        this.floatingTexts = [];
        this.input.shootingFire = false;
        this.input.groundFireRequested = false;
        this.input.pounceRequested = false;

        const hudComboWrap = document.getElementById('hudComboWrap');
        const hudFeverWrap = document.getElementById('hudFeverWrap');
        const hudStatusWrap = document.getElementById('hudStatusWrap');
        const hudShootingWrap = document.getElementById('hudShootingWrap');

        if (this.mode === 'shooting') {
            this.distanceLY = 0;
            this.nextBossDistance = 1500;
            this.warningTimer = 0;
            this.bossQueueIndex = 0;
            this.shootingSpawnTimer = 0;
            this.shootingStats = { kills: 0, pods: 0, bosses: 0 };
            this.shootingPlayer = new ShootingPlayer(120, this.height / 2);
            this.shootingBullets = [];
            this.shootingGroundMissiles = [];
            this.shootingEnemies = [];
            this.shootingCrawlers = [];
            this.shootingTerrain = new ShootingTerrain(this.width, this.height);
            this.itemPods = [];
            this.shootingBoss = null;

            hudComboWrap.classList.add('hidden');
            hudFeverWrap.classList.add('hidden');
            hudStatusWrap.classList.add('hidden');
            hudShootingWrap.classList.remove('hidden');
            this.updateShootingHUD();
        } else {
            this.caughtStats = { normal: 0, speedy: 0, golden: 0, giant: 0, total: 0 };
            this.mice = [];
            this.cat = new Cat(this.width / 2, this.height / 2);
            this.input.targetX = this.width / 2;
            this.input.targetY = this.height / 2;

            if (this.mode === 'endless') {
                this.cheese = new Cheese(this.width / 2, this.height / 2);
            } else {
                this.cheese = null;
            }

            for (let i = 0; i < 4; i++) {
                this.spawnMouse();
            }

            hudShootingWrap.classList.add('hidden');
            hudFeverWrap.classList.remove('hidden');
            hudStatusWrap.classList.remove('hidden');
            document.getElementById('hudStatusLabel').textContent = (this.mode === 'endless' ? '🧀 チーズHP' : '⏱️ 残り時間');
        }

        // UI切り替え
        document.getElementById('titleModal').classList.add('hidden');
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('pauseModal').classList.add('hidden');

        this.updateHighScoreDisplay();
    }

    pauseGame(isHelp = false) {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        const titleEl = document.getElementById('pauseModalTitle');
        const subEl = document.getElementById('pauseModalSubtitle');
        if (titleEl) {
            titleEl.textContent = isHelp ? '❓ 操作ヘルプ＆コマンド一覧' : '⏸️ 一時停止中';
        }
        if (subEl) {
            subEl.textContent = isHelp ? 'いつでも確認できるキー＆ボタン操作ガイド' : '操作キー一覧＆コマンドガイド';
        }
        const shootGuide = document.getElementById('pauseGuideShooting');
        const actGuide = document.getElementById('pauseGuideAction');
        if (shootGuide && actGuide) {
            if (this.mode === 'shooting') {
                shootGuide.classList.remove('hidden');
                actGuide.classList.add('hidden');
            } else {
                shootGuide.classList.add('hidden');
                actGuide.classList.remove('hidden');
            }
        }
        document.getElementById('pauseModal').classList.remove('hidden');
    }

    showHelpModal() {
        const titleEl = document.getElementById('pauseModalTitle');
        const subEl = document.getElementById('pauseModalSubtitle');
        if (titleEl) titleEl.textContent = '❓ 操作ヘルプ＆キー一覧';
        if (subEl) subEl.textContent = '各モードの操作方法一覧';
        const shootGuide = document.getElementById('pauseGuideShooting');
        const actGuide = document.getElementById('pauseGuideAction');
        if (shootGuide && actGuide) {
            shootGuide.classList.remove('hidden');
            actGuide.classList.remove('hidden');
        }
        document.getElementById('pauseModal').classList.remove('hidden');
    }

    resumeGame() {
        document.getElementById('pauseModal').classList.add('hidden');
        if (this.state === 'paused') {
            this.state = 'playing';
        }
    }

    showTitleScreen() {
        this.state = 'title';
        document.getElementById('titleModal').classList.remove('hidden');
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('pauseModal').classList.add('hidden');
        document.getElementById('hudShootingWrap').classList.add('hidden');
        document.getElementById('hudFeverWrap').classList.remove('hidden');
        document.getElementById('hudStatusWrap').classList.remove('hidden');
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
        } else if (this.mode === 'timeattack') {
            if (this.score > this.highScoreTimeAttack) {
                this.highScoreTimeAttack = this.score;
                localStorage.setItem('neko_hs_timeattack', this.highScoreTimeAttack);
                isNewHigh = true;
            }
        } else if (this.mode === 'shooting') {
            if (this.score > this.highScoreShooting) {
                this.highScoreShooting = this.score;
                localStorage.setItem('neko_hs_shooting', this.highScoreShooting);
                isNewHigh = true;
            }
        }

        // ランク判定とUI更新
        if (this.mode === 'shooting') {
            let rank = 'C';
            let rankComment = '宇宙の藻屑となってしまったニャ…！出撃準備せよ！';
            if (this.score >= 35000) {
                rank = 'S';
                rankComment = '銀河最強のニャイパー大統領！全宇宙のネズミ帝国を壊滅！';
            } else if (this.score >= 18000) {
                rank = 'A';
                rankComment = '宇宙猫エースパイロット！敵艦隊に多大な打撃を与えた！';
            } else if (this.score >= 8000) {
                rank = 'B';
                rankComment = '銀河パトロール隊員合格！マタタビ星へ無事帰還！';
            }

            document.getElementById('resultTitle').textContent = '🚀 宇宙ニャンディウス 任務終了！';
            document.getElementById('lblStat1').textContent = '👾 撃破敵機';
            document.getElementById('statNormal').textContent = this.shootingStats.kills;
            document.getElementById('lblStat2').textContent = '💊 カプセル回収';
            document.getElementById('statSpeedy').textContent = this.shootingStats.pods;
            document.getElementById('lblStat3').textContent = '👑 撃破ボス';
            document.getElementById('statGolden').textContent = this.shootingStats.bosses;
            document.getElementById('lblStat4').textContent = '🌌 航行距離';
            document.getElementById('statGiant').textContent = `${Math.floor(this.distanceLY)} LY`;
            document.getElementById('lblStatExtra').textContent = '⚔️ 最終兵装 / 機数';
            document.getElementById('statMaxCombo').textContent = `Lv.${this.shootingPlayer ? this.shootingPlayer.weaponRank : 1} / ${this.shootingPlayer ? this.shootingPlayer.options.length : 0}機`;

            document.getElementById('resultScore').textContent = this.score.toLocaleString();
            document.getElementById('resultRank').textContent = rank;
            document.getElementById('resultComment').textContent = rankComment;
            document.getElementById('newRecordBadge').style.display = isNewHigh ? 'inline-block' : 'none';
        } else {
            document.getElementById('resultTitle').textContent = '捕物帳 終了！';
            document.getElementById('lblStat1').textContent = '🐭 普通のネズミ';
            document.getElementById('lblStat2').textContent = '🏃 俊足ネズミ';
            document.getElementById('lblStat3').textContent = '✨ 黄金ネズミ';
            document.getElementById('lblStat4').textContent = '🐻 巨大ネズミ';
            document.getElementById('lblStatExtra').textContent = '🔥 最大コンボ数';

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

            document.getElementById('resultScore').textContent = this.score.toLocaleString();
            document.getElementById('resultRank').textContent = rank;
            document.getElementById('resultComment').textContent = rankComment;
            document.getElementById('newRecordBadge').style.display = isNewHigh ? 'inline-block' : 'none';

            document.getElementById('statNormal').textContent = this.caughtStats.normal;
            document.getElementById('statSpeedy').textContent = this.caughtStats.speedy;
            document.getElementById('statGolden').textContent = this.caughtStats.golden;
            document.getElementById('statGiant').textContent = this.caughtStats.giant;
            document.getElementById('statMaxCombo').textContent = this.maxCombo;
        }

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

        if (this.mode === 'shooting') {
            this.updateShooting(dt);
            return;
        }

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
        if (this.mode === 'shooting') {
            this.renderShooting();
            return;
        }

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

    // ==========================================
    // シューティングモード専用ロジック・描画
    // ==========================================

    updateShooting(dt) {
        this.gameTime += dt;
        this.distanceLY += 85 * dt; // 航行距離加算

        // 星空パララックス更新
        this.starfield.update(dt);

        // メイン武器射撃判定（Spaceキー押下中 or マウス/タッチホールドで自動連射）
        if (this.input.shootingFire) {
            this.shootingPlayer.shoot(this.shootingBullets, this.floatingTexts, this.particles);
        }

        // 対地兵器（押しっぱなし連射ではなく、キー/クリック1回につき1回発射のセミオート）
        if (this.input.groundFireRequested) {
            this.input.groundFireRequested = false;
            this.shootingPlayer.shootGround(this.shootingGroundMissiles);
        }

        // プレイヤー更新（地形による天井/地面の移動制限含む）
        this.shootingPlayer.update(dt, this.input, this.width, this.height, this.floatingTexts, this.particles, this.shootingTerrain, this.distanceLY);

        // ボス警告および出現管理
        if (!this.shootingBoss && this.distanceLY >= this.nextBossDistance) {
            if (this.warningTimer <= 0) {
                this.warningTimer = 3.2; // 警告演出秒数
                soundEngine.playWarningSiren();
            } else {
                this.warningTimer -= dt;
                if (this.warningTimer <= 0) {
                    const bossType = (this.bossQueueIndex % 2 === 0) ? 'mouse' : 'frog';
                    this.bossQueueIndex++;
                    this.shootingBoss = new ShootingBoss(bossType, this.width, this.height);
                    this.nextBossDistance += 2000;
                }
            }
        }

        // 敵ザコ編隊・クローラーのスポーン
        this.shootingSpawnTimer += dt;
        const spawnDelay = this.shootingBoss ? 3.5 : 2.1;
        if (this.shootingSpawnTimer >= spawnDelay) {
            this.shootingSpawnTimer = 0;
            this.spawnShootingWave();
        }

        // ボス更新
        if (this.shootingBoss) {
            this.shootingBoss.update(dt, this.shootingPlayer, this.shootingBullets);

            // カエルの舌攻撃とプレイヤーの当たり判定
            if (this.shootingBoss.type === 'frog' && this.shootingBoss.tongueLength > 0) {
                const tongueEndX = this.shootingBoss.x - this.shootingBoss.tongueLength;
                const tongueEndY = this.shootingBoss.y + (this.shootingBoss.tongueTargetY - this.shootingBoss.y) * 0.5;
                if (distance(this.shootingPlayer.x, this.shootingPlayer.y, tongueEndX, tongueEndY) < this.shootingPlayer.radius + 18) {
                    this.playerHitShooting();
                }
            }
        }

        // 空中ザコ敵更新
        for (let i = this.shootingEnemies.length - 1; i >= 0; i--) {
            const e = this.shootingEnemies[i];
            e.update(dt, this.shootingBullets);

            // 敵機と自機の体当たり判定
            if (e.alive && distance(this.shootingPlayer.x, this.shootingPlayer.y, e.x, e.y) < this.shootingPlayer.radius + e.radius) {
                e.alive = false;
                this.playerHitShooting();
            }

            if (!e.alive) {
                this.shootingEnemies.splice(i, 1);
            }
        }

        // 地面・天井クローラー敵更新
        for (let i = this.shootingCrawlers.length - 1; i >= 0; i--) {
            const c = this.shootingCrawlers[i];
            c.update(dt, this.shootingTerrain, this.distanceLY, this.shootingBullets);

            // クローラーと自機の体当たり判定
            if (c.alive && distance(this.shootingPlayer.x, this.shootingPlayer.y, c.x, c.y) < this.shootingPlayer.radius + c.radius) {
                c.alive = false;
                this.playerHitShooting();
            }

            if (!c.alive) {
                this.shootingCrawlers.splice(i, 1);
            }
        }

        // アイテムポッド更新＆回収判定
        for (let i = this.itemPods.length - 1; i >= 0; i--) {
            const pod = this.itemPods[i];
            pod.update(dt);

            if (distance(this.shootingPlayer.x, this.shootingPlayer.y, pod.x, pod.y) < this.shootingPlayer.radius + pod.radius) {
                this.collectItemPod(pod);
                this.itemPods.splice(i, 1);
                continue;
            }

            if (!pod.alive) {
                this.itemPods.splice(i, 1);
            }
        }

        // 弾丸の更新と当たり判定
        for (let i = this.shootingBullets.length - 1; i >= 0; i--) {
            const b = this.shootingBullets[i];
            b.update(dt);

            if (!b.alive) {
                this.shootingBullets.splice(i, 1);
                continue;
            }

            // プレイヤー弾の敵／クローラー／ボスへの当たり判定
            if (!b.isEnemy) {
                // 対ボス判定
                if (this.shootingBoss && this.shootingBoss.alive && !this.shootingBoss.isEntering) {
                    if (b.intersectsCircle(this.shootingBoss.x, this.shootingBoss.y, this.shootingBoss.radius) && !b.hitTargets.has(this.shootingBoss)) {
                        b.hitTargets.add(this.shootingBoss);
                        const bossDead = this.shootingBoss.hit(b.damage);
                        b.pierce--;
                        if (b.pierce <= 0) b.alive = false;

                        for (let p = 0; p < 3; p++) {
                            this.particles.push(new Particle(b.x, b.y, 'spark', '#f1c40f'));
                        }

                        if (bossDead) {
                            this.score += this.shootingBoss.points;
                            this.shootingStats.bosses++;
                            this.floatingTexts.push(new FloatingText(this.shootingBoss.x, this.shootingBoss.y - 30, `+${this.shootingBoss.points}!`, '#f1c40f', 1.8));

                            for (let p = 0; p < 35; p++) {
                                this.particles.push(new Particle(
                                    this.shootingBoss.x + (Math.random() - 0.5) * 80,
                                    this.shootingBoss.y + (Math.random() - 0.5) * 80,
                                    'star', Math.random() < 0.5 ? '#e74c3c' : '#f39c12'
                                ));
                            }

                            this.itemPods.push(new ItemPod(this.shootingBoss.x, this.shootingBoss.y));
                            this.shootingBoss = null;
                        }

                        if (!b.alive) {
                            this.shootingBullets.splice(i, 1);
                            continue;
                        }
                    }
                }

                // 対空中ザコ敵判定
                for (let j = this.shootingEnemies.length - 1; j >= 0; j--) {
                    const e = this.shootingEnemies[j];
                    if (b.intersectsCircle(e.x, e.y, e.radius) && !b.hitTargets.has(e)) {
                        b.hitTargets.add(e);
                        e.hp -= b.damage;
                        b.pierce--;
                        if (b.pierce <= 0) b.alive = false;

                        for (let p = 0; p < 2; p++) {
                            this.particles.push(new Particle(b.x, b.y, 'spark', '#e67e22'));
                        }

                        if (e.hp <= 0) {
                            e.alive = false;
                            soundEngine.playShootingExplosion(false);
                            this.score += e.scoreValue;
                            this.shootingStats.kills++;
                            this.floatingTexts.push(new FloatingText(e.x, e.y - 12, `+${e.scoreValue}`, '#fffa65', 1.0));

                            for (let p = 0; p < 6; p++) {
                                this.particles.push(new Particle(e.x, e.y, 'dust', e.isRed ? '#e74c3c' : '#95a5a6'));
                            }

                            if (e.isRed || Math.random() < 0.025) {
                                this.itemPods.push(new ItemPod(e.x, e.y));
                            }
                        }

                        if (!b.alive) break;
                    }
                }

                if (!b.alive) {
                    this.shootingBullets.splice(i, 1);
                    continue;
                }

                // 対地面・天井クローラー判定
                for (let j = this.shootingCrawlers.length - 1; j >= 0; j--) {
                    const c = this.shootingCrawlers[j];
                    if (b.intersectsCircle(c.x, c.y, c.radius) && !b.hitTargets.has(c)) {
                        b.hitTargets.add(c);
                        c.hp -= b.damage;
                        b.pierce--;
                        if (b.pierce <= 0) b.alive = false;

                        for (let p = 0; p < 3; p++) {
                            this.particles.push(new Particle(b.x, b.y, 'spark', '#f1c40f'));
                        }

                        if (c.hp <= 0) {
                            c.alive = false;
                            soundEngine.playShootingExplosion(false);
                            this.score += c.scoreValue;
                            this.shootingStats.kills++;
                            this.floatingTexts.push(new FloatingText(c.x, c.y - 12, `+${c.scoreValue}`, '#fffa65', 1.0));

                            for (let p = 0; p < 7; p++) {
                                this.particles.push(new Particle(c.x, c.y, 'dust', c.isRed ? '#e74c3c' : '#95a5a6'));
                            }

                            if (c.isRed || Math.random() < 0.05) {
                                this.itemPods.push(new ItemPod(c.x, c.y));
                            }
                        }

                        if (!b.alive) break;
                    }
                }

                if (!b.alive) {
                    this.shootingBullets.splice(i, 1);
                    continue;
                }
            } else {
                // 敵弾判定
                let absorbedByOption = false;
                for (const opt of this.shootingPlayer.options) {
                    if (distance(b.x, b.y, opt.x, opt.y) < opt.radius + b.radius + 6) {
                        b.alive = false;
                        absorbedByOption = true;
                        for (let p = 0; p < 4; p++) {
                            this.particles.push(new Particle(b.x, b.y, 'spark', '#3498db'));
                        }
                        break;
                    }
                }

                if (absorbedByOption) {
                    this.shootingBullets.splice(i, 1);
                    continue;
                }

                // 自機本体への被弾判定
                if (distance(b.x, b.y, this.shootingPlayer.x, this.shootingPlayer.y) < this.shootingPlayer.radius * 0.75 + b.radius) {
                    b.alive = false;
                    this.shootingBullets.splice(i, 1);
                    this.playerHitShooting();
                    continue;
                }
            }
        }

        // 対地ミサイル更新＆当たり判定
        for (let i = this.shootingGroundMissiles.length - 1; i >= 0; i--) {
            const m = this.shootingGroundMissiles[i];
            m.update(dt, this.shootingTerrain, this.distanceLY, this.particles);

            if (!m.alive) {
                this.shootingGroundMissiles.splice(i, 1);
                continue;
            }

            // 対クローラー判定（対地兵器の本領発揮！）
            for (let j = this.shootingCrawlers.length - 1; j >= 0; j--) {
                const c = this.shootingCrawlers[j];
                if (m.intersectsCircle(c.x, c.y, c.radius)) {
                    m.alive = false;
                    c.hp -= m.damage;
                    for (let p = 0; p < 5; p++) {
                        this.particles.push(new Particle(m.x, m.y, 'spark', '#f1c40f'));
                    }
                    if (c.hp <= 0) {
                        c.alive = false;
                        soundEngine.playShootingExplosion(false);
                        this.score += c.scoreValue;
                        this.shootingStats.kills++;
                        this.floatingTexts.push(new FloatingText(c.x, c.y - 12, `+${c.scoreValue}`, '#fffa65', 1.0));
                        for (let p = 0; p < 8; p++) {
                            this.particles.push(new Particle(c.x, c.y, 'dust', c.isRed ? '#e74c3c' : '#95a5a6'));
                        }
                        if (c.isRed || Math.random() < 0.05) {
                            this.itemPods.push(new ItemPod(c.x, c.y));
                        }
                    }
                    break;
                }
            }
            if (!m.alive) {
                this.shootingGroundMissiles.splice(i, 1);
                continue;
            }

            // 対空中ザコ敵判定
            for (let j = this.shootingEnemies.length - 1; j >= 0; j--) {
                const e = this.shootingEnemies[j];
                if (m.intersectsCircle(e.x, e.y, e.radius)) {
                    m.alive = false;
                    e.hp -= m.damage;
                    for (let p = 0; p < 4; p++) {
                        this.particles.push(new Particle(m.x, m.y, 'spark', '#f1c40f'));
                    }
                    if (e.hp <= 0) {
                        e.alive = false;
                        soundEngine.playShootingExplosion(false);
                        this.score += e.scoreValue;
                        this.shootingStats.kills++;
                        this.floatingTexts.push(new FloatingText(e.x, e.y - 12, `+${e.scoreValue}`, '#fffa65', 1.0));
                        if (e.isRed || Math.random() < 0.025) {
                            this.itemPods.push(new ItemPod(e.x, e.y));
                        }
                    }
                    break;
                }
            }
            if (!m.alive) {
                this.shootingGroundMissiles.splice(i, 1);
                continue;
            }

            // 対ボス判定
            if (this.shootingBoss && this.shootingBoss.alive && !this.shootingBoss.isEntering) {
                if (m.intersectsCircle(this.shootingBoss.x, this.shootingBoss.y, this.shootingBoss.radius)) {
                    m.alive = false;
                    const bossDead = this.shootingBoss.hit(m.damage);
                    for (let p = 0; p < 5; p++) {
                        this.particles.push(new Particle(m.x, m.y, 'spark', '#f1c40f'));
                    }
                    if (bossDead) {
                        this.score += this.shootingBoss.points;
                        this.shootingStats.bosses++;
                        this.floatingTexts.push(new FloatingText(this.shootingBoss.x, this.shootingBoss.y - 30, `+${this.shootingBoss.points}!`, '#f1c40f', 1.8));
                        for (let p = 0; p < 35; p++) {
                            this.particles.push(new Particle(
                                this.shootingBoss.x + (Math.random() - 0.5) * 80,
                                this.shootingBoss.y + (Math.random() - 0.5) * 80,
                                'star', Math.random() < 0.5 ? '#e74c3c' : '#f39c12'
                            ));
                        }
                        this.itemPods.push(new ItemPod(this.shootingBoss.x, this.shootingBoss.y));
                        this.shootingBoss = null;
                    }
                    this.shootingGroundMissiles.splice(i, 1);
                    continue;
                }
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

        this.updateShootingHUD();
    }

    spawnShootingWave() {
        const terrainActive = this.shootingTerrain && this.shootingTerrain.isTerrainActive(this.distanceLY);

        // 地形エリアでは約55%の確率でクローラー敵（地面・天井）をスポーン！
        if (terrainActive && Math.random() < 0.55) {
            const hasRed = (Math.random() < 0.25);
            const roll = Math.random();
            if (roll < 0.4) {
                // 地面クローラー 2体
                this.shootingCrawlers.push(new ShootingCrawler(this.width + 30, false, hasRed));
                this.shootingCrawlers.push(new ShootingCrawler(this.width + 80, false, false));
            } else if (roll < 0.75) {
                // 天井クローラー 2体
                this.shootingCrawlers.push(new ShootingCrawler(this.width + 30, true, hasRed));
                this.shootingCrawlers.push(new ShootingCrawler(this.width + 80, true, false));
            } else {
                // 地面と天井の挟み撃ち 各1体
                this.shootingCrawlers.push(new ShootingCrawler(this.width + 30, false, hasRed));
                this.shootingCrawlers.push(new ShootingCrawler(this.width + 65, true, false));
            }
            return;
        }

        // 空中編隊
        const hasRed = (Math.random() < 0.20);
        const patternChoice = Math.random();

        if (patternChoice < 0.45) {
            // 正弦波（サイン波）編隊 5機
            const baseY = 120 + Math.random() * (this.height - 240);
            for (let i = 0; i < 5; i++) {
                const isRed = hasRed && (i === 4);
                this.shootingEnemies.push(new ShootingEnemy(this.width + 40 + i * 45, baseY, 'sine', isRed));
            }
        } else if (patternChoice < 0.8) {
            // ダイブ急降下編隊 4機
            const startY = 80 + Math.random() * 100;
            for (let i = 0; i < 4; i++) {
                const isRed = hasRed && (i === 0);
                this.shootingEnemies.push(new ShootingEnemy(this.width + 40 + i * 50, startY, 'dive', isRed));
            }
        } else {
            // 直線編隊 3機
            const baseY = 150 + Math.random() * (this.height - 300);
            for (let i = 0; i < 3; i++) {
                const isRed = hasRed && (i === 1);
                this.shootingEnemies.push(new ShootingEnemy(this.width + 40 + i * 50, baseY, 'straight', isRed));
            }
        }
    }

    collectItemPod(pod) {
        soundEngine.playItemGet();
        this.shootingStats.pods++;

        // ランダムで兵装強化かオプションを付与
        const canWpn = this.shootingPlayer.weaponRank < 3;
        const canOpt = this.shootingPlayer.options.length < 3;

        let action = '';
        if (canWpn && canOpt) {
            action = Math.random() < 0.5 ? 'wpn' : 'opt';
        } else if (canWpn) {
            action = 'wpn';
        } else if (canOpt) {
            action = 'opt';
        } else {
            action = 'bonus';
        }

        if (action === 'wpn') {
            this.shootingPlayer.upgradeWeapon();
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 20, 'WEAPON UP!', '#f1c40f', 1.4));
        } else if (action === 'opt') {
            this.shootingPlayer.addOption();
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 20, 'OPTION +1!', '#2ecc71', 1.4));
        } else {
            this.score += 5000;
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 20, '+5000 BONUS!', '#e056fd', 1.4));
        }

        for (let p = 0; p < 12; p++) {
            this.particles.push(new Particle(pod.x, pod.y, 'star', '#f1c40f'));
        }
        this.updateShootingHUD();
    }

    playerHitShooting() {
        if (!this.shootingPlayer || this.shootingPlayer.invincibleTimer > 0) return;
        const wasHit = this.shootingPlayer.hit();
        if (wasHit) {
            this.floatingTexts.push(new FloatingText(this.shootingPlayer.x, this.shootingPlayer.y - 25, 'HIT!', '#e74c3c', 1.3));
            for (let p = 0; p < 15; p++) {
                this.particles.push(new Particle(this.shootingPlayer.x, this.shootingPlayer.y, 'spark', '#ff7675'));
            }
            this.updateShootingHUD();

            if (!this.shootingPlayer.alive) {
                this.gameOver();
            }
        }
    }

    renderShooting() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. 星空多重スクロール背景
        this.starfield.draw(this.ctx);

        // 2. 地形（エリアによる天井＆地面）
        if (this.shootingTerrain) {
            this.shootingTerrain.draw(this.ctx, this.distanceLY);
        }

        // 3. アイテムポッド
        this.itemPods.forEach(pod => pod.draw(this.ctx));

        // 4. 地面・天井クローラー敵
        this.shootingCrawlers.forEach(c => c.draw(this.ctx));

        // 5. 敵空中ザコ
        this.shootingEnemies.forEach(e => e.draw(this.ctx));

        // 6. ボス
        if (this.shootingBoss) {
            this.shootingBoss.draw(this.ctx);
        }

        // 7. 対地ミサイル
        this.shootingGroundMissiles.forEach(m => m.draw(this.ctx));

        // 8. プレイヤー戦闘機＆オプション
        if (this.shootingPlayer) {
            this.shootingPlayer.draw(this.ctx);
        }

        // 9. 弾丸（プレイヤー弾・敵弾・リップルレーザー）
        this.shootingBullets.forEach(b => b.draw(this.ctx));

        // 7. パーティクル
        this.particles.forEach(p => p.draw(this.ctx));

        // 8. 浮遊テキスト
        this.floatingTexts.forEach(ft => ft.draw(this.ctx));

        // 9. ボス警告アラート演出
        if (this.warningTimer > 0) {
            this.ctx.save();
            const flashAlpha = (Math.sin(this.gameTime * 20) + 1) * 0.25;
            this.ctx.fillStyle = `rgba(231, 76, 60, ${flashAlpha})`;
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, this.height / 2 - 40, this.width, 80);

            this.ctx.font = 'bold 28px "Courier New", monospace';
            this.ctx.fillStyle = '#ff3838';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = '#c0392b';
            this.ctx.shadowBlur = 15;
            this.ctx.fillText('⚠ WARNING!! A HUGE BATTLESHIP IS APPROACHING ⚠', this.width / 2, this.height / 2);
            this.ctx.restore();
        }
    }
}

// ゲーム起動
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
});
