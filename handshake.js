window.onload = function() {

    const WIDTH = 300.0;
    const HEIGHT = 600.0;
    const WIDTH_HEIGHT_RATIO = WIDTH / HEIGHT;
    const EXTENSION_SPEED = 2000.0;
    const IDLE_SPEED = 8.0;

    // Head idling
    const IDLE_MAX_DISTANCE = 2.0;
    const IDLE_HEAD_SPEED = 5.0;

    const ARM_DEFAULT_ANGLE = -33.0;
    const PEOPLE_ARM_DEFAULT_ANGLE = ARM_DEFAULT_ANGLE - 15;
    const ARM_IDLE_AMPLITUDE = 2.0;
    const ARM_IDLE_MIN_ANGLE = ARM_DEFAULT_ANGLE - ARM_IDLE_AMPLITUDE;
    const ARM_IDLE_MAX_ANGLE = ARM_DEFAULT_ANGLE + ARM_IDLE_AMPLITUDE;
    const ARM_SHAKE_AMPLITUDE = ARM_IDLE_AMPLITUDE * 5.0; // in degree
    const PEOPLE_ARM_SHAKE_AMPLITUDE = ARM_IDLE_AMPLITUDE * 10.0; // in degree
    const ARM_IDLE_ANCHOR = [0.5, 0.4];
    const ARM_MIN_POS = {
        x: 1.7 * WIDTH / 2.0,
        y: 1.7 * HEIGHT / 2.0
    };

    var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, '', {
        preload: preload,
        create: create,
        update: update,
        render: render
    });

    var arm = {
        power: 0.0,
        type: 0, // 0 Paper, 1 scissor, 2 stone
        move: false,
        extended: false,
        sprite: null,
        shake: false,
        idleUp: true,
        gyroMagnitude: 0.0,
        isIdle: function() {
            return !this.extended && !this.move;
        },
        hasToExpand: function() {
            return !this.extended && this.move;
        },
        hasToCollapse: function() {
            return this.extended && this.move;
        },
        isTooExtended: function() {
            return this.sprite.x < ARM_MIN_POS.x || this.sprite.y < ARM_MIN_POS.y;
        },
        isTooCollapsed: function() {
            return this.sprite.x > WIDTH || this.sprite.y > HEIGHT;
        },

        isPaperExtended: function() {
            return this.extended && this.type == 0;
        },
        isScissorsExtended: function() {
            return this.extended && this.type == 1;
        },
        isStoneExtended: function() {
            return this.extended && this.type == 2;
        },
        ...newArm(ARM_DEFAULT_ANGLE, ARM_SHAKE_AMPLITUDE)
    };

    var people = {
        primary: {
            arm: newArm(PEOPLE_ARM_DEFAULT_ANGLE, PEOPLE_ARM_SHAKE_AMPLITUDE),
            body: {},
            head: {},
            sprite: null,
            expectation: {},
        },
        queue: null,
        fadeoutQueue: null
    };

    var controls = {
        shake: null,
        nextHandButton: null,
        mouse: null,
        pressesShake: function() {
            return this.shake.isDown || this.mouse.isDown;
        }
    }

    function newArm(defaultAngle, angleMagnitude) {
        return {
            defaultAngle: defaultAngle,
            angleMagnitude: angleMagnitude
        };
    }

    function newPerson(kind) {
        var sprite = game.add.sprite(0, 120, kind);

        sprite.anchor.setTo(0.5, 0.5);
        sprite.setScaleMinMax(0.0, 0.0, 1.0, 1.0);
        sprite.scale.setTo(0.2, 0.2);
        sprite.name = kind;
        sprite.data.exitStrategy = randomItem([-1, 1]);

        game.physics.enable(sprite, Phaser.Physics.ARCADE);

        return sprite;
    }
    function newExitPerson(kind) {
        var sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind);

        sprite.anchor.setTo(0.5, 0.5);
        //sprite.setScaleMinMax(0.0, 0.0, 1.0, 1.0);
        //sprite.scale.setTo(0.2, 0.2);
        sprite.name = kind;
        sprite.data.exitStrategy = randomItem([-1, 1]);

        game.physics.enable(sprite, Phaser.Physics.ARCADE);

        return sprite;
    }

    function newPrimary(kind) {
        people.primary.sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind);
        people.primary.sprite.anchor.setTo(0.5, 0.5);
        people.primary.sprite.visibile = false;
        people.primary.sprite.name = kind;
        people.primary.body.sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind + '-body');
        people.primary.body.sprite.anchor.setTo(0.5, 0.5 - (70.5 / 409.0)); //people.businessman.sprite.y += 70.5;
        people.primary.head.sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind + '-head');
        people.primary.head.sprite.alignIn(people.primary.body.sprite, Phaser.TOP_LEFT, -108, -33);
        people.primary.head.sprite.anchor.setTo(0.5, 1.0);
        people.primary.head.sprite.name = kind;
        people.primary.head.origin = {
            x: people.primary.head.sprite.x,
            y: people.primary.head.sprite.y
        };
        people.primary.arm.sprite = game.add.sprite(0, 0, kind + '-arm');
        people.primary.arm.sprite.alignIn(people.primary.body.sprite, Phaser.TOP_LEFT, -18, -113);
        people.primary.arm.sprite.anchor.setTo(0.5, 17.0 / 137.0);
        people.primary.arm.sprite.angle = PEOPLE_ARM_DEFAULT_ANGLE;

        game.physics.enable(people.primary.head.sprite, Phaser.Physics.ARCADE);
        game.physics.enable(people.primary.sprite, Phaser.Physics.ARCADE);
        game.physics.enable(people.primary.arm.sprite, Phaser.Physics.ARCADE);

        if (kind === 'businessman') {
            people.primary.expectation = newExpectation([0], [1, 2], 5000);
        } else if (kind === 'punk') {
            people.primary.expectation = newExpectation([1], [0, 2], 5000);
        } else if (kind === 'granny') {
            people.primary.expectation = newExpectation([0], [1, 2], 5000);
        } else if (kind === 'nazi') {
            people.primary.expectation = newExpectation([0], [1, 2], 5000);
        } else if (kind === 'rapper') {
            people.primary.expectation = newExpectation([2], [0, 1], 5000);
        } else if (kind === 'alien') {
            people.primary.expectation = newExpectation([0], [1, 2], 5000);
        }

        setPrimaryVisible(true);
    }
    function destroyPrimary() {
        people.primary.body.sprite.destroy();
        people.primary.head.sprite.destroy();
        people.primary.arm.sprite.destroy();
        people.primary.sprite.destroy();
    }

    function newExpectation(happys, ouchs, stamina, power=10, shakables=[0], multiplier=1) {
        return {
            happyTypes: happys,
            ouchTypes: ouchs,
            stamina: stamina,
            powerGain: power,
            shakables: shakables,
            multiplier: multiplier
        };
    }

    function preload () {
        game.load.image('background', 'assets/level-01.png');

        game.load.image('button-paper', 'assets/button/button-hand-paper.png');
        game.load.image('button-scissors', 'assets/button/button-hand-scissors.png');
        game.load.image('button-stone', 'assets/button/button-hand-stone.png');

        game.load.image('businessman', 'assets/businessman/businessman-complete.png');
        game.load.image('businessman-head', 'assets/businessman/head.png');
        game.load.image('businessman-head-idle', 'assets/businessman/head-idle.png');
        game.load.image('businessman-head-happy', 'assets/businessman/head-happy.png');
        game.load.image('businessman-head-ouch', 'assets/businessman/head-ouch.png');
        game.load.image('businessman-body', 'assets/businessman/businessman-body.png');
        game.load.image('businessman-arm', 'assets/businessman/businessman-arm-lower.png');

        game.load.image('granny', 'assets/granny/granny-complete.png');
        game.load.image('granny-head', 'assets/granny/head.png');
        game.load.image('granny-head-idle', 'assets/granny/head-idle.png');
        game.load.image('granny-head-happy', 'assets/granny/head-happy.png');
        game.load.image('granny-head-ouch', 'assets/granny/head-ouch.png');
        game.load.image('granny-body', 'assets/granny/granny-body.png');
        game.load.image('granny-arm', 'assets/granny/granny-arm.png');

        game.load.image('punk', 'assets/punk/punk-complete.png');
        game.load.image('punk-head', 'assets/punk/head.png');
        game.load.image('punk-head-idle', 'assets/punk/head-idle.png');
        game.load.image('punk-head-happy', 'assets/punk/head-happy.png');
        game.load.image('punk-head-ouch', 'assets/punk/head-ouch.png');
        game.load.image('punk-body', 'assets/punk/punk-body.png');
        game.load.image('punk-arm', 'assets/punk/punk-arm-lower.png');

        game.load.image('alien', 'assets/alien/alien-complete.png');
        game.load.image('alien-head', 'assets/alien/head.png');
        game.load.image('alien-head-idle', 'assets/alien/head-idle.png');
        game.load.image('alien-head-happy', 'assets/alien/head-happy.png');
        game.load.image('alien-head-ouch', 'assets/alien/head-ouch.png');
        game.load.image('alien-body', 'assets/alien/alien-body.png');
        game.load.image('alien-arm', 'assets/alien/alien-arm.png');

        game.load.image('rapper', 'assets/rapper/rapper-complete.png');
        game.load.image('rapper-head', 'assets/rapper/head.png');
        game.load.image('rapper-head-idle', 'assets/rapper/head-idle.png');
        game.load.image('rapper-head-happy', 'assets/rapper/head-happy.png');
        game.load.image('rapper-head-ouch', 'assets/rapper/head-ouch.png');
        game.load.image('rapper-body', 'assets/rapper/rapper-body.png');
        game.load.image('rapper-arm', 'assets/rapper/rapper-arm.png');

        game.load.image('arm', 'assets/hand/hand-paper.png');
        game.load.image('arm-scissor', 'assets/hand/hand-scissor.png');
        game.load.image('arm-stone', 'assets/hand/hand-stone.png');
    }

    function create () {
        game.add.tileSprite(0, 0, WIDTH, HEIGHT, 'background');
        //game.stage.backgroundColor = '#aaaa00';

        // Maintain aspect ratio
        game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

        // Background and fadeout people
        people.queue = game.add.group();
        people.queue.add(newPerson('punk'));
        people.fadeoutQueue = game.add.group();

        // Primary person
        //newPrimary('businessman');

        // Arm
        arm.sprite = game.add.sprite(WIDTH, HEIGHT, 'arm');
        game.physics.enable(arm.sprite, Phaser.Physics.ARCADE);
        resetArm();

        //people.primary.arm.sprite.bringToTop();

        // Buttons
        controls.nextHandButton = game.add.button(0, HEIGHT - 60, 'button-scissors', onNextHand, this, 2, 1, 0);

        // Input
        arm.sprite.inputEnabled = true;
        arm.sprite.events.onInputDown.add(onArmMove, this);
        game.input.onDown.add(onDown, this);
        if (gyro.hasFeature('devicemotion')) {
            gyro.frequency = 50; // ms
            gyro.startTracking(onGyro);
        }

        game.input.keyboard.addKey(Phaser.Keyboard.W).onDown.add(onArmMove, this);
        controls.shake = game.input.keyboard.addKey(Phaser.Keyboard.S);
        controls.shake.onDown.add(onShake, this);
        controls.mouse = game.input.activePointer;
        game.input.keyboard.addKey(Phaser.Keyboard.D).onDown.add(swapArm, this);
    }

    function render() {
        //game.debug.inputInfo(32.0, 32.0);
        debug("powr " + round(arm.power), 2);
        debug("gyro " + round(arm.gyroMagnitude));
    }

    function onDown() {
        // Fullscreen
        if (!game.scale.isFullScreen) {
            game.scale.startFullScreen(false);
            return;
        }
    }

    function onArmMove() {
        // Arm movement state
        arm.move = true;
        if (arm.extended) {
            console.log("collapsing");
        } else {
            console.log("extending");
        }
    }

    function onShake() {
        if (!arm.extended) {
            onArmMove();
            return;
        }

        arm.shake = true;
    }

    function swapArm() {
        if (!arm.extended) {
            arm.type += 1;
            arm.type = arm.type % 3;
            switch(arm.type) {
                case 1:
                    arm.sprite.loadTexture('arm-scissor', 0, false);
                    controls.nextHandButton.loadTexture('button-stone', 0, false);
                    break;
                case 2:
                    arm.sprite.loadTexture('arm-stone', 0, false);
                    controls.nextHandButton.loadTexture('button-paper', 0, false);
                    break;
                default:
                    arm.sprite.loadTexture('arm', 0, false);
                    controls.nextHandButton.loadTexture('button-scissors', 0, false);
            }
        } else {
            onArmMove();
        }
    }

    function onGyro(o) {
        let magnitude = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
        arm.gyroMagnitude = Math.max(magnitude, arm.gyroMagnitude);
    }

    function onNextHand() {
        swapArm();
    }

    function setPrimaryVisible(visibility) {
        people.primary.body.sprite.visibile = visibility;
        people.primary.head.sprite.visibile = visibility;
        people.primary.arm.sprite.visibile = visibility;
    }

    function update() {
        if (!game.scale.isFullScreen) {
            return;
        }

        updateQueuedPeople();
        updateArm();

        // Dirty idle code
        if (people.primary.sprite == null) { return; }
        let headDistance = distance(people.primary.head.origin.x,
                                    people.primary.head.origin.y,
                                    people.primary.head.sprite.x,
                                    people.primary.head.sprite.y);
        if (headDistance > IDLE_MAX_DISTANCE) {
            //people.primary.head.sprite.body.velocity.x = 0;
            //people.primary.head.sprite.body.velocity.y = 0;
            //game.physics.arcade.accelerateToXY(people.primary.head.sprite, WIDTH, HEIGHT, EXTENSION_SPEED);
            //people.primary.head.sprite.position.setTo(people.primary.head.origin.x, people.primary.head.origin.y);
            people.primary.head.sprite.body.velocity.y = -1 * IDLE_HEAD_SPEED;
        } else if (round(headDistance) === 0.0) {
            // Reset and start idling again
            //people.primary.head.sprite.reset(people.primary.head.origin.x, people.primary.head.origin.y);
            people.primary.head.sprite.body.velocity.y = IDLE_HEAD_SPEED;
        }

    }

    function updateQueuedPeople() {
        people.queue.forEach(updateBackgroundPerson, this);
        people.fadeoutQueue.forEach(updateFadeoutPerson, this);
    }
    function updateBackgroundPerson(sprite) {
        if (sprite.x < game.world.centerX) {
            sprite.body.velocity.x = 100;
        } else {
            sprite.body.velocity.x = 0;
            handover(sprite);
            return;
        }
        sprite.body.velocity.y = 100;

        let y = sprite.y;
        let targetY = game.world.centerY;

        let distanceRatio = y / targetY;

        if (distanceRatio >= 1.0) {
            sprite.body.velocity.y = 0;
        }

        sprite.scale.setTo(distanceRatio, distanceRatio);
    }
    function updateFadeoutPerson(sprite) {
        console.log("updating fadeout " + sprite.name + " " + sprite.data.exitStrategy);
        sprite.visibility = true;
        sprite.body.velocity.x = sprite.data.exitStrategy * 150;

        if (sprite.x > 1.5 * WIDTH || sprite.x < -0.5 * WIDTH) {
            people.fadeoutQueue.removeChild(sprite);
            sprite.destroy();
            people.queue.add(newPerson(randomItem(['businessman', 'punk', 'granny', 'alien', 'rapper'])));
        }
    }

    function handover(sprite) {
        oldPrimaryType = null;
        if (people.primary.sprite !== null) {
            oldPrimaryType = people.primary.sprite.name;
        }
        newPrimaryType = sprite.name;

        people.queue.removeChild(sprite);
        sprite.destroy();
        if (people.primary.sprite !== null) {
            destroyPrimary();
        }

        newPrimary(newPrimaryType);

        if (people.primary.sprite !== null) {
            people.fadeoutQueue.add(newExitPerson(oldPrimaryType));
        }

        arm.sprite.bringToTop();

        people.primary.arm.sprite.bringToTop();
    }

    function resetArm() {
        arm.sprite.anchor.setTo(...ARM_IDLE_ANCHOR);
        arm.sprite.x = WIDTH;
        arm.sprite.y = HEIGHT;
        arm.sprite.angle = ARM_DEFAULT_ANGLE;
        arm.extended = false;
        arm.move = false;
    }

    function updateArm() {
        // Extend
        if (arm.hasToExpand()) {
            //game.physics.arcade.accelerateToObject(arm.sprite, people.businessman.arm.sprite, EXTENSION_SPEED);
            arm.sprite.body.velocity.x = -1.0 * EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            arm.sprite.body.velocity.y = -1.0 * EXTENSION_SPEED;
            console.log('negative velo');
        } else if (arm.hasToCollapse()) {
            //game.physics.arcade.accelerateToXY(arm.sprite, WIDTH, HEIGHT, EXTENSION_SPEED);
            arm.sprite.body.velocity.x = EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            arm.sprite.body.velocity.y = EXTENSION_SPEED;
            console.log('positive velo');
        }

        // Extension limit checks
        if (arm.isTooExtended()) {
            console.log("stopping top left");
            arm.extended = true;
            arm.sprite.x = ARM_MIN_POS.x;
            arm.sprite.y = ARM_MIN_POS.y;
            stopArmMovement();
        } else if (arm.isTooCollapsed()) {
            console.log("stopping bottom right");
            stopArmMovement();
            resetArm();
        }

        if (arm.isIdle()) {
            shake();
        } else {
            stopShaking();
        }

        // Shaking
        if (arm.gyroMagnitude >= 20.0) {
            arm.shake = true;
        }

        if (people.primary.sprite == null) { return; }
        if (arm.extended) {
            if (people.primary.expectation.ouchTypes.includes(arm.type)) {
                people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-ouch', 0, false);
                retreat(people.primary.arm)
            } else if (arm.shake || controls.pressesShake()) {
                shake(arm, IDLE_SPEED * 10, arm.angleMagnitude);

                console.log("name: " + people.primary.head.sprite.name);
                if (people.primary.expectation.happyTypes.includes(arm.type)) {
                    shake(people.primary.arm, IDLE_SPEED * 10 + 5, people.primary.arm.angleMagnitude, -1.0);
                    people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-happy', 0, false);
                }
            }
        } else {
            people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head', 0, false);
        }
    }

    function stopArmMovement() {
        if (arm.move) {
            stopPrimaryShaking();
            arm.sprite.body.velocity.setTo(0.0, 0.0);
            arm.sprite.angle = ARM_DEFAULT_ANGLE;
            arm.move = false;
            console.log('stop movement');
        }
    }

    function stopShaking() {
        arm.sprite.body.angularVelocity = 0.0;
        arm.shake = false;
        stopPrimaryShaking();
    }

    function stopPrimaryShaking() {
        if (people.primary.sprite == null) { return; }
        people.primary.arm.sprite.body.angularVelocity = 0.0;
    }

    function shake(armToShake=arm,
                   speed=IDLE_SPEED,
                   magnitude=ARM_IDLE_AMPLITUDE,
                   direction=1.0) {
        let minAngle = armToShake.defaultAngle - magnitude;
        let maxAngle = armToShake.defaultAngle + magnitude;

        if (arm.idleUp) {
            armToShake.sprite.body.angularVelocity = speed * direction;
        } else {
            armToShake.sprite.body.angularVelocity = -1.0 * speed * direction;
        }
        if (armToShake.sprite.angle > maxAngle) {
            armToShake.sprite.angle = maxAngle;
            arm.idleUp = false;
        }
        if (armToShake.sprite.angle < minAngle) {
            armToShake.sprite.angle = minAngle;
            arm.idleUp = true;
        }
    }

    function retreat(armToRetreat,
                     speed=IDLE_SPEED * 50 + 5,
                     direction=1.0,
                     stopAngle=-100) {
        armToRetreat.sprite.body.angularVelocity = -1.0 * speed * direction;
        if (armToRetreat.sprite.angle < stopAngle) {
            armToRetreat.sprite.angle = stopAngle;
        }
    }

    function debug(text, line=1.0) {
        game.debug.text(text, 100.0, HEIGHT - line * 20.0);
    }

    function round(value) {
        return Math.round(value * 100) / 100;
    }

    function random(min, max) {
        return game.rnd.between(min, max);
    }
    function randomItem(items) {
        return game.rnd.pick(items);
    }
    function frac() {
        return game.rnd.frac();
    }
    function distance(x1, y1, x2, y2) {
        return Phaser.Math.distance(x1, y1, x2, y2);
    }

};
