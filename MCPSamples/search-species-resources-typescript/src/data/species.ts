// Static species data

import { Species } from '../types.js';
import { encodeImage } from '../utils/imageEncoder.js';

export const SPECIES_DATA: Species[] = [
  {
    id: "monarch-butterfly",
    commonName: "Monarch Butterfly",
    scientificName: "Danaus plexippus",
    description: "The Monarch butterfly is famous for its distinctive orange and black wing pattern and its incredible multi-generational migration across North America.",
    habitat: "North America, with migration routes between Mexico/California and Canada/United States",
    diet: "Larvae feed exclusively on milkweed plants; adults feed on nectar from various flowers",
    conservationStatus: "Vulnerable",
    interestingFacts: [
      "Their migration can span up to 4,800 km (3,000 miles)",
      "It takes 3-4 generations to complete the full migration cycle",
      "Milkweed makes them toxic to most predators",
      "They use the Earth's magnetic field and sun position for navigation"
    ],
    tags: ["insect", "butterfly", "migration", "herbivore", "north-america", "endangered"],
    image: encodeImage("butterfly.png")
  },
  {
    id: "red-panda",
    commonName: "Red Panda",
    scientificName: "Ailurus fulgens",
    description: "The red panda is a small arboreal mammal native to the eastern Himalayas. Despite their name, red pandas are not closely related to giant pandas.",
    habitat: "Temperate forests in the Himalayas, at elevations between 2,200-4,800 meters",
    diet: "Primarily bamboo (95% of diet), but also eggs, birds, insects, and small mammals",
    conservationStatus: "Endangered",
    interestingFacts: [
      "They have a false thumb - an extended wrist bone that helps grip bamboo",
      "Red pandas sleep 17 hours a day, often in trees",
      "Their thick fur and bushy tail help them stay warm in cold mountain climates",
      "They use their tail for balance and as a blanket in cold weather"
    ],
    tags: ["mammal", "herbivore", "endangered", "asia", "himalaya", "arboreal", "cute"],
    image: encodeImage("red-panda.png")
  },
  {
    id: "blue-whale",
    commonName: "Blue Whale",
    scientificName: "Balaenoptera musculus",
    description: "The blue whale is the largest animal ever known to have lived on Earth, reaching lengths of up to 30 meters and weighing up to 200 tons.",
    habitat: "All major oceans worldwide, migrating between polar feeding grounds and tropical breeding areas",
    diet: "Primarily krill (tiny shrimp-like crustaceans), consuming up to 4 tons per day during feeding season",
    conservationStatus: "Endangered",
    interestingFacts: [
      "Their heart can weigh as much as a car and beat only 2 times per minute when diving",
      "Their calls can reach 188 decibels, louder than a jet engine",
      "A blue whale's tongue can weigh as much as an elephant",
      "They can live for 80-90 years in the wild"
    ],
    tags: ["mammal", "marine", "endangered", "carnivore", "ocean", "largest-animal"],
    image: encodeImage("blue-whale.png")
  },
  {
    id: "african-elephant",
    commonName: "African Elephant",
    scientificName: "Loxodonta africana",
    description: "The African elephant is the largest land animal on Earth, known for its intelligence, strong social bonds, and distinctive large ears that help regulate body temperature.",
    habitat: "Sub-Saharan Africa, including savannas, forests, deserts, and marshes",
    diet: "Herbivorous - grasses, leaves, bark, fruits, and roots (up to 300 pounds of vegetation daily)",
    conservationStatus: "Vulnerable",
    interestingFacts: [
      "They can weigh up to 6,000 kg (13,000 pounds) and stand up to 4 meters tall",
      "Their trunks contain over 40,000 muscles and can lift up to 350 kg",
      "Elephants are highly intelligent with excellent memory and self-awareness",
      "They communicate using infrasound frequencies below human hearing range"
    ],
    tags: ["mammal", "herbivore", "africa", "endangered", "largest-land-animal", "intelligent"]
  },
  {
    id: "snow-leopard",
    commonName: "Snow Leopard",
    scientificName: "Panthera uncia",
    description: "The snow leopard is a elusive big cat perfectly adapted to life in the harsh, cold mountains of Central Asia, with its thick fur and powerful build enabling it to hunt in extreme conditions.",
    habitat: "Mountain ranges of Central and South Asia, typically at elevations between 3,000-4,500 meters",
    diet: "Carnivorous - blue sheep, ibex, marmots, and other mountain mammals",
    conservationStatus: "Vulnerable",
    interestingFacts: [
      "Their thick fur and long tail help them survive temperatures as low as -40°C",
      "They can leap up to 15 meters in a single bound",
      "Snow leopards cannot roar, unlike other big cats",
      "Their wide paws act like natural snowshoes, distributing weight on snow"
    ],
    tags: ["mammal", "carnivore", "asia", "endangered", "mountain", "big-cat", "solitary"]
  }
];
