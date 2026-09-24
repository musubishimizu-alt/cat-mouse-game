/**
 * shooting.js - グラディウス風横スクロールシューティングモード『宇宙ニャンディウス』
 * 星空多重スクロール、猫戦闘機、シャドウオプション、兵装トレード、ボス戦闘
 */

// --- 宇宙星空パララックス背景 ---
class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.stars = [];
        this.nebulae = [];

        // 3層の星（遠景、中景、近景）
        for (let i = 0; i < 90; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                speed: 0.6 + Math.random() * 0.8, // 遠景
                size: 1.0,
                color: '#bdc3c7'
            });
        }
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                speed: 1.8 + Math.random() * 1.5, // 中景
                size: 1.8,
                color: Math.random() < 0.3 ? '#74b9ff' : '#f1c40f'
            });
        }
        for (let i = 0; i < 25; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                speed: 4.5 + Math.random() * 2.5, // 近景・高速
                size: 2.8,
                color: '#ffffff'
            });
        }

        // 星雲（宇宙ダスト）
        for (let i = 0; i < 4; i++) {
            this.nebulae.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 120 + Math.random() * 80,
                color: i % 2 === 0 ? 'rgba(142, 68, 173, 0.08)' : 'rgba(41, 128, 185, 0.08)',
                speed: 0.4
            });
        }
    }

    update(dt) {
        this.stars.forEach(star => {
            star.x -= star.speed * (dt * 60);
            if (star.x < 0) {
                star.x = this.width;
                star.y = Math.random() * this.height;
            }
        });

        this.nebulae.forEach(neb => {
            neb.x -= neb.speed * (dt * 60);
            if (neb.x + neb.radius < 0) {
                neb.x = this.width + neb.radius;
                neb.y = Math.random() * this.height;
            }
        });
    }

    draw(ctx) {
        // 深宇宙背景グラデーション
        const bgGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
        bgGrad.addColorStop(0, '#090a0f');
        bgGrad.addColorStop(0.5, '#0e111a');
        bgGrad.addColorStop(1, '#080812');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // 星雲
        this.nebulae.forEach(neb => {
            ctx.save();
            const grad = ctx.createRadialGradient(neb.x, neb.y, 10, neb.x, neb.y, neb.radius);
            grad.addColorStop(0, neb.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 星々
        this.stars.forEach(star => {
            ctx.fillStyle = star.color;
            ctx.fillRect(star.x, star.y, star.size, star.size);
        });
    }
}

// --- 地形システム（エリアに応じた天井＆地面） ---
class ShootingTerrain {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cycleLength = 2400; // 1サイクルの航行距離 (LY)
    }

    /** 指定された距離における地形の強度 (0.0〜1.0) */
    getEnvelope(distanceLY) {
        const inCycle = ((distanceLY % this.cycleLength) + this.cycleLength) % this.cycleLength;
        // 0〜400: 深宇宙（地形なし）
        if (inCycle < 400) return 0;
        // 400〜550: 地形出現（フェードイン）
        if (inCycle < 550) return (inCycle - 400) / 150;
        // 550〜1600: 地形エリア（天井＆地面、這う敵が出現）
        if (inCycle < 1600) return 1.0;
        // 1600〜1750: 地形消失（フェードアウト）
        if (inCycle < 1750) return 1.0 - (inCycle - 1600) / 150;
        // 1750〜2400: ボス戦エリア（地形なし）
        return 0;
    }

    /** 地形が有効（這う敵が出現可能）かどうか */
    isTerrainActive(distanceLY) {
        return this.getEnvelope(distanceLY) > 0.35;
    }

    /** 現在のサイクルのテーマ ('cheese' または 'mecha') */
    getTheme(distanceLY) {
        const cycleIndex = Math.floor(distanceLY / this.cycleLength);
        return cycleIndex % 2 === 0 ? 'cheese' : 'mecha';
    }

    /** 画面座標 screenX における天井のY座標を取得 */
    getCeilingY(screenX, distanceLY) {
        const wx = distanceLY + (screenX / this.width) * 160;
        const env = this.getEnvelope(wx);
        if (env <= 0.001) return 0;

        const wave1 = Math.sin(wx * 0.045) * 22;
        const wave2 = Math.sin(wx * 0.11) * 12;
        const wave3 = Math.cos(wx * 0.02) * 18;
        const baseHeight = 55 + wave1 + wave2 + wave3; // 40〜100px

        return Math.max(0, env * baseHeight);
    }

    /** 画面座標 screenX における地面のY座標を取得 */
    getGroundY(screenX, distanceLY) {
        const wx = distanceLY + (screenX / this.width) * 160;
        const env = this.getEnvelope(wx);
        if (env <= 0.001) return this.height;

        const wave1 = Math.sin(wx * 0.04 + 1.2) * 24;
        const wave2 = Math.cos(wx * 0.10) * 14;
        const wave3 = Math.sin(wx * 0.025 + 2.0) * 16;
        const baseHeight = 60 + wave1 + wave2 + wave3; // 45〜110px

        return this.height - Math.max(0, env * baseHeight);
    }

    draw(ctx, distanceLY) {
        const env = this.getEnvelope(distanceLY);
        if (env <= 0.001 && this.getEnvelope(distanceLY + 160) <= 0.001) return;

        const theme = this.getTheme(distanceLY);
        const steps = 40;
        const stepWidth = this.width / steps;

        // 1. 天井地形の描画
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.width, 0);
        for (let i = steps; i >= 0; i--) {
            const x = i * stepWidth;
            const y = this.getCeilingY(x, distanceLY);
            ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (theme === 'cheese') {
            // チーズ小惑星洞窟
            const gradTop = ctx.createLinearGradient(0, 0, 0, 110);
            gradTop.addColorStop(0, '#2c3e50');
            gradTop.addColorStop(0.6, '#d35400');
            gradTop.addColorStop(1, '#f39c12');
            ctx.fillStyle = gradTop;
            ctx.fill();

            ctx.strokeStyle = '#ffeaa7';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else {
            // メカフォートレス
            const gradTop = ctx.createLinearGradient(0, 0, 0, 110);
            gradTop.addColorStop(0, '#1e272e');
            gradTop.addColorStop(0.7, '#2f3542');
            gradTop.addColorStop(1, '#57606f');
            ctx.fillStyle = gradTop;
            ctx.fill();

            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();

        // 2. 地面地形の描画
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, this.height);
        ctx.lineTo(this.width, this.height);
        for (let i = steps; i >= 0; i--) {
            const x = i * stepWidth;
            const y = this.getGroundY(x, distanceLY);
            ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (theme === 'cheese') {
            const gradBtm = ctx.createLinearGradient(0, this.height, 0, this.height - 110);
            gradBtm.addColorStop(0, '#2c3e50');
            gradBtm.addColorStop(0.6, '#d35400');
            gradBtm.addColorStop(1, '#f39c12');
            ctx.fillStyle = gradBtm;
            ctx.fill();

            ctx.strokeStyle = '#ffeaa7';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else {
            const gradBtm = ctx.createLinearGradient(0, this.height, 0, this.height - 110);
            gradBtm.addColorStop(0, '#1e272e');
            gradBtm.addColorStop(0.7, '#2f3542');
            gradBtm.addColorStop(1, '#57606f');
            ctx.fillStyle = gradBtm;
            ctx.fill();

            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 表面装飾
        if (theme === 'cheese') {
            for (let i = 2; i <= steps - 2; i += 4) {
                const x = i * stepWidth;
                const topY = this.getCeilingY(x, distanceLY);
                if (topY > 25) {
                    ctx.fillStyle = 'rgba(211, 84, 0, 0.6)';
                    ctx.beginPath();
                    ctx.ellipse(x, topY - 10, 8, 4, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                const btmY = this.getGroundY(x, distanceLY);
                if (this.height - btmY > 25) {
                    ctx.fillStyle = 'rgba(211, 84, 0, 0.6)';
                    ctx.beginPath();
                    ctx.ellipse(x, btmY + 10, 9, 5, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else {
            ctx.strokeStyle = 'rgba(0, 210, 211, 0.4)';
            ctx.lineWidth = 1.5;
            for (let i = 2; i <= steps - 2; i += 5) {
                const x = i * stepWidth;
                const topY = this.getCeilingY(x, distanceLY);
                if (topY > 30) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, topY - 6);
                    ctx.stroke();
                }
                const btmY = this.getGroundY(x, distanceLY);
                if (this.height - btmY > 30) {
                    ctx.beginPath();
                    ctx.moveTo(x, this.height);
                    ctx.lineTo(x, btmY + 6);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }
}

// --- プレイヤー戦闘機（ビックニャイパー） ---
class ShootingPlayer {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 22;
        this.speed = 5.2;
        this.tilt = 0; // 上下移動時の傾き

        // 兵装＆オプション（最大3段階、最大3機）
        this.weaponRank = 1; // 1: 通常ツインビーム, 2: 直線ロングレーザー, 3: 超極太ハイパーロングレーザー
        this.options = [];   // OptionPodの配列 (最大3)

        // 対地兵器（初期状態は未装備。切り替えキーで兵装ランク-1で解放）
        this.hasGroundWeapon = false;
        this.groundWeaponActive = false;

        // シャドウトレース用履歴キュー（各フレームの座標と傾き）
        this.history = [];
        this.maxHistory = 60;

        // 射撃クールダウン＆オーバーヒート
        this.shootTimer = 0;
        this.shootInterval = 0.13; // 連射間隔
        this.groundShootTimer = 0;
        this.groundShootInterval = 0.25; // 対地兵器最小インターバル（セミオート連打保護）
        this.shotCount = 0;        // 累積発射弾数 (0〜100)
        this.maxShots = 100;       // 100発ごとにオーバーヒート
        this.overheatTimer = 0;    // クールダウン残り秒数 (0〜3.0s)
        this.overheatDuration = 3.0; // クールダウン所要時間 (3秒)

        // ライフ＆無敵
        this.lives = 3;
        this.invincibleTimer = 0;
        this.alive = true;
        this.terrainCollidedThisFrame = false;

        // アニメーション用
        this.thrusterTimer = 0;
    }

    update(dt, input, width, height, floatingTexts = null, particles = null, terrain = null, distanceLY = 0) {
        if (!this.alive) return;

        this.thrusterTimer += dt * 25;
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }

        let moveX = 0;
        let moveY = 0;

        // 操作判定（キーボード または マウス追従）
        if (input.type === 'keyboard') {
            if (input.left) moveX -= this.speed;
            if (input.right) moveX += this.speed;
            if (input.up) moveY -= this.speed;
            if (input.down) moveY += this.speed;

            if (moveX !== 0 && moveY !== 0) {
                moveX *= 0.7071;
                moveY *= 0.7071;
            }
        } else if (input.type === 'mouse' && input.pointerActive) {
            const dx = input.targetX - this.x;
            const dy = input.targetY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
                moveX = (dx / dist) * Math.min(dist * 0.15, this.speed);
                moveY = (dy / dist) * Math.min(dist * 0.15, this.speed);
            }
        }

        this.x += moveX;
        this.y += moveY;

        // 画面左右の移動制限
        this.x = clamp(this.x, this.radius + 15, width - this.radius - 15);

        // 地形（天井・地面）との接触判定（接触時は敵弾の3倍の大ダメージ）
        let collidedTerrain = false;
        const hitMargin = this.radius * 0.75; // 精密な当たり判定マージン
        let minY = this.radius + 10;
        let maxY = height - this.radius - 10;

        if (terrain) {
            const rawCeilY = terrain.getCeilingY(this.x, distanceLY);
            const rawFloorY = terrain.getGroundY(this.x, distanceLY);

            // 天井地形（rawCeilY > 5）との接触判定
            if (rawCeilY > 5) {
                const ceilLimit = rawCeilY + hitMargin;
                if (this.y <= ceilLimit) {
                    collidedTerrain = true;
                    this.y = ceilLimit + 4; // 反発・めり込み防止
                }
                minY = Math.max(minY, ceilLimit);
            }

            // 地面地形（rawFloorY < height - 5）との接触判定
            if (rawFloorY < height - 5) {
                const floorLimit = rawFloorY - hitMargin;
                if (this.y >= floorLimit) {
                    collidedTerrain = true;
                    this.y = floorLimit - 4; // 反発・めり込み防止
                }
                maxY = Math.min(maxY, floorLimit);
            }
        }

        // 画面上下の境界内への制限
        this.y = clamp(this.y, minY, maxY);
        this.terrainCollidedThisFrame = collidedTerrain;

        // 機体の上下チルト姿勢
        const targetTilt = moveY < -0.5 ? -0.22 : (moveY > 0.5 ? 0.22 : 0);
        this.tilt += (targetTilt - this.tilt) * 0.2;

        // 座標履歴の更新（グラディウス風シャドウトレース）
        this.history.unshift({ x: this.x, y: this.y, tilt: this.tilt });
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }

        // オプション位置の更新
        this.options.forEach((opt, idx) => {
            const frameDelay = (idx + 1) * 12; // 12f, 24f, 36f 遅延
            const histPos = this.history[Math.min(frameDelay, this.history.length - 1)] || { x: this.x, y: this.y, tilt: 0 };
            opt.update(histPos.x, histPos.y, histPos.tilt);
        });

        // 射撃クールダウン
        if (this.shootTimer > 0) {
            this.shootTimer -= dt;
        }
        if (this.groundShootTimer > 0) {
            this.groundShootTimer -= dt;
        }

        // オーバーヒート（100発後の3秒間クールダウン）
        if (this.overheatTimer > 0) {
            this.overheatTimer -= dt;
            // 冷却中の蒸気スモーク微粒子
            if (particles && Math.random() < 0.25) {
                particles.push(new Particle(this.x - 14 + (Math.random() * 6 - 3), this.y - 9 + (Math.random() * 6 - 3), 'smoke', '#95a5a6'));
            }
            if (this.overheatTimer <= 0) {
                this.overheatTimer = 0;
                this.shotCount = 0;
                soundEngine.playCooldownReady();
                if (floatingTexts) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 25, '⚡ WEAPON RECHARGED!', '#00d2d3', 1.4));
                }
                if (particles) {
                    for (let i = 0; i < 12; i++) {
                        particles.push(new Particle(this.x, this.y, 'star', '#00d2d3'));
                    }
                }
            }
        }
    }

    canShoot() {
        return this.shootTimer <= 0 && this.overheatTimer <= 0 && this.alive;
    }

    triggerShoot() {
        this.shootTimer = this.shootInterval;
    }

    shoot(bullets, floatingTexts = null, particles = null) {
        if (!this.canShoot()) return;
        this.triggerShoot();
        soundEngine.playShootingLaser(this.weaponRank);

        // 発射数カウント（メインレーザー）
        this.shotCount++;

        // ランク別メイン武器（すべてまっすぐ前に飛ぶ直線レーザー）
        if (this.weaponRank === 1) {
            // Rank 1: 通常ツインビーム（2連射の平行直線弾）
            bullets.push(new ShootingBullet(this.x + 24, this.y - 5, 14, 0, 'beam', false, 1, 1));
            bullets.push(new ShootingBullet(this.x + 24, this.y + 5, 14, 0, 'beam', false, 1, 1));
        } else if (this.weaponRank === 2) {
            // Rank 2: 直線ロングレーザー（長めのシャープな直線光線がまっすぐ前へ貫通！）
            bullets.push(new ShootingBullet(this.x + 26, this.y, 17, 0, 'laser', false, 2, 2.2));
        } else if (this.weaponRank >= 3) {
            // Rank 3: 超極太ハイパーロングレーザー（さらに長く太い強力な直線光線がまっすぐ前へ貫通！）
            bullets.push(new ShootingBullet(this.x + 28, this.y, 19, 0, 'hyper_laser', false, 5, 4.0));
        }

        // オプション護衛機も同様にまっすぐ前へ射撃
        this.options.forEach(opt => {
            if (this.weaponRank === 1) {
                bullets.push(new ShootingBullet(opt.x + 16, opt.y, 14, 0, 'beam', false, 1, 1));
            } else if (this.weaponRank === 2) {
                bullets.push(new ShootingBullet(opt.x + 18, opt.y, 17, 0, 'laser', false, 2, 1.8));
            } else if (this.weaponRank >= 3) {
                bullets.push(new ShootingBullet(opt.x + 20, opt.y, 19, 0, 'hyper_laser', false, 4, 3.0));
            }
        });

        // 100発到達時に3秒間のオーバーヒート発動
        if (this.shotCount >= this.maxShots) {
            this.overheatTimer = this.overheatDuration;
            soundEngine.playOverheatWarning();
            if (floatingTexts) {
                floatingTexts.push(new FloatingText(this.x, this.y - 25, '⚠️ OVERHEAT! (3.0s)', '#e74c3c', 1.6));
            }
            if (particles) {
                for (let i = 0; i < 15; i++) {
                    particles.push(new Particle(this.x - 12, this.y - 8, 'smoke', '#e74c3c'));
                }
            }
        }
    }

    canShootGround() {
        return this.hasGroundWeapon && this.groundWeaponActive && this.groundShootTimer <= 0 && this.overheatTimer <= 0 && this.alive;
    }

    shootGround(groundMissiles) {
        if (!this.canShootGround() || !groundMissiles) return;
        this.groundShootTimer = this.groundShootInterval;
        soundEngine.playMissileLaunch();

        // 自機から上下へ発射（地面方向 + 天井方向）
        groundMissiles.push(new ShootingGroundMissile(this.x + 12, this.y + 6, 1));
        groundMissiles.push(new ShootingGroundMissile(this.x + 12, this.y - 6, -1));

        // オプション護衛機からも投下
        this.options.forEach(opt => {
            groundMissiles.push(new ShootingGroundMissile(opt.x + 8, opt.y + 4, 1));
            groundMissiles.push(new ShootingGroundMissile(opt.x + 8, opt.y - 4, -1));
        });
    }

    upgradeWeapon() {
        if (this.weaponRank < 3) {
            this.weaponRank++;
            return true;
        }
        return false;
    }

    addOption() {
        if (this.options.length < 3) {
            this.options.push(new OptionPod(this.options.length));
            return true;
        }
        return false;
    }

    /** 兵装 ➔ オプションへのトレード (Qキー) */
    tradeWeaponToOption() {
        if (this.weaponRank > 1 && this.options.length < 3) {
            this.weaponRank--;
            this.options.push(new OptionPod(this.options.length));
            soundEngine.playTradeSound();
            return true;
        }
        return false;
    }

    /** オプション ➔ 兵装へのトレード (Eキー) */
    tradeOptionToWeapon() {
        if (this.options.length > 0 && this.weaponRank < 3) {
            this.options.pop();
            this.weaponRank++;
            soundEngine.playTradeSound();
            return true;
        }
        return false;
    }

    /** 対地兵器解放・切り替え (Rキー) */
    toggleGroundWeapon() {
        if (!this.hasGroundWeapon) {
            // 初回解放：兵装ランクを1つ削る（Lv.2以上が必要）
            if (this.weaponRank > 1) {
                this.weaponRank--;
                this.hasGroundWeapon = true;
                this.groundWeaponActive = true;
                soundEngine.playMissileEquip();
                return { success: true, status: 'unlocked' };
            } else {
                soundEngine.playWallBump();
                return { success: false, reason: 'low_rank' };
            }
        } else {
            // 解放済み：ON / OFF 切り替え
            this.groundWeaponActive = !this.groundWeaponActive;
            soundEngine.playTradeSound();
            return { success: true, status: this.groundWeaponActive ? 'on' : 'off' };
        }
    }

    hit(damage = 1) {
        if (this.invincibleTimer > 0) return false;
        this.lives -= damage;
        this.invincibleTimer = 2.0; // 2秒無敵
        this.shotCount = 0;
        this.overheatTimer = 0;
        soundEngine.playShootingExplosion(damage > 1);

        if (this.lives <= 0) {
            this.lives = 0;
            this.alive = false;
        }
        return true;
    }

    draw(ctx) {
        if (!this.alive) return;

        // 無敵時点滅
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
            ctx.globalAlpha = 0.45;
        }

        // オプションを機体の下に描画
        this.options.forEach(opt => opt.draw(ctx, this.weaponRank));

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);

        // 1. 背中のミニロケット噴射炎 (Thruster Flame)
        const flameLen = 16 + Math.sin(this.thrusterTimer) * 7;
        const flameGrad = ctx.createLinearGradient(-16, -9, -16 - flameLen, -9);
        flameGrad.addColorStop(0, '#00d2d3');
        flameGrad.addColorStop(0.5, '#54a0ff');
        flameGrad.addColorStop(1, 'rgba(0, 210, 211, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-16, -14);
        ctx.lineTo(-16 - flameLen, -9);
        ctx.lineTo(-16, -4);
        ctx.closePath();
        ctx.fill();

        // 2. しっぽ (Tail - 振れるトラ柄のしっぽ)
        ctx.save();
        ctx.translate(-18, 0);
        const tailAngle = Math.sin(this.thrusterTimer * 0.25) * 0.25;
        ctx.rotate(Math.PI + 0.15 + tailAngle);
        // しっぽ本体
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(14, -10, 24, -4);
        ctx.stroke();
        // しっぽ先端の白毛
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(18, -6);
        ctx.lineTo(24, -4);
        ctx.stroke();
        // しっぽのシマ模様
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 6;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(4, -3);
        ctx.lineTo(16, -7);
        ctx.stroke();
        ctx.restore();

        // 3. 後ろ足 (Rear Legs - 後ろにピンと伸ばした飛翔ポーズ)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-16, 7, 7, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // ピンクの肉球
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.arc(-20, 8, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 4. 胴体 (Cat Body - 横から見た滑らかな楕円)
        ctx.fillStyle = '#f39c12'; // 茶トラオレンジ
        ctx.beginPath();
        ctx.ellipse(0, 1, 20, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // お腹の白毛
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(2, 5, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 背中のトラ柄模様 (Stripes)
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.ellipse(-6, -6, 2.5, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(3, -6, 2.5, 6, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // 5. 前足 (Front Paws - 前方に突き出したスーパーニャンコポーズ)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(14, 7, 8, 4.5, 0.15, 0, Math.PI * 2);
        ctx.fill();
        // 前足のピンク肉球
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.ellipse(19, 8, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 6. 背中のミニロケットパック (Backpack Thruster)
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-16, -14, 14, 10, 3);
        } else {
            ctx.rect(-16, -14, 14, 10);
        }
        ctx.fill();
        // 赤い燃料ライン
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-12, -13, 3, 8);

        // 7. 奥側の耳 (Far Ear)
        ctx.fillStyle = '#b84600';
        ctx.beginPath();
        ctx.moveTo(9, -12);
        ctx.lineTo(13, -22);
        ctx.lineTo(18, -11);
        ctx.closePath();
        ctx.fill();

        // 8. 猫の頭部 (Cat Head - 横顔)
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.ellipse(11, -3, 11, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // マズル（ふっくらした鼻口元）
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(18, -1, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // ピンクの猫鼻
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.arc(22, -2, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // 手前側の耳 (Near Ear)
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.moveTo(5, -11);
        ctx.lineTo(9, -23);
        ctx.lineTo(15, -10);
        ctx.closePath();
        ctx.fill();
        // 耳の内側のピンク
        ctx.fillStyle = '#ffb6c1';
        ctx.beginPath();
        ctx.moveTo(7, -11);
        ctx.lineTo(10, -19);
        ctx.lineTo(13, -11);
        ctx.closePath();
        ctx.fill();

        // 横顔の大きな瞳 (Cat Eye)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.ellipse(14, -4, 3, 4, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 瞳の白いハイライト（キラキラ）
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(15, -5.5, 1.4, 0, Math.PI * 2);
        ctx.arc(13.5, -2.5, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // ピンと伸びたヒゲ (Whiskers)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(18, -2);
        ctx.lineTo(26, -4);
        ctx.moveTo(18, 0);
        ctx.lineTo(27, 1);
        ctx.moveTo(17, 2);
        ctx.lineTo(25, 5);
        ctx.stroke();

        // 9. 透明な宇宙ヘルメット (Glass Space Helmet)
        ctx.save();
        ctx.fillStyle = 'rgba(72, 219, 251, 0.16)';
        ctx.strokeStyle = 'rgba(72, 219, 251, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(13, -4, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // ヘルメット首輪リング
        ctx.fillStyle = '#bdc3c7';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 10, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // ヘルメットのガラス反射（ツヤ）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(13, -4, 15, -Math.PI * 0.35, -Math.PI * 0.05);
        ctx.stroke();

        // ヘルメット頭頂部の通信アンテナ
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(13, -22);
        ctx.lineTo(13, -29);
        ctx.stroke();
        // アンテナ先端の点滅ライト
        ctx.fillStyle = Math.floor(this.thrusterTimer * 2) % 2 === 0 ? '#ff3838' : '#fffa65';
        ctx.beginPath();
        ctx.arc(13, -30, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore(); // ヘルメット終了

        ctx.restore(); // 猫本体の回転・平行移動終了

        // オーバーヒート中の頭上ステータス表示（警告＆リチャージ進捗バー）
        if (this.overheatTimer > 0) {
            const blink = Math.floor(Date.now() / 150) % 2 === 0;
            ctx.save();
            ctx.translate(this.x, this.y - this.radius - 22);

            // 警告ラベル
            ctx.fillStyle = blink ? '#e74c3c' : '#f39c12';
            ctx.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`⚠️ OVERHEAT ${this.overheatTimer.toFixed(1)}s`, 0, -6);

            // クールダウン進捗バー（3秒で満タンに回復）
            const barW = 46;
            const barH = 5;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(-barW / 2, 0, barW, barH);
            const progress = (this.overheatDuration - this.overheatTimer) / this.overheatDuration;
            ctx.fillStyle = '#00d2d3';
            ctx.fillRect(-barW / 2, 0, barW * progress, barH);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(-barW / 2, 0, barW, barH);
            ctx.restore();
        }

        ctx.globalAlpha = 1.0;
    }
}

// --- オプション護衛機（シャドウトレース） ---
class OptionPod {
    constructor(index) {
        this.index = index;
        this.x = 0;
        this.y = 0;
        this.tilt = 0;
        this.radius = 12;
        this.sparkleTimer = 0;
    }

    update(targetX, targetY, targetTilt) {
        this.x = targetX;
        this.y = targetY;
        this.tilt = targetTilt;
        this.sparkleTimer += 0.15;
    }

    draw(ctx, weaponRank) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // オレンジ/シアンの光球オーラ（グラディウス伝統カラー）
        const glowRad = this.radius * (1.2 + Math.sin(this.sparkleTimer * 3) * 0.2);
        const grad = ctx.createRadialGradient(0, 0, 3, 0, 0, glowRad);
        grad.addColorStop(0, '#ffeaa7');
        grad.addColorStop(0.5, '#e67e22');
        grad.addColorStop(1, 'rgba(230, 126, 34, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // コア（子猫型ポッドのシルエット）
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // 肉球コア
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 1, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-3, -3, 1.3, 0, Math.PI * 2);
        ctx.arc(0, -4.5, 1.3, 0, Math.PI * 2);
        ctx.arc(3, -3, 1.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- 弾丸クラス（プレイヤー＆敵） ---
class ShootingBullet {
    constructor(x, y, vx, vy, type = 'beam', isEnemy = false, pierce = 1, dmg = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type; // 'beam', 'laser', 'hyper_laser', 'enemy', 'boss_laser'
        this.isEnemy = isEnemy;
        this.alive = true;
        this.pierce = pierce; // 貫通回数
        this.damage = dmg;
        this.hitTargets = new Set(); // 貫通時に同一敵へ重複多段ヒットするのを防止

        // レーザーの長さと太さ（当たり判定半径）
        if (type === 'hyper_laser') {
            this.length = 130;
            this.radius = 8;
        } else if (type === 'laser') {
            this.length = 75;
            this.radius = 4.5;
        } else if (type === 'boss_laser') {
            this.length = 0;
            this.radius = 12;
        } else if (type === 'beam') {
            this.length = 16;
            this.radius = 3.5;
        } else {
            this.length = 0;
            this.radius = 4.5;
        }
    }

    /** 円との当たり判定（直線レーザーの場合は線分と円の最短距離で判定） */
    intersectsCircle(cx, cy, cr) {
        if (this.length > 0) {
            const closestX = clamp(cx, this.x - this.length, this.x);
            const closestY = this.y;
            return distance(cx, cy, closestX, closestY) < cr + this.radius;
        }
        return distance(cx, cy, this.x, this.y) < cr + this.radius;
    }

    update(dt) {
        this.x += this.vx * (dt * 60);
        this.y += this.vy * (dt * 60);

        // 画面外消去判定
        const backX = this.length > 0 ? this.x - this.length : this.x;
        if (backX > 960 || this.x < -80 || this.y < -60 || this.y > 660) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        if (this.isEnemy) {
            // 敵弾（チーズエナジーボール）
            ctx.fillStyle = '#f1c40f';
            ctx.shadowColor = '#e67e22';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'hyper_laser') {
            // Rank 3: 超極太ハイパーロングレーザー（直線の高エネルギー光線）
            const startX = this.x - this.length;
            const endX = this.x;

            // 1. 外側プラズマハロー
            ctx.strokeStyle = 'rgba(224, 86, 253, 0.45)';
            ctx.lineWidth = 16;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#00d2d3';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.moveTo(startX, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();

            // 2. 鮮烈なシアンの主レーザービーム
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(startX, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();

            // 3. 純白の高エネルギー中心コア
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(startX + 6, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();

            // 先端のスパークヘッド
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(endX, this.y, 6.5, 0, Math.PI * 2);
            ctx.fill();

        } else if (this.type === 'laser') {
            // Rank 2: 直線ロングレーザー（長めのシャープな直線光線）
            const startX = this.x - this.length;
            const endX = this.x;

            // 1. 青白いオーラ外殻
            ctx.strokeStyle = '#0abde3';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#48dbfb';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(startX, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();

            // 2. 白色中心ビーム
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(startX + 4, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();

            // 先端の光点
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(endX, this.y, 4, 0, Math.PI * 2);
            ctx.fill();

        } else if (this.type === 'boss_laser') {
            // ボス用大口径ビーム
            ctx.fillStyle = '#e74c3c';
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 通常ニャンコビーム (Rank 1: 平行直線ビーム弾)
            const startX = this.x - this.length;
            const endX = this.x;

            ctx.strokeStyle = '#ff9f1a';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#fffa65';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(startX, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();

            ctx.strokeStyle = '#fffa65';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(startX, this.y);
            ctx.lineTo(endX, this.y);
            ctx.stroke();
        }
        ctx.restore();
    }
}

// --- 対地兵器（上下2-Wayミサイル：斜め落下/上昇 ➔ 地形滑走） ---
class ShootingGroundMissile {
    constructor(x, y, dirY = 1) { // dirY: 1 = 地面（下）へ, -1 = 天井（上）へ
        this.x = x;
        this.y = y;
        this.dirY = dirY;
        this.state = 'dropping'; // 'dropping' (斜め落下/上昇) or 'gliding' (表面を滑走)
        this.vx = 4.4;
        this.vy = 4.8 * dirY;
        this.alive = true;
        this.damage = 2; // 対地兵器は高威力！
        this.radius = 7;
        this.lifeTime = 3.5;
        this.animTimer = 0;
    }

    update(dt, terrain, distanceLY, particles = null) {
        this.animTimer += dt * 20;
        this.lifeTime -= dt;
        if (this.lifeTime <= 0 || this.x > 940 || this.x < -30) {
            this.alive = false;
            return;
        }

        const ceilY = terrain ? terrain.getCeilingY(this.x, distanceLY) : 0;
        const groundY = terrain ? terrain.getGroundY(this.x, distanceLY) : 600;

        if (this.state === 'dropping') {
            this.x += this.vx * (dt * 60);
            this.y += this.vy * (dt * 60);

            // 地面または天井への着弾で滑走モードに移行
            if (this.dirY > 0 && this.y >= groundY - 3) {
                this.state = 'gliding';
                this.y = groundY - 3;
                if (particles) {
                    for (let p = 0; p < 4; p++) {
                        particles.push(new Particle(this.x, this.y, 'spark', '#f1c40f'));
                    }
                }
            } else if (this.dirY < 0 && this.y <= ceilY + 3) {
                this.state = 'gliding';
                this.y = ceilY + 3;
                if (particles) {
                    for (let p = 0; p < 4; p++) {
                        particles.push(new Particle(this.x, this.y, 'spark', '#f1c40f'));
                    }
                }
            }
        } else if (this.state === 'gliding') {
            // 地面・天井に沿って高速滑走！
            this.x += 6.5 * (dt * 60);
            if (this.dirY > 0) {
                this.y = groundY - 3;
                if (particles && Math.random() < 0.4) {
                    particles.push(new Particle(this.x - 4, this.y + 2, 'spark', '#e67e22'));
                }
            } else {
                this.y = ceilY + 3;
                if (particles && Math.random() < 0.4) {
                    particles.push(new Particle(this.x - 4, this.y - 2, 'spark', '#e67e22'));
                }
            }
        }
    }

    intersectsCircle(cx, cy, cr) {
        return distance(cx, cy, this.x, this.y) < cr + this.radius;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const angle = this.state === 'dropping'
            ? Math.atan2(this.vy, this.vx)
            : 0;
        ctx.rotate(angle);

        // ロケット推進炎
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.moveTo(-6, -2.5);
        ctx.lineTo(-12 - Math.sin(this.animTimer) * 4, 0);
        ctx.lineTo(-6, 2.5);
        ctx.closePath();
        ctx.fill();

        // ミサイル弾頭
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-6, 4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();

        // 先端の黄色信管
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(4, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- 宇宙ネズミ敵（ザコ編隊） ---
class ShootingEnemy {
    constructor(x, y, pattern = 'sine', isRed = false) {
        this.x = x;
        this.y = y;
        this.pattern = pattern; // 'sine', 'dive', 'straight'
        this.isRed = isRed;     // 赤色編隊リーダー（撃破でアイテムポッド確定ドロップ）
        this.alive = true;
        this.radius = 16;
        this.hp = isRed ? 2 : 1;
        this.baseY = y;
        this.time = Math.random() * 5;
        this.shootTimer = 1.0 + Math.random() * 1.5;
        this.scoreValue = isRed ? 300 : 100;
    }

    update(dt, bullets) {
        this.time += dt * 3;

        // 飛行パターン計算
        if (this.pattern === 'sine') {
            this.x -= 3.6 * (dt * 60);
            this.y = this.baseY + Math.sin(this.time) * 45;
        } else if (this.pattern === 'dive') {
            this.x -= 4.2 * (dt * 60);
            if (this.x < 550 && this.x > 350) {
                this.y += 3.2 * (dt * 60);
            }
        } else {
            this.x -= 4.0 * (dt * 60);
        }

        // 赤色ネズミは時折弾を撃つ
        if (bullets && this.isRed) {
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && this.x > 100) {
                this.shootTimer = 1.8 + Math.random() * 1.5;
                bullets.push(new ShootingBullet(this.x - 12, this.y, -4.8, 0, 'enemy', true, 1, 1));
            }
        }

        // 画面外で消去
        if (this.x < -this.radius - 20) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 赤ネズミのフラッシュ
        const bodyColor = this.isRed ? '#e74c3c' : '#7f8c8d';

        // ジェット噴射
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(this.radius * 0.7, -4);
        ctx.lineTo(this.radius + 8, 0);
        ctx.lineTo(this.radius * 0.7, 4);
        ctx.closePath();
        ctx.fill();

        // 宇宙スーツネズミの胴体
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // 耳（宇宙ヘルメットの上）
        ctx.fillStyle = this.isRed ? '#c0392b' : '#95a5a6';
        ctx.beginPath();
        ctx.arc(-2, -this.radius * 0.8, 6, 0, Math.PI * 2);
        ctx.arc(-2, this.radius * 0.8, 6, 0, Math.PI * 2);
        ctx.fill();

        // ヘルメットシールド
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.35, 0, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 赤い目
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.45, -2, 1.8, 0, Math.PI * 2);
        ctx.arc(-this.radius * 0.45, 2, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- 地面・天井を這う敵（ダッカー風メカネズミ） ---
class ShootingCrawler {
    constructor(x, isCeiling = false, isRed = false) {
        this.x = x;
        this.isCeiling = isCeiling; // true: 天井を這う, false: 地面を這う
        this.isRed = isRed;         // 赤色（撃破でアイテム確定ドロップ）
        this.radius = 15;
        this.hp = isRed ? 3 : 2;
        this.scoreValue = isRed ? 500 : 250;
        this.alive = true;
        this.speed = 2.4;
        this.shootTimer = 1.2 + Math.random() * 1.5;
        this.animTimer = 0;
        this.tilt = 0;
        this.y = 0;
    }

    update(dt, terrain, distanceLY, bullets) {
        this.animTimer += dt * 15;
        this.x -= this.speed * (dt * 60);

        // 地形追従Y座標と傾きの計算
        const curY = this.isCeiling ? terrain.getCeilingY(this.x, distanceLY) : terrain.getGroundY(this.x, distanceLY);
        const nextY = this.isCeiling ? terrain.getCeilingY(this.x - 8, distanceLY) : terrain.getGroundY(this.x - 8, distanceLY);

        this.y = this.isCeiling ? curY + this.radius - 2 : curY - this.radius + 2;
        this.tilt = Math.atan2(nextY - curY, -8);

        // 射撃動作
        if (bullets) {
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && this.x > 80 && this.x < 780) {
                this.shootTimer = 2.4 + Math.random() * 1.6;
                if (this.isCeiling) {
                    // 天井：斜め下に向けて投下弾
                    bullets.push(new ShootingBullet(this.x, this.y + 10, -2.5, 3.8, 'enemy', true, 1, 1));
                } else {
                    // 地面：斜め上に向けて対空弾
                    bullets.push(new ShootingBullet(this.x, this.y - 10, -2.5, -3.8, 'enemy', true, 1, 1));
                }
            }
        }

        // 画面外で消去
        if (this.x < -40) {
            this.alive = false;
        }
    }

    intersectsCircle(cx, cy, cr) {
        return distance(cx, cy, this.x, this.y) < cr + this.radius;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);
        if (this.isCeiling) {
            ctx.scale(1, -1); // 天井の場合は上下反転
        }

        const color = this.isRed ? '#e74c3c' : '#34495e';
        const trimColor = this.isRed ? '#c0392b' : '#2c3e50';

        // 1. キャタピラ・車輪（足元）
        ctx.fillStyle = '#1e272e';
        if (ctx.roundRect) {
            ctx.roundRect(-14, 5, 28, 9, 3);
        } else {
            ctx.fillRect(-14, 5, 28, 9);
        }
        ctx.fill();

        // 車輪の回転
        const wheelShift = Math.floor(this.animTimer) % 6;
        ctx.fillStyle = '#7f8c8d';
        for (let w = -10; w <= 10; w += 7) {
            ctx.beginPath();
            ctx.arc(w + (wheelShift - 3) * 0.5, 9.5, 2.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. メカネズミ本体ボディ
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = trimColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. 背中の対空キャノン砲塔
        ctx.save();
        ctx.translate(-2, -6);
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-7, -8);
        ctx.stroke();
        ctx.restore();

        // 4. 赤いバイザー目（索敵センサー）
        ctx.fillStyle = this.isRed ? '#f1c40f' : '#e74c3c';
        ctx.shadowColor = this.isRed ? '#f1c40f' : '#e74c3c';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(-8, -1, 3, 0, Math.PI * 2);
        ctx.fill();

        // 5. アンテナ
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(4, -7);
        ctx.lineTo(8, -13);
        ctx.stroke();
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.arc(8, -13, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- アイテムポッド（肉球パワーカプセル） ---
class ItemPod {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.alive = true;
        this.animTimer = 0;
    }

    update(dt) {
        this.x -= 1.8 * (dt * 60); // ゆっくり左に流れる
        this.animTimer += dt * 5;
        this.y += Math.sin(this.animTimer) * 0.6;

        if (this.x < -30) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // キラキラオーラ
        const glowRad = this.radius * (1.3 + Math.sin(this.animTimer * 2) * 0.2);
        const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowRad);
        grad.addColorStop(0, '#f1c40f');
        grad.addColorStop(0.6, '#e67e22');
        grad.addColorStop(1, 'rgba(241, 196, 15, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // カプセル外殻
        ctx.fillStyle = '#f39c12';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 中央の肉球スタンプ
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 1.5, 4.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-3.5, -3, 1.5, 0, Math.PI * 2);
        ctx.arc(0, -4.5, 1.5, 0, Math.PI * 2);
        ctx.arc(3.5, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- ボスキャラクター（巨大メカネズミ / 巨大宇宙カエル） ---
class ShootingBoss {
    constructor(bossType = 'mouse', width, height) {
        this.type = bossType; // 'mouse' or 'frog'
        this.width = width;
        this.height = height;

        this.x = width + 120; // 画面右外から進入
        this.targetX = width - 180;
        this.y = height / 2;

        this.radius = bossType === 'mouse' ? 70 : 65;
        this.maxHp = bossType === 'mouse' ? 140 : 180;
        this.hp = this.maxHp;
        this.points = bossType === 'mouse' ? 10000 : 15000;
        this.alive = true;
        this.isEntering = true;

        this.time = 0;
        this.attackTimer = 2.0;
        this.phase = 0;

        // カエルの舌攻撃用
        this.tongueState = 'idle'; // 'idle', 'extending', 'retracting'
        this.tongueLength = 0;
        this.tongueTargetY = this.y;
    }

    update(dt, player, bullets) {
        if (!this.alive) return;

        this.time += dt;

        // 登場進入
        if (this.isEntering) {
            this.x -= 2.0 * (dt * 60);
            if (this.x <= this.targetX) {
                this.x = this.targetX;
                this.isEntering = false;
            }
            return;
        }

        // 上下浮遊運動
        this.y = (this.height / 2) + Math.sin(this.time * 1.5) * 140;

        // 攻撃ルーチン
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.executeAttack(player, bullets);
            this.attackTimer = 1.8 + Math.random() * 1.2;
        }

        // カエルの舌更新
        if (this.type === 'frog') {
            if (this.tongueState === 'extending') {
                this.tongueLength += 38 * (dt * 60);
                if (this.tongueLength >= this.x - 40) {
                    this.tongueState = 'retracting';
                }
            } else if (this.tongueState === 'retracting') {
                this.tongueLength -= 32 * (dt * 60);
                if (this.tongueLength <= 0) {
                    this.tongueLength = 0;
                    this.tongueState = 'idle';
                }
            }
        }
    }

    executeAttack(player, bullets) {
        if (this.type === 'mouse') {
            // メカネズミ：前方チーズビーム斉射 + ヒゲスプレッド
            const count = 5;
            for (let i = 0; i < count; i++) {
                const angle = Math.PI - 0.35 + (i * 0.17);
                const spd = 4.8;
                bullets.push(new ShootingBullet(
                    this.x - 60, this.y - 15 + (i * 8),
                    Math.cos(angle) * spd, Math.sin(angle) * spd,
                    'boss_laser', true, 1, 1
                ));
            }
        } else {
            // 宇宙カエル：ロケット舌伸ばし または 誘導オタマジャクシ弾
            if (Math.random() < 0.45 && this.tongueState === 'idle') {
                // 舌伸ばし突進！
                this.tongueState = 'extending';
                this.tongueTargetY = player.y;
            } else {
                // ケロケロ弾幕（全方位リング）
                const count = 8;
                for (let i = 0; i < count; i++) {
                    const angle = (Math.PI * 2 / count) * i + this.time;
                    bullets.push(new ShootingBullet(
                        this.x - 40, this.y,
                        Math.cos(angle) * 4.0, Math.sin(angle) * 4.0,
                        'enemy', true, 1, 1
                    ));
                }
            }
        }
    }

    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
            soundEngine.playShootingExplosion(true);
            return true; // 撃破
        }
        return false;
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'mouse') {
            // --- 宇宙戦艦メカネズミ ---
            // 巨大ブースター噴射炎
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(60, -25);
            ctx.lineTo(110 + Math.sin(this.time * 20) * 15, 0);
            ctx.lineTo(60, 25);
            ctx.closePath();
            ctx.fill();

            // 主船体（装甲板）
            ctx.fillStyle = '#34495e';
            ctx.strokeStyle = '#e67e22';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, 0, 75, 48, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // チーズ装甲キャノン（上下）
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(-65, -38, 45, 12);
            ctx.fillRect(-65, 26, 45, 12);

            // メカ耳
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(20, -50, 24, 0, Math.PI * 2);
            ctx.arc(20, 50, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 回転コア（グラディウス風ビッグコア・シールド）
            ctx.save();
            ctx.rotate(this.time * 2);
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 26, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 赤いコア中心球
            ctx.fillStyle = '#e74c3c';
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();

            // メカ目
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(-35, -12, 6, 0, Math.PI * 2);
            ctx.arc(-35, 12, 6, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // --- 巨大宇宙カエル（ケロケロス） ---
            // カエルの舌（伸びている場合）
            if (this.tongueLength > 0) {
                ctx.save();
                ctx.strokeStyle = '#ff7675';
                ctx.lineWidth = 14;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-this.radius * 0.8, 0);
                ctx.lineTo(-this.tongueLength, (this.tongueTargetY - this.y) * 0.5);
                ctx.stroke();

                // 舌先の吸盤
                ctx.fillStyle = '#d63031';
                ctx.beginPath();
                ctx.arc(-this.tongueLength, (this.tongueTargetY - this.y) * 0.5, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // カエル体（緑とネオンシアン）
            ctx.fillStyle = '#27ae60';
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, 0, 68, 52, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // お腹の白斑点
            ctx.fillStyle = '#abebc6';
            ctx.beginPath();
            ctx.ellipse(-15, 0, 32, 28, 0, 0, Math.PI * 2);
            ctx.fill();

            // 巨大目玉（左右）
            ctx.fillStyle = '#f1c40f';
            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(-22, -42, 20, 0, Math.PI * 2);
            ctx.arc(-22, 42, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 瞳（縦スリット）
            ctx.fillStyle = '#1e272e';
            ctx.beginPath();
            ctx.ellipse(-24, -42, 4, 12, 0, 0, Math.PI * 2);
            ctx.ellipse(-24, 42, 4, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // 口のライン
            ctx.strokeStyle = '#1e272e';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(-35, 0, 24, -Math.PI * 0.4, Math.PI * 0.4);
            ctx.stroke();
        }

        // ボスHPバー（上部に表示）
        ctx.restore();
        ctx.save();
        const barWidth = 240;
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(this.width / 2 - barWidth / 2, 20, barWidth, 12);
        ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : (hpPct > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillRect(this.width / 2 - barWidth / 2 + 2, 22, (barWidth - 4) * hpPct, 8);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS: ${this.type === 'mouse' ? 'メカデカチュウ戦艦' : '巨大宇宙カエル ケロケロス'}`, this.width / 2, 16);
        ctx.restore();
    }
}
