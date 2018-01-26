window.onload = function() {

    const WIDTH = 300.0;
    const HEIGHT = 600.0;
    const WIDTH_HEIGHT_RATIO = WIDTH / HEIGHT;
    const EXTENSION_SPEED = 2000.0;

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
        gyro: null
    };

    function preload () {
        game.load.image('logo', 'phaser.png');
        game.load.image('arm', 'assets/arm.png');
    }

    function create () {
        // Maintain aspect ratio
        game.stage.backgroundColor = '#4d4d4d';
        game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

        logo = game.add.sprite(0, 0, 'logo');

        arm.sprite = game.add.sprite(WIDTH, HEIGHT, 'arm');
        arm.sprite.anchor.setTo(0.5, 0.5);
        arm.sprite.angle = -30.0;
        game.physics.enable(arm.sprite, Phaser.Physics.ARCADE);

        game.input.onDown.add(onDown, this);
        //game.input.touch.onTouchStart.add(onDown, this);

        if (gyro.hasFeature('devicemotion')) {
            gyro.frequency = 100;
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
        updateArm();
    }

    function updateArm() {
        if (!arm.extended && arm.move) {
            arm.sprite.body.velocity.y = -1.0 * EXTENSION_SPEED;
            arm.sprite.body.velocity.x = -1.0 * EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            console.log('negative velo');
        } else if (arm.extended && arm.move) {
            arm.sprite.body.velocity.y = EXTENSION_SPEED;
            arm.sprite.body.velocity.x = EXTENSION_SPEED * WIDTH_HEIGHT_RATIO;
            console.log('positive velo');
        }

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
            debug("x" + arm.gyro.x + " y" + arm.gyro.y + " z" + arm.gyro.z);
        }
    }

    function debug(text) {
        game.debug.text(text, 0.0, HEIGHT - 20.0);
    }

};
