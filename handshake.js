window.onload = function() {

    const WIDTH = 300.0;
    const HEIGHT = 600.0;
    const WIDTH_HEIGHT_RATIO = WIDTH / HEIGHT;
    const EXTENSION_SPEED = 2000.0;

    // Person types
    const FIRST_PERSON = 'businessman';
    const PERSONS = ['businessman', 'punk', 'nazi', 'granny', 'alien', 'rapper'];

    // Head idling
    const IDLE_MAX_DISTANCE = 2.0;
    const IDLE_HEAD_SPEED = 5.0;

    const IDLE_BLINK_DURATION = 150.0; // ms
    const IDLE_BLINK_WAIT = 3000.0; // ms

    // Arms and shaking
    const ARM_DEFAULT_ANGLE = -33.0;
    const ARM_IDLE_SPEED = 8.0;
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
    const POWER_SHAKE_PENALTY = 10;
    const POWER_SHAKE_KARMA_PENALTY = 1;
    const POWER_SHAKE_PENALTY_MULTIPLIER = 0.1;

    var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, '', {
        preload: preload,
        create: create,
        update: update,
        render: render
    });

    var arm = {
        power: 0.0,
        setPower: function(newPower) {
            this.power = newPower;
            controls.power.setText('' + Math.round(this.power));
        },
        addPower: function(toAdd) {
            this.setPower(this.power + toAdd);
        },
        reducePower: function(penalty) {
            if (this.power >= 0.0) {
                this.addPower(-1.0 * penalty);
            } else {
                this.addPower(penalty);
            }
        },
        multiplier: 1.0,
        karma: 0, // Positive: kindness, negative: infections
        reduceKarma: function(penalty) {
            if (this.karma >= 0.0) {
                this.karma -= penalty;
            } else {
                this.karma += penalty;
            }
        },
        shakeTime: 0.0, // ms
        type: 0, // 0 Paper, 1 scissor, 2 stone
        move: false,
        extended: false,
        sprite: null,
        shake: false,
        idleUp: true,
        gyroMagnitude: 0.0,
        disease: '',
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
            timeWithoutBlink: 0,
            playIntro: function() {
                if (this.sprite == null) { return; }
                dispatchAudio(sounds[this.sprite.name].intro);
            },
            playPositive: function() {
                if (this.sprite == null) { return; }
                dispatchAudio(sounds[this.sprite.name].positive);
            },
            playNegative: function() {
                if (this.sprite == null) { return; }
                dispatchAudio(sounds[this.sprite.name].negative);
            },
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
        },
        power: ''
    }

    var sounds = {
        businessman: {},
        granny: {},
        punk: {},
        nazi: {},
        rapper: {},
        alien: {},
        arm: {}
    }

    function newArm(defaultAngle, angleMagnitude) {
        return {
            defaultAngle: defaultAngle,
            angleMagnitude: angleMagnitude
        };
    }

    function newPerson(kind) {
        let startX = randomItem([-50, 350]);
        var sprite = game.add.sprite(startX, 95, kind);

        sprite.anchor.setTo(0.5, 0.5);
        sprite.setScaleMinMax(0.0, 0.0, 1.0, 1.0);
        sprite.scale.setTo(0.1, 0.1);
        sprite.name = kind;
        sprite.data.exitStrategy = randomItem([-1, 1]);

        game.physics.enable(sprite, Phaser.Physics.ARCADE);

        return sprite;
    }
    function newExitPerson(kind) {
        var sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind);

        sprite.anchor.setTo(0.5, 0.5);
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
        people.primary.arm.sprite.name = kind;
        people.primary.arm.sprite.alignIn(people.primary.body.sprite, Phaser.TOP_LEFT, -18, -113);
        people.primary.arm.sprite.anchor.setTo(0.5, 17.0 / 137.0);
        people.primary.arm.sprite.angle = (kind === 'nazi') ? 180 : PEOPLE_ARM_DEFAULT_ANGLE;
        people.primary.arm.defaultAngle = (kind === 'nazi') ? 175 : ARM_DEFAULT_ANGLE;

        game.physics.enable(people.primary.head.sprite, Phaser.Physics.ARCADE);
        game.physics.enable(people.primary.sprite, Phaser.Physics.ARCADE);
        game.physics.enable(people.primary.arm.sprite, Phaser.Physics.ARCADE);

        people.primary.timeWithoutBlink = 0.0;

        if (kind === 'businessman') {
            people.primary.expectation = newExpectation([0], [1, 2], 4000);
        } else if (kind === 'punk') {
            people.primary.expectation = newExpectation([1], [0, 2], 3000, 5000, 0, -10);
        } else if (kind === 'granny') {
            people.primary.expectation = newExpectation([0], [1, 2], 1500, 5000, 1);
        } else if (kind === 'nazi') {
            people.primary.expectation = newExpectation([0], [1, 2], 2000, 5000, -1, -10);
        } else if (kind === 'rapper') {
            people.primary.expectation = newExpectation([2], [0, 1], 12000, 5000, 0, 10, [], 2);
        } else if (kind === 'alien') {
            let moves = [0, 1, 2];
            let favMove = randomItem(moves);
            delete moves[favMove];
            let powerGain = randomItem([10, -10]);
            people.primary.expectation = newExpectation([favMove], moves, 10000, 5000, 0, powerGain);
        }

        people.primary.playIntro();
        setPrimaryVisible(true);
        people.primary.sprite.kill();
    }
    function destroyPrimary() {
        people.primary.body.sprite.destroy();
        people.primary.head.sprite.destroy();
        people.primary.arm.sprite.destroy();
        people.primary.sprite.destroy();
        people.primary.sprite = null;
    }

    function newExpectation(happys, ouchs, stamina, patience=5000, karma=0, power=10, shakables=[0], multiplier=1) {
        return {
            happyTypes: happys,
            ouchTypes: ouchs,
            stamina: stamina,
            patience: patience,
            karma: karma,
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

        game.load.image('nazi', 'assets/nazi/nazi-complete.png');
        game.load.image('nazi-head', 'assets/nazi/head.png');
        game.load.image('nazi-head-idle', 'assets/nazi/head-idle.png');
        game.load.image('nazi-head-happy', 'assets/nazi/head-happy.png');
        game.load.image('nazi-head-ouch', 'assets/nazi/head-ouch.png');
        game.load.image('nazi-body', 'assets/nazi/nazi-body.png');
        game.load.image('nazi-arm', 'assets/nazi/nazi-arm.png');

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

        game.load.image('arm-paper', 'assets/hand/hand-paper.png');
        game.load.image('arm-scissor', 'assets/hand/hand-scissor.png');
        game.load.image('arm-stone', 'assets/hand/hand-stone.png');
        game.load.image('arm-paper-dirty', 'assets/hand/hand-paper-poisoned.png');
        game.load.image('arm-scissor-dirty', 'assets/hand/hand-scissor-poisoned.png');
        game.load.image('arm-stone-dirty', 'assets/hand/hand-stone-poisoned.png');

        // Audio
        game.load.audio('businessman-intro', ['assets/businessman/businessman-intro.ogg']);
        game.load.audio('businessman-positive', ['assets/businessman/businessman-positiv.ogg']);
        game.load.audio('businessman-negative', ['assets/businessman/businessman-negativ.ogg']);

        game.load.audio('granny-intro', ['assets/granny/granny-intro.ogg']);
        game.load.audio('granny-positive', ['assets/granny/granny-positiv.ogg']);
        game.load.audio('granny-negative', ['assets/granny/granny-negativ.ogg']);

        game.load.audio('punk-intro', ['assets/punk/punk-intro.ogg']);
        game.load.audio('punk-positive', ['assets/punk/punk-positiv.ogg']);
        game.load.audio('punk-negative', ['assets/punk/punk-negativ.ogg']);

        game.load.audio('nazi-intro', ['assets/nazi/nazi-intro.ogg']);
        game.load.audio('nazi-positive', ['assets/nazi/nazi-positiv.ogg']);
        game.load.audio('nazi-negative', ['assets/nazi/nazi-negativ.ogg']);

        game.load.audio('alien-intro', ['assets/alien/alien-intro.ogg']);
        game.load.audio('alien-positive', ['assets/alien/alien-positiv.ogg']);
        game.load.audio('alien-negative', ['assets/alien/alien-negativ.ogg']);

        game.load.audio('rapper-intro', ['assets/rapper/rapper-intro.mp3']);
        game.load.audio('rapper-positive', ['assets/rapper/rapper-positiv-bro.ogg']);
        game.load.audio('rapper-negative', ['assets/rapper/rapper-negativ.mp3']);

        game.load.audio('arm-punch', ['assets/audio/system-punch-hard.ogg']);
        game.load.audio('arm-punch-mega', ['assets/audio/system-punch-strong.ogg']);
        game.load.audio('arm-cough', ['assets/audio/system-husten.ogg']);
        game.load.audio('arm-heal', ['assets/audio/system-handclean.ogg']);
    }

    function create () {
        game.add.tileSprite(0, 0, WIDTH, HEIGHT, 'background');
        //game.stage.backgroundColor = '#aaaa00';

        // Maintain aspect ratio
        game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

        // Create sounds
        sounds.businessman.intro = game.add.audio('businessman-intro');
        sounds.businessman.positive = game.add.audio('businessman-positive');
        sounds.businessman.negative = game.add.audio('businessman-negative');
        sounds.granny.intro = game.add.audio('granny-intro');
        sounds.granny.positive = game.add.audio('granny-positive');
        sounds.granny.negative = game.add.audio('granny-negative');
        sounds.punk.intro = game.add.audio('punk-intro');
        sounds.punk.positive = game.add.audio('punk-positive');
        sounds.punk.negative = game.add.audio('punk-negative');
        sounds.nazi.intro = game.add.audio('nazi-intro');
        sounds.nazi.positive = game.add.audio('nazi-positive');
        sounds.nazi.negative = game.add.audio('nazi-negative');
        sounds.alien.intro = game.add.audio('alien-intro');
        sounds.alien.positive = game.add.audio('alien-positive');
        sounds.alien.negative = game.add.audio('alien-negative');
        sounds.rapper.intro = game.add.audio('rapper-intro');
        sounds.rapper.positive = game.add.audio('rapper-positive');
        sounds.rapper.negative = game.add.audio('rapper-negative');

        sounds.arm.punch = game.add.audio('arm-punch');
        sounds.arm.punchmega = game.add.audio('arm-punch-mega');
        sounds.arm.heal = game.add.audio('arm-heal');
        sounds.arm.cough = game.add.audio('arm-cough');

        // Background and fadeout people
        people.queue = game.add.group();
        people.queue.add(newPerson(FIRST_PERSON));
        people.fadeoutQueue = game.add.group();

        // Primary person
        //newPrimary('businessman');

        // Arm
        arm.sprite = game.add.sprite(WIDTH, HEIGHT, 'arm-paper');
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
        game.input.keyboard.addKey(Phaser.Keyboard.P).onDown.add(powerShake, this);
        game.input.keyboard.addKey(Phaser.Keyboard.H).onDown.add(gesundheit, this);
        game.input.keyboard.addKey(Phaser.Keyboard.M).onDown.add(takeMeds, this);

        // "UI"
        controls.power = game.add.text(6, 6, '', { font: "20pt Courier", fill: "#19cb65", stroke: "#119f4e", strokeThickness: 2 });
        arm.setPower(0);
    }

    function render() {
        //game.debug.inputInfo(32.0, 32.0);
        //debug("shakeTime " + round(arm.shakeTime));
        //game.debug.sound(6, 40);
        //debug('karma ' + round(arm.karma));
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
        if (!arm.extended) {
            lastAudio = undefined;
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
            setArmType(arm.type + 1);
        } else {
            onArmMove();
        }
    }
    function setArmType(type) {
        arm.type = type % 3;
        switch(arm.type) {
            case 1:
                arm.sprite.loadTexture('arm-scissor' + arm.disease, 0, false);
                controls.nextHandButton.loadTexture('button-stone', 0, false);
                break;
            case 2:
                arm.sprite.loadTexture('arm-stone' + arm.disease, 0, false);
                controls.nextHandButton.loadTexture('button-paper', 0, false);
                break;
            default:
                arm.sprite.loadTexture('arm-paper' + arm.disease, 0, false);
                controls.nextHandButton.loadTexture('button-scissors', 0, false);
        }
    }

    function powerShake() {
        // Punch!
        setArmType(2);
        onArmMove();
        dispatchAudio(randomItem([sounds.arm.punch, sounds.arm.punchmega]));
        fadeoutPrimary(true);
    }

    function takeMeds() {
        arm.disease = '';
        setArmType(arm.type); // Refresh texture
        dispatchAudio(sounds.arm.heal);
        reduceArmPowerAfterCheat();
    }

    function gesundheit() {
        arm.disease = '-dirty';
        setArmType(arm.type); // Refresh texture
        dispatchAudio(sounds.arm.cough);
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

        updatePrimary();
        updatePrimaryIdle();

        updatePowerAndStamina();
    }

    function updatePrimaryIdle() {
        if (people.primary.sprite == null) { return; }
        let headDistance = distance(people.primary.head.origin.x,
                                    people.primary.head.origin.y,
                                    people.primary.head.sprite.x,
                                    people.primary.head.sprite.y);
        if (headDistance > IDLE_MAX_DISTANCE) {
            people.primary.head.sprite.body.velocity.y = -1 * IDLE_HEAD_SPEED;
        } else if (round(headDistance) === 0.0) {
            // Reset and start idling again
            people.primary.head.sprite.body.velocity.y = IDLE_HEAD_SPEED;
        }

        // Blinking
        let headState = people.primary.head.sprite.key;
        if (arm.extended && (headState.endsWith('happy') || headState.endsWith('ouch'))) { return; }
        people.primary.timeWithoutBlink += game.time.elapsed;
        setPrimaryIdleTexture();
    }
    function setPrimaryIdleTexture() {
        if (people.primary.timeWithoutBlink > IDLE_BLINK_WAIT) {
            // Blink
            people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-idle', 0, false);
            people.primary.sprite.name + '-idle'
            people.primary.timeWithoutBlink = 0.0;
        } else if (people.primary.timeWithoutBlink > IDLE_BLINK_DURATION) {
            // Revert back to open eyes
            people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head', 0, false);
        }
    }

    function updateQueuedPeople() {
        people.queue.forEach(updateBackgroundPerson, this);
        people.fadeoutQueue.forEach(updateFadeoutPerson, this);
    }

    const EPSILON = 2.0;
    function updateBackgroundPerson(sprite) {
        if (people.primary.sprite !== null) { return; }

        if (sprite.x < game.world.centerX - EPSILON) {
            sprite.body.velocity.x = 100;
        } else if (sprite.x > game.world.centerX + EPSILON) {
            sprite.body.velocity.x = -100;
        } else {
            sprite.body.velocity.x = 0;
        }

        if (sprite.y < game.world.centerY) {
            if (sprite.x >= 50 && sprite.x <= 250) {
                sprite.body.velocity.y = 100;
            }
        } else {
            sprite.body.velocity.x = 0;
            handover(sprite);
            return;
        }

        let y = sprite.y;
        let targetY = game.world.centerY;

        let distanceRatio = y / targetY;

        if (distanceRatio >= 1.0) {
            sprite.body.velocity.y = 0;
        }

        sprite.scale.setTo(distanceRatio, distanceRatio);
    }

    function updateFadeoutPerson(sprite) {
        sprite.visibility = true;
        sprite.body.velocity.x = sprite.data.exitStrategy * 350;
        sprite.body.velocity.y = 50;

        if (sprite.x > 1.5 * WIDTH || sprite.x < -0.5 * WIDTH) {
            people.fadeoutQueue.removeChild(sprite);
            sprite.destroy();
            people.queue.add(newPerson(randomItem(PERSONS)));
        }
    }

    function handover(sprite) {
        newPrimaryType = sprite.name;

        people.queue.removeChild(sprite);
        sprite.destroy();

        fadeoutPrimary();
        newPrimary(newPrimaryType);

        arm.sprite.bringToTop();
        people.primary.arm.sprite.bringToTop();
    }

    function fadeoutPrimary(powerMove=false) {
        if (people.primary.sprite !== null) {
            if (powerMove) {
                reduceArmPowerAfterCheat();
            }
            people.fadeoutQueue.add(newExitPerson(people.primary.sprite.name));
            destroyPrimary();
        }
    }
    function reduceArmPowerAfterCheat() {
        let penalty = Math.max(POWER_SHAKE_PENALTY, Math.round(Math.abs(arm.power * POWER_SHAKE_PENALTY_MULTIPLIER)));
        arm.reducePower(penalty);

        let karmaPenalty = Math.max(POWER_SHAKE_KARMA_PENALTY, Math.round(Math.abs(arm.karma * POWER_SHAKE_PENALTY_MULTIPLIER)));
        arm.reduceKarma(karmaPenalty);
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
        } else if (arm.hasToCollapse()) {
            //game.physics.arcade.accelerateToXY(arm.sprite, WIDTH, HEIGHT, EXTENSION_SPEED);
            arm.sprite.body.velocity.x = EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            arm.sprite.body.velocity.y = EXTENSION_SPEED;
        }

        // Extension limit checks
        if (arm.isTooExtended()) {
            arm.extended = true;
            arm.sprite.x = ARM_MIN_POS.x;
            arm.sprite.y = ARM_MIN_POS.y;
            stopArmMovement();
        } else if (arm.isTooCollapsed()) {
            stopArmMovement();
            resetArm();
        }

        if (arm.isIdle()) {
            shake();
        } else {
            stopIdleShaking();
        }

        // Fast forward ;)
        if (arm.gyroMagnitude >= 20.0) {
            arm.shake = true;
            powerShake();
            arm.gyroMagnitude = 0.0;
        }
    }

    function updatePrimary() {
        if (people.primary.sprite == null) { return; }
        if (!(arm.shake || controls.pressesShake())) {
            arm.shakeTime = 0.0;
        }
        if (arm.extended) {
            if (people.primary.expectation.ouchTypes.includes(arm.type)) {
                people.primary.playNegative();
                people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-ouch', 0, false);
                retreat(people.primary.arm)
            } else if (arm.shake || controls.pressesShake()) {
                shake(arm, ARM_IDLE_SPEED * 10, arm.angleMagnitude);

                if (people.primary.expectation.happyTypes.includes(arm.type)) {
                    shake(people.primary.arm, ARM_IDLE_SPEED * 10 + 5, people.primary.arm.angleMagnitude, -1.0);
                    people.primary.playPositive();
                    people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-happy', 0, false);
                }
            }
        } else {
            setPrimaryIdleTexture();
        }
    }

    function stopArmMovement() {
        if (arm.move) {
            stopPrimaryShaking();
            arm.sprite.body.velocity.setTo(0.0, 0.0);
            arm.sprite.angle = ARM_DEFAULT_ANGLE;
            arm.move = false;
        }
    }

    function stopIdleShaking() {
        arm.sprite.body.angularVelocity = 0.0;
        arm.shake = false;
        stopPrimaryShaking();
    }

    function stopPrimaryShaking() {
        if (people.primary.sprite == null) { return; }
        people.primary.arm.sprite.body.angularVelocity = 0.0;
    }

    function shake(armToShake=arm,
                   speed=ARM_IDLE_SPEED,
                   magnitude=ARM_IDLE_AMPLITUDE,
                   direction=1.0) {
        if (magnitude > ARM_IDLE_AMPLITUDE) {
            // Active shake, record time
            arm.shakeTime += game.time.elapsed;
        }

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

    function updatePowerAndStamina() {
        if (people.primary.expectation.stamina - arm.shakeTime <= 0) {
            arm.addPower((people.primary.expectation.stamina / 1000) * people.primary.expectation.powerGain * arm.multiplier);
            arm.shakeTime = 0.0;

            if (arm.disease !== '') {
                arm.karma -= 1;
            }
            arm.karma += people.primary.expectation.karma;

            fadeoutPrimary();
        }

        // Kindness / infections
        arm.addPower(arm.karma * (game.time.elapsed / 1000));
    }

    function retreat(armToRetreat,
                     speed=ARM_IDLE_SPEED * 50 + 5,
                     direction=1.0,
                     stopAngle=-100) {
        let isNazi = armToRetreat.sprite.name === 'nazi';
        if (isNazi) {
            stopAngle = 180;
        }

        if (!isNazi) {
            armToRetreat.sprite.body.angularVelocity = -1.0 * speed * direction;
        } else {
            armToRetreat.sprite.body.angularVelocity = speed * direction;
        }

        if (!isNazi && armToRetreat.sprite.angle < stopAngle) {
            armToRetreat.sprite.angle = stopAngle;
        } else if (isNazi && armToRetreat.sprite.angle < stopAngle) {
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

    var lastAudio = undefined;
    function dispatchAudio(audio) {
        // MEGA HACK
        let punchAudioGroup = [sounds.arm.punch, sounds.arm.punchmega];
        if (punchAudioGroup.includes(lastAudio)
            && punchAudioGroup.includes(audio)) {
            return;
        }

        // Normal, non-hacky behaviour
        if (audio != lastAudio) {
            if (audio == undefined) { return; }
            audio.play('', 0, 1, false, false);
            lastAudio = audio;
        }
    }

};
