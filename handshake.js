window.onload = function() {

    const WIDTH = 300.0;
    const HEIGHT = 600.0;
    const WIDTH_HEIGHT_RATIO = WIDTH / HEIGHT;
    const EXTENSION_SPEED = 2000.0;
    const IDLE_SPEED = 8.0;

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
        type: 0, // 0 Paper, 1 scissor, 2 stone
        move: false,
        extended: false,
        sprite: null,
        shake: false,
        idleUp: true,
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
        ...newArm(ARM_DEFAULT_ANGLE, ARM_SHAKE_AMPLITUDE)
    };

    var people = {
        primary: {
            arm: newArm(PEOPLE_ARM_DEFAULT_ANGLE, PEOPLE_ARM_SHAKE_AMPLITUDE),
            body: {},
            head: {},
            group: null,
            expectations: {},
        },
        queue: null
    };

    var controls = {
        shake: null,
        gyroMagnitude: 0.0,
        nextHandButton: null
    }

    function newArm(defaultAngle, angleMagnitude) {
        return {
            defaultAngle: defaultAngle,
            angleMagnitude: angleMagnitude
        };
    }

    function newPerson(kind) {
        var sprite = game.add.sprite(0, 120, kind);

        sprite.anchor.setTo(0.3, 0.5);
        sprite.setScaleMinMax(0.0, 0.0, 1.0, 1.0);
        sprite.scale.setTo(0.2, 0.2);
        sprite.name = kind;

        game.physics.enable(sprite, Phaser.Physics.ARCADE);

        return sprite;
    }

    function newPrimary(kind) {
        people.primary.body.sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind + '-body');
        people.primary.body.sprite.anchor.setTo(0.5, 0.5 - (70.5 / 409.0)); //people.businessman.sprite.y += 70.5;
        people.primary.head.sprite = game.add.sprite(game.world.centerX, game.world.centerY, kind + '-head');
        people.primary.head.sprite.alignIn(people.primary.body.sprite, Phaser.TOP_LEFT, -108, -33);
        people.primary.head.sprite.anchor.setTo(0.5, 1.0);
        people.primary.head.sprite.name = kind;
        people.primary.arm.sprite = game.add.sprite(0, 0, kind + '-arm');
        people.primary.arm.sprite.alignIn(people.primary.body.sprite, Phaser.TOP_LEFT, -18, -113);
        people.primary.arm.sprite.anchor.setTo(0.5, 17.0 / 137.0);
        people.primary.arm.sprite.angle = PEOPLE_ARM_DEFAULT_ANGLE;

        game.physics.enable(people.primary.arm.sprite, Phaser.Physics.ARCADE);

        people.primary.expectations = {
            happyTypes: [0],
            ouchTypes: [1, 2],
            shakeMagnitude: 100000000 // huge ;)
        }

        setPrimaryVisible(true);
    }

    function preload () {
        game.load.image('background', 'assets/level-01.png');

        game.load.image('button-paper', 'assets/button/button-hand-paper.png');
        game.load.image('button-scissors', 'assets/button/button-hand-scissors.png');
        game.load.image('button-stone', 'assets/button/button-hand-stone.png');

        game.load.image('businessman', 'assets/businessman/businessman-complete.png');
        game.load.image('businessman-head', 'assets/businessman/head05.png');
        game.load.image('businessman-head-happy', 'assets/businessman/head-happy.png');
        game.load.image('businessman-head-ouch', 'assets/businessman/head-ouch.png');
        game.load.image('businessman-body', 'assets/businessman/businessman-body.png');
        game.load.image('businessman-arm', 'assets/businessman/businessman-arm-lower.png');

        game.load.image('granny', 'assets/granny/granny-complete.png');

        game.load.image('arm', 'assets/hand/hand-paper.png');
        game.load.image('arm-scissor', 'assets/hand/hand-scissor.png');
        game.load.image('arm-stone', 'assets/hand/hand-stone.png');
    }

    function create () {
        game.add.tileSprite(0, 0, WIDTH, HEIGHT, 'background');
        //game.stage.backgroundColor = '#aaaa00';

        // Maintain aspect ratio
        game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

        // BG people
        people.queue = game.add.group();
        people.queue.add(newPerson('granny'));

        // Primary person
        newPrimary('businessman')

        // Arm
        arm.sprite = game.add.sprite(WIDTH, HEIGHT, 'arm');
        game.physics.enable(arm.sprite, Phaser.Physics.ARCADE);
        resetArm();

        people.primary.arm.sprite.bringToTop();

        // Buttons
        controls.nextHandButton = game.add.button(0, HEIGHT - 60, 'button-scissors', onNextHand, this, 2, 1, 0);

        // Input
        arm.sprite.inputEnabled = true;
        arm.sprite.events.onInputDown.add(onHandDown, this);
        game.input.onDown.add(onDown, this);
        if (gyro.hasFeature('devicemotion')) {
            gyro.frequency = 50; // ms
            gyro.startTracking(onGyro);
        }

        controls.shake = game.input.keyboard.addKey(Phaser.Keyboard.S);
        game.input.keyboard.addKey(Phaser.Keyboard.D).onDown.add(swapArm, this);
    }

    function render() {
        game.debug.inputInfo(32.0, 32.0);
        //game.debug.pointer(game.input.activePointer);
        if (arm.gyro != null) {
            debug("gyro " + round(arm.gyroMagnitude));
            //debug("x" + round(arm.gyro.x) + " y" + round(arm.gyro.y) + " z" + round(arm.gyro.z));
        } else {
            debug("no gyro :( power: " + controls.gyroMagnitude)
        }
    }

    function onDown() {
        // Fullscreen
        if (!game.scale.isFullScreen) {
            game.scale.startFullScreen(false);
            return;
        }
    }

    function onHandDown() {
        // Arm movement state
        arm.move = true;
        if (arm.extended) {
            console.log("collapsing");
        } else {
            console.log("extending");
        }
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
        }
    }

    function onGyro(o) {
        //arm.gyro = o;
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
    }

    function updateQueuedPeople() {
        people.queue.forEach(updateBackgroundPerson, this);
    }
    function updateBackgroundPerson(sprite) {
        if (sprite.x < game.world.centerX) {
            sprite.body.velocity.x = 100;
        } else {
            sprite.body.velocity.x = 0;
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
        if (arm.gyro != null && arm.gyroMagnitude >= 20.0) {
            arm.shake = true;
        }
        if (arm.extended && (arm.shake || controls.shake.isDown)) {
            shake(arm, IDLE_SPEED * 10, arm.angleMagnitude);

            console.log("name: " + people.primary.head.sprite.name);
            if (people.primary.expectations.happyTypes.includes(arm.type)) {
                shake(people.primary.arm, IDLE_SPEED * 10 + 5, people.primary.arm.angleMagnitude, -1.0);
                people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-happy', 0, false);
            } else if (people.primary.expectations.ouchTypes.includes(arm.type)) {
                people.primary.head.sprite.loadTexture(people.primary.head.sprite.name + '-head-ouch', 0, false);
            }
        }
    }

    function stopArmMovement() {
        if (arm.move) {
            stopShaking();
            arm.sprite.body.velocity.setTo(0.0, 0.0);
            arm.sprite.angle = ARM_DEFAULT_ANGLE;
            arm.move = false;
            console.log('stop movement');
        }
    }

    function stopShaking() {
        arm.sprite.body.angularVelocity = 0.0;
        people.primary.arm.sprite.body.angularVelocity = 0.0;
        arm.shake = false;
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

    function debug(text, offset=20.0) {
        game.debug.text(text, 100.0, HEIGHT - offset);
    }

    function round(value) {
        return Math.round(value * 100) / 100;
    }

    function translateAnchor(sprite) {
        let moveX = WIDTH - sprite.x;
        let moveY = HEIGHT - sprite.y;

        let offsetRatioX = moveX / arm.sprite.width;
        let offsetRatioY = moveY / arm.sprite.height;
        console.log("ox" + offsetRatioX + " oy" + offsetRatioY);

        sprite.position.setTo(sprite.x + moveX, sprite.y + moveY);
        sprite.anchor.setTo(ARM_IDLE_ANCHOR[0] + offsetRatioX,
                            ARM_IDLE_ANCHOR[1] + offsetRatioY);
    }

};
