import type { WordPack } from "../shared/types";

/*
 * A good pair is close enough that a Confused Kitten does not notice at first,
 * yet different enough that clues start to drift apart: same category, shared
 * looks or uses, at least one clear difference. Avoid synonyms (Running /
 * Jogging) that no clue can tell apart, and opposites (Sun / Moon) that give
 * the game away on the first clue.
 */
type Pack = WordPack & { description: string };

function pack(id: string, name: string, description: string, pairs: [string, string][]): Pack {
  return { id, name, description, pairs: pairs.map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })) };
}

export const BUILT_IN_PACKS: Pack[] = [
  pack("food-drink", "Food & Drink", "Snacks, meals and what you sip", [
    ["Coffee", "Hot chocolate"], ["Pancake", "Waffle"], ["Ketchup", "Mustard"],
    ["Taco", "Burrito"], ["Cupcake", "Muffin"], ["Milkshake", "Smoothie"],
    ["Pizza", "Calzone"], ["Donut", "Bagel"], ["Popcorn", "Nachos"],
    ["Honey", "Maple syrup"], ["Spaghetti", "Ramen"], ["Ice cream", "Frozen yogurt"],
    ["Hot dog", "Corn dog"], ["Lemon", "Lime"], ["Peanut butter", "Nutella"],
    ["Cheesecake", "Tiramisu"], ["French fries", "Onion rings"], ["Salsa", "Guacamole"],
    ["Strawberry", "Raspberry"], ["Watermelon", "Pumpkin"], ["Sushi", "Dumplings"],
    ["Wine", "Beer"], ["Cereal", "Granola"], ["Soup", "Chili"],
  ]),
  pack("animals", "Animals", "Pets, wild things and creepy crawlies", [
    ["Lion", "Tiger"], ["Dolphin", "Shark"], ["Bee", "Butterfly"],
    ["Owl", "Bat"], ["Horse", "Zebra"], ["Wolf", "Fox"],
    ["Spider", "Scorpion"], ["Octopus", "Jellyfish"], ["Giraffe", "Camel"],
    ["Squirrel", "Raccoon"], ["Parrot", "Flamingo"], ["Snail", "Slug"],
    ["Panda", "Koala"], ["Cow", "Goat"], ["Hamster", "Guinea pig"],
    ["Elephant", "Rhino"], ["Peacock", "Turkey"], ["Eagle", "Vulture"],
    ["Gorilla", "Bear"], ["Frog", "Lizard"], ["Penguin", "Seal"],
    ["Kangaroo", "Rabbit"], ["Crab", "Lobster"], ["Ant", "Ladybug"],
  ]),
  pack("home", "Around the House", "Things you trip over at home", [
    ["Couch", "Bed"], ["Spoon", "Chopsticks"], ["Lamp", "Candle"],
    ["Fridge", "Oven"], ["Toothbrush", "Hairbrush"], ["Pillow", "Teddy bear"],
    ["Shower", "Bathtub"], ["Broom", "Mop"], ["Blanket", "Sleeping bag"],
    ["Mug", "Teapot"], ["Scissors", "Knife"], ["Umbrella", "Raincoat"],
    ["Stairs", "Elevator"], ["Washing machine", "Dishwasher"], ["Microwave", "Toaster"],
    ["TV remote", "Game controller"], ["Keys", "Wallet"], ["Sock", "Glove"],
    ["Tape", "Glue"], ["Bucket", "Trash can"], ["Mirror", "Picture frame"],
    ["Doorbell", "Smoke alarm"], ["Houseplant", "Vase of flowers"], ["Laptop", "Tablet"],
  ]),
  pack("places", "Places", "Where you go, and where you would rather not", [
    ["Airport", "Train station"], ["Library", "Bookstore"], ["Beach", "Swimming pool"],
    ["Restaurant", "Food truck"], ["Hotel", "Hospital"], ["Cinema", "Theater"],
    ["Stadium", "Concert hall"], ["Zoo", "Aquarium"], ["Bridge", "Tunnel"],
    ["Attic", "Basement"], ["Gym", "Spa"], ["Supermarket", "Mall"],
    ["Prison", "School"], ["Haunted house", "Graveyard"], ["Space station", "Submarine"],
    ["Volcano", "Glacier"], ["Lighthouse", "Windmill"], ["Casino", "Arcade"],
    ["Igloo", "Tent"], ["Playground", "Water park"], ["Castle", "Museum"],
    ["Desert", "Island"], ["Farm", "Vineyard"], ["Bakery", "Ice cream shop"],
  ]),
  pack("sports-hobbies", "Sports & Hobbies", "Games, pastimes and weekend plans", [
    ["Tennis", "Badminton"], ["Basketball", "Volleyball"], ["Swimming", "Surfing"],
    ["Painting", "Pottery"], ["Singing", "Whistling"], ["Camping", "Picnic"],
    ["Baking", "Grilling"], ["Fishing", "Kayaking"], ["Bowling", "Mini golf"],
    ["Yoga", "Meditation"], ["Skiing", "Sledding"], ["Chess", "Poker"],
    ["Knitting", "Sewing"], ["Baseball", "Golf"], ["Hide-and-seek", "Tag"],
    ["Boxing", "Wrestling"], ["Skateboarding", "Rollerblading"], ["Rock climbing", "Bungee jumping"],
    ["Archery", "Darts"], ["Jigsaw puzzle", "Crossword"], ["Video games", "Board games"],
    ["Karate", "Fencing"], ["Karaoke", "Dancing"], ["Soccer", "Hockey"],
  ]),
  pack("characters", "Characters & Fantasy", "Heroes, monsters and make-believe", [
    ["Superhero", "Wizard"], ["Pirate", "Ninja"], ["Robot", "Alien"],
    ["Vampire", "Zombie"], ["Dragon", "Dinosaur"], ["Mermaid", "Fairy"],
    ["Magician", "Clown"], ["Detective", "Bounty hunter"], ["King", "President"],
    ["Astronaut", "Scuba diver"], ["Ghost", "Skeleton"], ["Cowboy", "Knight"],
    ["Unicorn", "Pegasus"], ["Santa Claus", "Easter Bunny"], ["Witch", "Genie"],
    ["Werewolf", "Bigfoot"], ["Princess", "Ballerina"], ["Caveman", "Viking"],
    ["Mummy", "Scarecrow"], ["Tooth Fairy", "Sandman"], ["Elf", "Leprechaun"],
    ["Gladiator", "Samurai"], ["Mad scientist", "Evil villain"], ["Giant", "Troll"],
  ]),
  pack("jobs", "Jobs", "Who does what all day", [
    ["Doctor", "Dentist"], ["Firefighter", "Police officer"], ["Chef", "Waiter"],
    ["Pilot", "Bus driver"], ["Teacher", "Librarian"], ["Farmer", "Gardener"],
    ["Plumber", "Electrician"], ["Lifeguard", "Coach"], ["Photographer", "Painter"],
    ["Barber", "Tailor"], ["Judge", "Lawyer"], ["Vet", "Zookeeper"],
    ["Scientist", "Inventor"], ["Actor", "Comedian"], ["DJ", "Bartender"],
    ["Nurse", "Paramedic"], ["Architect", "Builder"], ["Mail carrier", "Garbage collector"],
    ["Astronomer", "Weather forecaster"], ["Cashier", "Bank teller"], ["Babysitter", "Dog walker"],
    ["Mechanic", "Carpenter"], ["News anchor", "YouTuber"], ["Hairdresser", "Makeup artist"],
  ]),
  pack("life-moments", "Life Moments", "Feelings, events and everyday chaos", [
    ["Sneeze", "Hiccup"], ["Snowman", "Sandcastle"], ["Rainbow", "Fireworks"],
    ["Hug", "High five"], ["Selfie", "Passport photo"], ["Text message", "Phone call"],
    ["Traffic jam", "Long line"], ["Sunburn", "Mosquito bite"], ["Alarm clock", "Rooster"],
    ["Homework", "Taxes"], ["First date", "Job interview"], ["Road trip", "Cruise"],
    ["Halloween", "Christmas"], ["Wedding", "Graduation"], ["Birthday party", "Baby shower"],
    ["Nightmare", "Scary movie"], ["Wi-Fi", "Electricity"], ["Sleepover", "Movie night"],
    ["Thunderstorm", "Earthquake"], ["Breakfast in bed", "Picnic in the park"], ["Moving house", "Spring cleaning"],
    ["Yawning", "Stretching"], ["Lottery ticket", "Fortune cookie"], ["Brain freeze", "Headache"],
  ]),
];
