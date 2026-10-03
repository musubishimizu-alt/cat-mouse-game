/**
 * nyakaimura.js - 魔界村風横スクロールアクションモード『ニャ界村』
 * 
 * 墓場の風景の中、鎧を着た猫の騎士が、地面から湧き出るゾンビネズミ、
 * 木に止まるカラス、そしてレッドアリーマーのように急降下・低空突進・急上昇で翻弄する
 * 赤いコウモリネズミを相手に、3種の武器（槍・短剣・松明）を駆使して戦うスコアアタック。
 */

// --- 武器クラス (NyakaiWeapon) ---
class NyakaiWeapon {
    /**
     * @param {number} x 初期X
     * @param {number} y 初期Y
     * @param {string} type 'spear' | 'dagger' | 'torch'
     * @param {number} facing 1 (右向き) または -1 (左向き)
     */
    constructor(x, y, type, facing) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.facing = facing; // 1 or -1
        this.alive = true;
        this.state = 'flying'; // 'flying' or 'burning' (torchのみ)
        this.burnTimer = 0;
        this.burnDuration = 2.0; // 地面火炎持続秒数 (2秒)
        this.hitTargets = new Set(); // 貫通・多段ヒット制御

        if (type === 'spear') {
            // 槍：通常兵装。威力2 / 連射2 / 直進
            this.damage = 2;
            this.vx = 550 * facing;
            this.vy = 0;
            this.radius = 9;
            this.length = 34;
        } else if (type === 'dagger') {
            // 短剣：高速で飛んでいく短い武器。威力1 / 連射3 / 超高速直進
            this.damage = 1;
            this.vx = 820 * facing;
            this.vy = 0;
            this.radius = 7;
            this.length = 20;
        } else if (type === 'torch') {
            // 松明：短い放物線を描いて落下。威力3 / 連射1 / 地面着弾で火炎ゾーン2秒生成
            this.damage = 3;
            this.vx = 340 * facing;
            this.vy = -360;
            this.radius = 10;
            this.gravity = 920;
            this.rotation = 0;
        }
    }

    update(dt, groundY, particles) {
        if (!this.alive) return;

        if (this.state === 'burning') {
            this.burnTimer -= dt;
            if (this.burnTimer <= 0) {
                this.alive = false;
                return;
            }
            // 燃焼中の火炎パーティクル
            if (particles && Math.random() < 0.6) {
                const px = this.x + (Math.random() - 0.5) * 36;
                const py = this.y - Math.random() * 25;
                const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#3498db'];
                particles.push(new Particle(px, py, 'spark', colors[Math.floor(Math.random() * colors.length)]));
            }
            return;
        }

        // 飛行中
        if (this.type === 'torch') {
            this.vy += this.gravity * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.rotation += this.facing * 12 * dt;

            // 地面着弾判定
            if (this.y >= groundY - 6) {
                this.y = groundY - 4;
                this.vx = 0;
                this.vy = 0;
                this.state = 'burning';
                this.burnTimer = this.burnDuration;
                if (typeof soundEngine !== 'undefined') soundEngine.playThrowTorch();
                // 着火時爆発パーティクル
                if (particles) {
                    for (let i = 0; i < 14; i++) {
                        particles.push(new Particle(this.x, this.y, 'spark', Math.random() < 0.5 ? '#e74c3c' : '#f1c40f'));
                    }
                }
            }
        } else {
            // 槍・短剣は等速直進
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }

        // 松明飛行中の火の粉
        if (this.type === 'torch' && particles && Math.random() < 0.4) {
            particles.push(new Particle(this.x, this.y, 'spark', '#f39c12'));
        }
    }

    igniteAt(x, y, particles) {
        if (this.type === 'torch' && this.state !== 'burning') {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.state = 'burning';
            this.burnTimer = this.burnDuration;
            if (typeof soundEngine !== 'undefined') soundEngine.playThrowTorch();
            if (particles) {
                for (let i = 0; i < 12; i++) {
                    particles.push(new Particle(this.x, this.y, 'spark', '#e67e22'));
                }
            }
        }
    }

    draw(ctx, cameraX) {
        const renderX = this.x - cameraX;
        const renderY = this.y;

        ctx.save();
        ctx.translate(renderX, renderY);

        if (this.state === 'burning') {
            // 2秒間の火炎ダメージゾーンの描画（激しく揺らめく炎の柱）
            const pulse = Math.sin(Date.now() * 0.02) * 4;
            const grad = ctx.createRadialGradient(0, -15, 4, 0, -10, 30);
            grad.addColorStop(0, 'rgba(255, 242, 0, 0.95)');
            grad.addColorStop(0.3, 'rgba(255, 107, 107, 0.85)');
            grad.addColorStop(0.7, 'rgba(235, 77, 75, 0.6)');
            grad.addColorStop(1, 'rgba(235, 77, 75, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, -12, 28 + pulse, 32 + pulse, 0, 0, Math.PI * 2);
            ctx.fill();

            // 内部の高温の核
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, -5, 10, 16 + pulse * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // 飛行中の武器描画
        if (this.type === 'spear') {
            // 槍：木製シャフト＋鋭利な銀の穂先
            ctx.scale(this.facing, 1);
            // シャフト
            ctx.strokeStyle = '#8c502b';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-this.length / 2, 0);
            ctx.lineTo(this.length / 2 - 8, 0);
            ctx.stroke();

            // 穂先（銀の鋭角ブレード）
            ctx.fillStyle = '#dfe6e9';
            ctx.strokeStyle = '#b2bec3';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.length / 2 - 8, -5);
            ctx.lineTo(this.length / 2 + 6, 0);
            ctx.lineTo(this.length / 2 - 8, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 金の留め具
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(this.length / 2 - 10, -4, 3, 8);
        } else if (this.type === 'dagger') {
            // 短剣：鋭いシルバーナイフ、高速の閃光光輪
            ctx.scale(this.facing, 1);
            // 柄
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-10, -2, 6, 4);
            ctx.fillStyle = '#f1c40f'; // 鍔
            ctx.fillRect(-4, -5, 3, 10);
            // 刃
            ctx.fillStyle = '#f5f6fa';
            ctx.strokeStyle = '#00a8ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-1, -3);
            ctx.lineTo(12, 0);
            ctx.lineTo(-1, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'torch') {
            // 松明：回転しながら火の粉を散らすトーチ
            ctx.rotate(this.rotation);
            // 柄の木
            ctx.fillStyle = '#795548';
            ctx.fillRect(-5, -3, 20, 6);
            // 松明の頭部（布巻き）
            ctx.fillStyle = '#424242';
            ctx.fillRect(10, -5, 9, 10);
            // 炎
            ctx.fillStyle = '#ff7675';
            ctx.beginPath();
            ctx.arc(17, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffeaa7';
            ctx.beginPath();
            ctx.arc(16, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// --- 猫の騎士 (KnightCat / アーサー風猫ちゃん) ---
class KnightCat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 36;
        this.height = 48;
        this.facing = 1; // 1: 右, -1: 左
        this.isGrounded = false;
        this.isCrouching = false;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;

        // 魔界村伝統の鎧システム：
        // hasArmor = true (白銀の鎧) ➔ 被弾でガシャン！粉砕 ➔ hasArmor = false (イチゴトランクス姿) ➔ 被弾で力尽きる
        this.hasArmor = true;
        this.invincibleTimer = 0; // 被弾後の無敵点滅秒数
        this.alive = true;

        // 武器
        this.weapon = 'spear'; // 初期武器は必ず「槍」
        this.walkCycle = 0;
    }

    update(dt, input, groundY, weapons, particles, floatingTexts) {
        if (!this.alive) return;

        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }

        // 入力処理：しゃがみ判定
        this.isCrouching = input.down && this.isGrounded;

        // 左右移動（しゃがみ中は移動不可）
        const speed = 210;
        if (!this.isCrouching) {
            if (input.left) {
                this.vx = -speed;
                this.facing = -1;
                this.walkCycle += dt * 10;
            } else if (input.right) {
                this.vx = speed;
                this.facing = 1;
                this.walkCycle += dt * 10;
            } else {
                this.vx = 0;
                this.walkCycle = 0;
            }
        } else {
            this.vx = 0;
        }

        // ジャンプ（Space or W or Up、接地中のみ）
        if ((input.up || input.jumpRequested) && this.isGrounded && !this.isCrouching) {
            input.jumpRequested = false;
            this.vy = -560; // 快適で爽快な跳躍力
            this.isGrounded = false;
            if (typeof soundEngine !== 'undefined') soundEngine.playKnightJump();
            if (particles) {
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(this.x, this.y + this.height / 2, 'dust', '#95a5a6'));
                }
            }
        }

        // 重力適用
        const gravity = 1200;
        this.vy += gravity * dt;

        // 位置更新
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 地面接地判定
        const targetGround = groundY - this.height / 2;
        if (this.y >= targetGround) {
            this.y = targetGround;
            this.vy = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        // 攻撃判定（Space / クリック / attackRequested）
        if (input.attackRequested && this.attackCooldown <= 0) {
            input.attackRequested = false;
            this.throwWeapon(weapons, particles, floatingTexts);
        }
    }

    throwWeapon(weapons, particles, floatingTexts) {
        // 連射数制限の確認
        // spear: 最大2本, dagger: 最大3本, torch: 最大1本(火炎含む)
        const activeCount = weapons.filter(w => w.alive && w.type === this.weapon).length;
        let maxLimit = 2;
        if (this.weapon === 'spear') maxLimit = 2;
        else if (this.weapon === 'dagger') maxLimit = 3;
        else if (this.weapon === 'torch') maxLimit = 1;

        if (activeCount >= maxLimit) {
            // 連射数オーバー
            return;
        }

        this.isAttacking = true;
        this.attackTimer = 0.22;

        // 攻撃クールダウン設定（短剣は連射3なので極小）
        if (this.weapon === 'dagger') {
            this.attackCooldown = 0.14;
            if (typeof soundEngine !== 'undefined') soundEngine.playThrowDagger();
        } else if (this.weapon === 'torch') {
            this.attackCooldown = 0.42;
            if (typeof soundEngine !== 'undefined') soundEngine.playThrowTorch();
        } else {
            this.attackCooldown = 0.25;
            if (typeof soundEngine !== 'undefined') soundEngine.playThrowSpear();
        }

        // 発射位置（しゃがみ時は低位置）
        const spawnX = this.x + this.facing * 18;
        const spawnY = this.isCrouching ? (this.y + 6) : (this.y - 8);

        weapons.push(new NyakaiWeapon(spawnX, spawnY, this.weapon, this.facing));
    }

    hit(particles, floatingTexts) {
        if (this.invincibleTimer > 0 || !this.alive) return false;

        if (this.hasArmor) {
            // 鎧破壊！ガシャンッ！イチゴトランクス姿になる
            this.hasArmor = false;
            this.invincibleTimer = 2.0; // 2秒無敵
            if (typeof soundEngine !== 'undefined') soundEngine.playArmorBreak();

            floatingTexts.push(new FloatingText(this.x, this.y - 30, '💥 ARMOR BROKEN!', '#ff4757', 1.8));

            // 金属片の粉砕パーティクル
            if (particles) {
                for (let i = 0; i < 22; i++) {
                    particles.push(new Particle(
                        this.x + (Math.random() - 0.5) * 30,
                        this.y + (Math.random() - 0.5) * 30,
                        'spark', '#bdc3c7'
                    ));
                }
            }
            return false;
        } else {
            // イチゴパンツ状態で被弾 ➔ 倒れる
            this.alive = false;
            if (typeof soundEngine !== 'undefined') soundEngine.playGameOver();
            floatingTexts.push(new FloatingText(this.x, this.y - 30, '💀 GAME OVER', '#ff4757', 2.0));
            if (particles) {
                for (let i = 0; i < 25; i++) {
                    particles.push(new Particle(this.x, this.y, 'star', '#ffffff'));
                }
            }
            return true;
        }
    }

    restoreArmor(floatingTexts, particles) {
        if (!this.hasArmor) {
            this.hasArmor = true;
            if (typeof soundEngine !== 'undefined') soundEngine.playArmorEquip();
            floatingTexts.push(new FloatingText(this.x, this.y - 30, '🛡️ ARMOR RESTORED!', '#f1c40f', 1.8));
            if (particles) {
                for (let i = 0; i < 16; i++) {
                    particles.push(new Particle(this.x, this.y, 'star', '#f1c40f'));
                }
            }
        }
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;

        // 無敵時間中の点滅表示
        if (this.invincibleTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
            return;
        }

        const renderX = this.x - cameraX;
        const renderY = this.isCrouching ? (this.y + 10) : this.y;

        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.scale(this.facing, 1);

        // --- 猫騎士 / パンツ猫のドット絵風ベクター描画 ---
        const bob = this.isGrounded ? Math.sin(this.walkCycle) * 2 : -3;

        // しっぽ
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, 10 + bob);
        ctx.quadraticCurveTo(-22, 6 + Math.sin(Date.now() * 0.008) * 6, -18, -2);
        ctx.stroke();

        if (this.hasArmor) {
            // 赤いマント
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.moveTo(-8, -4 + bob);
            ctx.lineTo(-20 + (this.vx !== 0 ? -this.facing * 8 : 0), 18 + bob);
            ctx.lineTo(-4, 16 + bob);
            ctx.closePath();
            ctx.fill();

            // 銀の猫甲冑（胴体）
            ctx.fillStyle = '#bdc3c7';
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(-10, -6 + bob, 20, 22, 5);
            ctx.fill();
            ctx.stroke();

            // 甲冑の金縁・リベット
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(-7, 2 + bob, 14, 3);
            ctx.beginPath();
            ctx.arc(0, -1 + bob, 3, 0, Math.PI * 2);
            ctx.fill();

            // 兜（白銀のナイトヘルメット）
            ctx.fillStyle = '#ecf0f1';
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, -16 + bob, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 猫耳用の角ばった兜突起
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.moveTo(-11, -26 + bob);
            ctx.lineTo(-5, -16 + bob);
            ctx.lineTo(-14, -14 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(11, -26 + bob);
            ctx.lineTo(5, -16 + bob);
            ctx.lineTo(14, -14 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // バイザー（目元スリット）とキラリと光る猫の瞳
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-8, -17 + bob, 16, 5);
            ctx.fillStyle = '#2ecc71'; // 緑の猫目
            ctx.fillRect(2, -16 + bob, 3, 3);

            // 兜の真紅の羽飾り（プルーム）
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(-3, -28 + bob);
            ctx.quadraticCurveTo(-14, -36 + bob, -8, -24 + bob);
            ctx.lineTo(0, -26 + bob);
            ctx.closePath();
            ctx.fill();

            // 脚・グリーブ
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(-7, 16 + bob, 5, 8);
            ctx.fillRect(2, 16 + bob, 5, 8);
        } else {
            // --- イチゴトランクス姿の猫ちゃん（鎧破壊後） ---
            // 猫の生身の体（ふんわり白猫）
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, 4 + bob, 11, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            // イチゴ柄のトランクス（ピンク地に赤いイチゴのドット）
            ctx.fillStyle = '#ff7675';
            ctx.beginPath();
            ctx.roundRect(-10, 6 + bob, 20, 12, 3);
            ctx.fill();
            // イチゴの模様
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-5, 10 + bob, 1.5, 0, Math.PI * 2);
            ctx.arc(3, 11 + bob, 1.5, 0, Math.PI * 2);
            ctx.arc(-1, 14 + bob, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2ecc71'; // ヘタ
            ctx.fillRect(-5.5, 8 + bob, 1, 1);
            ctx.fillRect(2.5, 9 + bob, 1, 1);

            // 猫の生頭
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, -14 + bob, 12, 0, Math.PI * 2);
            ctx.fill();

            // ピンクの猫耳
            ctx.fillStyle = '#ffb8b8';
            ctx.beginPath();
            ctx.moveTo(-9, -24 + bob);
            ctx.lineTo(-3, -16 + bob);
            ctx.lineTo(-11, -14 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(9, -24 + bob);
            ctx.lineTo(3, -16 + bob);
            ctx.lineTo(11, -14 + bob);
            ctx.closePath();
            ctx.fill();

            // 焦り顔・目（被弾してアワアワしているキュートな表情）
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(3, -15 + bob, 2.5, 0, Math.PI * 2); // くりくり黒目
            ctx.fill();
            // ほっぺ
            ctx.fillStyle = '#ff7675';
            ctx.beginPath();
            ctx.arc(6, -11 + bob, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // ヒゲ
            ctx.strokeStyle = '#bdc3c7';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(6, -13 + bob); ctx.lineTo(14, -15 + bob);
            ctx.moveTo(6, -11 + bob); ctx.lineTo(14, -10 + bob);
            ctx.stroke();

            // 生足
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-7, 18 + bob, 4, 6);
            ctx.fillRect(2, 18 + bob, 4, 6);
        }

        // 手・武器構え
        if (this.isAttacking) {
            ctx.fillStyle = this.hasArmor ? '#bdc3c7' : '#ffffff';
            ctx.beginPath();
            ctx.arc(14, -4 + bob, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// --- 敵キャラクター群 ---

/** 1. ゾンビネズミ (ZombieMouse) - 土から無限に湧いてくる・一撃必殺 */
class ZombieMouse {
    constructor(x, groundY) {
        this.x = x;
        this.groundY = groundY;
        this.y = groundY;
        this.width = 30;
        this.height = 24;
        this.hp = 1; // "どの武器でも一撃で倒せる"
        this.maxHp = 1;
        this.alive = true;
        this.state = 'rising'; // 'rising' (這い出し中) or 'walking'
        this.riseProgress = 0; // 0 -> 1
        this.riseSpeed = 1.4;
        this.speed = 45;
        this.walkCycle = Math.random() * Math.PI * 2;
        this.scoreValue = 100;
        this.radius = 14;
    }

    update(dt, knight, particles) {
        if (!this.alive) return;

        if (this.state === 'rising') {
            this.riseProgress += this.riseSpeed * dt;
            // 這い出し中の土煙パーティクル
            if (particles && Math.random() < 0.4) {
                particles.push(new Particle(this.x + (Math.random() - 0.5) * 20, this.groundY, 'dust', '#596275'));
            }
            if (this.riseProgress >= 1) {
                this.riseProgress = 1;
                this.state = 'walking';
                if (typeof soundEngine !== 'undefined') soundEngine.playZombieRise();
            }
            this.y = this.groundY - (this.riseProgress * (this.height / 2));
            return;
        }

        // 歩行状態：猫騎士へ向かってのそのそ前進
        const dir = (knight.x > this.x) ? 1 : -1;
        this.x += dir * this.speed * dt;
        this.walkCycle += dt * 5;
        this.facing = dir;
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const renderX = this.x - cameraX;
        const renderY = this.y;

        ctx.save();
        ctx.translate(renderX, renderY);

        if (this.state === 'rising') {
            // 土から這い出る演出（下半分が土に埋もれている）
            ctx.fillStyle = '#3d3d3d';
            ctx.beginPath();
            ctx.ellipse(0, this.groundY - renderY, 16, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.scale(this.facing || -1, 1);
        const bob = Math.sin(this.walkCycle) * 2;

        // ゾンビネズミの体（腐敗した深緑・灰色の毛並み）
        ctx.fillStyle = '#57606f';
        ctx.beginPath();
        ctx.ellipse(0, 0 + bob, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // 包帯・ツギハギ
        ctx.strokeStyle = '#ced6e0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, -6 + bob); ctx.lineTo(-1, 6 + bob);
        ctx.stroke();

        // 腐った耳（欠けている）
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        ctx.arc(-8, -8 + bob, 5, 0, Math.PI * 2);
        ctx.fill();

        // 怪しく赤く光るゾンビの瞳
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(6, -2 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(7, -3 + bob, 1, 0, Math.PI * 2);
        ctx.fill();

        // 突き出たネズミの鼻先
        ctx.fillStyle = '#e84118';
        ctx.beginPath();
        ctx.arc(12, 1 + bob, 2, 0, Math.PI * 2);
        ctx.fill();

        // ボロボロの骨ばった尻尾
        ctx.strokeStyle = '#a4b0be';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, 2 + bob);
        ctx.lineTo(-22, -2 + bob);
        ctx.stroke();

        ctx.restore();
    }
}

/** 2. カラス (GraveyardCrow) - 木に止まり、接近で一旦反対方向へ飛んでから低空飛行で向かってくる */
class GraveyardCrow {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.initialY = y;
        this.hp = 1;
        this.maxHp = 1;
        this.alive = true;
        this.radius = 13;
        this.scoreValue = 200;

        // ステートマシン：
        // 'perched' (止まり木で待機)
        // -> 'reverse_fly' (一旦反対方向に少し羽ばたき上昇)
        // -> 'swoop' (降下)
        // -> 'low_glide' (低空飛行で水平突撃！)
        this.state = 'perched';
        this.stateTimer = 0;
        this.facing = -1; // プレイヤーの方向
        this.wingAngle = 0;
        this.targetY = 0;
    }

    update(dt, knight, groundY, particles) {
        if (!this.alive) return;
        this.wingAngle += dt * 18;

        const distToKnight = Math.abs(knight.x - this.x);

        if (this.state === 'perched') {
            this.facing = (knight.x > this.x) ? 1 : -1;
            // プレイヤーが一定距離（240px以内）に近づいたら起動！
            if (distToKnight < 240) {
                this.state = 'reverse_fly';
                this.stateTimer = 0.35; // 0.35秒間、反対方向にフワッと逃げるように上昇
                if (typeof soundEngine !== 'undefined') soundEngine.playCrowCaw();
            }
            return;
        }

        if (this.state === 'reverse_fly') {
            this.stateTimer -= dt;
            // "一旦反対方向に少し飛んでから"：プレイヤーと逆方向へ後退しつつ上昇！
            const reverseDir = (knight.x > this.x) ? -1 : 1;
            this.x += reverseDir * 90 * dt;
            this.y -= 70 * dt;

            if (this.stateTimer <= 0) {
                this.state = 'swoop';
                this.stateTimer = 0.45;
                // 低空飛行の目標高度：猫騎士の足元〜胸の高さ
                this.targetY = groundY - 24;
            }
            return;
        }

        if (this.state === 'swoop') {
            this.stateTimer -= dt;
            // 急降下しながらプレイヤーへ向き直る
            this.facing = (knight.x > this.x) ? 1 : -1;
            this.x += this.facing * 180 * dt;
            this.y += (this.targetY - this.y) * 6 * dt;

            if (this.stateTimer <= 0 || Math.abs(this.y - this.targetY) < 10) {
                this.state = 'low_glide';
            }
            return;
        }

        if (this.state === 'low_glide') {
            // "降りて低空飛行で向かって来る"：地上スレスレを高速で一直線に突進！
            this.facing = (knight.x > this.x) ? 1 : -1;
            this.x += this.facing * 290 * dt;
            this.y = groundY - 22 + Math.sin(this.wingAngle) * 3;
        }
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const renderX = this.x - cameraX;
        const renderY = this.y;

        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.scale(this.facing, 1);

        const wingFlap = Math.sin(this.wingAngle) * 8;

        // 漆黒のカラスの胴体
        ctx.fillStyle = '#1e272e';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // 羽ばたく漆黒の翼
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(-4, -2);
        ctx.lineTo(-12, -10 - (this.state === 'perched' ? -3 : wingFlap));
        ctx.lineTo(2, -4);
        ctx.closePath();
        ctx.fill();

        // 頭部
        ctx.fillStyle = '#1e272e';
        ctx.beginPath();
        ctx.arc(8, -4, 6, 0, Math.PI * 2);
        ctx.fill();

        // 鋭い黄色いクチバシ
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.moveTo(12, -5);
        ctx.lineTo(19, -3);
        ctx.lineTo(12, -1);
        ctx.closePath();
        ctx.fill();

        // 不気味な紫・赤の眼光
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.arc(9, -5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(10, -5, 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

/** 3. 赤いコウモリネズミ (RedBatMouse / レッドアリーマー風) */
class RedBatMouse {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 5; // 手ごわいエリート悪魔ネズミ
        this.maxHp = 5;
        this.alive = true;
        this.radius = 20;
        this.scoreValue = 1000;

        // ステートマシン (レッドアリーマーの変幻自在な機動):
        // 'lurking' (高空で怪しく浮遊)
        // -> 'dive' (急降下攻撃！)
        // -> 'ground_rush' (低空飛行からの超高速水平突撃！)
        // -> 'soar_up' (プレイヤーの攻撃をすり抜け急上昇！)
        // -> 'hover_taunt' (挑発ホバリング・再急降下の狙い)
        this.state = 'lurking';
        this.stateTimer = 1.0;
        this.facing = -1;
        this.wingFlap = 0;
        this.speedX = 0;
        this.speedY = 0;
    }

    update(dt, knight, groundY, particles, floatingTexts) {
        if (!this.alive) return;
        this.wingFlap += dt * 14;

        const dx = knight.x - this.x;
        const dy = knight.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (this.state === 'lurking') {
            this.facing = dx > 0 ? 1 : -1;
            // プレイヤーが近づくと威嚇咆哮して急降下へ！
            if (dist < 420) {
                this.state = 'dive';
                this.stateTimer = 0.8;
                if (typeof soundEngine !== 'undefined') soundEngine.playArremerScreech();
                if (floatingTexts) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 25, '👹 ギニャアァッ！', '#ff4757', 1.2));
                }
            }
            return;
        }

        if (this.state === 'dive') {
            // "急降下攻撃"：斜め下方へ超高速で滑空ダイブ！
            this.stateTimer -= dt;
            this.facing = dx > 0 ? 1 : -1;
            this.x += this.facing * 340 * dt;
            this.y += 320 * dt;

            // 地面付近（低空）に達したら水平突撃へ移行
            if (this.y >= groundY - 35 || this.stateTimer <= 0) {
                this.y = groundY - 32;
                this.state = 'ground_rush';
                this.stateTimer = 0.9;
            }
            return;
        }

        if (this.state === 'ground_rush') {
            // "低空飛行からの水平突撃"：地面スレスレを目にも留まらぬ速さで水平ダッシュ！
            this.stateTimer -= dt;
            this.x += this.facing * 420 * dt;
            this.y = groundY - 32 + Math.sin(this.wingFlap) * 4;

            // プレイヤーを通り過ぎたか、一定時間経過で急上昇へ
            if (this.stateTimer <= 0 || (this.facing === 1 && this.x > knight.x + 80) || (this.facing === -1 && this.x < knight.x - 80)) {
                this.state = 'soar_up';
                this.stateTimer = 0.75;
            }
            return;
        }

        if (this.state === 'soar_up') {
            // "急上昇などを行いプレイヤーを翻弄する"：垂直に一気に大空へ上昇退避！
            this.stateTimer -= dt;
            this.y -= 380 * dt;
            this.x -= this.facing * 80 * dt; // 少し後退しながら上昇

            if (this.stateTimer <= 0 || this.y <= 160) {
                this.state = 'hover_taunt';
                this.stateTimer = 1.2;
            }
            return;
        }

        if (this.state === 'hover_taunt') {
            // 高空で滞空しながらプレイヤーを狙い定め、次の急降下へ！
            this.stateTimer -= dt;
            this.facing = dx > 0 ? 1 : -1;
            this.x += Math.sin(this.wingFlap * 0.5) * 50 * dt;
            this.y += Math.cos(this.wingFlap * 0.5) * 30 * dt;

            if (this.stateTimer <= 0) {
                this.state = 'dive';
                this.stateTimer = 0.8;
                if (typeof soundEngine !== 'undefined') soundEngine.playArremerScreech();
            }
        }
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const renderX = this.x - cameraX;
        const renderY = this.y;

        ctx.save();
        ctx.translate(renderX, renderY);
        ctx.scale(this.facing, 1);

        const wingMove = Math.sin(this.wingFlap) * 12;

        // 巨大な悪魔コウモリの翼（深紅の蝙蝠羽）
        ctx.fillStyle = '#b71540';
        ctx.strokeStyle = '#6a097d';
        ctx.lineWidth = 2;

        // 奥の翼
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(-24, -26 - wingMove);
        ctx.lineTo(-32, -10 - wingMove);
        ctx.lineTo(-18, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 悪魔ネズミの体（深紅・マゼンタ）
        ctx.fillStyle = '#e84118';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 手前の翼
        ctx.fillStyle = '#c23616';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(24, -30 + wingMove);
        ctx.lineTo(34, -12 + wingMove);
        ctx.lineTo(16, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 悪魔の角
        ctx.fillStyle = '#2f3640';
        ctx.beginPath();
        ctx.moveTo(4, -10);
        ctx.lineTo(12, -22);
        ctx.lineTo(8, -8);
        ctx.closePath();
        ctx.fill();

        // 鋭く睨みつける黄色い目
        ctx.fillStyle = '#fbc531';
        ctx.beginPath();
        ctx.arc(8, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c23616';
        ctx.beginPath();
        ctx.arc(9, -3, 2, 0, Math.PI * 2);
        ctx.fill();

        // 凶悪なキバ
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(12, 3);
        ctx.lineTo(15, 8);
        ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();

        // 残像オーラ（エリート強敵の証）
        ctx.strokeStyle = 'rgba(232, 65, 24, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// --- 武器の壺 (WeaponPot) 🏺 ---
class WeaponPot {
    constructor(x, y, groundY, weaponType) {
        this.x = x;
        this.y = y;
        this.groundY = groundY;
        this.weaponType = weaponType; // 'spear' | 'dagger' | 'torch' | 'armor'
        this.vy = -160;
        this.vx = (Math.random() - 0.5) * 40;
        this.gravity = 650;
        this.alive = true;
        this.radius = 16;
    }

    update(dt) {
        if (!this.alive) return;
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.y >= this.groundY - 14) {
            this.y = this.groundY - 14;
            this.vy = 0;
            this.vx = 0;
        }
    }

    draw(ctx, cameraX) {
        if (!this.alive) return;
        const renderX = this.x - cameraX;
        const renderY = this.y;

        ctx.save();
        ctx.translate(renderX, renderY);

        const bob = Math.sin(Date.now() * 0.006) * 3;

        // 黄金のオーラ
        ctx.fillStyle = 'rgba(241, 196, 15, 0.25)';
        ctx.beginPath();
        ctx.arc(0, bob, 20, 0, Math.PI * 2);
        ctx.fill();

        // 古代の壺（茶色と金の装飾）
        ctx.fillStyle = '#d35400';
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-9, -10 + bob, 18, 20, 4);
        ctx.fill();
        ctx.stroke();

        // 壺の首
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(-6, -14 + bob, 12, 5);

        // 壺の中身アイコン描画
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let icon = '🔱';
        if (this.weaponType === 'spear') icon = '🔱';
        else if (this.weaponType === 'dagger') icon = '🗡️';
        else if (this.weaponType === 'torch') icon = '🔥';
        else if (this.weaponType === 'armor') icon = '🛡️';

        ctx.fillText(icon, 0, bob);
        ctx.restore();
    }
}

// --- 墓場の背景・環境 (GraveyardEnvironment) ---
class GraveyardEnvironment {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.groundY = height - 85;

        // 墓石・枯れ木などのオブジェクト配置
        this.decorations = [];
        this.generateDecorations();
    }

    generateDecorations() {
        // スクロール可能な墓場風景オブジェクト
        for (let i = 0; i < 40; i++) {
            const x = 150 + i * 160 + (Math.random() - 0.5) * 50;
            const type = Math.random() < 0.4 ? 'cross' : (Math.random() < 0.7 ? 'tombstone' : 'dead_tree');
            this.decorations.push({
                x,
                type,
                height: 35 + Math.random() * 45
            });
        }
    }

    draw(ctx, cameraX) {
        // 1. ゴシック怪奇夜空グラデーション（深紫 ➔ 漆黒）
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        skyGrad.addColorStop(0, '#130f40');
        skyGrad.addColorStop(0.65, '#2c2c54');
        skyGrad.addColorStop(1, '#0c1017');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // 2. 巨大な不気味な満月
        ctx.save();
        const moonX = 720 - (cameraX * 0.05) % 900;
        const moonY = 120;
        const moonGrad = ctx.createRadialGradient(moonX, moonY, 15, moonX, moonY, 70);
        moonGrad.addColorStop(0, '#fffbc2');
        moonGrad.addColorStop(0.7, '#f1c40f');
        moonGrad.addColorStop(1, 'rgba(241, 196, 15, 0)');
        ctx.fillStyle = moonGrad;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 70, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fffbc2';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 45, 0, Math.PI * 2);
        ctx.fill();

        // クレーター
        ctx.fillStyle = '#eccc68';
        ctx.beginPath();
        ctx.arc(moonX - 12, moonY - 10, 8, 0, Math.PI * 2);
        ctx.arc(moonX + 15, moonY + 8, 12, 0, Math.PI * 2);
        ctx.arc(moonX + 8, moonY - 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. 遠景：魔界の古城・大聖堂の尖塔シルエット
        ctx.fillStyle = '#17142b';
        ctx.beginPath();
        const bX = -(cameraX * 0.15) % 600;
        for (let k = -1; k < 3; k++) {
            const baseX = bX + k * 600;
            ctx.rect(baseX + 50, this.groundY - 140, 70, 140);
            ctx.moveTo(baseX + 85, this.groundY - 210); // 尖塔
            ctx.lineTo(baseX + 50, this.groundY - 140);
            ctx.lineTo(baseX + 120, this.groundY - 140);

            ctx.rect(baseX + 180, this.groundY - 110, 100, 110);
            ctx.moveTo(baseX + 230, this.groundY - 170);
            ctx.lineTo(baseX + 180, this.groundY - 110);
            ctx.lineTo(baseX + 280, this.groundY - 110);
        }
        ctx.fill();

        // 4. 中景：墓石・十字架・枯れ木の動的生成＆描画
        while (this.decorations.length === 0 || this.decorations[this.decorations.length - 1].x < cameraX + this.width + 500) {
            const lastX = this.decorations.length > 0 ? this.decorations[this.decorations.length - 1].x : 0;
            const x = lastX + 110 + Math.random() * 80;
            const type = Math.random() < 0.4 ? 'cross' : (Math.random() < 0.7 ? 'tombstone' : 'dead_tree');
            this.decorations.push({
                x,
                type,
                height: 35 + Math.random() * 45
            });
        }
        while (this.decorations.length > 0 && this.decorations[0].x < cameraX - 300) {
            this.decorations.shift();
        }

        this.decorations.forEach(dec => {
            const rx = dec.x - cameraX;
            if (rx < -60 || rx > this.width + 60) return;

            if (dec.type === 'cross') {
                // 十字架
                ctx.fillStyle = '#57606f';
                ctx.fillRect(rx - 4, this.groundY - dec.height, 8, dec.height);
                ctx.fillRect(rx - 16, this.groundY - dec.height + 12, 32, 7);
            } else if (dec.type === 'tombstone') {
                // 苔むしたアーチ型墓石
                ctx.fillStyle = '#474787';
                ctx.beginPath();
                ctx.roundRect(rx - 14, this.groundY - dec.height, 28, dec.height, [14, 14, 0, 0]);
                ctx.fill();
                ctx.fillStyle = '#2c2c54';
                ctx.fillText('R.I.P', rx - 10, this.groundY - dec.height + 25);
            } else if (dec.type === 'dead_tree') {
                // 枝が折れた不気味な枯れ木
                ctx.fillStyle = '#2f3542';
                ctx.beginPath();
                ctx.moveTo(rx - 8, this.groundY);
                ctx.lineTo(rx + 8, this.groundY);
                ctx.lineTo(rx + 3, this.groundY - dec.height);
                ctx.lineTo(rx - 3, this.groundY - dec.height);
                ctx.closePath();
                ctx.fill();

                // 枝
                ctx.strokeStyle = '#2f3542';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(rx, this.groundY - dec.height + 15);
                ctx.lineTo(rx - 25, this.groundY - dec.height - 10);
                ctx.moveTo(rx, this.groundY - dec.height + 25);
                ctx.lineTo(rx + 28, this.groundY - dec.height);
                ctx.stroke();
            }
        });

        // 5. 地面（起伏のある黒土と苔の土手）
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

        ctx.fillStyle = '#2f3542';
        ctx.fillRect(0, this.groundY, this.width, 6);

        // 6. 墓場を流れる這いずる青い霧（フォグ）
        const fogOffset = (Date.now() * 0.04) % this.width;
        ctx.fillStyle = 'rgba(116, 185, 255, 0.06)';
        ctx.beginPath();
        ctx.ellipse(this.width / 2, this.groundY - 10, this.width, 25, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}
