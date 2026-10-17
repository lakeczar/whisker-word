# Whisker Word

Whisker Word is a phone-friendly hidden-word party game. The host sets up a room in three steps (table size, word packs, and whether they are playing too), every player scans the same QR code, and each phone receives its own private card. The host can run the room from a laptop or TV, or host and play on their own phone. Phones stay connected for later rounds, so players scan only once.

## Live deployment

Play at [whisker-word.cyan-candy.workers.dev](https://whisker-word.cyan-candy.workers.dev).

The website is hosted on Cloudflare Workers. Room state and custom word libraries use Cloudflare SQLite Durable Objects. This source repository is private, but the deployed game is public so players can open it without GitHub access or an account.

## What is included

- Private Good Kitten, Confused Kitten, and Spy Pup cards
- A setup wizard: a player-count slider that shows how many of each role will be dealt, then the word packs, then the host's choice to play
- Host and play from one phone, with host controls that never show the words or anyone's role during a round
- A guide on every card (peek, clue, vote) and an “I was voted out” button that shows that player's role to the whole table
- Role counts that update as players go out, and a call when the round is decided
- Official 4–8 player ratios and house ratios for 9–12 players
- Eight built-in packs with 192 hand-picked word pairs
- Reusable custom word libraries protected by a private recovery key
- Original Whisker Word kitten and puppy artwork
- Automatic room cleanup after 24 hours of inactivity

Clues, discussion, and voting happen aloud around the table. Anyone voted out taps “I was voted out”; a Spy Pup says a final guess aloud first, then sees the real word.

## Run locally

Requires Node.js 20 or newer and pnpm.

```powershell
pnpm install
pnpm test
pnpm dev --host 0.0.0.0
```

Open the address shown by Vite on the host computer. To test with a real phone, connect the computer and phone to the same Wi-Fi network and open the computer's LAN address shown by Vite. Windows may ask for permission to allow the local server through the firewall.

The normal game-night setup is the deployed website, which avoids local-network and firewall setup.

## Deploy to Cloudflare

The project uses Cloudflare Workers, static assets, and SQLite Durable Objects. A free Cloudflare account is sufficient for a small private game-night deployment.

```powershell
pnpm exec wrangler login
pnpm deploy
```

The first command opens Cloudflare's authorization page. The second builds and publishes the site to a `workers.dev` address.

## Game ratios

| Players | Good Kittens | Confused Kittens | Spy Pups | Mode |
| ---: | ---: | ---: | ---: | --- |
| 4 | 3 | 1 | 0 | Official |
| 5 | 3 | 1 | 1 | Official |
| 6 | 4 | 1 | 1 | Official |
| 7 | 4 | 2 | 1 | Official |
| 8 | 5 | 2 | 1 | Official |
| 9 | 5 | 3 | 1 | House |
| 10 | 6 | 3 | 1 | House |
| 11 | 6 | 4 | 1 | House |
| 12 | 7 | 4 | 1 | House |

The setup slider sets how many seats the room has. Cards are dealt for the players who have joined, so a host can deal early with fewer than planned.

A round is decided when every Confused Kitten and Spy Pup is out (the Kittens win, unless the Spy Pup guessed the word when they went out), or when only one Good Kitten is left (the impostors win).

## Privacy model

During a round, host controls receive player status, but no words and no roles except those of players who are already out, so a host who plays on the same phone is not spoiled. Each player endpoint returns only that player's own secret plus the public table. Both words and every role are sent to everyone once the host ends the round. Player seats use separate random tokens. Custom libraries use a random recovery key instead of an account; losing that key means losing access to the library.

Ending a room deletes it immediately. Abandoned rooms are deleted after 24 hours of inactivity.
