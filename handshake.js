window.onload = function() {

    const WIDTH = 300.0;
    const HEIGHT = 600.0;
    const WIDTH_HEIGHT_RATIO = WIDTH / HEIGHT;
    const EXTENSION_SPEED = 2000.0;

    const ARM_DEFAULT_ANGLE = -33.0;
    const PEOPLE_ARM_DEFAULT_ANGLE = ARM_DEFAULT_ANGLE - 15;
    const ARM_IDLE_AMPLITUDE = 2.0;
    const ARM_IDLE_MIN_ANGLE = ARM_DEFAULT_ANGLE - ARM_IDLE_AMPLITUDE;
    const ARM_IDLE_MAX_ANGLE = ARM_DEFAULT_ANGLE + ARM_IDLE_AMPLITUDE;
    const ARM_SHAKE_AMPLITUDE = 10.0; // in degree
    const ARM_IDLE_ANCHOR = [0.5, 0.3];

    var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, '', {
        preload: preload,
        create: create,
        update: update,
        render: render
    });

    var logo;
    var arm = {
        move: false,
        extended: false,
        gyro: null,
        gyroMagnitude: 0.0,
        shake: false,
        idleUp: true,
        isIdle: () => { return !this.move }
    };

    var people = {
        businessman: {
            arm: {},
            body: {},
            head: {}
        },
        queue: []
    };

    var movingBusinessMan = {};

    function preload () {
        //game.load.image('logo', 'phaser.png');
        game.load.image('businessman', 'assets/businessman-complete.png')
        game.load.image('businessman-head', 'assets/businessman-head.png');
        game.load.image('businessman-body', 'assets/businessman-body.png');
        game.load.image('businessman-arm', 'assets/businessman-arm-lower.png');
        game.load.image('arm', 'assets/hand-perspective/hand.png');
    }

    function create () {
        // Maintain aspect ratio
        game.stage.backgroundColor = '#fafa00';
        game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

        //logo = game.add.sprite(0, 0, 'logo');
        //var tmp_bm = game.add.sprite(game.world.centerX, game.world.centerY, 'businessman');
        //tmp_bm.anchor.setTo(0.3, 0.5);

        movingBusinessMan.sprite = game.add.sprite(game.world.centerX, 0, 'businessman');
        movingBusinessMan.sprite.anchor.setTo(0.5, 0.5);
        movingBusinessMan.sprite.setScaleMinMax(0.0, 0.0, 1.0, 1.0);
        movingBusinessMan.sprite.scale.setTo(0.2, 0.2);

        people.businessman.body.sprite = game.add.sprite(game.world.centerX, game.world.centerY, 'businessman-body');
        people.businessman.body.sprite.anchor.setTo(0.5, 0.5 - (70.5 / 409.0)); //people.businessman.sprite.y += 70.5;

        arm.sprite = game.add.sprite(WIDTH, HEIGHT, 'arm');
        arm.sprite.anchor.setTo(...ARM_IDLE_ANCHOR);
        arm.sprite.angle = ARM_DEFAULT_ANGLE;

        people.businessman.arm.sprite = game.add.sprite(0, 0, 'businessman-arm');
        people.businessman.arm.sprite.alignIn(people.businessman.body.sprite, Phaser.TOP_LEFT, -18, -113);
        people.businessman.arm.sprite.anchor.setTo(0.5, 17.0 / 137.0);
        people.businessman.arm.sprite.angle = PEOPLE_ARM_DEFAULT_ANGLE;

        game.physics.enable(movingBusinessMan.sprite, Phaser.Physics.ARCADE);
        game.physics.enable(arm.sprite, Phaser.Physics.ARCADE);

        game.input.onDown.add(onDown, this);
        //game.input.touch.onTouchStart.add(onDown, this);

        if (gyro.hasFeature('devicemotion')) {
            gyro.frequency = 50; // ms
            gyro.startTracking(onGyro);
        } else {
            console.log('no gyro :(');
        }
    }

    function onDown() {
        if (!game.scale.isFullScreen) {
            game.scale.startFullScreen(false);
            return;
        }

        updateCommands();
    }

    function onGyro(o) {
        arm.gyro = o;
        let magnitude = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
        arm.gyroMagnitude = Math.max(magnitude, arm.gyroMagnitude);
    }

    function updateCommands() {
        arm.move = true;
        if (arm.extended) {
            console.log("collapsing");
        } else {
            console.log("extending");
        }
    }

    function update() {
        updateMovingBusinessMan();
        updateArm();
    }

    function updateMovingBusinessMan() {
        movingBusinessMan.sprite.body.velocity.y = 100;
        let y = movingBusinessMan.sprite.y;
        let targetY = game.world.centerY;

        let distanceRatio = y / targetY;

        if (distanceRatio >= 1.0) {
            movingBusinessMan.sprite.body.velocity.y = 0;
        }

        movingBusinessMan.sprite.scale.setTo(distanceRatio, distanceRatio);
    }

    function updateArm() {
        // Extend
        if (!arm.extended && arm.move) {
            arm.sprite.body.velocity.y = -1.0 * EXTENSION_SPEED;
            arm.sprite.body.velocity.x = -1.0 * EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            console.log('negative velo');
        } else if (arm.extended && arm.move) {
            arm.sprite.body.velocity.y = EXTENSION_SPEED;
            arm.sprite.body.velocity.x = EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            console.log('positive velo');
        }

        // Extension limit checks
        if ((arm.sprite.x < 1.5 * WIDTH / 2.0)
            || (arm.sprite.y < 1.5 * HEIGHT / 2.0)) {
            arm.extended = true;
            arm.sprite.x = 1.5 * WIDTH / 2.0;
            arm.sprite.y = 1.5 * HEIGHT / 2.0;
            stopArmExtension();
        } else if (arm.sprite.x > WIDTH || arm.sprite.y > HEIGHT) {
            arm.extended = false;
            arm.sprite.x = WIDTH;
            arm.sprite.y = HEIGHT;
            stopArmExtension();
        }

        // Shaking
        if (arm.gyro != null && arm.gyroMagnitude >= 20.0) {
            arm.shake = true;
        }

        if (arm.isIdle()) {
            if (arm.extended) {
                arm.sprite.anchor.setTo(0.5, 1.0);
            } else {
                arm.sprite.anchor.setTo(...ARM_IDLE_ANCHOR);
            }

            if (arm.idleUp) {
                arm.sprite.angle += 0.1;
            } else {
                arm.sprite.angle -= 0.1;
            }
            if (arm.sprite.angle > ARM_IDLE_MAX_ANGLE) {
                arm.sprite.angle = ARM_IDLE_MAX_ANGLE;
                arm.idleUp = false;
            }
            if (arm.sprite.angle < ARM_IDLE_MIN_ANGLE) {
                arm.sprite.angle = ARM_IDLE_MIN_ANGLE;
                arm.idleUp = true;
            }

            arm.sprite.anchor.setTo(...ARM_IDLE_ANCHOR);
        } else {
            arm.sprite.anchor.setTo(...ARM_IDLE_ANCHOR);
        }

        if (arm.shake) {

        }
    }

    function stopArmExtension() {
        arm.sprite.body.velocity.x = 0.0;
        arm.sprite.body.velocity.y = 0.0;
        arm.move = false;
        console.log('stop extension');
    }

    function render() {
        game.debug.inputInfo(32.0, 32.0);
        game.debug.pointer(game.input.activePointer);
        if (arm.gyro != null) {
            debug("gyro " + round(arm.gyroMagnitude));
            //debug("x" + round(arm.gyro.x) + " y" + round(arm.gyro.y) + " z" + round(arm.gyro.z));
        } else {
            debug("no gyro :(")
        }
    }

    function debug(text, offset=20.0) {
        game.debug.text(text, 0.0, HEIGHT - offset);
    }

    function round(value) {
        return Math.round(value * 100) / 100;
    }

    function translateAnchor(sprite, anchorX, anchorY) {
        let  = sprite.anchor.x;
    }

};
