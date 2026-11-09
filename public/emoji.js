// Team icon library for the Teams tab: classroom-friendly emoji grouped by theme, each with search words.
// Format: one string per emoji, "emoji words words". Any other emoji can still be pasted in.
const ICON_CATS = [
  ['Science', '🔬', [
    '🪨 rock stone granite boulder', '🌋 volcano lava eruption basalt', '💎 gem diamond crystal quartz mineral', '🔥 fire flame magma hot', '🧊 ice glacier cube cold',
    '🦴 bone fossil skeleton', '💧 water drop geyser', '🌊 wave ocean sea tide', '⛰️ mountain peak range', '🏔️ mountain snow summit', '🌍 earth globe planet world',
    '🌎 earth americas globe', '🌏 earth asia globe', '🪐 saturn planet ring space', '🌙 moon crescent night lunar', '☀️ sun solar day', '⭐ star', '🌟 star glow shine',
    '☄️ comet meteor asteroid', '🚀 rocket space launch', '🛰️ satellite orbit', '🔭 telescope astronomy', '🔬 microscope lab cell', '🧪 test tube chemistry experiment',
    '⚗️ flask alembic chemistry', '🧬 dna gene genetics', '🧫 petri dish bacteria culture', '⚛️ atom physics nucleus', '🧲 magnet magnetic force', '⚡ lightning electricity energy bolt',
    '🔋 battery power energy', '💡 idea light bulb', '🌡️ thermometer temperature heat', '🧭 compass direction north', '🌪️ tornado twister wind storm', '🌀 cyclone hurricane swirl',
    '🌈 rainbow light', '❄️ snowflake snow winter', '☁️ cloud weather', '⛈️ thunderstorm storm', '🌧️ rain', '🌫️ fog mist', '🏜️ desert canyon dune', '🏝️ island beach',
    '🌌 galaxy milky way space', '👽 alien ufo', '🛸 ufo flying saucer', '🧮 abacus math', '📐 ruler triangle geometry', '📏 ruler measure',
  ]],
  ['Animals', '🦊', [
    '🦊 fox', '🐺 wolf', '🐻 bear', '🐼 panda', '🐨 koala', '🐯 tiger', '🦁 lion', '🐮 cow', '🐷 pig', '🐸 frog', '🐵 monkey', '🦍 gorilla', '🐘 elephant', '🦒 giraffe',
    '🦓 zebra', '🦘 kangaroo', '🐴 horse', '🦄 unicorn', '🐺 wolves pack', '🦌 deer', '🐇 rabbit bunny', '🐿️ squirrel chipmunk', '🦔 hedgehog', '🦇 bat', '🐢 turtle',
    '🐍 snake', '🦎 lizard gecko', '🐊 crocodile alligator gator', '🦖 t rex dinosaur', '🦕 dinosaur brachiosaurus', '🐉 dragon', '🐲 dragon face', '🦅 eagle', '🦉 owl', '🦆 duck',
    '🦜 parrot', '🦚 peacock', '🐧 penguin', '🕊️ dove peace', '🐦 bird', '🐝 bee bumblebee', '🦋 butterfly', '🐞 ladybug', '🐜 ant', '🕷️ spider', '🦂 scorpion',
    '🐙 octopus', '🦑 squid', '🦈 shark', '🐬 dolphin', '🐳 whale', '🐟 fish', '🐠 tropical fish', '🦀 crab', '🦞 lobster', '🐚 shell', '🪼 jellyfish',
  ]],
  ['Nature', '🌻', [
    '🌻 sunflower flower', '🌹 rose', '🌷 tulip', '🌸 blossom cherry', '🌼 daisy', '🪻 lavender', '🌵 cactus desert', '🌴 palm tree', '🌲 evergreen pine tree', '🌳 tree oak',
    '🍀 clover luck four leaf', '🍁 maple leaf autumn fall', '🍂 leaves fallen', '🍃 leaf wind', '🌿 herb plant', '🌱 seedling sprout', '🍄 mushroom', '🪵 wood log', '🌾 wheat grain',
    '🪸 coral reef', '🌅 sunrise', '🌄 sunrise mountain', '🌠 shooting star', '🔆 bright sun', '🌋 volcano', '🏞️ park national', '🌐 globe network',
  ]],
  ['Food', '🍎', [
    '🍎 apple red', '🍏 apple green', '🍊 orange tangerine', '🍋 lemon', '🍌 banana', '🍉 watermelon', '🍇 grapes', '🍓 strawberry', '🫐 blueberry', '🍒 cherries', '🍑 peach',
    '🥭 mango', '🍍 pineapple', '🥥 coconut', '🥝 kiwi', '🍅 tomato', '🥑 avocado', '🌽 corn', '🥕 carrot', '🌶️ chili pepper hot', '🥨 pretzel', '🍕 pizza', '🍔 burger hamburger',
    '🌮 taco', '🌯 burrito', '🍟 fries', '🌭 hot dog', '🥪 sandwich', '🍿 popcorn', '🧀 cheese', '🥞 pancakes', '🍩 donut', '🍪 cookie', '🧁 cupcake', '🍰 cake', '🍦 ice cream',
    '🍫 chocolate', '🍬 candy', '🍭 lollipop', '🧇 waffle', '🥐 croissant', '☕ coffee', '🧋 boba bubble tea',
  ]],
  ['Sports & games', '⚽', [
    '⚽ soccer football', '🏀 basketball', '🏈 football', '⚾ baseball', '🥎 softball', '🎾 tennis', '🏐 volleyball', '🏉 rugby', '🥏 frisbee', '🏓 ping pong', '🏸 badminton',
    '🏒 hockey', '🥍 lacrosse', '⛳ golf', '🏹 archery', '🥊 boxing glove', '🥋 martial arts karate', '🛹 skateboard', '🛼 roller skate', '⛸️ ice skate', '🎿 ski', '🏂 snowboard',
    '🚴 bike cycling', '🏊 swim', '🏆 trophy winner champion', '🥇 gold medal first', '🥈 silver medal', '🥉 bronze medal', '🏅 medal', '🎯 target bullseye dart', '🎳 bowling',
    '🎮 video game controller', '🕹️ joystick arcade', '🧩 puzzle', '♟️ chess pawn', '🎲 dice', '🪁 kite', '🎪 circus', '🎈 balloon party',
  ]],
  ['Objects', '🎨', [
    '🎨 art palette paint', '🖌️ paintbrush', '✏️ pencil', '🖍️ crayon', '📚 books', '📖 book open', '📓 notebook', '🗺️ map', '🎸 guitar', '🎹 piano keyboard', '🥁 drum', '🎺 trumpet',
    '🎻 violin', '🎤 microphone', '🎧 headphones', '🎬 movie film', '📷 camera', '🔑 key', '🔔 bell', '📣 megaphone', '🛠️ tools build', '🔧 wrench', '⚙️ gear', '🧰 toolbox',
    '🪄 magic wand', '🔮 crystal ball', '👑 crown king queen', '🏰 castle', '⚓ anchor', '⛵ sailboat', '🚁 helicopter', '✈️ airplane plane', '🚂 train', '🚗 car', '🏎️ race car',
    '🚲 bicycle', '🛶 canoe', '⛺ tent camping', '🏠 house home', '🎁 gift present', '🧸 teddy bear', '🪀 yo-yo', '🪅 piñata', '🧢 cap hat', '🕶️ sunglasses cool', '🎩 top hat',
  ]],
  ['Symbols', '💯', [
    '💯 hundred perfect', '✅ check done', '✔️ check mark', '❤️ heart red love', '🧡 heart orange', '💛 heart yellow', '💚 heart green', '💙 heart blue', '💜 heart purple', '🖤 heart black',
    '🤍 heart white', '🤎 heart brown', '💥 boom collision', '✨ sparkles shine', '🔱 trident', '☮️ peace', '♾️ infinity', '❓ question', '❗ exclamation', '➕ plus', '➖ minus', '✖️ multiply',
    '➗ divide', '🔺 triangle red', '🔷 diamond blue', '🔶 diamond orange', '🟥 square red', '🟧 square orange', '🟨 square yellow', '🟩 square green', '🟦 square blue', '🟪 square purple',
    '⬛ square black', '🔴 circle red', '🟠 circle orange', '🟡 circle yellow', '🟢 circle green', '🔵 circle blue', '🟣 circle purple', '⚫ circle black', '⚪ circle white',
  ]],
  ['Faces', '😎', [
    '😀 grin happy', '😄 smile', '😁 beam', '😆 laugh', '😂 joy tears', '🙂 slight smile', '😉 wink', '😊 blush', '😍 heart eyes', '🤩 star struck wow', '😎 cool sunglasses', '🤓 nerd glasses',
    '🥳 party celebrate', '🤠 cowboy', '🥸 disguise', '🤖 robot', '👾 alien monster game', '👻 ghost', '💀 skull', '🎃 pumpkin halloween', '😺 cat smile', '🙌 hands raised hooray', '👏 clap',
    '💪 strong muscle flex', '🧠 brain smart', '👀 eyes', '🫡 salute', '🧙 wizard mage', '🦸 superhero hero', '🧑‍🚀 astronaut', '🧑‍🔬 scientist', '🧑‍🚒 firefighter', '🥷 ninja', '🧜 mermaid', '🧚 fairy',
  ]],
].map(([name, icon, list]) => ({ name, icon, items: list.map(s => { const i = s.indexOf(' '); return { e: s.slice(0, i), w: s.slice(i + 1) }; }) }));

// Emoji suggestions for a team name: words in the name matched against each emoji's search words.
function iconMatches(q, limit = 60) {
  const words = String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  if (!words.length) return [];
  const out = [], seen = new Set();
  for (const c of ICON_CATS) for (const it of c.items) {
    if (seen.has(it.e)) continue;
    const hay = ' ' + it.w + ' ';
    if (words.every(w => hay.includes(' ' + w) || hay.includes(w))) { seen.add(it.e); out.push(it.e); if (out.length >= limit) return out; }
  }
  return out;
}
