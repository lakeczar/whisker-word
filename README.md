# Whisker Word

Whisker Word is a phone-friendly hidden-word party game. One computer hosts the room, every player scans the same QR code, and each phone receives its own private card. Phones stay connected for later games, so players scan only once.

## Live deployment

Play at [whisker-word.cyan-candy.workers.dev](https://whisker-word.cyan-candy.workers.dev).

The website is hosted on Cloudflare Workers. Room state and custom word libraries use Cloudflare SQLite Durable Objects. This source repository is private, but the deployed game is public so players can open it without GitHub access or an account.

## What is included

- Private Good Kitten, Confused Kitten, and Spy Pup cards
- Host-only room controls that never expose the secret words
- Live room updates over WebSockets
- Official 4–8 player ratios and experimental 9–12 player ratios
- Six built-in categories with 120 original password pairs
- Reusable custom word libraries protected by a private recovery key
- Original Whisker Word kitten and puppy artwork
- Automatic room cleanup after 24 hours of inactivity

Clues, discussion, voting, and the Spy Pup's final guess happen aloud around the table.

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
| 9 | 5 | 3 | 1 | Experimental |
| 10 | 6 | 3 | 1 | Experimental |
| 11 | 6 | 4 | 1 | Experimental |
| 12 | 7 | 4 | 1 | Experimental |

## Privacy model

Room hosts receive player status and controls, but no role or word assignments. Player seats use separate random tokens, and each player endpoint returns only that player's secret. Custom libraries use a random recovery key instead of an account; losing that key means losing access to the library.

Ending a room deletes it immediately. Abandoned rooms are deleted after 24 hours of inactivity.
