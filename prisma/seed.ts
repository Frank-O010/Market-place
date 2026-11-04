/**
 * Seed data for local development, tests and staging demos: a Nairobi category tree,
 * staff accounts, buyers, five sellers and about forty listings.
 *
 * Safe to re-run: it wipes and recreates demo data. Refuses to run against production.
 * Run with `pnpm db:seed`.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ListingCondition, type Role, type VerificationTier } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  throw new Error("Refusing to seed a production database. Set ALLOW_SEED=true if you really mean it.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const kes = (shillings: number) => shillings * 100;

const categories: { name: string; children: string[] }[] = [
  { name: "Phones & Tablets", children: ["Mobile Phones", "Tablets", "Accessories"] },
  { name: "Electronics", children: ["Laptops", "TVs", "Audio", "Gaming"] },
  { name: "Home & Furniture", children: ["Sofas", "Beds", "Kitchen", "Decor"] },
  { name: "Fashion", children: ["Women's Clothing", "Men's Clothing", "Shoes", "Bags"] },
  { name: "Baby & Kids", children: ["Strollers", "Toys", "Kids' Clothing"] },
  { name: "Sports & Outdoors", children: ["Bicycles", "Fitness", "Camping"] },
  { name: "Health & Beauty", children: ["Skincare", "Hair", "Fragrance"] },
  { name: "Books & Stationery", children: ["Textbooks", "Novels"] },
];

type SeedUser = {
  key: string;
  name: string;
  email: string;
  phone: string;
  roles: Role[];
  status?: "ACTIVE" | "SUSPENDED";
};

const users: SeedUser[] = [
  { key: "admin", name: "Achieng Admin", email: "admin@soko.test", phone: "+254700000001", roles: ["BUYER", "ADMIN"] },
  {
    key: "moderator",
    name: "Kamau Moderator",
    email: "moderator@soko.test",
    phone: "+254700000002",
    roles: ["BUYER", "MODERATOR"],
  },
  { key: "buyer", name: "Njeri Buyer", email: "buyer@soko.test", phone: "+254700000003", roles: ["BUYER"] },
  { key: "buyer2", name: "Otieno Buyer", email: "buyer2@soko.test", phone: "+254700000004", roles: ["BUYER"] },
  {
    key: "suspended",
    name: "Suspended User",
    email: "suspended@soko.test",
    phone: "+254700000005",
    roles: ["BUYER", "SELLER"],
    status: "SUSPENDED",
  },
  {
    key: "s_wanjiku",
    name: "Wanjiku Mwangi",
    email: "wanjiku@soko.test",
    phone: "+254711000001",
    roles: ["BUYER", "SELLER"],
  },
  {
    key: "s_baraka",
    name: "Baraka Ochieng",
    email: "baraka@soko.test",
    phone: "+254711000002",
    roles: ["BUYER", "SELLER"],
  },
  {
    key: "s_amina",
    name: "Amina Hassan",
    email: "amina@soko.test",
    phone: "+254711000003",
    roles: ["BUYER", "SELLER"],
  },
  {
    key: "s_kiprop",
    name: "Kiprop Kirui",
    email: "kiprop@soko.test",
    phone: "+254711000004",
    roles: ["BUYER", "SELLER"],
  },
  {
    key: "s_zawadi",
    name: "Zawadi Mutua",
    email: "zawadi@soko.test",
    phone: "+254711000005",
    roles: ["BUYER", "SELLER"],
  },
];

const sellers: {
  userKey: string;
  displayName: string;
  location: string;
  bio: string;
  tier: VerificationTier;
  rating: [number, number];
  badges: string[];
}[] = [
  {
    userKey: "s_wanjiku",
    displayName: "Wanjiku Electronics",
    location: "Westlands",
    bio: "Phones and laptops, all tested before sale.",
    tier: "BUSINESS_VERIFIED",
    rating: [470, 38],
    badges: ["top_seller"],
  },
  {
    userKey: "s_baraka",
    displayName: "Baraka Home Furnishings",
    location: "Industrial Area",
    bio: "Locally made sofas and beds. Delivery within Nairobi.",
    tier: "ID_VERIFIED",
    rating: [450, 21],
    badges: [],
  },
  {
    userKey: "s_amina",
    displayName: "Amina's Closet",
    location: "Eastleigh",
    bio: "Quality fashion at fair prices.",
    tier: "ID_VERIFIED",
    rating: [480, 64],
    badges: ["fast_shipper"],
  },
  {
    userKey: "s_kiprop",
    displayName: "Kiprop Sports",
    location: "Karen",
    bio: "Bikes, fitness gear and camping equipment.",
    tier: "PHONE_VERIFIED",
    rating: [420, 9],
    badges: [],
  },
  {
    userKey: "s_zawadi",
    displayName: "Zawadi Kids & Beauty",
    location: "Kilimani",
    bio: "Baby gear and skincare, gently used and new.",
    tier: "UNVERIFIED",
    rating: [0, 0],
    badges: [],
  },
];

type SeedListing = {
  seller: string;
  category: string;
  title: string;
  price: number;
  condition: ListingCondition;
  description: string;
  stock?: number;
};

const listings: SeedListing[] = [
  // Wanjiku Electronics
  {
    seller: "s_wanjiku",
    category: "Mobile Phones",
    title: "Samsung Galaxy A54 5G 128GB",
    price: 34_500,
    condition: "LIKE_NEW",
    description: "Used for 4 months, no scratches. Comes with box and charger.",
  },
  {
    seller: "s_wanjiku",
    category: "Mobile Phones",
    title: "iPhone 13 128GB Midnight",
    price: 62_000,
    condition: "GOOD",
    description: "Battery health 87%. Small mark on the frame.",
  },
  {
    seller: "s_wanjiku",
    category: "Mobile Phones",
    title: "Tecno Camon 20 Pro 256GB",
    price: 24_999,
    condition: "NEW",
    description: "Brand new, sealed, one-year warranty.",
    stock: 6,
  },
  {
    seller: "s_wanjiku",
    category: "Mobile Phones",
    title: "Infinix Hot 40i 128GB",
    price: 13_500,
    condition: "NEW",
    description: "Sealed in box. Dual SIM.",
    stock: 10,
  },
  {
    seller: "s_wanjiku",
    category: "Tablets",
    title: "iPad 9th Gen 64GB Wi-Fi",
    price: 38_000,
    condition: "LIKE_NEW",
    description: "Includes a protective case.",
  },
  {
    seller: "s_wanjiku",
    category: "Laptops",
    title: "HP EliteBook 840 G5, Core i5, 8GB, 256GB SSD",
    price: 42_000,
    condition: "GOOD",
    description: "Ex-UK. Windows 11 Pro installed, battery holds 4 hours.",
  },
  {
    seller: "s_wanjiku",
    category: "Laptops",
    title: "Lenovo ThinkPad T480, Core i7, 16GB",
    price: 55_000,
    condition: "GOOD",
    description: "Great for programming. Backlit keyboard.",
  },
  {
    seller: "s_wanjiku",
    category: "Audio",
    title: "JBL Flip 6 Bluetooth Speaker",
    price: 12_500,
    condition: "NEW",
    description: "Waterproof, 12-hour battery.",
    stock: 4,
  },
  {
    seller: "s_wanjiku",
    category: "Accessories",
    title: "Oraimo 20,000mAh Power Bank",
    price: 2_800,
    condition: "NEW",
    description: "Fast charging, two USB ports.",
    stock: 25,
  },
  {
    seller: "s_wanjiku",
    category: "TVs",
    title: 'Hisense 43" Smart TV (VIDAA)',
    price: 31_000,
    condition: "NEW",
    description: "Full HD, Netflix and YouTube built in.",
    stock: 3,
  },
  {
    seller: "s_wanjiku",
    category: "Gaming",
    title: "PlayStation 4 Slim 500GB + 2 controllers",
    price: 29_000,
    condition: "GOOD",
    description: "Comes with FIFA 23.",
  },
  // Baraka Home Furnishings
  {
    seller: "s_baraka",
    category: "Sofas",
    title: "5-seater L-shaped sofa, grey fabric",
    price: 48_000,
    condition: "NEW",
    description: "Made to order in 7 days. Free delivery within Nairobi.",
  },
  {
    seller: "s_baraka",
    category: "Sofas",
    title: "3-seater chesterfield sofa, brown leatherette",
    price: 36_500,
    condition: "NEW",
    description: "Hardwood frame, high-density foam.",
  },
  {
    seller: "s_baraka",
    category: "Beds",
    title: "5x6 mahogany bed with storage drawers",
    price: 42_000,
    condition: "NEW",
    description: "Solid mahogany. Mattress not included.",
  },
  {
    seller: "s_baraka",
    category: "Beds",
    title: "4x6 metal bed frame",
    price: 9_500,
    condition: "NEW",
    description: "Easy to assemble, black finish.",
    stock: 8,
  },
  {
    seller: "s_baraka",
    category: "Kitchen",
    title: "6-seater dining table set",
    price: 39_000,
    condition: "LIKE_NEW",
    description: "Glass top with six cushioned chairs.",
  },
  {
    seller: "s_baraka",
    category: "Decor",
    title: "Handwoven sisal rug, 5x7",
    price: 6_500,
    condition: "NEW",
    description: "Made by Machakos weavers.",
    stock: 5,
  },
  {
    seller: "s_baraka",
    category: "Kitchen",
    title: "Ramtons 2-burner gas cooker",
    price: 4_200,
    condition: "GOOD",
    description: "Works perfectly, moving house sale.",
  },
  // Amina's Closet
  {
    seller: "s_amina",
    category: "Women's Clothing",
    title: "Kitenge maxi dress, size M",
    price: 2_500,
    condition: "NEW",
    description: "Tailored in Nairobi. Other sizes on request.",
    stock: 6,
  },
  {
    seller: "s_amina",
    category: "Women's Clothing",
    title: "Denim jacket, size L",
    price: 1_800,
    condition: "LIKE_NEW",
    description: "Worn twice.",
  },
  {
    seller: "s_amina",
    category: "Men's Clothing",
    title: "Men's slim-fit suit, navy, 40R",
    price: 7_500,
    condition: "NEW",
    description: "Two-piece. Free alterations.",
  },
  {
    seller: "s_amina",
    category: "Shoes",
    title: "Nike Air Force 1, white, size 42",
    price: 6_000,
    condition: "LIKE_NEW",
    description: "Original, worn a few times.",
  },
  {
    seller: "s_amina",
    category: "Shoes",
    title: "Leather sandals, handmade, size 39",
    price: 1_500,
    condition: "NEW",
    description: "Maasai beadwork straps.",
    stock: 12,
  },
  {
    seller: "s_amina",
    category: "Bags",
    title: "Leather laptop bag, brown",
    price: 4_800,
    condition: "NEW",
    description: 'Fits up to 15.6" laptops.',
    stock: 4,
  },
  {
    seller: "s_amina",
    category: "Bags",
    title: "Kiondo woven basket bag",
    price: 1_200,
    condition: "NEW",
    description: "Traditional sisal with leather handles.",
    stock: 15,
  },
  {
    seller: "s_amina",
    category: "Men's Clothing",
    title: "Men's African print shirt, size XL",
    price: 1_900,
    condition: "NEW",
    description: "100% cotton.",
    stock: 7,
  },
  // Kiprop Sports
  {
    seller: "s_kiprop",
    category: "Bicycles",
    title: 'Mountain bike, 21-speed, 26" wheels',
    price: 18_000,
    condition: "GOOD",
    description: "Recently serviced, new brake pads.",
  },
  {
    seller: "s_kiprop",
    category: "Bicycles",
    title: "Kids' bicycle with training wheels, 16\"",
    price: 6_500,
    condition: "LIKE_NEW",
    description: "Suitable for ages 4 to 7.",
  },
  {
    seller: "s_kiprop",
    category: "Fitness",
    title: "Adjustable dumbbells set, 20kg",
    price: 7_800,
    condition: "NEW",
    description: "Pair, with carry case.",
    stock: 5,
  },
  {
    seller: "s_kiprop",
    category: "Fitness",
    title: "Yoga mat, 6mm",
    price: 1_400,
    condition: "NEW",
    description: "Non-slip, with strap.",
    stock: 20,
  },
  {
    seller: "s_kiprop",
    category: "Camping",
    title: "4-person dome tent",
    price: 8_500,
    condition: "GOOD",
    description: "Used on two trips to Hell's Gate.",
  },
  {
    seller: "s_kiprop",
    category: "Fitness",
    title: "Treadmill, foldable, 2HP",
    price: 45_000,
    condition: "GOOD",
    description: "Pickup in Karen or delivery at extra cost.",
  },
  // Zawadi Kids & Beauty
  {
    seller: "s_zawadi",
    category: "Strollers",
    title: "Chicco travel system stroller",
    price: 22_000,
    condition: "GOOD",
    description: "Includes car seat. Clean, all parts work.",
  },
  {
    seller: "s_zawadi",
    category: "Toys",
    title: "Wooden building blocks, 100 pieces",
    price: 2_200,
    condition: "NEW",
    description: "Non-toxic paint.",
    stock: 8,
  },
  {
    seller: "s_zawadi",
    category: "Kids' Clothing",
    title: "School uniform set, age 8",
    price: 2_000,
    condition: "NEW",
    description: "Sweater, shirt and shorts.",
  },
  {
    seller: "s_zawadi",
    category: "Skincare",
    title: "Shea butter body cream, 500ml",
    price: 950,
    condition: "NEW",
    description: "Made in Kenya, unscented.",
    stock: 30,
  },
  {
    seller: "s_zawadi",
    category: "Hair",
    title: "Braiding hair, 6 packs",
    price: 1_100,
    condition: "NEW",
    description: "Assorted colours.",
    stock: 20,
  },
  {
    seller: "s_zawadi",
    category: "Fragrance",
    title: "Oud perfume oil, 12ml",
    price: 1_800,
    condition: "NEW",
    description: "Long lasting.",
    stock: 10,
  },
  {
    seller: "s_zawadi",
    category: "Textbooks",
    title: "KCSE revision books bundle",
    price: 3_500,
    condition: "GOOD",
    description: "Maths, Chemistry and Biology.",
  },
  {
    seller: "s_zawadi",
    category: "Novels",
    title: "Ngũgĩ wa Thiong'o: The River Between",
    price: 650,
    condition: "GOOD",
    description: "Paperback, some highlighting.",
  },
];

// A few non-active listings so seller dashboards and moderation views have something to show.
const nonActive: Partial<Record<string, "DRAFT" | "PENDING_REVIEW" | "SOLD" | "PAUSED">> = {
  "Ramtons 2-burner gas cooker": "SOLD",
  "Denim jacket, size L": "DRAFT",
  "Treadmill, foldable, 2HP": "PAUSED",
  "Chicco travel system stroller": "PENDING_REVIEW",
};

async function main() {
  console.log("Clearing demo data…");
  // Order matters because of foreign keys.
  await db.auditLog.deleteMany();
  await db.moderationAction.deleteMany();
  await db.report.deleteMany();
  await db.notification.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.review.deleteMany();
  await db.dispute.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.payout.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.savedItem.deleteMany();
  await db.listingImage.deleteMany();
  await db.listingVariant.deleteMany();
  await db.listing.deleteMany();
  await db.category.deleteMany();
  await db.sellerProfile.deleteMany();
  await db.user.deleteMany();
  await db.platformSetting.deleteMany();

  console.log("Platform settings…");
  await db.platformSetting.createMany({
    data: [
      { key: "commission_bps", value: 1000 }, // 10%
      { key: "auto_release_days", value: 3 },
      { key: "launch_city", value: "Nairobi" },
      {
        key: "prohibited_items",
        value: [
          "Weapons",
          "Drugs and drug paraphernalia",
          "Counterfeit goods",
          "Stolen goods",
          "Live animals",
          "Alcohol and tobacco",
          "Prescription medicine",
          "Government IDs and documents",
        ],
      },
    ],
  });

  console.log("Categories…");
  const categoryIds = new Map<string, string>();
  for (const [i, top] of categories.entries()) {
    const parent = await db.category.create({ data: { name: top.name, slug: slugify(top.name), sortOrder: i } });
    categoryIds.set(top.name, parent.id);
    for (const [j, child] of top.children.entries()) {
      const c = await db.category.create({
        data: { name: child, slug: slugify(child), parentId: parent.id, sortOrder: j },
      });
      categoryIds.set(child, c.id);
    }
  }

  console.log("Users…");
  const userIds = new Map<string, string>();
  for (const u of users) {
    const created = await db.user.create({
      data: {
        authProviderId: `seed_${u.key}`,
        name: u.name,
        email: u.email,
        phone: u.phone,
        roles: u.roles,
        status: u.status ?? "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
      },
    });
    userIds.set(u.key, created.id);
  }

  console.log("Sellers…");
  const sellerIds = new Map<string, string>();
  for (const s of sellers) {
    const profile = await db.sellerProfile.create({
      data: {
        userId: userIds.get(s.userKey)!,
        displayName: s.displayName,
        slug: slugify(s.displayName),
        bio: s.bio,
        location: s.location,
        verificationTier: s.tier,
        ratingAverage: s.rating[0],
        ratingCount: s.rating[1],
        badges: s.badges,
        onboardedAt: new Date(),
      },
    });
    sellerIds.set(s.userKey, profile.id);
  }
  await db.sellerProfile.create({
    data: {
      userId: userIds.get("suspended")!,
      displayName: "Suspended Shop",
      slug: "suspended-shop",
      location: "Nairobi CBD",
    },
  });

  console.log("Listings…");
  const now = Date.now();
  for (const [i, l] of listings.entries()) {
    const seller = sellers.find((s) => s.userKey === l.seller)!;
    const status = nonActive[l.title] ?? "ACTIVE";
    await db.listing.create({
      data: {
        sellerId: sellerIds.get(l.seller)!,
        categoryId: categoryIds.get(l.category)!,
        title: l.title,
        slug: slugify(l.title).slice(0, 80),
        description: l.description,
        condition: l.condition,
        priceMinor: kes(l.price),
        stock: l.stock ?? 1,
        status,
        location: seller.location,
        // Spread publish times so "latest" ordering is stable and realistic.
        publishedAt: status === "ACTIVE" || status === "SOLD" ? new Date(now - i * 3_600_000) : null,
      },
    });
  }

  const counts = await Promise.all([
    db.user.count(),
    db.sellerProfile.count(),
    db.category.count(),
    db.listing.count(),
  ]);
  console.log(`Seeded ${counts[0]} users, ${counts[1]} sellers, ${counts[2]} categories, ${counts[3]} listings.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
