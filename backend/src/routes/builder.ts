/**
 * builder.ts
 * Phase 3 P3-02 — Builder API surface
 *
 * Routes:
 *   POST   /api/builder/projects               — create project
 *   GET    /api/builder/projects               — list owner's projects
 *   GET    /api/builder/projects/:id           — get single project
 *   PUT    /api/builder/projects/:id           — update project (items, title, status)
 *   POST   /api/builder/projects/:id/render-preview  — enqueue preview job
 *   GET    /api/builder/projects/:id/preview   — poll preview status
 *
 * All routes require a valid Supabase Bearer token (customer or admin).
 * Ownership is enforced inside the service layer (ownerId = authenticated user).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../lib/logger';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  saveVersion,
  createProjectSchema,
  updateProjectSchema,
} from '../services/builder.service';
import {
  enqueuePreviewJob,
  getLatestPreview,
} from '../services/builder-preview.service';
import { env } from '../lib/env';

// ---------------------------------------------------------------------------
// Auth helper — extracts userId from Bearer JWT (any authenticated user)
// ---------------------------------------------------------------------------

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

async function getUserId(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const auth  = request.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    reply.status(401).send({ message: 'Missing Bearer token' });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    reply.status(401).send({ message: 'Invalid or expired token' });
    return null;
  }

  return data.user.id;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function builderRoutes(app: FastifyInstance) {
  // ── POST /api/builder/projects ──────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const parseResult = createProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Invalid request body',
        errors:  parseResult.error.issues,
      });
    }

    try {
      const project = await createProject(ownerId, parseResult.data);
      return reply.status(201).send({ project });
    } catch (err: any) {
      logger.error({ error: err.message }, '[Builder] createProject failed');
      return reply.status(500).send({ message: 'Failed to create project' });
    }
  });

  // ── GET /api/builder/projects ───────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const projects = await listProjects(ownerId);
    return { projects };
  });

  // ── GET /api/builder/projects/:id ──────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const project = await getProject(id, ownerId);
    if (!project) return reply.status(404).send({ message: 'Project not found' });

    return { project };
  });

  // ── PUT /api/builder/projects/:id ──────────────────────────────────────
  app.put('/:id', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const parseResult = updateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Invalid request body',
        errors:  parseResult.error.issues,
      });
    }

    // Validate canvas geometry if items provided
    if (parseResult.data.items) {
      const invalid = parseResult.data.items.filter(
        (item) => item.widthCm <= 0 || item.heightCm <= 0,
      );
      if (invalid.length > 0) {
        return reply.status(400).send({
          message: 'Invalid item geometry: widthCm and heightCm must be positive',
        });
      }
    }

    const project = await updateProject(id, ownerId, parseResult.data);
    if (!project) return reply.status(404).send({ message: 'Project not found' });

    return { project };
  });

  // ── POST /api/builder/projects/:id/lock ────────────────────────────────
  // Marks project READY, saves an immutable version snapshot, returns versionId.
  // Called by frontend just before adding builder item to cart.
  app.post('/:id/lock', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    try {
      // Mark project as READY (idempotent if already READY)
      const project = await updateProject(id, ownerId, { status: 'READY' });
      if (!project) return reply.status(404).send({ message: 'Project not found' });

      // Save explicit version snapshot (captures current state at lock time)
      const version = await saveVersion(id, ownerId);
      if (!version) return reply.status(404).send({ message: 'Project not found' });

      return reply.status(200).send({ project, versionId: version.id });
    } catch (err: any) {
      logger.error({ error: err.message }, '[Builder] lockProject failed');
      return reply.status(500).send({ message: 'Failed to lock project' });
    }
  });

  // ── POST /api/builder/projects/:id/render-preview ──────────────────────
  app.post('/:id/render-preview', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const job = await enqueuePreviewJob(id, ownerId);
    if (!job) return reply.status(404).send({ message: 'Project not found' });

    return reply.status(202).send({
      jobId:  job.id,
      status: job.status,
      message: 'Preview render job enqueued',
    });
  });

  // ── GET /api/builder/projects/:id/preview ──────────────────────────────
  app.get('/:id/preview', async (request, reply) => {
    const ownerId = await getUserId(request, reply);
    if (!ownerId) return;

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const preview = await getLatestPreview(id, ownerId);
    if (!preview) return reply.status(404).send({ message: 'No preview found for this project' });

    return { preview };
  });
}
