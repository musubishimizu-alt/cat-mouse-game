/**
 * entities.js - ゲーム内キャラクター（猫、ネズミ各種、チーズ、エフェクト）
 */

// --- ユーティリティ ---
function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function normalizeAngle(angle) {
    while (angle < -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
}

/**
 * プレイヤー（猫）クラス
 */
class Cat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 28;
        this.angle = 0;
        this.targetAngle = 0;
        this.speed = 4.2;
        this.vx = 0;
        this.vy = 0;

        // 飛びつき（パウンス）状態
        this.isPouncing = false;
        this.pounceTimer = 0;
        this.pounceDuration = 0.22; // 秒
        this.pounceCooldown = 0;
        this.pounceCooldownMax = 0.45; // クールダウン秒
        this.pounceSpeed = 16.0;

        // アニメーション用プロパティ
        this.tailAngle = 0;
        this.tailTimer = 0;
        this.walkCycle = 0;
        this.isMoving = false;
        this.blinkTimer = Math.random() * 3 + 2;
        this.isBlinking = false;
        this.pouncePawStretch = 0;

        // 肉球スタンプ発生タイマー
        this.pawPrintTimer = 0;
    }

    update(dt, input, width, height, isFever) {
        // クールダウン更新
        if (this.pounceCooldown > 0) {
            this.pounceCooldown -= dt;
        }

        // アニメーションタイマー
        this.tailTimer += dt * (isFever ? 12 : 5);
        this.tailAngle = Math.sin(this.tailTimer) * 0.45;

        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
            this.isBlinking = !this.isBlinking;
            this.blinkTimer = this.isBlinking ? 0.12 : (Math.random() * 3.5 + 2);
        }

        const currentSpeed = (isFever ? this.speed * 1.6 : this.speed);

        // 飛びつきアクション中の処理
        if (this.isPouncing) {
            this.pounceTimer -= dt;
            this.pouncePawStretch = Math.sin((1 - this.pounceTimer / this.pounceDuration) * Math.PI);
            
            const pSpeed = (isFever ? this.pounceSpeed * 1.3 : this.pounceSpeed);
            this.x += Math.cos(this.angle) * pSpeed;
            this.y += Math.sin(this.angle) * pSpeed;

            if (this.pounceTimer <= 0) {
                this.isPouncing = false;
                this.pouncePawStretch = 0;
            }
        } else {
            // 通常移動計算
            let moveX = 0;
            let moveY = 0;

            if (input.type === 'mouse' && input.pointerActive) {
                // マウス・タッチカーソル追従
                const dx = input.targetX - this.x;
                const dy = input.targetY - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 15) {
                    moveX = (dx / dist) * currentSpeed;
                    moveY = (dy / dist) * currentSpeed;
                    this.targetAngle = Math.atan2(dy, dx);
                }
            } else if (input.type === 'keyboard') {
                // キーボード（WASD / 矢印）
                if (input.left) moveX -= currentSpeed;
                if (input.right) moveX += currentSpeed;
                if (input.up) moveY -= currentSpeed;
                if (input.down) moveY += currentSpeed;

                if (moveX !== 0 && moveY !== 0) {
                    moveX *= 0.7071;
                    moveY *= 0.7071;
                }

                if (moveX !== 0 || moveY !== 0) {
                    this.targetAngle = Math.atan2(moveY, moveX);
                }
            }

            this.vx = moveX;
            this.vy = moveY;
            this.x += this.vx;
            this.y += this.vy;

            this.isMoving = (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1);
            if (this.isMoving) {
                this.walkCycle += dt * (isFever ? 18 : 10);
            }

            // 角度の補間回転
            let diff = this.targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 0.25;

            // 飛びつき発動チェック
            if (input.pounceRequested && (this.pounceCooldown <= 0 || isFever)) {
                this.triggerPounce(isFever);
                input.pounceRequested = false;
            }
        }

        // 画面外移動制限
        this.x = clamp(this.x, this.radius + 10, width - this.radius - 10);
        this.y = clamp(this.y, this.radius + 10, height - this.radius - 10);
    }

    triggerPounce(isFever) {
        this.isPouncing = true;
        this.pounceTimer = this.pounceDuration;
        this.pounceCooldown = isFever ? 0.1 : this.pounceCooldownMax;
        soundEngine.playPounce();
    }

    draw(ctx, isFever) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // フィーバー時のオーラ発光
        if (isFever) {
            ctx.save();
            const glowRadius = this.radius * (1.3 + Math.sin(this.tailTimer * 2) * 0.15);
            const gradient = ctx.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, glowRadius);
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
            gradient.addColorStop(0.6, 'rgba(255, 105, 180, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(0, 6, this.radius * 1.05, this.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // 正面捕獲エリア・視界インジケーター（前方扇形）
        ctx.save();
        const coneAngle = isFever ? Math.PI * 0.50 : (this.isPouncing ? Math.PI * 0.42 : Math.PI * 0.33);
        const reachRadius = this.radius + (this.isPouncing ? 34 : (isFever ? 30 : 18));
        const coneGrad = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, reachRadius);
        coneGrad.addColorStop(0, isFever ? 'rgba(255, 105, 180, 0.20)' : 'rgba(243, 156, 18, 0.14)');
        coneGrad.addColorStop(0.85, isFever ? 'rgba(255, 230, 100, 0.10)' : 'rgba(243, 156, 18, 0.06)');
        coneGrad.addColorStop(1, 'rgba(243, 156, 18, 0)');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, reachRadius, -coneAngle, coneAngle);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isFever ? 'rgba(255, 105, 180, 0.35)' : 'rgba(230, 126, 34, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, reachRadius, -coneAngle, coneAngle);
        ctx.stroke();
        ctx.restore();

        // しっぽ
        ctx.save();
        ctx.translate(-this.radius * 0.75, 0);
        ctx.rotate(Math.PI + this.tailAngle);
        ctx.strokeStyle = '#e67e22'; // 暖かみのある茶トラ色
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(15, -12, 28, -6);
        ctx.stroke();

        // しっぽの先の白毛
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(22, -8);
        ctx.lineTo(28, -6);
        ctx.stroke();
        ctx.restore();

        // 足（歩行・飛びつきアニメーション）
        const legOffset = Math.sin(this.walkCycle) * 5;
        const pawStretch = this.pouncePawStretch * 14;

        // 前足（左・右）
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(this.radius * 0.55 + pawStretch, -14, 7, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(this.radius * 0.55 + pawStretch, 14, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 後ろ足
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.45 + legOffset, -16, 7, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(-this.radius * 0.45 - legOffset, 16, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 猫の体（ぽってりしたオーバル）
        ctx.fillStyle = '#f39c12'; // オレンジ茶トラベース
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();

        // 背中のトラ柄模様
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.ellipse(-6, 0, 4, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(6, 0, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // お腹・胸のふわふわ白毛
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(8, 0, this.radius * 0.5, this.radius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // 耳（左・右）
        const earAngle = this.isPouncing ? 0.35 : 0.05; // 飛びつき時は耳を伏せる
        ctx.fillStyle = '#d35400';
        // 左耳
        ctx.beginPath();
        ctx.moveTo(8, -12);
        ctx.lineTo(16 + earAngle * 8, -26);
        ctx.lineTo(-2, -18);
        ctx.closePath();
        ctx.fill();
        // 右耳
        ctx.beginPath();
        ctx.moveTo(8, 12);
        ctx.lineTo(16 + earAngle * 8, 26);
        ctx.lineTo(-2, 18);
        ctx.closePath();
        ctx.fill();

        // 耳の内側（ピンク）
        ctx.fillStyle = '#ffb6c1';
        ctx.beginPath();
        ctx.moveTo(8, -13);
        ctx.lineTo(14, -22);
        ctx.lineTo(0, -17);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(8, 13);
        ctx.lineTo(14, 22);
        ctx.lineTo(0, 17);
        ctx.closePath();
        ctx.fill();

        // 顔のパーツ
        // 目
        if (this.isBlinking) {
            // まばたき（笑顔の線）
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(14, -8);
            ctx.quadraticCurveTo(18, -11, 21, -8);
            ctx.moveTo(14, 8);
            ctx.quadraticCurveTo(18, 5, 21, 8);
            ctx.stroke();
        } else {
            // パッチリした大きな黒目＆ハイライト
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.ellipse(17, -8, 4.5, 5, 0, 0, Math.PI * 2);
            ctx.ellipse(17, 8, 4.5, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // 瞳のキラキラ（白ハイライト）
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(18.5, -9.5, 1.8, 0, Math.PI * 2);
            ctx.arc(18.5, 6.5, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // 鼻（ピンクの小三角）
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(25, -2);
        ctx.lineTo(25, 2);
        ctx.closePath();
        ctx.fill();

        // 口（ω）
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(24, -2.5, 2.5, 0, Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(24, 2.5, 2.5, -Math.PI * 0.85, 0);
        ctx.stroke();

        // ヒゲ（左右3本ずつ）
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        // 左ひげ
        ctx.moveTo(20, -6); ctx.lineTo(32, -15);
        ctx.moveTo(21, -5); ctx.lineTo(34, -7);
        ctx.moveTo(20, -4); ctx.lineTo(31, 0);
        // 右ひげ
        ctx.moveTo(20, 6); ctx.lineTo(32, 15);
        ctx.moveTo(21, 5); ctx.lineTo(34, 7);
        ctx.moveTo(20, 4); ctx.lineTo(31, 0);
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * ネズミ各種クラス
 */
class Mouse {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.angle = Math.random() * Math.PI * 2;
        this.wobble = Math.random() * 10;
        this.alive = true; // 生存フラグ
        this.isFleeing = false;
        this.fleeTimer = 0;
        this.fleeCooldown = 0;
        this.isAlerted = false; // 猫に気づいた直後の硬直・驚き状態（タイムラグ中）
        this.alertTimer = 0;   // 逃げ始めるまでの残りタイムラグ（秒）
        this.pauseTimer = 0;

        // タイプ別ステータス設定
        if (type === 'speedy') {
            this.radius = 12;
            this.speed = 3.6 + Math.random() * 0.7;
            this.points = 250;
            this.color = '#e17055'; // すばやいオレンジ茶
            this.earColor = '#fab1a0';
            this.hp = 1;
            this.feverCharge = 18;
        } else if (type === 'golden') {
            this.radius = 13;
            this.speed = 4.2 + Math.random() * 0.8;
            this.points = 1000;
            this.color = '#f1c40f'; // 眩しいゴールド
            this.earColor = '#ffeaa7';
            this.hp = 1;
            this.feverCharge = 40;
        } else if (type === 'giant') {
            this.radius = 26;
            this.speed = 1.3 + Math.random() * 0.4;
            this.points = 500;
            this.color = '#636e72'; // デカ重炭灰色
            this.earColor = '#b2bec3';
            this.hp = 2;
            this.maxHp = 2;
            this.feverCharge = 25;
        } else {
            // normal
            this.radius = 13;
            this.speed = 2.0 + Math.random() * 0.6;
            this.points = 100;
            this.color = '#a4b0be'; // スタンダードグレー
            this.earColor = '#ffb8b8';
            this.hp = 1;
            this.feverCharge = 10;
        }
    }

    update(dt, cat, cheese, width, height) {
        if (!this.alive) return;

        this.wobble += dt * 14;
        const distToCat = distance(this.x, this.y, cat.x, cat.y);
        const distToCheese = (cheese && cheese.alive) ? distance(this.x, this.y, cheese.x, cheese.y) : 9999;
        const isNearCheese = distToCheese < 115;

        // クールダウン更新
        if (this.fleeCooldown > 0) {
            this.fleeCooldown -= dt;
        }

        // 猫の正面方向との角度差（猫が向いている方向に対してネズミがどの角度にいるか）
        const toMouseAngle = Math.atan2(this.y - cat.y, this.x - cat.x);
        const angleDiffFromCatFront = Math.abs(normalizeAngle(toMouseAngle - cat.angle));

        // ②「ネズミは猫の正面にくると逃げる」：
        // 猫の正面視野（約±70° = 140°の扇形内）にいるかどうか
        const inFrontOfCat = angleDiffFromCatFront <= (Math.PI * 0.39);

        // 正面での猫警戒距離（正面にいる時は猫の顔・爪が見えるためしっかり逃げる！）
        let frontScareRadius = 90;
        if (this.type === 'speedy') frontScareRadius = 105;
        else if (this.type === 'giant') frontScareRadius = 65;
        else if (this.type === 'golden') frontScareRadius = 110;

        // チーズ付近ではチーズに引き寄せられつつも、正面なら逃げる
        if (isNearCheese) frontScareRadius = Math.max(55, frontScareRadius - 18);

        // 猫の正面に来た場合のみ逃走・警戒を発動！背後・死角からは警戒せずチーズを目指す
        if (inFrontOfCat && distToCat < frontScareRadius && this.fleeCooldown <= 0) {
            if (!this.isFleeing && !this.isAlerted) {
                // 猫の正面に入った瞬間：「！」を出して一瞬硬直（0.2〜0.3秒）
                this.isAlerted = true;
                this.alertTimer = isNearCheese ? (0.28 + Math.random() * 0.08) : (0.20 + Math.random() * 0.08);
                if (Math.random() < 0.3) {
                    soundEngine.playSqueak();
                }
            }
        } else if (!inFrontOfCat || distToCat >= frontScareRadius + 25) {
            // 猫の正面から外れた（猫が別を向いた）、または距離が離れたら警戒解除
            if (this.isAlerted && !this.isFleeing) {
                this.isAlerted = false;
                this.alertTimer = 0;
            }
        }

        // タイムラグのカウントダウン
        if (this.isAlerted && !this.isFleeing) {
            this.alertTimer -= dt;
            if (this.alertTimer <= 0) {
                // タイムラグ終了 -> 猫の正面から全力で逃走開始！
                this.isAlerted = false;
                this.isFleeing = true;
                this.fleeTimer = 0.8;
                // 猫の反対方向へ逃走
                const awayAngle = Math.atan2(this.y - cat.y, this.x - cat.x);
                this.angle = awayAngle + (Math.random() - 0.5) * 0.6;
            }
        }

        // 逃走タイマー更新
        if (this.fleeTimer > 0) {
            this.fleeTimer -= dt;
            if (this.fleeTimer <= 0) {
                this.isFleeing = false;
                this.fleeCooldown = 0.5; // 再警戒までのクールダウン
            }
        }

        // 移動速度の計算
        let curSpeed = this.speed;
        if (this.isFleeing) {
            curSpeed = this.speed * 1.45;
        } else if (this.isAlerted) {
            // タイムラグ中は驚いて一瞬足が鈍る
            curSpeed = this.speed * 0.25;
        }

        // チーズ防衛モード：逃走中でない場合はチーズへ向かう
        if (!this.isFleeing && cheese && cheese.alive) {
            if (distToCheese > cheese.radius + this.radius) {
                const toCheeseAngle = Math.atan2(cheese.y - this.y, cheese.x - this.x);
                let dAngle = toCheeseAngle - this.angle;
                while (dAngle < -Math.PI) dAngle += Math.PI * 2;
                while (dAngle > Math.PI) dAngle -= Math.PI * 2;
                // チーズ方向へ旋回
                this.angle += dAngle * 0.08;
            } else {
                // チーズをかじる！
                cheese.damage(dt * (this.type === 'giant' ? 12 : 5));
                curSpeed = 0.2; // かじり中はほぼ停止
            }
        } else if (!this.isFleeing && !this.isAlerted) {
            // 通常のランダム徘徊
            if (Math.random() < 0.03) {
                this.angle += (Math.random() - 0.5) * 1.2;
            }
        }

        // 移動実行
        this.x += Math.cos(this.angle) * curSpeed;
        this.y += Math.sin(this.angle) * curSpeed;

        // 壁バウンド
        const margin = this.radius + 15;
        if (this.x < margin) {
            this.x = margin;
            this.angle = Math.PI - this.angle;
        } else if (this.x > width - margin) {
            this.x = width - margin;
            this.angle = Math.PI - this.angle;
        }
        if (this.y < margin) {
            this.y = margin;
            this.angle = -this.angle;
        } else if (this.y > height - margin) {
            this.y = height - margin;
            this.angle = -this.angle;
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // ゴールデンネズミの輝き
        if (this.type === 'golden') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 234, 167, 0.4)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.beginPath();
        ctx.ellipse(0, 4, this.radius * 1.0, this.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // ネズミのしっぽ（うねうね）
        const tailWiggle = Math.sin(this.wobble) * 0.35;
        ctx.strokeStyle = '#ff9ff3';
        ctx.lineWidth = this.type === 'giant' ? 3.5 : 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.8, 0);
        ctx.quadraticCurveTo(-this.radius * 1.5, tailWiggle * 10, -this.radius * 2.2, tailWiggle * 6);
        ctx.stroke();

        // 体（しずく型）
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 1.0, this.radius * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();

        // すばやいネズミの赤いハチマキ
        if (this.type === 'speedy') {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.radius * 0.3, 0, this.radius * 0.73, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.stroke();
        }

        // デカネズミの残りHPゲージ
        if (this.type === 'giant' && this.hp < this.maxHp) {
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-15, -this.radius - 8, 30, 4);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-15, -this.radius - 8, 30 * (this.hp / this.maxHp), 4);
        }

        // 耳（左右）
        ctx.fillStyle = this.earColor;
        ctx.beginPath();
        ctx.arc(-this.radius * 0.2, -this.radius * 0.65, this.radius * 0.38, 0, Math.PI * 2);
        ctx.arc(-this.radius * 0.2, this.radius * 0.65, this.radius * 0.38, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // つぶらな黒目
        ctx.fillStyle = '#1e272e';
        ctx.beginPath();
        ctx.arc(this.radius * 0.45, -this.radius * 0.3, this.radius * 0.14, 0, Math.PI * 2);
        ctx.arc(this.radius * 0.45, this.radius * 0.3, this.radius * 0.14, 0, Math.PI * 2);
        ctx.fill();

        // 鼻先（ピンク）
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.arc(this.radius * 0.95, 0, this.radius * 0.16, 0, Math.PI * 2);
        ctx.fill();

        // ひげ
        ctx.strokeStyle = '#2f3542';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(this.radius * 0.7, -2); ctx.lineTo(this.radius * 1.2, -8);
        ctx.moveTo(this.radius * 0.7, 2); ctx.lineTo(this.radius * 1.2, 8);
        ctx.stroke();

        ctx.restore();

        // 猫に気づいた直後の警戒タイムラグ中の「！」マーク
        if (this.isAlerted) {
            ctx.save();
            ctx.font = 'bold 16px "M PLUS Rounded 1c", sans-serif';
            ctx.fillStyle = '#e74c3c';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('！', this.x, this.y - this.radius - 2);
            ctx.restore();
        }
    }
}

/**
 * 守るべきチーズクラス（チーズ防衛モード用）
 */
class Cheese {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 34;
        this.maxHp = 100;
        this.hp = 100;
        this.alive = true;
        this.nibbleCooldown = 0;
    }

    damage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this.nibbleCooldown = 0.2;
        if (Math.random() < 0.1) {
            soundEngine.playNibble();
        }
        if (this.hp <= 0) {
            this.alive = false;
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.beginPath();
        ctx.ellipse(0, 8, this.radius * 1.1, this.radius * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // 三角チーズの形
        ctx.fillStyle = '#f1c40f'; // 黄色
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius * 1.1, this.radius * 0.8);
        ctx.quadraticCurveTo(0, this.radius * 1.1, -this.radius * 1.1, this.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // チーズの穴（ぽこぽこ）
        ctx.fillStyle = '#e67e22';
        const holes = [
            { x: -5, y: -4, r: 6 },
            { x: 12, y: 10, r: 8 },
            { x: -14, y: 12, r: 5 },
            { x: 4, y: -16, r: 4 },
        ];
        holes.forEach(h => {
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 残り耐久度ゲージ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-28, -this.radius - 14, 56, 8);
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? '#2ecc71' : hpPercent > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(-26, -this.radius - 12, 52 * hpPercent, 4);

        ctx.restore();
    }
}

/**
 * 湧き出し口（ネズミの巣穴）クラス
 */
class MouseHole {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle; // 穴が部屋の内側を向く角度
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 穴の暗がり
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // 穴の縁取り
        ctx.strokeStyle = '#636e72';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * パーティクルエフェクト
 */
class Particle {
    constructor(x, y, type = 'star', color = '#f1c40f') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 0.5 + Math.random() * 0.4;
        this.size = (type === 'paw' ? 14 : 4 + Math.random() * 6);
        
        const speed = (type === 'dust' ? 1.5 : 3.5 + Math.random() * 4);
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt) {
        this.life -= dt / this.maxLife;
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.94;
        this.vy *= 0.94;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);

        if (this.type === 'star') {
            ctx.fillStyle = this.color;
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * this.size,
                           -Math.sin((18 + i * 72) * Math.PI / 180) * this.size);
                ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (this.size * 0.4),
                           -Math.sin((54 + i * 72) * Math.PI / 180) * (this.size * 0.4));
            }
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'paw') {
            // 肉球スタンプ
            ctx.fillStyle = 'rgba(255, 182, 193, 0.45)';
            ctx.translate(this.x, this.y);
            // 主球
            ctx.beginPath();
            ctx.ellipse(0, 2, 7, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            // 4つの指球
            const toeOffsets = [[-6, -4], [-2, -7], [2, -7], [6, -4]];
            toeOffsets.forEach(([tx, ty]) => {
                ctx.beginPath();
                ctx.arc(tx, ty, 2.2, 0, Math.PI * 2);
                ctx.fill();
            });
        } else {
            // 丸いダストや光球
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * 浮遊スコアテキスト
 */
class FloatingText {
    constructor(x, y, text, color = '#f1c40f', scale = 1.0) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.scale = scale;
        this.life = 1.0;
        this.maxLife = 0.85;
    }

    update(dt) {
        this.life -= dt / this.maxLife;
        this.y -= 38 * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `bold ${Math.floor(18 * this.scale)}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(this.text, this.x + 1, this.y + 1); // ドロップシャドウ
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}
