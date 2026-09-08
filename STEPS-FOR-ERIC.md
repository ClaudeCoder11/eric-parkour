# 📖 READ ME FIRST — Eric's Guide to the Parkour Game

### 👋 This file is for YOU, Eric. Not for the AI.

`STEPS.md` (the other file) is the technical checklist. It's written in
programmer language, so it's confusing on purpose — it's basically the AI's
to-do list.

**This file explains the exact same plan in normal words.** Every time I use a
techy word, I explain it right there. There's also a dictionary at the bottom.

---

## 🎮 What we're building

A 3D parkour game like Minecraft parkour. You jump from block to block without
falling. It has:

- **5 levels**, each in a different biome (Plains, Snowy, Jungle, Badlands, Nether)
- **1 endless mode** that never stops and gets harder and harder
- Each level teaches you a **new trick** (ice, slime, pistons, potions…)
- It works on the **computer AND your phone**

---

## 💻 What language are we writing it in? (your question)

**JavaScript.** Here's why, in plain words:

JavaScript is the language web browsers speak. Chrome, Safari, Firefox — they
all understand it, and so does the browser on your phone. That means:

- ✅ Nobody has to install anything. You send a friend a link, they play.
- ✅ The SAME code works on a laptop and a phone. We don't write it twice.
- ✅ No app store, no waiting for approval, no $99 developer fee.

The other options we didn't pick:

| Language | Why not |
|---|---|
| **C# with Unity** | Unity is a giant program you have to install and learn. Getting it onto a phone is a whole extra project. |
| **Python** | Great language, but there's basically no good way to get a Python game onto a phone. |
| **Swift / Kotlin** | These make real iPhone/Android apps, but you'd write the game TWICE — once for each. Double the work. |

We're also using something called **Three.js**.

> **Three.js** = a free toolkit other people already wrote that handles the hard
> 3D math (where things are, what's in front of what, how to draw a cube). Without
> it we'd spend months writing that before you could even jump once. We downloaded
> a copy into the `lib` folder so the game works even with no internet.

---

## 🏗️ The plan, in normal words

### ✅ Step 1 — Get a picture on the screen (DONE)

Just prove we can draw a block and look at it. Boring but you can't skip it.

### ✅ Step 2 — Make the jumping feel EXACTLY like Minecraft (DONE — this was the big one)

This is the most important step in the whole project, so here's the deal:

In Minecraft, when you jump you go up **1.2522 blocks**. Not 1.2. Not 1.3.
That exact number is why you can hop onto a single block but can NEVER jump over
a fence (fences are 1.5 blocks tall — that's Mojang being sneaky on purpose).

And a **sprint jump goes exactly 4 blocks across.** Every Minecraft parkour map
ever made is built around that number.

So before building a single level, I copied Minecraft's real movement numbers in.
Then I wrote **19 tests** to prove they're right.

> **Test** = a tiny program that plays the game by itself and checks one fact,
> like "did the player clear a 4-block gap?" It answers PASS or FAIL. Computers
> are great at doing this a thousand times without getting bored.

You can run them yourself! Start the game (see below) and go to
**http://localhost:8100/tests.html**. Right now all 19 say PASS. Here are some:

- ✅ Jump goes up exactly 1.2522 blocks
- ✅ Sprint jump clears 4 blocks — but NOT 5
- ✅ Walking jump (no sprint) only clears 2 blocks
- ✅ You can't jump over a fence
- ✅ Jumping UP one block, you only reach 3 across instead of 4
- ✅ You can't jump up 2 blocks at all
- ✅ Ice makes you slide about 7× further than stone
- ✅ Slime blocks bounce you back up

**Why bother?** Because if I change something next month and accidentally break
jumping, these tests catch it instantly instead of me finding out after all 5
levels are already built wrong.

### 🔨 Step 3 — Blocks and how they look (mostly done)

Every block (grass, ice, slime, netherrack…) gets its **texture** drawn by code
when the game starts.

> **Texture** = the little picture painted on the side of a block. Minecraft's
> are 16×16 dots.

We do NOT use Minecraft's real picture files. Two reasons: they belong to Mojang,
and drawing our own with code means the whole game is tiny and needs zero
downloads. So there's a bit of code that says "grass is green with darker green
speckles" and it paints it fresh every time.

I also wrote a shortcut language for building levels, so instead of typing out
thousands of block positions I can write things like:

```
c.pad(3, 3);      // put down a 3×3 platform
c.gap(4);         // leave a 4-block gap  ← the big sprint jump
c.pad(3, 3);      // another platform
c.checkpoint();   // save point here
```

That's it. That's how the levels get made. Which means **you could build levels
too** — it's basically writing down the course.

### 🎮 Step 4 — Controls (built — still needs testing on your actual phone)

- **Computer:** WASD to move, Space to jump, Ctrl to sprint, mouse to look
- **Phone:** left thumb is a joystick, right side you drag to look, big JUMP button
- **V** switches between first-person (through your eyes) and third-person
  (camera behind you). Third person makes jumps way easier to judge — you picked
  having both, which was a good call.

### 🚩 Step 5 — Checkpoints and dying (done)

Fall in the void or touch lava → you respawn at the last checkpoint instead of
starting over. There's a timer, a death counter, and it remembers your best time.

> **Checkpoint** = a save point. Touch it and that becomes your new restart spot.

### ✅ Step 6 — The five levels (ALL FIVE ARE BUILT — go play them)

Each level teaches one new thing, then mixes it with everything before:

| Level | Where | What's new |
|---|---|---|
| 1 | **Plains** ✅ | The basics: 2-block jumps, sprint jumps, slabs, stairs, ladders, cobwebs, and a fence you can't jump |
| 2 | **Snowy Tundra** ✅ | **Ice!** You slide and can't stop. Packed ice, blue ice, powder snow |
| 3 | **Jungle** ✅ | **Slime blocks** bounce you. **Honey blocks** stick to you and slow you down. Vines to climb |
| 4 | **Badlands** ✅ | **Pistons** that shove you, and **neo jumps** — landing on the tiny side edge of a block. The hard one |
| 5 | **Nether Wastes** ✅ | Lava, magma blocks that burn you, soul sand that slows you, and **potions** — Speed, Jump Boost (you really do jump higher!), Slow Falling |

### ✅ Step 7 — Endless mode (built)

The game builds the course as you run, forever, and gets harder. Checkpoint every
10 platforms. The biome changes every 25 platforms.

It uses a **seed**, which means you can send a friend a number and they get the
*exact same* course you played. Then you can race.

> **Seed** = a starting number for the random-course-maker. Same seed in, same
> course out — same as Minecraft world seeds.

### ✅ Step 8 — Sounds and menus (built)

Jump sounds, landing sounds, slime *boing*, a title screen, and a level-picker
showing your best times.

All sounds are **made by code**, not recorded — again so we're not using Mojang's
files.

### 🛠️ Step 9 — A level editor (not built yet — optional, but I think you'd like it)

A page where you click to place blocks and build your OWN level, then save it.
Because of how Step 3 was set up, this is mostly easy. This would let you make
levels without writing any code at all.

### ⚡ Step 10 — Make it fast (not done yet)

Make sure it runs smoothly (60 **fps**) on your phone.

> **fps** = frames per second, how many pictures the game draws each second.
> 60 is smooth. 20 feels like a slideshow.

---

## ▶️ How to play it right now

**The whole game is playable right now.** Open Terminal, go to the game's
folder, and type:

```bash
python3 serve.py
```

Then open **http://localhost:8100** in your browser.

To play on your phone (same wifi), find your Mac's address by typing
`ipconfig getifaddr en0`, then on your phone go to `http://THAT-NUMBER:8100`
and turn the phone sideways.

To see the tests: **http://localhost:8100/tests.html** — all 26 pass right now.

### ⚠️ Why `serve.py` and not the usual command?

Browsers are sneaky: they save a copy of your code and reuse it. So you edit a
file, hit refresh, and the game runs the OLD version — which looks exactly like
"my change did nothing". `serve.py` is the normal server plus one instruction:
*never save a copy*. It cost me a confusing 10 minutes today, so it's fixed for
good now.

---

## 🎯 What's left

| Thing | Who |
|---|---|
| **Play it on your actual phone** and tell me what feels wrong | **You** — I can't hold a phone |
| Level editor (Step 9) so you can build your own levels | Me, if you want it |
| Ghost replay — race your best run | Me, if you want it |
| Install-to-home-screen (Step 10) | Me, if you want it |

Play the five levels first and tell me which jumps feel unfair. Now that the
physics are locked down and tested, changing a level is easy and safe.

---

## 📚 Jargon dictionary

Every confusing word from `STEPS.md`, explained:

| Word | What it actually means |
|---|---|
| **Physics** | The math for how you move, fall, and jump |
| **Tick** | One heartbeat of the game. Minecraft does 20 per second, and so do we |
| **20 TPS / fixed timestep** | The game thinks 20 times a second no matter what device it's on. Without this, a jump that works on the laptop might fail on the phone |
| **Interpolation** | Smoothing the picture between two heartbeats so it doesn't look jerky |
| **Constant** | A number that never changes, like gravity. Ours all live in one file so they're easy to find |
| **AABB** | "Axis-Aligned Bounding Box" — the invisible box around you that bumps into things. Yours is 0.6 wide and 1.8 tall, same as Steve |
| **Collision** | Working out when your box hits a block, so you don't walk through walls |
| **Swept collision** | Checking the whole path you moved through, not just where you ended up. Stops you tunneling through a wall when you're going fast |
| **Slipperiness / friction** | How slidey a block is. Stone is 0.6, ice is 0.98 (higher = slidier) |
| **Apex** | The very top of your jump |
| **Hitbox** | Same as AABB — your invisible collision box |
| **Texture** | The picture on a block's face |
| **Procedural** | Made by code instead of by hand. Our textures are procedural |
| **Atlas** | All the textures packed into one big image. Faster for the computer to draw |
| **Render / renderer** | Drawing the 3D scene onto the screen |
| **Mesh** | The 3D shape made of triangles that gets drawn |
| **InstancedMesh / batching** | Drawing 5,000 blocks in one go instead of 5,000 separate goes. Huge speed win |
| **Draw call** | One "hey graphics card, draw this" request. Fewer = faster |
| **JSON / data-driven** | Levels are stored as plain information, not code. So adding a level never means changing the game engine |
| **Module** | One file of code that does one job. We have separate ones for the player, the blocks, the camera… easier than one giant file |
| **ES modules / import map** | The modern way browsers load those files. It's why we need no build step |
| **Build step** | A program that packs your code before it runs. We deliberately have NONE — you just save the file and refresh |
| **localStorage** | A small box in your browser where the game saves your best times. Stays after you close the tab |
| **Pointer Lock** | Hides the mouse and lets it spin forever, so you can look around without hitting the edge of the screen |
| **Coyote time** | A tiny grace period where you can still jump *just after* running off an edge. Named after Wile E. Coyote running off cliffs. Minecraft doesn't have it; we added it to be nicer |
| **Jump buffering** | If you press jump slightly too early, the game remembers and jumps the moment you land |
| **Assist mode** | Coyote time + jump buffering turned on. Doesn't make jumps shorter — just more forgiving on timing |
| **Deterministic** | Same actions always give the exact same result. Needed for ghost replays and shared seeds |
| **Ghost replay** | A see-through copy of your best run that races you |
| **Seed** | The number that decides a random course. Same seed = same course |
| **PWA / service worker** | Tech that lets the game install onto your phone's home screen like a real app and work with no internet |
| **Frustum culling** | Not drawing stuff that's behind you. Free speed |
| **Vendored** | We saved our own copy of Three.js instead of downloading it every time. Works offline, and can't break if the website changes |
| **Repo / directory** | The project folder |
| **Cache** | A saved copy the browser keeps so pages load faster. Great normally, annoying when you're editing code — see the `serve.py` note above |
| **Chain (of jumps)** | Several jumps in a row with no room to rest. Harder than one jump, because you land slower than you took off |
| **Overshoot** | Jumping too far and landing past the platform. Real thing in this game: sprint-jumping a 2-block gap flies you right over a small platform |

---

## 💡 Some ideas I think would make it better

1. **Ghost replay** — race a see-through copy of your best run. Really fun, not much work.
2. **Par time** on each level — a target to beat, like golf.
3. **Assist mode ON by default** — you can switch it off when you want it strict.
4. **Shareable endless seeds** — send friends a number, race the same course.
5. **The level editor** (Step 9) — so you can build levels yourself.
6. **Test on your real phone early**, not at the end. Phone controls are where
   browser games usually fall apart.

---

## ⚠️ One important thing

This game uses **zero** Minecraft files — no textures, no sounds. Everything is
drawn and made by our own code. That's on purpose: those files belong to Mojang,
and copying them would be stealing.

So if you ever show this to anyone, call it a **"Minecraft-style"** parkour game,
not "Minecraft". Same idea, all our own work. 👍
