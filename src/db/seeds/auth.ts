import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/db";
import {
  accounts,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@/db/schema/auth";
import { env } from "@/env";
import { PERMISSIONS, STARTER_ROLES } from "@/lib/permissions";

export async function seedAuth(db = defaultDb) {
  console.log("🌱 Seeding permissions catalog...");
  const permissionEntries = Object.values(PERMISSIONS).map((name) => ({
    name,
    description: `System permission for ${name}`,
  }));

  for (const perm of permissionEntries) {
    await db
      .insert(permissions)
      .values(perm)
      .onConflictDoNothing({ target: permissions.name });
  }

  console.log("🌱 Seeding 5 starter roles...");
  for (const roleDef of Object.values(STARTER_ROLES)) {
    await db
      .insert(roles)
      .values({
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      })
      .onConflictDoNothing({ target: roles.name });
  }

  // Fetch all inserted permissions and roles to map IDs
  const allDbPermissions = await db.select().from(permissions);
  const allDbRoles = await db.select().from(roles);

  const permissionMap = new Map(allDbPermissions.map((p) => [p.name, p.id]));
  const roleMap = new Map(allDbRoles.map((r) => [r.name, r.id]));

  console.log("🌱 Seeding role-permission mappings...");
  for (const [roleName, roleDef] of Object.entries(STARTER_ROLES)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;

    for (const permKey of roleDef.permissions) {
      const permissionId = permissionMap.get(permKey);
      if (!permissionId) continue;

      await db
        .insert(rolePermissions)
        .values({
          roleId,
          permissionId,
        })
        .onConflictDoNothing({
          target: [rolePermissions.roleId, rolePermissions.permissionId],
        });
    }
  }

  // Provision bootstrap administrator account if configured
  if (env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.log(
      `🌱 Provisioning bootstrap administrator (${env.BOOTSTRAP_ADMIN_EMAIL})...`,
    );

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, env.BOOTSTRAP_ADMIN_EMAIL))
      .limit(1);

    let adminUserId: string;

    if (existingUser.length > 0 && existingUser[0]) {
      adminUserId = existingUser[0].id;
    } else {
      const [insertedUser] = await db
        .insert(users)
        .values({
          name: "Administrator",
          email: env.BOOTSTRAP_ADMIN_EMAIL,
          emailVerified: true,
          role: "admin",
          isActive: true,
        })
        .returning();

      if (!insertedUser) {
        throw new Error("Failed to insert bootstrap admin user");
      }
      adminUserId = insertedUser.id;

      const hashedPassword = await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD);
      await db.insert(accounts).values({
        userId: adminUserId,
        accountId: adminUserId,
        providerId: "credential",
        password: hashedPassword,
      });
    }

    const superAdminRoleId = roleMap.get("super_admin");
    if (superAdminRoleId) {
      await db
        .insert(userRoles)
        .values({
          userId: adminUserId,
          roleId: superAdminRoleId,
        })
        .onConflictDoNothing({
          target: [userRoles.userId, userRoles.roleId],
        });
    }
  }

  console.log("✅ Auth and dynamic RBAC seeding completed.");
}

// Direct CLI execution
if (
  process.argv[1] &&
  import.meta.filename &&
  process.argv[1].endsWith("src/db/seeds/auth.ts")
) {
  seedAuth()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
