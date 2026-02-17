/**
 * builder.service.ts
 * Phase 3 — Gang Sheet Builder persistence layer
 *
 * Manages builder projects, canvas items, and version snapshots.
 * All methods enforce owner isolation — callers must supply ownerId from
 * the authenticated session; the service never exposes another user's data.
 */

import { prisma } from '../lib/prisma';
import { BuilderProjectStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Input schemas (shared by service + future route layer)
// ---------------------------------------------------------------------------

export const canvasItemSchema = z.object({
  assetUrl: z.string().url(),
  xCm:      z.number(),
  yCm:      z.number(),
  widthCm:  z.number().positive(),
  heightCm: z.number().positive(),
  rotation: z.number().default(0),
  zIndex:   z.number().int().min(0),
  flipH:    z.boolean().default(false),
  flipV:    z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CanvasItemInput = z.infer<typeof canvasItemSchema>;

export const createProjectSchema = z.object({
  productId:      z.string().uuid(),
  title:          z.string().min(1).max(200).optional(),
  canvasWidthCm:  z.number().positive(),
  canvasHeightCm: z.number().positive(),
  items:          z.array(canvasItemSchema).default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  title:  z.string().min(1).max(200).optional(),
  status: z.enum(['DRAFT', 'READY', 'ARCHIVED'] as const).optional(),
  items:  z.array(canvasItemSchema).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new builder project for an owner.
 * Items are created in a single transaction to keep z_index consistent.
 */
export async function createProject(ownerId: string, input: CreateProjectInput) {
  const data = createProjectSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const project = await tx.gangSheetProject.create({
      data: {
        ownerId,
        productId:      data.productId,
        title:          data.title ?? 'Untitled Project',
        canvasWidthCm:  data.canvasWidthCm,
        canvasHeightCm: data.canvasHeightCm,
      },
    });

    if (data.items.length > 0) {
      await tx.gangSheetProjectItem.createMany({
        data: data.items.map((item) => ({
          projectId: project.id,
          assetUrl:  item.assetUrl,
          xCm:       item.xCm,
          yCm:       item.yCm,
          widthCm:   item.widthCm,
          heightCm:  item.heightCm,
          rotation:  item.rotation,
          zIndex:    item.zIndex,
          flipH:     item.flipH,
          flipV:     item.flipV,
          metadata:  (item.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      });
    }

    return getProjectWithItems(project.id, ownerId, tx as any);
  });
}

/**
 * Get a single project with its items, enforcing owner isolation.
 * Returns null if not found or owner mismatch.
 */
export async function getProject(id: string, ownerId: string) {
  return getProjectWithItems(id, ownerId, prisma);
}

/** Internal helper — accepts a transaction or the default prisma client. */
async function getProjectWithItems(
  id: string,
  ownerId: string,
  client: typeof prisma,
) {
  return client.gangSheetProject.findFirst({
    where: { id, ownerId },
    include: {
      items: { orderBy: { zIndex: 'asc' } },
    },
  });
}

/**
 * List all projects for an owner, most-recently-updated first.
 */
export async function listProjects(ownerId: string) {
  return prisma.gangSheetProject.findMany({
    where:   { ownerId },
    orderBy: { updatedAt: 'desc' },
    include: {
      items: { orderBy: { zIndex: 'asc' } },
    },
  });
}

/**
 * Update a project's title, status, and/or items.
 * When items are supplied the existing items are replaced atomically and a
 * version snapshot is saved before the replacement.
 */
export async function updateProject(
  id:      string,
  ownerId: string,
  input:   UpdateProjectInput,
) {
  const data = updateProjectSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    // Ownership check
    const project = await tx.gangSheetProject.findFirst({
      where:   { id, ownerId },
      include: { items: { orderBy: { zIndex: 'asc' } } },
    });

    if (!project) return null;

    // Save version snapshot before replacing items
    if (data.items !== undefined && project.items.length > 0) {
      await _saveVersionInTx(tx as any, project.id, project.items);
    }

    // Replace items if provided
    if (data.items !== undefined) {
      await tx.gangSheetProjectItem.deleteMany({ where: { projectId: id } });

      if (data.items.length > 0) {
        await tx.gangSheetProjectItem.createMany({
          data: data.items.map((item) => ({
            projectId: id,
            assetUrl:  item.assetUrl,
            xCm:       item.xCm,
            yCm:       item.yCm,
            widthCm:   item.widthCm,
            heightCm:  item.heightCm,
            rotation:  item.rotation,
            zIndex:    item.zIndex,
            flipH:     item.flipH,
            flipV:     item.flipV,
            metadata:  (item.metadata ?? {}) as Prisma.InputJsonValue,
          })),
        });
      }
    }

    // Update scalar fields
    const updateData: Record<string, unknown> = {};
    if (data.title  !== undefined) updateData.title  = data.title;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length > 0) {
      await tx.gangSheetProject.update({ where: { id }, data: updateData });
    }

    return getProjectWithItems(id, ownerId, tx as any);
  });
}

// ---------------------------------------------------------------------------
// Version snapshots
// ---------------------------------------------------------------------------

/**
 * Explicitly save a version snapshot of the current project state.
 * Version numbers auto-increment per project.
 */
export async function saveVersion(id: string, ownerId: string) {
  const project = await prisma.gangSheetProject.findFirst({
    where:   { id, ownerId },
    include: { items: { orderBy: { zIndex: 'asc' } } },
  });

  if (!project) return null;

  return _saveVersionInTx(prisma, project.id, project.items);
}

/** Internal: persist a version row, auto-incrementing versionNumber. */
async function _saveVersionInTx(
  client: typeof prisma,
  projectId: string,
  items: { assetUrl: string; xCm: number; yCm: number; widthCm: number; heightCm: number; rotation: number; zIndex: number; flipH: boolean; flipV: boolean; metadata: unknown }[],
) {
  const latest = await client.gangSheetProjectVersion.findFirst({
    where:   { projectId },
    orderBy: { versionNumber: 'desc' },
    select:  { versionNumber: true },
  });

  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  return client.gangSheetProjectVersion.create({
    data: {
      projectId,
      versionNumber: nextVersion,
      itemsSnapshot: items as any,
    },
  });
}

/**
 * List version history for a project (newest first), enforcing ownership.
 */
export async function getVersions(projectId: string, ownerId: string) {
  const project = await prisma.gangSheetProject.findFirst({
    where:  { id: projectId, ownerId },
    select: { id: true },
  });

  if (!project) return null;

  return prisma.gangSheetProjectVersion.findMany({
    where:   { projectId },
    orderBy: { versionNumber: 'desc' },
  });
}

/**
 * Restore a project to a specific version snapshot.
 * Current items are saved as a new version before rollback.
 */
export async function restoreVersion(
  projectId: string,
  versionId:  string,
  ownerId:    string,
) {
  return prisma.$transaction(async (tx) => {
    // Ownership check
    const project = await tx.gangSheetProject.findFirst({
      where:   { id: projectId, ownerId },
      include: { items: { orderBy: { zIndex: 'asc' } } },
    });

    if (!project) return null;

    const version = await tx.gangSheetProjectVersion.findFirst({
      where: { id: versionId, projectId },
    });

    if (!version) return null;

    // Save current state as a version before overwriting
    if (project.items.length > 0) {
      await _saveVersionInTx(tx as any, projectId, project.items);
    }

    // Replace items with snapshot
    await tx.gangSheetProjectItem.deleteMany({ where: { projectId } });

    const snapshot = version.itemsSnapshot as CanvasItemInput[];
    if (snapshot.length > 0) {
      await tx.gangSheetProjectItem.createMany({
        data: snapshot.map((item) => ({
          projectId,
          assetUrl:  item.assetUrl,
          xCm:       item.xCm,
          yCm:       item.yCm,
          widthCm:   item.widthCm,
          heightCm:  item.heightCm,
          rotation:  item.rotation,
          zIndex:    item.zIndex,
          flipH:     item.flipH,
          flipV:     item.flipV,
          metadata:  (item.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      });
    }

    return getProjectWithItems(projectId, ownerId, tx as any);
  });
}

/**
 * Soft-archive a project (keeps data, hides from active list).
 */
export async function archiveProject(id: string, ownerId: string) {
  const project = await prisma.gangSheetProject.findFirst({
    where:  { id, ownerId },
    select: { id: true },
  });

  if (!project) return null;

  return prisma.gangSheetProject.update({
    where: { id },
    data:  { status: BuilderProjectStatus.ARCHIVED },
  });
}
