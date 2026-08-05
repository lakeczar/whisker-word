import type { WordPack } from "../shared/types";

export const BUILT_IN_PACKS: WordPack[] = [
  {
    id: "food-drink",
    name: "Food & Drink",
    pairs: [
      ["Coffee", "Tea"], ["Burger", "Sandwich"], ["Pancake", "Waffle"],
      ["Ketchup", "Mustard"], ["Pizza", "Lasagna"], ["Apple", "Pear"],
      ["Cookie", "Brownie"], ["Milkshake", "Smoothie"], ["Taco", "Burrito"],
      ["Popcorn", "Pretzel"], ["Cupcake", "Muffin"], ["Cereal", "Oatmeal"],
      ["Lemonade", "Iced tea"], ["Sushi", "Dumpling"], ["Soup", "Stew"],
      ["Chocolate", "Caramel"], ["Fries", "Tater tots"], ["Grapes", "Cherries"],
      ["Yogurt", "Pudding"], ["Cinnamon", "Nutmeg"],
    ].map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })),
  },
  {
    id: "animals-nature",
    name: "Animals & Nature",
    pairs: [
      ["Lion", "Tiger"], ["Frog", "Toad"], ["Eagle", "Hawk"],
      ["Dolphin", "Whale"], ["Rabbit", "Hare"], ["Turtle", "Tortoise"],
      ["Bee", "Wasp"], ["Owl", "Bat"], ["Shark", "Stingray"],
      ["Crocodile", "Alligator"], ["Rose", "Tulip"], ["River", "Stream"],
      ["Mountain", "Hill"], ["Rain", "Snow"], ["Forest", "Jungle"],
      ["Cactus", "Succulent"], ["Moon", "Sun"], ["Thunder", "Lightning"],
      ["Pebble", "Shell"], ["Pine", "Oak"],
    ].map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })),
  },
  {
    id: "places-travel",
    name: "Places & Travel",
    pairs: [
      ["Airport", "Train station"], ["Library", "Bookstore"], ["Hospital", "Clinic"],
      ["Museum", "Gallery"], ["Beach", "Pool"], ["Farm", "Ranch"],
      ["Castle", "Palace"], ["Restaurant", "Cafe"], ["School", "College"],
      ["Park", "Garden"], ["Hotel", "Resort"], ["Cinema", "Theater"],
      ["Bakery", "Deli"], ["Stadium", "Arena"], ["Zoo", "Aquarium"],
      ["Bridge", "Tunnel"], ["Kitchen", "Dining room"], ["Attic", "Basement"],
      ["Island", "Peninsula"], ["Campsite", "Cabin"],
    ].map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })),
  },
  {
    id: "objects-tech",
    name: "Objects & Technology",
    pairs: [
      ["Phone", "Tablet"], ["Laptop", "Desktop"], ["Spoon", "Fork"],
      ["Couch", "Armchair"], ["Lamp", "Flashlight"], ["Clock", "Watch"],
      ["Key", "Password"], ["Backpack", "Suitcase"], ["Pencil", "Pen"],
      ["Camera", "Binoculars"], ["Headphones", "Speaker"], ["Refrigerator", "Freezer"],
      ["Broom", "Vacuum"], ["Blanket", "Towel"], ["Mug", "Glass"],
      ["Hammer", "Screwdriver"], ["Button", "Zipper"], ["Mirror", "Window"],
      ["Battery", "Charger"], ["Umbrella", "Raincoat"],
    ].map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })),
  },
  {
    id: "activities-sports",
    name: "Activities & Sports",
    pairs: [
      ["Running", "Jogging"], ["Soccer", "Football"], ["Swimming", "Diving"],
      ["Painting", "Drawing"], ["Singing", "Humming"], ["Dancing", "Skating"],
      ["Camping", "Hiking"], ["Baking", "Cooking"], ["Reading", "Writing"],
      ["Fishing", "Boating"], ["Bowling", "Darts"], ["Yoga", "Stretching"],
      ["Gardening", "Farming"], ["Skiing", "Snowboarding"], ["Biking", "Scootering"],
      ["Chess", "Checkers"], ["Sewing", "Knitting"], ["Surfing", "Kayaking"],
      ["Baseball", "Cricket"], ["Hide-and-seek", "Tag"],
    ].map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })),
  },
  {
    id: "entertainment-life",
    name: "Entertainment & Everyday Life",
    pairs: [
      ["Movie", "TV show"], ["Guitar", "Piano"], ["Superhero", "Villain"],
      ["Magician", "Clown"], ["Puzzle", "Riddle"], ["Birthday", "Wedding"],
      ["Dream", "Nightmare"], ["Joke", "Prank"], ["Photo", "Video"],
      ["Newspaper", "Magazine"], ["Parade", "Festival"], ["Pirate", "Ninja"],
      ["Robot", "Alien"], ["Treasure", "Trophy"], ["Detective", "Reporter"],
      ["Costume", "Uniform"], ["Vacation", "Holiday"], ["Podcast", "Radio"],
      ["Alarm", "Reminder"], ["Secret", "Surprise"],
    ].map(([goodWord, confusedWord]) => ({ goodWord, confusedWord })),
  },
];
