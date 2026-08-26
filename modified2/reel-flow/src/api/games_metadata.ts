import { Gamepad2, Brain, RotateCcw, Plane, Crosshair, Shield, Zap } from 'lucide-react-native';

export const ICON_MAP: Record<string, any> = {
  Gamepad2,
  Brain,
  RotateCcw,
  Plane,
  Crosshair,
  Shield,
  Zap
};

export type GameMetadata = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  thumbnail: string;
  accent: string;
  iconName: string;
};

export const GAMES_METADATA: Record<string, GameMetadata> = {
  "hitball": {
    "id": "hitball",
    "title": "Pinball Precision",
    "subtitle": "Arcade",
    "path": "hitball",
    "thumbnail": "hitball/assets/ball.png",
    "accent": "#F2994A",
    "iconName": "Gamepad2"
  },
  "unforgetday": {
    "id": "unforgetday",
    "title": "A Day to Remember",
    "subtitle": "Adventure",
    "path": "unforgetday",
    "thumbnail": "unforgetday/images/tabicon3.png",
    "accent": "#FF4D1A",
    "iconName": "Shield"
  },
  "puzzle": {
    "id": "puzzle",
    "title": "Jigsaw Puzzle Master",
    "subtitle": "Brain",
    "path": "puzzle",
    "thumbnail": "puzzle/assets/img/jinduBg.png",
    "accent": "#FF4D1A",
    "iconName": "Brain"
  },
  "findpath": {
    "id": "findpath",
    "title": "Pathfinding Solver",
    "subtitle": "Simulation",
    "path": "findpath",
    "thumbnail": "findpath/assets/hero.png",
    "accent": "#27E1C1",
    "iconName": "Brain"
  },
  "minorminer": {
    "id": "minorminer",
    "title": "Little Gold Miner",
    "subtitle": "Arcade",
    "path": "minorminer",
    "thumbnail": "minorminer/assets/img/player-speedo-warp.png",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "breakout3": {
    "id": "breakout3",
    "title": "Brick Breaker 3D",
    "subtitle": "Arcade",
    "path": "breakout3",
    "thumbnail": "breakout3/assets/breakout.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "run": {
    "id": "run",
    "title": "Running Man Challenge",
    "subtitle": "Casual",
    "path": "run",
    "thumbnail": "run/assets/run_bg.jpg",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "fruit": {
    "id": "fruit",
    "title": "Fruit Slasher",
    "subtitle": "Action",
    "path": "fruit",
    "thumbnail": "fruit/assets/logo.png",
    "accent": "#B983FF",
    "iconName": "Zap"
  },
  "charge": {
    "id": "charge",
    "title": "Must Charge!",
    "subtitle": "Casual",
    "path": "charge",
    "thumbnail": "charge/assets/images/title11.png",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "susliks": {
    "id": "susliks",
    "title": "Whack-a-Mole Battle",
    "subtitle": "Arcade",
    "path": "susliks",
    "thumbnail": "susliks/assets/bg.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "petparty": {
    "id": "petparty",
    "title": "Egg Party Dash",
    "subtitle": "Casual",
    "path": "petparty",
    "thumbnail": "petparty/assets/images/game/fullscreen_icon.png",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "arpg": {
    "id": "arpg",
    "title": "Action RPG Quest",
    "subtitle": "RPG",
    "path": "arpg",
    "thumbnail": "arpg/images/logo.png",
    "accent": "#FFD700",
    "iconName": "Shield"
  },
  "rocket": {
    "id": "rocket",
    "title": "Rocket Flight",
    "subtitle": "Simulation",
    "path": "rocket",
    "thumbnail": "rocket/assets/sitelogo-sheet0.png",
    "accent": "#6B8CFF",
    "iconName": "Brain"
  },
  "russianblock": {
    "id": "russianblock",
    "title": "Classic Tetris",
    "subtitle": "Puzzle",
    "path": "russianblock",
    "thumbnail": "russianblock/img/Tetris Clone Logo.png",
    "accent": "#56CCF2",
    "iconName": "Brain"
  },
  "tank": {
    "id": "tank",
    "title": "Modern Tank Battle",
    "subtitle": "Action",
    "path": "tank",
    "thumbnail": "tank/assets/img/player1.png",
    "accent": "#B983FF",
    "iconName": "Zap"
  },
  "getcockscomb": {
    "id": "getcockscomb",
    "title": "Catch the Rooster Comb",
    "subtitle": "Casual",
    "path": "getcockscomb",
    "thumbnail": "getcockscomb/assets/images/title.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "jokingyou": {
    "id": "jokingyou",
    "title": "Joking Around",
    "subtitle": "Casual",
    "path": "jokingyou",
    "thumbnail": "jokingyou/assets/sprites/player/PlayerMask.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "allalive": {
    "id": "allalive",
    "title": "One Must Die",
    "subtitle": "Action",
    "path": "allalive",
    "thumbnail": "allalive/assets/background.jpg",
    "accent": "#56CCF2",
    "iconName": "Zap"
  },
  "fctank": {
    "id": "fctank",
    "title": "NES Battle City",
    "subtitle": "Action",
    "path": "fctank",
    "thumbnail": "fctank/assets/logo.jpg",
    "accent": "#56CCF2",
    "iconName": "Zap"
  },
  "wipeglass": {
    "id": "wipeglass",
    "title": "Glass Cleaning Challenge",
    "subtitle": "Casual",
    "path": "wipeglass",
    "thumbnail": "wipeglass/assets/park-bg.jpg",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "40963": {
    "id": "40963",
    "title": "4096 Mania",
    "subtitle": "Puzzle",
    "path": "40963",
    "thumbnail": "40963/assets/sprites/logo.png",
    "accent": "#6B8CFF",
    "iconName": "Brain"
  },
  "hearthstone": {
    "id": "hearthstone",
    "title": "Hearthstone Card Arena",
    "subtitle": "Card",
    "path": "hearthstone",
    "thumbnail": "hearthstone/assets/attack_icon.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "pixelstar": {
    "id": "pixelstar",
    "title": "Retro Star Catch",
    "subtitle": "Arcade",
    "path": "pixelstar",
    "thumbnail": "",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "blindmoon": {
    "id": "blindmoon",
    "title": "Blind Moon AVG",
    "subtitle": "Adventure",
    "path": "blindmoon",
    "thumbnail": "blindmoon/assets/bg.png",
    "accent": "#56CCF2",
    "iconName": "Shield"
  },
  "doudizhu": {
    "id": "doudizhu",
    "title": "Landlord Poker Clash",
    "subtitle": "Card",
    "path": "doudizhu",
    "thumbnail": "doudizhu/src/client/resources/imgs/background/t_bg.jpg",
    "accent": "#56CCF2",
    "iconName": "Gamepad2"
  },
  "nail": {
    "id": "nail",
    "title": "Avoid the Spikes",
    "subtitle": "Arcade",
    "path": "nail",
    "thumbnail": "nail/assets/bird.png",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "seckill": {
    "id": "seckill",
    "title": "Slash & Loot Quest",
    "subtitle": "Action",
    "path": "seckill",
    "thumbnail": "seckill/assets/backGround.png",
    "accent": "#7CFFB2",
    "iconName": "Zap"
  },
  "candytbc": {
    "id": "candytbc",
    "title": "Candy Monster Intermediate",
    "subtitle": "Casual",
    "path": "candytbc",
    "thumbnail": "candytbc/assets/monster-cover.png",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "planewar": {
    "id": "planewar",
    "title": "Alien Plane Invasion",
    "subtitle": "Shooter",
    "path": "planewar",
    "thumbnail": "planewar/assets/player.png",
    "accent": "#6B8CFF",
    "iconName": "Crosshair"
  },
  "shoot": {
    "id": "shoot",
    "title": "Top-down Shooter",
    "subtitle": "Shooter",
    "path": "shoot",
    "thumbnail": "shoot/assets/bg.jpg",
    "accent": "#27E1C1",
    "iconName": "Crosshair"
  },
  "blockdown": {
    "id": "blockdown",
    "title": "Falling Blocks",
    "subtitle": "Arcade",
    "path": "blockdown",
    "thumbnail": "blockdown/assets/img/i.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "ballgame": {
    "id": "ballgame",
    "title": "Billiards Clash",
    "subtitle": "Sports",
    "path": "ballgame",
    "thumbnail": "ballgame/assets/yellow.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "knifehit3": {
    "id": "knifehit3",
    "title": "Knife Hit Master",
    "subtitle": "Arcade",
    "path": "knifehit3",
    "thumbnail": "knifehit3/assets/target.png",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "twowar": {
    "id": "twowar",
    "title": "Duo Kings Battle",
    "subtitle": "Action",
    "path": "twowar",
    "thumbnail": "twowar/images/background.jpg",
    "accent": "#B983FF",
    "iconName": "Zap"
  },
  "jump": {
    "id": "jump",
    "title": "Jump High",
    "subtitle": "Arcade",
    "path": "jump",
    "thumbnail": "jump/images/bg.jpg",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "eatball": {
    "id": "eatball",
    "title": "Agario Ball Eater",
    "subtitle": "Casual",
    "path": "eatball",
    "thumbnail": "eatball/assets/logo.png",
    "accent": "#6B8CFF",
    "iconName": "Gamepad2"
  },
  "fubag": {
    "id": "fubag",
    "title": "Catch the Lucky Bags",
    "subtitle": "Casual",
    "path": "fubag",
    "thumbnail": "fubag/assets/MainMenu.jpg",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "manna": {
    "id": "manna",
    "title": "Heavenly Blessings",
    "subtitle": "Casual",
    "path": "manna",
    "thumbnail": "manna/images/background.jpg",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "marathon": {
    "id": "marathon",
    "title": "Community Marathon Run",
    "subtitle": "Sports",
    "path": "marathon",
    "thumbnail": "marathon/assets/menu.png",
    "accent": "#6B8CFF",
    "iconName": "Gamepad2"
  },
  "collectstar": {
    "id": "collectstar",
    "title": "Catch Stars",
    "subtitle": "Casual",
    "path": "collectstar",
    "thumbnail": "collectstar/assets/dude.png",
    "accent": "#56CCF2",
    "iconName": "Gamepad2"
  },
  "rpgdemo": {
    "id": "rpgdemo",
    "title": "Retro RPG Quest",
    "subtitle": "RPG",
    "path": "rpgdemo",
    "thumbnail": "rpgdemo/assets/button-menu.png",
    "accent": "#56CCF2",
    "iconName": "Shield"
  },
  "fifty": {
    "id": "fifty",
    "title": "Survive 50 Seconds",
    "subtitle": "Survival",
    "path": "fifty",
    "thumbnail": "fifty/assets/logo.png",
    "accent": "#7CFFB2",
    "iconName": "Zap"
  },
  "snap": {
    "id": "snap",
    "title": "Car Speed Radar Catch",
    "subtitle": "Casual",
    "path": "snap",
    "thumbnail": "snap/assets/images/index-bg.jpg",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "timberpig": {
    "id": "timberpig",
    "title": "Woodcutter Pig",
    "subtitle": "Casual",
    "path": "timberpig",
    "thumbnail": "timberpig/assets/title.png",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "simplechess": {
    "id": "simplechess",
    "title": "Classic Chess Board",
    "subtitle": "Brain",
    "path": "simplechess",
    "thumbnail": "simplechess/assets/images/logo.png",
    "accent": "#27E1C1",
    "iconName": "Brain"
  },
  "attackonball": {
    "id": "attackonball",
    "title": "Attack On Ball",
    "subtitle": "Arcade",
    "path": "attackonball",
    "thumbnail": "attackonball/assets/Title.png",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "dragandmatch": {
    "id": "dragandmatch",
    "title": "Drag & Match",
    "subtitle": "Puzzle",
    "path": "dragandmatch",
    "thumbnail": "dragandmatch/assets/tiles.png",
    "accent": "#7CFFB2",
    "iconName": "Brain"
  },
  "kite": {
    "id": "kite",
    "title": "Fly the Kite",
    "subtitle": "Casual",
    "path": "kite",
    "thumbnail": "kite/assets/mainMenuBg.jpg",
    "accent": "#56CCF2",
    "iconName": "Gamepad2"
  },
  "crazybird": {
    "id": "crazybird",
    "title": "Crazy Bird",
    "subtitle": "Arcade",
    "path": "crazybird",
    "thumbnail": "crazybird/assets/background.jpg",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "hitgraywolf3": {
    "id": "hitgraywolf3",
    "title": "Whack a Wolf",
    "subtitle": "Arcade",
    "path": "hitgraywolf3",
    "thumbnail": "hitgraywolf3/assets/images/logo.png",
    "accent": "#6B8CFF",
    "iconName": "Gamepad2"
  },
  "bottle3": {
    "id": "bottle3",
    "title": "Falling Bottles",
    "subtitle": "Arcade",
    "path": "bottle3",
    "thumbnail": "bottle3/assets/logo_main-sheet0.png",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "tacit": {
    "id": "tacit",
    "title": "Perfect Telepathy Match",
    "subtitle": "Brain",
    "path": "tacit",
    "thumbnail": "tacit/assets/icons/missonicon_green_1.png",
    "accent": "#FFD700",
    "iconName": "Brain"
  },
  "pacman": {
    "id": "pacman",
    "title": "Retro Pacman",
    "subtitle": "Arcade",
    "path": "pacman",
    "thumbnail": "pacman/assets/pill16.png",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "starship": {
    "id": "starship",
    "title": "Interstellar Starship",
    "subtitle": "Simulation",
    "path": "starship",
    "thumbnail": "starship/assets/player.png",
    "accent": "#FF4D1A",
    "iconName": "Brain"
  },
  "shenjingmao": {
    "id": "shenjingmao",
    "title": "Trapping the Crazy Cat",
    "subtitle": "Puzzle",
    "path": "shenjingmao",
    "thumbnail": "shenjingmao/assets/images/bg.jpg",
    "accent": "#FF4D1A",
    "iconName": "Brain"
  },
  "fruitwar": {
    "id": "fruitwar",
    "title": "Fruit War",
    "subtitle": "Action",
    "path": "fruitwar",
    "thumbnail": "fruitwar/images/bg_orange.png",
    "accent": "#27E1C1",
    "iconName": "Zap"
  },
  "p2ball": {
    "id": "p2ball",
    "title": "Physics Pinball",
    "subtitle": "Arcade",
    "path": "p2ball",
    "thumbnail": "p2ball/img/balls2.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "kupao": {
    "id": "kupao",
    "title": "Super Parkour Runner",
    "subtitle": "Runner",
    "path": "kupao",
    "thumbnail": "kupao/assets/MainMenu.jpg",
    "accent": "#FFD700",
    "iconName": "Zap"
  },
  "skeletonguard": {
    "id": "skeletonguard",
    "title": "Skeleton Tower Defense",
    "subtitle": "Strategy",
    "path": "skeletonguard",
    "thumbnail": "skeletonguard/assets/backgrounds/tower.png",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "magicplain": {
    "id": "magicplain",
    "title": "Classic Bomber Man",
    "subtitle": "Action",
    "path": "magicplain",
    "thumbnail": "magicplain/assets/tileset.png",
    "accent": "#B983FF",
    "iconName": "Zap"
  },
  "getthestarforyou": {
    "id": "getthestarforyou",
    "title": "Pluck Stars for You",
    "subtitle": "Casual",
    "path": "getthestarforyou",
    "thumbnail": "getthestarforyou/assets/images/menu.png",
    "accent": "#56CCF2",
    "iconName": "Gamepad2"
  },
  "eliminate": {
    "id": "eliminate",
    "title": "Hero Match-3",
    "subtitle": "Puzzle",
    "path": "eliminate",
    "thumbnail": "eliminate/assets/sprites/tiles.png",
    "accent": "#FF4D1A",
    "iconName": "Brain"
  },
  "plane": {
    "id": "plane",
    "title": "Retro Jet Fighter",
    "subtitle": "Shooter",
    "path": "plane",
    "thumbnail": "plane/assets/logo.jpg",
    "accent": "#F2994A",
    "iconName": "Crosshair"
  },
  "mota": {
    "id": "mota",
    "title": "Magic Tower Ascent",
    "subtitle": "RPG",
    "path": "mota",
    "thumbnail": "mota/assets/player.png",
    "accent": "#FF4D1A",
    "iconName": "Shield"
  },
  "dinosaur": {
    "id": "dinosaur",
    "title": "T-Rex Runner",
    "subtitle": "Arcade",
    "path": "dinosaur",
    "thumbnail": "dinosaur/assets/images/BG.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "bike": {
    "id": "bike",
    "title": "Bicycle Racing",
    "subtitle": "Racing",
    "path": "bike",
    "thumbnail": "bike/assets/MainMenu_bg.jpg",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "downfloor": {
    "id": "downfloor",
    "title": "Going Downstairs",
    "subtitle": "Arcade",
    "path": "downfloor",
    "thumbnail": "downfloor/assets/hero.png",
    "accent": "#56CCF2",
    "iconName": "Gamepad2"
  },
  "quitsmoke": {
    "id": "quitsmoke",
    "title": "Smoke Stopper",
    "subtitle": "Casual",
    "path": "quitsmoke",
    "thumbnail": "quitsmoke/assets/images/preloadbar.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "justshoot": {
    "id": "justshoot",
    "title": "Lakeside Shooters",
    "subtitle": "Shooter",
    "path": "justshoot",
    "thumbnail": "justshoot/assets/MainMenu_logo.png",
    "accent": "#FFD700",
    "iconName": "Crosshair"
  },
  "getogether": {
    "id": "getogether",
    "title": "Get Together",
    "subtitle": "Casual",
    "path": "getogether",
    "thumbnail": "getogether/assets/background.png",
    "accent": "#6B8CFF",
    "iconName": "Gamepad2"
  },
  "learn3": {
    "id": "learn3",
    "title": "Phaser 3 Playground",
    "subtitle": "Educational",
    "path": "learn3",
    "thumbnail": "learn3/assets/dude.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "memory": {
    "id": "memory",
    "title": "Card Memory Match",
    "subtitle": "Brain",
    "path": "memory",
    "thumbnail": "memory/assets/background2.png",
    "accent": "#56CCF2",
    "iconName": "Brain"
  },
  "prize": {
    "id": "prize",
    "title": "Lucky Wheel Spin",
    "subtitle": "Casual",
    "path": "prize",
    "thumbnail": "prize/assets/pin.png",
    "accent": "#6B8CFF",
    "iconName": "Gamepad2"
  },
  "maze": {
    "id": "maze",
    "title": "Labyrinth Escape",
    "subtitle": "Puzzle",
    "path": "maze",
    "thumbnail": "maze/assets/player.png",
    "accent": "#56CCF2",
    "iconName": "Brain"
  },
  "circlepath": {
    "id": "circlepath",
    "title": "Climb Higher",
    "subtitle": "Casual",
    "path": "circlepath",
    "thumbnail": "circlepath/assets/ball.png",
    "accent": "#F2994A",
    "iconName": "Gamepad2"
  },
  "flappybird": {
    "id": "flappybird",
    "title": "Classic Flappy Bird",
    "subtitle": "Arcade",
    "path": "flappybird",
    "thumbnail": "flappybird/assets/title.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "rhythm": {
    "id": "rhythm",
    "title": "Beat Master Rhythm",
    "subtitle": "Music",
    "path": "rhythm",
    "thumbnail": "rhythm/image/beijing0006.png",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "donottapwhitetile": {
    "id": "donottapwhitetile",
    "title": "Dont Tap The White Tile",
    "subtitle": "Arcade",
    "path": "donottapwhitetile",
    "thumbnail": "donottapwhitetile/assets/background.png",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "breaklovers": {
    "id": "breaklovers",
    "title": "Lovers Splitter",
    "subtitle": "Casual",
    "path": "breaklovers",
    "thumbnail": "breaklovers/assets/img/bg.png",
    "accent": "#B983FF",
    "iconName": "Gamepad2"
  },
  "candy": {
    "id": "candy",
    "title": "Feed the Candy Monster",
    "subtitle": "Casual",
    "path": "candy",
    "thumbnail": "candy/img/monster-cover.png",
    "accent": "#6B8CFF",
    "iconName": "Gamepad2"
  },
  "swordart": {
    "id": "swordart",
    "title": "Sword Art Arena",
    "subtitle": "RPG",
    "path": "swordart",
    "thumbnail": "swordart/js/assets/TitleBg0.gif",
    "accent": "#FFD700",
    "iconName": "Shield"
  },
  "getcoins3": {
    "id": "getcoins3",
    "title": "Gold Coins Collector",
    "subtitle": "Casual",
    "path": "getcoins3",
    "thumbnail": "getcoins3/assets/images/gold_bar.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "catapult": {
    "id": "catapult",
    "title": "Slingshot Catapult",
    "subtitle": "Arcade",
    "path": "catapult",
    "thumbnail": "catapult/assets/bg.jpg",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "jumpone": {
    "id": "jumpone",
    "title": "Jump and Hop",
    "subtitle": "Casual",
    "path": "jumpone",
    "thumbnail": "jumpone/assets/icons.png",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "2048": {
    "id": "2048",
    "title": "2048",
    "subtitle": "Puzzle",
    "path": "2048",
    "thumbnail": "2048/assets/logo.png",
    "accent": "#F2994A",
    "iconName": "Brain"
  },
  "lottery": {
    "id": "lottery",
    "title": "Animal Roulette Wheel",
    "subtitle": "Casual",
    "path": "lottery",
    "thumbnail": "lottery/assets/bg.jpg",
    "accent": "#27E1C1",
    "iconName": "Gamepad2"
  },
  "stardog": {
    "id": "stardog",
    "title": "Astral Space Dog",
    "subtitle": "Arcade",
    "path": "stardog",
    "thumbnail": "stardog/assets/dude.png",
    "accent": "#FF4D1A",
    "iconName": "Gamepad2"
  },
  "flappybird3": {
    "id": "flappybird3",
    "title": "Flappy Bird 3D",
    "subtitle": "Arcade",
    "path": "flappybird3",
    "thumbnail": "flappybird3/assets/title.png",
    "accent": "#F2994A",
    "iconName": "Gamepad2"
  },
  "learn": {
    "id": "learn",
    "title": "Phaser Demos",
    "subtitle": "Educational",
    "path": "learn",
    "thumbnail": "learn/assets/dude.png",
    "accent": "#FFD700",
    "iconName": "Gamepad2"
  },
  "randomdungeon": {
    "id": "randomdungeon",
    "title": "Dungeon Generator",
    "subtitle": "RPG",
    "path": "randomdungeon",
    "thumbnail": "randomdungeon/assets/player.png",
    "accent": "#F2994A",
    "iconName": "Shield"
  },
  "scaldfish": {
    "id": "scaldfish",
    "title": "Lantern Hangout",
    "subtitle": "Casual",
    "path": "scaldfish",
    "thumbnail": "scaldfish/assets/icon.jpg",
    "accent": "#7CFFB2",
    "iconName": "Gamepad2"
  },
  "runrobot": {
    "id": "runrobot",
    "title": "Run Robot Run",
    "subtitle": "Runner",
    "path": "runrobot",
    "thumbnail": "runrobot/assets/apple-touch-icon.png",
    "accent": "#7CFFB2",
    "iconName": "Zap"
  },
  "quickrush3": {
    "id": "quickrush3",
    "title": "Quick Rush Runner",
    "subtitle": "Runner",
    "path": "quickrush3",
    "thumbnail": "quickrush3/assets/images/rush-menu-scene.png",
    "accent": "#FF4D1A",
    "iconName": "Zap"
  },
  "legendofwolf": {
    "id": "legendofwolf",
    "title": "Legend of the Wolf",
    "subtitle": "Adventure",
    "path": "legendofwolf",
    "thumbnail": "legendofwolf/assets/images/menu-sprites2.png",
    "accent": "#FF4D1A",
    "iconName": "Shield"
  }
};
