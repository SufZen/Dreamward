import type { FastifyInstance } from 'fastify';
import categoryRoutes from './categories';
import contentBlockRoutes from './contentBlocks';
import lifeVisionRoutes from './lifeVision';
import goalRoutes from './goals';
import journalRoutes from './journal';
import moodboardRoutes from './moodboards';
import assetRoutes from './assets';
import snapshotRoutes from './snapshots';
import llmRoutes from './llm';
import codexAuthRoutes from './codexAuth';
import agentRoutes from './agent';
import proposalRoutes from './proposals';
import actionRoutes from './actions';
import apiKeyRoutes from './apiKeys';
import agentApiRoutes from './agentApi';
import routineRoutes from './routines';
import chapterRoutes from './chapters';
import ratingRoutes from './ratings';
import ikigaiRoutes from './ikigai';
import portabilityRoutes from './portability';

/** Registers all authenticated feature routes (mounted under /api). */
export async function registerFeatureRoutes(app: FastifyInstance) {
  await app.register(categoryRoutes);
  await app.register(contentBlockRoutes);
  await app.register(lifeVisionRoutes);
  await app.register(goalRoutes);
  await app.register(journalRoutes);
  await app.register(moodboardRoutes);
  await app.register(assetRoutes);
  await app.register(snapshotRoutes);
  await app.register(llmRoutes);
  await app.register(codexAuthRoutes);
  await app.register(agentRoutes);
  await app.register(proposalRoutes);
  await app.register(actionRoutes);
  await app.register(apiKeyRoutes);
  await app.register(routineRoutes);
  await app.register(chapterRoutes);
  await app.register(ratingRoutes);
  await app.register(ikigaiRoutes);
  await app.register(portabilityRoutes);
}

/**
 * The /api/v1 agent surface (bearer API-key auth). A deliberate SUBSET of the
 * feature routes: no llm/codexAuth (provider secrets), no agent chat (SSE),
 * no proposals, no snapshots, no admin/auth/invites. Everything here is
 * tenant-scoped content CRUD + the agent-friendly markdown endpoints.
 */
export async function registerAgentApiRoutes(app: FastifyInstance) {
  await app.register(categoryRoutes);
  await app.register(contentBlockRoutes);
  await app.register(lifeVisionRoutes);
  await app.register(goalRoutes);
  await app.register(journalRoutes);
  await app.register(moodboardRoutes);
  await app.register(actionRoutes);
  await app.register(chapterRoutes);
  await app.register(ratingRoutes);
  await app.register(ikigaiRoutes);
  await app.register(agentApiRoutes);
}
