const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("Admin@1234", 12);

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@truthlens.in" },
    update: {},
    create: {
      name: "TruthLens Admin",
      email: "admin@truthlens.in",
      passwordHash,
      role: "ADMIN",
      isVerified: true,
      bio: "Platform administrator",
    },
  });
  console.log("✅ Admin user:", admin.email);

  // Demo blogger
  const blogger = await prisma.user.upsert({
    where: { email: "priya@truthlens.in" },
    update: {},
    create: {
      name: "Priya Venkatesh",
      email: "priya@truthlens.in",
      passwordHash: await bcrypt.hash("Blogger@1234", 12),
      role: "BLOGGER",
      isVerified: true,
      bio: "Tech journalist covering AI and emerging technologies.",
    },
  });
  console.log("✅ Demo blogger:", blogger.email);

  // Demo blog
  const blog = await prisma.blog.upsert({
    where: { slug: "the-quiet-revolution-ai-farming" },
    update: {},
    create: {
      title: "The Quiet Revolution: How Farmers Are Using AI to Feed the World",
      slug: "the-quiet-revolution-ai-farming",
      excerpt: "Across rural India, a subtle transformation is underway...",
      content: `Across rural India, a subtle transformation is underway. Smallholder farmers armed with nothing but smartphones are accessing satellite data, soil diagnostics, and yield predictions.

The transformation began quietly, almost invisibly. Rural communities, historically on the periphery of technological progress, began to see the first signs of change not in grand infrastructure projects but in the smartphones that found their way into the hands of farmers.

What is remarkable is not the technology itself—AI systems for agriculture have existed in research settings for decades—but rather the infrastructure of access and translation that has finally made them viable for smallholder farmers.`,
      category: "TECHNOLOGY",
      subcategory: "AI",
      country: "INDIA",
      tags: ["AI", "Agriculture", "India", "Technology"],
      status: "PUBLISHED",
      publishedAt: new Date(),
      readTime: 7,
      authorId: blogger.id,
      sources: {
        create: [
          { title: "ICRISAT Annual Report 2025 — Digital Agriculture Division", order: 0 },
          { title: "Ministry of Agriculture — PM-KISAN Digital Initiative Report", order: 1 },
          { title: "Nature Food Journal — AI-Assisted Smallholder Farming Study", url: "https://nature.com", order: 2 },
        ],
      },
    },
  });
  console.log("✅ Demo blog:", blog.title);

  console.log("\n🎉 Seed complete!");
  console.log("Admin login:   admin@truthlens.in  /  Admin@1234");
  console.log("Blogger login: priya@truthlens.in  /  Blogger@1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
