window.onload = function() {

    var game = new Phaser.Game(300, 600, Phaser.AUTO, '', {
        preload: preload,
        create: create,
        update: update
    });

    var logo;
    var arm;

    function preload () {
        game.load.image('logo', 'phaser.png');
        game.load.image('arm', 'assets/arm.png');
    }

    function create () {
        // Maintain aspect ratio
        game.stage.backgroundColor = '#4d4d4d';
        game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

        logo = game.add.sprite(game.world.centerX, game.world.centerY, 'logo');
        logo.anchor.setTo(0.5, 0.5);

        arm = game.add.sprite(game.world.centerX, game.world.centerY, 'arm');
        arm.angle = -30.0;

        game.input.onDown.add(fullscreen, this);
    }

    function fullscreen() {
        if (!game.scale.isFullScreen) {
            game.scale.startFullScreen(false);
        }
    }

    function update() {
    }



};
