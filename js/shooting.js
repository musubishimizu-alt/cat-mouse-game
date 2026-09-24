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

// --- プレイヤー戦闘機（ビックニャイパー） ---
class ShootingPlayer {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 22;
        this.speed = 5.2;
        this.tilt = 0; // 上下移動時の傾き

        // 兵装＆オプション（最大3段階、最大3機）
        this.weaponRank = 1; // 1: 通常ビーム, 2: 3WAYワイドレーザー, 3: ハイパーニャン波＆対地魚雷
        this.options = [];   // OptionPodの配列 (最大3)

        // シャドウトレース用履歴キュー（各フレームの座標と傾き）
        this.history = [];
        this.maxHistory = 60;

        // 射撃クールダウン
        this.shootTimer = 0;
        this.shootInterval = 0.13; // 連射間隔

        // ライフ＆無敵
        this.lives = 3;
        this.invincibleTimer = 0;
        this.alive = true;

        // アニメーション用
        this.thrusterTimer = 0;
    }

    update(dt, input, width, height) {
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

        // 画面内移動制限
        this.x = clamp(this.x, this.radius + 15, width - this.radius - 15);
        this.y = clamp(this.y, this.radius + 15, height - this.radius - 15);

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
    }

    canShoot() {
        return this.shootTimer <= 0 && this.alive;
    }

    triggerShoot() {
        this.shootTimer = this.shootInterval;
    }

    shoot(bullets) {
        if (!this.canShoot()) return;
        this.triggerShoot();
        soundEngine.playShootingLaser(this.weaponRank);

        // ランク別メイン武器
        if (this.weaponRank === 1) {
            // 通常ビーム (2連射)
            bullets.push(new ShootingBullet(this.x + 20, this.y - 6, 13, 0, 'beam', false, 1, 1));
            bullets.push(new ShootingBullet(this.x + 20, this.y + 6, 13, 0, 'beam', false, 1, 1));
        } else if (this.weaponRank === 2) {
            // 3WAYワイドレーザー
            bullets.push(new ShootingBullet(this.x + 22, this.y, 14, 0, 'wide', false, 1, 1.8));
            bullets.push(new ShootingBullet(this.x + 20, this.y - 8, 13.5, -3.2, 'wide', false, 1, 1.5));
            bullets.push(new ShootingBullet(this.x + 20, this.y + 8, 13.5, 3.2, 'wide', false, 1, 1.5));
        } else if (this.weaponRank >= 3) {
            // ハイパーニャン波（貫通リップルレーザー） + 対地ミサイル
            bullets.push(new ShootingBullet(this.x + 24, this.y, 11, 0, 'ripple', false, 4, 2.5));
            bullets.push(new ShootingBullet(this.x + 12, this.y + 12, 7, 4.2, 'torpedo', false, 1, 2.0));
            bullets.push(new ShootingBullet(this.x + 12, this.y - 12, 7, -4.2, 'torpedo', false, 1, 2.0));
        }

        // オプション護衛機の同時斉射
        this.options.forEach(opt => {
            if (this.weaponRank === 1) {
                bullets.push(new ShootingBullet(opt.x + 14, opt.y, 13, 0, 'beam', false, 1, 1));
            } else if (this.weaponRank === 2) {
                bullets.push(new ShootingBullet(opt.x + 16, opt.y, 14, 0, 'wide', false, 1, 1.5));
                bullets.push(new ShootingBullet(opt.x + 14, opt.y - 6, 13, -3.0, 'wide', false, 1, 1.2));
                bullets.push(new ShootingBullet(opt.x + 14, opt.y + 6, 13, 3.0, 'wide', false, 1, 1.2));
            } else if (this.weaponRank >= 3) {
                bullets.push(new ShootingBullet(opt.x + 16, opt.y, 11, 0, 'ripple', false, 3, 2.0));
            }
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

    hit() {
        if (this.invincibleTimer > 0) return false;
        this.lives--;
        this.invincibleTimer = 2.0; // 2秒無敵
        soundEngine.playShootingExplosion(false);

        if (this.lives <= 0) {
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

        // バーニア噴射炎
        const flameLength = 16 + Math.sin(this.thrusterTimer) * 7;
        const flameGrad = ctx.createLinearGradient(-this.radius, 0, -this.radius - flameLength, 0);
        flameGrad.addColorStop(0, '#00d2d3');
        flameGrad.addColorStop(0.5, '#54a0ff');
        flameGrad.addColorStop(1, 'rgba(92, 107, 192, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.8, -7);
        ctx.lineTo(-this.radius - flameLength, 0);
        ctx.lineTo(-this.radius * 0.8, 7);
        ctx.closePath();
        ctx.fill();

        // 機体本体（ビックニャイパー）
        // 主翼（上下）
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(2, -10);
        ctx.lineTo(-14, -24);
        ctx.lineTo(-8, -8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(2, 10);
        ctx.lineTo(-14, 24);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();

        // 翼端のレーザー砲身
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-14, -26, 8, 3);
        ctx.fillRect(-14, 23, 8, 3);

        // 胴体（白とオレンジの戦闘機）
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 1.1, this.radius * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // 猫ストライプ
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.ellipse(-6, 0, 5, this.radius * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();

        // 機首ノーズコーン（ピンクの猫鼻）
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.arc(this.radius * 0.95, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // キャノピー（透明バイザー）
        ctx.fillStyle = 'rgba(72, 219, 251, 0.75)';
        ctx.strokeStyle = '#0abde3';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(6, 0, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // キャノピー内の猫パイロットの目
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(8, -2.5, 1.8, 0, Math.PI * 2);
        ctx.arc(8, 2.5, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 猫耳（宇宙ヘルメットの上から突き出たアンテナ風）
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.moveTo(-2, -10);
        ctx.lineTo(6, -20);
        ctx.lineTo(-8, -12);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-2, 10);
        ctx.lineTo(6, 20);
        ctx.lineTo(-8, 12);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
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
        this.type = type; // 'beam', 'wide', 'ripple', 'torpedo', 'enemy', 'boss_laser'
        this.isEnemy = isEnemy;
        this.alive = true;
        this.pierce = pierce; // 貫通回数
        this.damage = dmg;

        // リップルレーザー用の拡大設定
        this.radius = type === 'ripple' ? 8 : (type === 'boss_laser' ? 14 : 4);
        this.maxRadius = type === 'ripple' ? 38 : this.radius;
        this.growthRate = type === 'ripple' ? 38 : 0;
    }

    update(dt) {
        this.x += this.vx * (dt * 60);
        this.y += this.vy * (dt * 60);

        if (this.growthRate > 0 && this.radius < this.maxRadius) {
            this.radius += this.growthRate * dt;
        }

        // 画面外判定
        if (this.x < -60 || this.x > 960 || this.y < -60 || this.y > 660) {
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
            ctx.arc(this.x, this.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'ripple') {
            // ハイパーニャン波リップルレーザー（広がるリング）
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 3.5;
            ctx.shadowColor = '#54a0ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius * 0.7, this.radius, 0, 0, Math.PI * 2);
            ctx.stroke();

            // 内部の薄いリング
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius * 0.5, this.radius * 0.75, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'wide') {
            // 3WAYレーザー（青白く伸びる光弾）
            ctx.fillStyle = '#48dbfb';
            ctx.shadowColor = '#0abde3';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, 14, 4, Math.atan2(this.vy, this.vx), 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'torpedo') {
            // 対地爪ミサイル
            ctx.fillStyle = '#ff9f43';
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, 8, 4, Math.atan2(this.vy, this.vx), 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 通常ニャンコビーム (Rank 1)
            ctx.fillStyle = '#fffa65';
            ctx.shadowColor = '#ff9f1a';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, 11, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
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
