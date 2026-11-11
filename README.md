# 🐺 Moonhollow Werewolf

A cute online Werewolf game to play during **Microsoft Teams** meetings.
Players talk on Teams. Secret roles, night choices and votes happen on their **phones**.

- **Two links:**
  - `https://…/` is the **player link**. It only has **Join a game**. Share it with everyone.
  - `https://…/admin.html` is the **admin link**, protected by a PIN. Keep it to yourself.
- **Moderator** (doesn't play): creates the room, deals roles and runs the game from a dashboard.
- **Players**: join with a 5-letter room code and their name. No accounts.
- **Admin can change the app's name, title, tagline and icon** (pick a character or upload a picture).
- **Music & sound effects**: spooky night music, cheerful day music, a wolf howl, morning bells, a verdict gong and win fanfares. Every phone has a 🔊 button that switches between *music + sounds → sounds only → muted*.
- **Free to host**: Firebase (database) + GitHub Pages (website).

---

## Try it first (no setup)

While `js/config.js` is empty, the app runs in **demo mode**: every browser tab is a separate player.

1. In this folder run `python3 -m http.server 8000` (or use the "Live Server" add-on in VS Code).
2. Open `http://localhost:8000/admin.html`, create an admin PIN and click **Create a new game**.
3. Click **Open player tab** a few times to add players, or **Add test bot**.
4. Play through a whole game.

---

## Put it online (about 15 minutes)

### 1. Create the Firebase project (free)
1. Go to <https://console.firebase.google.com> and click **Create a project**. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method →** turn on **Anonymous**.
3. **Build → Firestore Database → Create database**. Pick a location near you and choose **production mode**.
4. In Firestore, open the **Rules** tab. Paste in the whole `firestore.rules` file from this folder and click **Publish**.
   > **Updating the app?** Whenever `firestore.rules` changes (for example the wolf pack chat added rules), paste it in and **Publish** again, or the new feature will be blocked online.
   These rules stop players from peeking at other people's roles.
5. Click **Project settings (⚙️) → General → Your apps → `</>` Web**, register an app (no hosting needed), then copy the `firebaseConfig` values.
6. Paste them into **`js/config.js`**.

### 2. Host it on GitHub Pages (free)
1. Create a new **public** repository on GitHub, for example `werewolf`.
2. Upload every file in this folder: **Add file → Upload files**, drag everything in, then **Commit**.
3. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main` / `(root)` → **Save**.
4. After a minute, your game is live at `https://YOUR-USERNAME.github.io/werewolf/`.
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain →** `YOUR-USERNAME.github.io`.

> The Firebase web config is **meant** to be public. Your data is protected by the rules from step 1.4, not by hiding the key.

---

## Running a game in Teams

1. The moderator opens **admin.html** on a **laptop**. The first visitor ever creates the admin PIN; later devices type it once. Then click **Create a new game**.
2. Click **Copy invite for Teams** and paste it into the meeting chat.
3. Players open the link on their **phones**, type their name and pick a villager.
4. The moderator sets the **role mix** (werewolves, doctors, seers, an optional Jester), the **votes per player**, the **wolf kills per night**, the night timer and any **extra clues** (Village hunch, Rumors), then clicks **Deal secret roles**.
5. Follow the big button and read the 🎙️ script lines out loud:
   **Night** (everyone mutes and turns their camera off) → **Morning** → **Debate** (unmute on Teams) → **Vote** → **Verdict** → next night…
6. In **automatic mode** the app moves through every phase by itself. The admin page must stay **open** (it can be in the background) because it runs the game.
7. ⚠️ The moderator must **not share their screen**, because it shows every role. Keep the moderator tab open: it runs the game.

### The rules this app uses
| Rule | Setting |
|---|---|
| Roles | Moderator sets how many **werewolves (1–40)**, **doctors (0–12)**, **seers (0–12)** and an optional **Jester (0–1)**; everyone else is a villager. ✨ *Use suggested* fills in a good mix for the group size |
| 🤖 Automatic mode (on by default) | The app runs every phase by itself on timers the admin sets: **look at roles, night, morning news, debate, voting, verdict**, until someone wins. The moderator can still **⏸ pause, +30s or ⏭ skip**. With a planned player count the game even **starts itself** 10s after everyone joins. *End voting early* closes the vote once everyone has used all their votes. Turn it off to press every button yourself |
| Big groups (up to 200 players) | Every player gets their own face: 18 hand-drawn villagers plus hundreds of generated ones in the same style (the picker shows 24 at a time, *Show other villagers* for more). *Use suggested* scales the roles (about 1 wolf per 7 players). With more than 24 people to pick from, the night and vote screens get a name search. Note: the free Firebase plan allows 50,000 reads a day, which a 100-player game can use up; switch the project to the pay-as-you-go **Blaze** plan for big games (it costs a few cents per game) |
| Planned player count (optional) | Switch on **👥 Plan the player count** to set how many players you expect. You can then set the exact number of villagers too, and the game waits until that many have joined. Anyone extra becomes a villager |
| Dealing | 🎲 **Random**: the app shuffles all players and hands out the roles; nobody (not even the moderator) chooses. **Reshuffle roles** re-deals before night 1 |
| Several doctors | Each protects one person; anyone protected by any doctor survives. Each doctor can't protect the same person two nights in a row |
| Several seers | Each gets their own private peek every night |
| Wolf kills per night | Moderator picks 1 up to the number of wolves (in the lobby). Set it to the number of wolves for **one kill per wolf**. It never goes above the number of *living* wolves, so the pack loses a kill when a wolf is voted out |
| Wolves pick different victims | With 1 kill per night, the app picks one of their choices at random 🎲. With more, each different pick is attacked, up to the limit. Wolves who pick the same person only kill once |
| Doctor | Can protect themselves, but not the same person 2 nights in a row |
| Wolf chat | The werewolves get a private group chat on their phones, open while roles are shown and during the night, so they can agree who to visit. Only living wolves can write; the moderator can read along. It closes at sunrise, starts empty after every deal or reshuffle, and makes no sound (phones just buzz) so nobody gets caught on the call |
| Seer | One peek per night, learns "werewolf" or "not a werewolf" |
| Jester (optional) | On nobody's team. **Wins alone if the village votes them out**, which ends the game at once and everyone else loses. Killed by the wolves at night, they just lose. At night they tap a suspect like a villager, and the Seer sees them as "not a werewolf". Everyone can see in the lobby that a Jester is in the game |
| Villagers at night | Tap a "suspect", so nobody can tell who has powers |
| Death | The player's role is revealed to everyone |
| Votes per player | Moderator picks 1–3 (in the lobby, or before each vote). Each vote must go to a different person. |
| Tied vote | Nobody is out |
| 🤔 Village hunch (optional switch) | Each morning everyone sees who got the most "Who do you suspect?" taps last night (anonymous count) |
| 👁️ Survivor's glimpse (on by default) | When the doctor saves someone the wolves attacked, that person privately sees one true detail about how one of their attackers looks, like "the wolf wears glasses" or "has dark hair". It always fits several living players (about a third of them in a 27-player game, never everyone), so it narrows the hunt without naming the wolf. Shown on their phone through the morning and the debate. The moderator sees who got it |
| 🗝️ Rumors (optional switch) | Each morning one random living villager privately hears a true clue: "One of these 3 is a werewolf." Exactly one of the three is a wolf, and the listener is never in the list |
| Village wins | When every werewolf is gone |
| Wolves win | When there are as many wolves as other players (a living Jester counts as an other player) |
| Jester wins | When the village votes out the Jester |

---

## Files

```
index.html            the page
css/style.css         all the styling (night 🌙 / day ☀️ themes)
admin.html            the admin / moderator page (separate link)
js/app.js             screens + game flow (admin, moderator & player)
js/sound.js           generated background music + sound effects
js/game.js            pure rules: dealing roles, night results, votes, winner
js/art.js             every character and icon, drawn in code (SVG)
js/backend-firebase.js  online mode (Firebase)
js/backend-local.js   demo mode (browser tabs)
js/config.js          ← paste your Firebase settings here
firestore.rules       ← paste into Firebase → Firestore → Rules
assets/png/           PNG versions of all characters (512×512)
assets/svg/           SVG versions of all characters
tools/export-png.mjs  re-exports the PNGs after you change art.js
```

### Admin page (admin.html)
- **Start a game** / **Resume game**
- **Player link** with a copy button
- **App look**: name, small title, tagline and icon (12 characters, or **Upload** your own picture, which is cropped to a circle automatically). Click **Save look** and every player's page updates instantly, including the browser-tab icon.
- **Security**: change the PIN, or sign this device out of admin.
- Forgot the PIN? In Firebase → Firestore, delete the `app/secret` document, then open admin.html again to create a new one.

### Sound
All music and effects are generated live in the browser with the Web Audio API, so there are no audio files and nothing to license. Phones only play sound after the first tap (browser rule). Players should probably keep it on **sounds only** while talking on Teams.

### Customising
- **Add or change villagers:** edit the `AVATARS` list in `js/art.js`. Each one is a mix of hair, hat, eyes, mouth, shirt colour and so on.
- **Change role descriptions:** edit `ROLES` in `js/game.js`.
- **Change colours:** edit the variables at the top of `css/style.css`.
